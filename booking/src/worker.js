import {PACKAGES,nowSeconds,candidates,validateBooking,checkoutBody,verifySignature,matchesPayment,calendarFile,emailPayloads} from './core.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const sql=(env,query,...args)=>env.DB.prepare(query).bind(...args);
const rows=async stmt=>(await stmt.all()).results;
function configured(env) {
  return env.BOOKING_ENABLED==='true' && ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY','EMAIL_FROM','COACH_EMAIL','ADMIN_TOKEN','TURNSTILE_SECRET_KEY','TURNSTILE_SITE_KEY','PUBLIC_ORIGIN','TIME_ZONE'].every(k=>env[k] && !env[k].includes('REPLACE'));
}
async function body(req) {
  const text=await req.text();
  if(text.length>12000) throw new Error('Solicitud demasiado grande.');
  return JSON.parse(text);
}
async function stripe(env,path,form,key) {
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{
    method:form?'POST':'GET',headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,...(form?{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':key}:{})},body:form,signal:AbortSignal.timeout(15000)
  });
  const data=await response.json();
  if(!response.ok) throw new Error(`Stripe ${response.status}`);
  return data;
}
async function ensureCheckout(env,order) {
  if(order.checkout_id) return stripe(env,`checkout/sessions/${order.checkout_id}`);
  // Reuse exactly the persisted body and idempotency key on every retry.
  const session=await stripe(env,'checkout/sessions',order.checkout_body,`booking-${order.id}`);
  await sql(env,"UPDATE orders SET checkout_id=?,checkout_url=?,status='pending',last_error=NULL WHERE id=? AND status='creating'",session.id,session.url,order.id).run();
  order.checkout_id=session.id;
  return session;
}
export async function settle(env,order,session) {
  if(matchesPayment(session,order)) {
    if(order.status==='expired' || order.status==='review') throw new Error('Payment needs manual review');
    const slots=await rows(sql(env,'SELECT start FROM slots WHERE order_id=? ORDER BY start',order.id));
    const payloads=emailPayloads(order,slots,env);
    await env.DB.batch([
      sql(env,"UPDATE orders SET status='paid',last_error=NULL WHERE id=? AND status IN ('creating','pending')",order.id),
      ...payloads.map((p,i)=>sql(env,'INSERT OR IGNORE INTO outbox(id,order_id,payload) VALUES(?,?,?)',`${order.id}-${i}`,order.id,JSON.stringify(p)))
    ]);
  } else if(session.id===order.checkout_id && session.status==='expired') {
    await env.DB.batch([
      sql(env,"UPDATE orders SET status='expired' WHERE id=? AND status IN ('creating','pending')",order.id),
      sql(env,"UPDATE slots SET active=0 WHERE order_id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status='expired')",order.id,order.id)
    ]);
  } else if(session.status==='complete') {
    // Do not release capacity or confirm a mismatched amount/currency.
    await sql(env,"UPDATE orders SET status='review',last_error='Payment mismatch' WHERE id=? AND status!='paid'",order.id).run();
  }
}
export async function reconcile(env) {
  if(!env.STRIPE_SECRET_KEY) return;
  const orders=await rows(sql(env,"SELECT * FROM orders WHERE status IN ('creating','pending') ORDER BY last_check LIMIT 10"));
  for(const order of orders) {
    try {
      // Never recreate a checkout after Stripe's 24-hour idempotency window.
      if(!order.checkout_id && nowSeconds()-order.created>23*3600) {
        await sql(env,"UPDATE orders SET status='review',last_error='Checkout recovery required' WHERE id=? AND status='creating'",order.id).run();
        continue;
      }
      await settle(env,order,await ensureCheckout(env,order));
    } catch {
      await sql(env,"UPDATE orders SET last_error='Stripe reconciliation failed' WHERE id=?",order.id).run();
    } finally { await sql(env,'UPDATE orders SET last_check=? WHERE id=?',nowSeconds(),order.id).run(); }
  }
}
export async function sendOutbox(env) {
  if(!env.RESEND_API_KEY) return;
  const messages=await rows(sql(env,"SELECT * FROM outbox WHERE status='pending' AND next_attempt<=? ORDER BY next_attempt LIMIT 10",nowSeconds()));
  for(const m of messages) {
    const now=nowSeconds();
    // Stop ambiguous retries before Resend's 24-hour deduplication window ends.
    if(m.first_attempt && now-m.first_attempt>23*3600) {
      await sql(env,"UPDATE outbox SET status='review',last_error='Check Resend delivery before retry' WHERE id=?",m.id).run(); continue;
    }
    const lock=await sql(env,"UPDATE outbox SET first_attempt=COALESCE(first_attempt,?),next_attempt=?,attempts=attempts+1 WHERE id=? AND status='pending' AND next_attempt<=?",now,now+600,m.id,now).run();
    if(!lock.meta.changes) continue;
    try {
      const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':m.id},body:m.payload,signal:AbortSignal.timeout(15000)});
      if(!r.ok) throw new Error(`Resend ${r.status}`);
      await sql(env,"UPDATE outbox SET status='sent',last_error=NULL WHERE id=?",m.id).run();
    } catch {
      await sql(env,"UPDATE outbox SET last_error='Email delivery retry pending',next_attempt=? WHERE id=?",now+Math.min(3600,300*2**Math.min(m.attempts,4)),m.id).run();
    }
  }
}
async function availability(env) {
  const available=candidates(env);
  const occupied=await rows(sql(env,'SELECT start,day FROM slots WHERE active=1 AND start>=?',nowSeconds()-5400));
  const blocked=new Set((await rows(sql(env,'SELECT day FROM blocked_days'))).map(x=>x.day));
  const counts=new Map(); occupied.forEach(s=>counts.set(s.day,(counts.get(s.day)||0)+1));
  return available.filter(s=>!blocked.has(s.day) && (counts.get(s.day)||0)<3 && !occupied.some(o=>o.start<s.start+5400 && o.start+5400>s.start));
}
async function turnstile(env,req,token) {
  if(typeof token!=='string' || token.length>2048) return false;
  const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:req.headers.get('CF-Connecting-IP')||undefined}),signal:AbortSignal.timeout(10000)});
  const result=await r.json();
  return result.success===true && result.hostname===new URL(env.PUBLIC_ORIGIN).hostname && result.action==='booking';
}
async function book(req,env) {
  if(!configured(env)) return json({error:'Las reservas nuevas todavía no están activas.'},503);
  const data=await body(req);
  let checked;
  try {checked=validateBooking(data,env);} catch(e) {return json({error:e.message},400);}
  if(!await turnstile(env,req,data.challenge)) return json({error:'Completa de nuevo la verificación de seguridad.'},400);
  const order={...checked,id:crypto.randomUUID(),token:crypto.randomUUID()+crypto.randomUUID(),created:nowSeconds(),expires:nowSeconds()+2100};
  order.checkout_body=checkoutBody(order,env.PUBLIC_ORIGIN);
  try {
    await env.DB.batch([
      sql(env,"INSERT INTO orders(id,token,name,email,amount,quantity,status,created,expires,checkout_body) VALUES(?,?,?,?,?,?,'creating',?,?,?)",order.id,order.token,order.name,order.email,order.amount,order.quantity,order.created,order.expires,order.checkout_body),
      ...order.slots.map(s=>sql(env,'INSERT INTO slots(order_id,start,day) VALUES(?,?,?)',order.id,s.start,s.day))
    ]);
  } catch {
    return json({error:'Alguno de los horarios acaba de ocuparse. Actualiza y elige otro.'},409);
  }
  try {
    const session=await ensureCheckout(env,order);
    return json({url:session.url,token:order.token});
  } catch {
    // Preserve locks after ambiguous network failures; reconciliation recovers Checkout.
    return json({token:order.token,pending:true},202);
  }
}
async function status(req,env) {
  const {token}=await body(req);
  if(typeof token!=='string' || token.length!==72) return json({error:'Reserva no encontrada.'},404);
  const order=await sql(env,'SELECT * FROM orders WHERE token=?',token).first();
  if(!order) return json({error:'Reserva no encontrada.'},404);
  const slots=await rows(sql(env,'SELECT start FROM slots WHERE order_id=? ORDER BY start',order.id));
  return json({status:order.status,url:order.status==='pending'?order.checkout_url:null,amount:order.amount,slots,zone:env.TIME_ZONE,calendar:order.status==='paid'?calendarFile(order,slots):null});
}
async function webhook(req,env,ctx) {
  const raw=await req.text();
  if(raw.length>1000000 || !await verifySignature(raw,req.headers.get('Stripe-Signature'),env.STRIPE_WEBHOOK_SECRET)) return json({error:'Invalid signature'},400);
  const event=JSON.parse(raw);
  if(['checkout.session.completed','checkout.session.expired','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type)) {
    const session=event.data.object;
    const order=await sql(env,'SELECT * FROM orders WHERE id=?',session.metadata?.order_id||'').first();
    if(order) {
      if(!order.checkout_id) await ensureCheckout(env,order);
      await settle(env,order,session);
      ctx.waitUntil(sendOutbox(env));
    }
  }
  return json({received:true});
}
async function admin(req,env) {
  if(!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length<32 || req.headers.get('Authorization')!==`Bearer ${env.ADMIN_TOKEN}`) return json({error:'Acceso no autorizado.'},401);
  if(req.method==='POST') {
    const data=await body(req);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data.day||'')) return json({error:'Fecha inválida.'},400);
    if(data.action==='block') await sql(env,'INSERT OR IGNORE INTO blocked_days(day) VALUES(?)',data.day).run();
    else if(data.action==='unblock') await sql(env,'DELETE FROM blocked_days WHERE day=?',data.day).run();
    else return json({error:'Acción inválida.'},400);
  }
  return json({
    orders:await rows(sql(env,"SELECT o.id,o.name,o.email,o.status,o.amount,o.last_error,s.start FROM orders o JOIN slots s ON s.order_id=o.id WHERE s.start>=? AND o.status!='expired' ORDER BY s.start LIMIT 100",nowSeconds()-86400)),
    blocked:await rows(sql(env,'SELECT day FROM blocked_days ORDER BY day')),
    mail:await rows(sql(env,"SELECT order_id,status,attempts,last_error FROM outbox WHERE status!='sent' LIMIT 50")),zone:env.TIME_ZONE
  });
}
export default {
  async fetch(req,env,ctx) {
    const url=new URL(req.url);
    if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if(url.pathname==='/api/webhook' && req.method==='POST') return await webhook(req,env,ctx);
      if(req.method==='POST' && req.headers.get('Origin')!==env.PUBLIC_ORIGIN) return json({error:'Origen no permitido.'},403);
      if(url.pathname==='/api/config' && req.method==='GET') return json({enabled:configured(env),packages:PACKAGES,zone:env.TIME_ZONE,siteKey:env.TURNSTILE_SITE_KEY});
      if(url.pathname==='/api/slots' && req.method==='GET') return json({slots:configured(env)?await availability(env):[]});
      if(url.pathname==='/api/book' && req.method==='POST') return await book(req,env);
      if(url.pathname==='/api/status' && req.method==='POST') return await status(req,env);
      if(url.pathname==='/api/admin' && ['GET','POST'].includes(req.method)) return await admin(req,env);
      return json({error:'No encontrado.'},404);
    } catch { return json({error:'No se pudo completar la solicitud. Inténtalo de nuevo.'},500); }
  },
  async scheduled(event,env,ctx) {ctx.waitUntil((async()=>{await reconcile(env);await sendOutbox(env);})());}
};
