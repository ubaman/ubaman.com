export const PACKAGES = Object.freeze({1:4000,3:9600,5:16000});
export const nowSeconds = () => Math.floor(Date.now()/1000);
const formatters=new Map();
export function localParts(seconds, zone) {
  if(!formatters.has(zone)) formatters.set(zone,new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
  return Object.fromEntries(formatters.get(zone).formatToParts(new Date(seconds*1000)).map(p=>[p.type,p.value]));
}
export function dayKey(seconds, zone) {
  const p=localParts(seconds,zone); return `${p.year}-${p.month}-${p.day}`;
}
// Resolve each local date separately; never assume a fixed UTC offset across DST.
export function candidates(env, now=nowSeconds()) {
  const days = new Set(env.DAYS.split(',').map(Number));
  const result=[];
  const today=dayKey(now,env.TIME_ZONE);
  const represented=p=>Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute))/1000;
  for(let d=0;d<=14;d++) {
    const midnight=Date.parse(today+'T00:00:00Z')/1000+d*86400;
    const date=new Date(midnight*1000),day=date.toISOString().slice(0,10);
    if(!days.has(date.getUTCDay())) continue;
    const noon=midnight+43200;
    const offset=noon-represented(localParts(noon,env.TIME_ZONE));
    for(let m=Number(env.START_HOUR)*60;m+60<=Number(env.END_HOUR)*60;m+=90) {
      const wall=midnight+m*60;
      let t=wall+offset;
      for(let i=0;i<2;i++) {const delta=wall-represented(localParts(t,env.TIME_ZONE));if(!delta)break;t+=delta;}
      if(t>=now+7200 && represented(localParts(t,env.TIME_ZONE))===wall) result.push({start:t,day});
    }
  }
  return result;
}
export function validateBooking(data, env, now=nowSeconds()) {
  const q=Number(data.quantity), amount=PACKAGES[q];
  if(!amount || !Array.isArray(data.slots) || data.slots.length!==q || new Set(data.slots).size!==q) throw new Error('Selecciona un horario diferente por cada sesión.');
  const allowed=new Map(candidates(env,now).map(s=>[s.start,s]));
  const slots=data.slots.map(t=>allowed.get(t));
  if(slots.some(s=>!s)) throw new Error('Un horario ya no está disponible. Actualiza el calendario.');
  const name=String(data.name||'').trim(), email=String(data.email||'').trim().toLowerCase();
  if(name.length<2 || name.length>100 || /[\r\n]/.test(name) || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Revisa tu nombre y correo electrónico.');
  return {quantity:q,amount,name,email,slots:slots.sort((a,b)=>a.start-b.start)};
}
export function checkoutBody(order, origin) {
  return new URLSearchParams({
    mode:'payment', customer_email:order.email, client_reference_id:order.id,
    'metadata[order_id]':order.id,
    'line_items[0][price_data][currency]':'usd',
    'line_items[0][price_data][unit_amount]':String(order.amount),
    'line_items[0][price_data][product_data][name]':`Coaching con Ubaman · ${order.quantity} sesión(es) de 60 minutos`,
    'line_items[0][quantity]':'1',
    // Immediate payment only: no asynchronous bank/voucher payments while holding slots.
    'payment_method_types[0]':'card',
    expires_at:String(order.expires),
    success_url:`${origin}/resultado.html#${order.token}`,
    cancel_url:`${origin}/resultado.html#${order.token}`
  }).toString();
}
export async function verifySignature(raw, header, secret, now=nowSeconds()) {
  if(!secret || !header) return false;
  const parts=header.split(',').map(x=>x.split('='));
  const t=parts.find(x=>x[0]==='t')?.[1];
  if(!/^\d+$/.test(t||'') || Math.abs(now-Number(t))>300) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const [type,sig] of parts) {
    if(type!=='v1' || !/^[0-9a-f]{64}$/.test(sig)) continue;
    const bytes=Uint8Array.from(sig.match(/../g),x=>parseInt(x,16));
    if(await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(`${t}.${raw}`))) return true;
  }
  return false;
}
export function matchesPayment(session, order) {
  return session.id===order.checkout_id && session.metadata?.order_id===order.id &&
    session.mode==='payment' && session.status==='complete' && session.payment_status==='paid' &&
    session.currency==='usd' && session.amount_total===order.amount;
}
const stamp=t=>new Date(t*1000).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
export function calendarFile(order,slots) {
  const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Ubaman//Coaching//ES','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  for(const s of slots) rows.push('BEGIN:VEVENT',`UID:${order.id}-${s.start}@ubaman.com`,`DTSTAMP:${stamp(order.created)}`,`DTSTART:${stamp(s.start)}`,`DTEND:${stamp(s.start+3600)}`,'SUMMARY:Coaching con Ubaman','DESCRIPTION:Sesion individual. El enlace de la llamada se enviara por correo.','END:VEVENT');
  return [...rows,'END:VCALENDAR',''].join('\r\n');
}
export function emailPayloads(order,slots,env) {
  const dates=slots.map(s=>new Intl.DateTimeFormat('es-MX',{timeZone:env.TIME_ZONE,dateStyle:'full',timeStyle:'short'}).format(new Date(s.start*1000))).join('\n');
  const attachment={filename:'sesiones-ubaman.ics',content:btoa(calendarFile(order,slots))};
  const common=`Reserva ${order.id}\n${order.quantity} sesión(es) de 60 minutos · USD ${(order.amount/100).toFixed(2)}\n${dates}\nZona horaria: ${env.TIME_ZONE}\n\nAdjuntamos las sesiones para añadirlas a tu calendario. El enlace para la llamada se enviará por correo antes de la sesión.`;
  return [
    {from:env.EMAIL_FROM,to:[order.email],reply_to:env.COACH_EMAIL,subject:'Tu coaching con Ubaman está confirmado',text:`Hola ${order.name},\n\nPago confirmado.\n${common}`,attachments:[attachment]},
    {from:env.EMAIL_FROM,to:[env.COACH_EMAIL],reply_to:order.email,subject:'Nueva reserva pagada · Ubaman',text:`Cliente: ${order.name}\nCorreo: ${order.email}\n${common}`,attachments:[attachment]}
  ];
}
