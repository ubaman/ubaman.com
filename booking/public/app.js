const $=id=>document.getElementById(id), form=$('booking');
let config,available=[],selected=new Set(),challenge='',widget,busy=false;
const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
const quantity=()=>Number(form.elements.quantity.value);
const fmt=t=>new Intl.DateTimeFormat('es-MX',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(new Date(t*1000));
async function api(path,body){const r=await fetch('/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo cargar.');return d;}
function render(){
  $('total').textContent=`$${config.packages[quantity()]/100} USD`;
  $('saving').textContent=quantity()===1?'Pago único.':'20% de descuento incluido · $32 USD por sesión.';
  $('count').textContent=`${selected.size} de ${quantity()} horarios seleccionados`;
  $('selected').replaceChildren(...[...selected].sort((a,b)=>a-b).map(t=>{const li=document.createElement('li');li.textContent=fmt(t);return li;}));
  $('pay').disabled=busy || !config.enabled || selected.size!==quantity() || !challenge;
  $('slots').replaceChildren();
  const groups=new Map();
  available.forEach(s=>{const key=new Intl.DateTimeFormat('es-MX',{timeZone:zone,dateStyle:'full'}).format(new Date(s.start*1000));if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);});
  for(const [day,slots] of groups){const section=document.createElement('div');section.className='day';const h=document.createElement('h3');h.textContent=day;const times=document.createElement('div');times.className='times';for(const s of slots){const b=document.createElement('button');b.type='button';b.className='time';b.textContent=new Intl.DateTimeFormat('es-MX',{timeZone:zone,timeStyle:'short'}).format(new Date(s.start*1000));b.setAttribute('aria-label',fmt(s.start));b.setAttribute('aria-pressed',String(selected.has(s.start)));b.disabled=busy||(!selected.has(s.start)&&selected.size>=quantity());b.onclick=()=>{selected.has(s.start)?selected.delete(s.start):selected.add(s.start);render();};times.append(b);}section.append(h,times);$('slots').append(section);}
}
async function refresh(){available=(await api('slots')).slots;selected=new Set([...selected].filter(t=>available.some(s=>s.start===t)));render();$('notice').textContent=config.enabled?(available.length?'Elige tus fechas. Los horarios se muestran en tu zona horaria.':'No hay horarios disponibles ahora. Vuelve a consultar más tarde.'):'Estamos preparando este calendario. Las reservas actuales siguen disponibles desde la página de coaching.';}
form.elements.quantity.forEach(r=>r.addEventListener('change',()=>{selected.clear();render();}));
$('refresh').onclick=()=>refresh().catch(e=>$('notice').textContent=e.message);
form.onsubmit=async e=>{e.preventDefault();if(busy || selected.size!==quantity() || !challenge)return;busy=true;render();$('notice').textContent='Comprobando tus horarios…';try{const data=await api('book',{quantity:quantity(),slots:[...selected],name:form.elements.name.value,email:form.elements.email.value,challenge});location.assign(data.url||('/resultado.html#'+data.token));}catch(e){$('notice').textContent=e.message;busy=false;challenge='';if(widget!==undefined)turnstile.reset(widget);await refresh().catch(()=>{});$('notice').textContent=e.message;render();}};
(async()=>{try{config=await api('config');$('timezone').textContent=`Zona horaria: ${zone}`;await refresh();if(config.enabled){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=()=>{widget=turnstile.render('#challenge',{sitekey:config.siteKey,action:'booking',callback:token=>{challenge=token;render();},'expired-callback':()=>{challenge='';render();},'error-callback':()=>{challenge='';render();}});};document.head.append(script);}}catch(e){$('notice').textContent='No se pudo cargar el calendario. Inténtalo más tarde.';}})();
