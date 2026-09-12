(() => {
'use strict';
const $=id=>document.getElementById(id), canvas=$('arena'), ctx=canvas.getContext('2d');
const W=960,H=600,R=12, keys=new Set();
const attacks=[
 {name:'Lux · Láser',tip:'Sal de la línea antes del destello.',color:'#ffdf76'},
 {name:'Blitzcrank · Gancho',tip:'Un proyectil rápido hacia tu posición.',color:'#ffac50'},
 {name:'Ashe · Abanico',tip:'Busca un hueco entre las flechas.',color:'#70dbff'},
 {name:'Veigar · Meteorito',tip:'Abandona el círculo marcado.',color:'#c390ff'},
 {name:'Ahri · Orbe de regreso',tip:'Esquiva la ida y también la vuelta.',color:'#ff83bf'},
 {name:'Yasuo · Tornado',tip:'Un torbellino ancho cruza la arena.',color:'#83f2d2'}
];
let state='menu', time=0, lives=3, hazards=[], next=1, round=0, inv=0, flash=0, dashCd=0, dashTime=0, last=0;
let p={x:W/2,y:H/2}, target={...p}, best=0, selection='all', touchId=null;
try{best=Number(localStorage.getItem('ubaman-dodge-best-v1'))||0;}catch{}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function segmentDistance(x,y,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;
 const t=l?clamp(((x-ax)*dx+(y-ay)*dy)/l,0,1):0;
 return Math.hypot(x-ax-t*dx,y-ay-t*dy);
}
function score(){return Math.floor(time*10);}
function hud(){
 $('time').textContent=time.toFixed(1)+' s';$('score').textContent=score();
 $('lives').textContent='♥'.repeat(lives)+'♡'.repeat(3-lives);
 $('best').textContent=best;
 $('dash').textContent=dashCd>0?'IMPULSO · '+dashCd.toFixed(1)+' s':'IMPULSO · LISTO';
 $('dash').disabled=state!=='playing'||dashCd>0;
}
function panel(title,desc,button){
 $('panel-title').textContent=title;$('panel-desc').textContent=desc;$('play').textContent=button;
 $('overlay').hidden=false;$('play').focus();
}
function start(){
 selection=$('mode').value;state='playing';time=0;lives=3;hazards=[];next=1;round=0;inv=0;dashCd=0;dashTime=0;flash=0;
 p={x:W/2,y:H/2};target={...p};keys.clear();$('overlay').hidden=true;$('mode').disabled=true;
 $('pause').disabled=false;$('pause').textContent='PAUSAR';$('attack').textContent='Prepárate. Mira las señales del suelo.';
 canvas.focus();hud();
}
function finish(){
 state='over';keys.clear();if(selection==='all'&&score()>best){best=score();try{localStorage.setItem('ubaman-dodge-best-v1',String(best));}catch{}}
 $('mode').disabled=false;$('pause').disabled=true;
 panel('¡BUEN INTENTO!',time.toFixed(1)+' segundos · '+score()+' puntos. '+(selection==='all'?'Tu récord en mezcla: '+best+'.':'Modo práctica: no modifica tu récord.'),'VOLVER A JUGAR');hud();
}
function pause(){
 if(state==='playing'){state='paused';keys.clear();panel('RESPIRA.','La partida está pausada. Continúa cuando estés listo.','CONTINUAR');$('pause').textContent='CONTINUAR';}
 else if(state==='paused'){state='playing';$('overlay').hidden=true;$('pause').textContent='PAUSAR';canvas.focus();}
}
function dash(){if(state==='playing'&&dashCd<=0){dashTime=.16;dashCd=5;}}
function spawn(){
 const k=selection==='all'?round%6:Number(selection);round++;
 const edge=Math.floor(Math.random()*4),q=30+Math.random()*.9;
 let x,y;
 if(edge===0){x=20;y=30+Math.random()*(H-60);}
 if(edge===1){x=W-20;y=30+Math.random()*(H-60);}
 if(edge===2){x=30+Math.random()*(W-60);y=20;}
 if(edge===3){x=30+Math.random()*(W-60);y=H-20;}
 const a=Math.atan2(p.y-y,p.x-x);
 hazards.push({k,x,y,a,age:0,warn:k===0?1.1:.85,tx:p.x,ty:p.y, speed:(k===1?470:k===5?280:340)*(1+Math.min(time/160,.5)),color:attacks[k].color});
 $('attack').textContent=attacks[k].name+' — '+attacks[k].tip;
}
function hit(){if(inv>0||state!=='playing')return;lives--;inv=1.1;flash=.25;if(lives<=0)finish();}
function projectile(h,t,angle=h.a){
 let d=t*h.speed;
 if(h.k===4){const reach=760;d=t*h.speed<=reach?d:2*reach-d;}
 return {x:h.x+Math.cos(angle)*d,y:h.y+Math.sin(angle)*d};
}
function update(dt){
 time+=dt;inv=Math.max(0,inv-dt);flash=Math.max(0,flash-dt);dashCd=Math.max(0,dashCd-dt);dashTime=Math.max(0,dashTime-dt);
 let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0);
 let dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
 if(!dx&&!dy){dx=target.x-p.x;dy=target.y-p.y;}
 const len=Math.hypot(dx,dy),step=keys.size?(dashTime>0?800:270)*dt:Math.min(len,(dashTime>0?800:270)*dt);
 if(len){p.x=clamp(p.x+dx/len*step,R+8,W-R-8);p.y=clamp(p.y+dy/len*step,R+8,H-R-8);}
 if(keys.size)target={...p};
 next-=dt;if(next<=0){spawn();next=Math.max(.75,1.9-time/70);}
 for(const h of hazards){
 h.age+=dt;const t=h.age-h.warn;
 if(t<0)continue;
 if(h.k===0){
   if(t<.32&&segmentDistance(p.x,p.y,h.x,h.y,h.x+Math.cos(h.a)*1400,h.y+Math.sin(h.a)*1400)<R+16)hit();
   h.done=t>.42;
 }else if(h.k===3){
   if(t<.35&&Math.hypot(p.x-h.tx,p.y-h.ty)<R+65)hit();h.done=t>.48;
 }else{
   const angles=h.k===2?[-.48,-.24,0,.24,.48].map(d=>h.a+d):[h.a];
   for(const a of angles){
     const c=projectile(h,t,a),prev=projectile(h,Math.max(0,t-dt),a);
     if(segmentDistance(p.x,p.y,prev.x,prev.y,c.x,c.y)<R+(h.k===5?29:h.k===1?14:10))hit();
   }
   h.done=t>(h.k===4?1520/h.speed:1400/h.speed);
 }
 }
 hazards=hazards.filter(h=>!h.done);hud();
}
function circle(x,y,r,color,fill=true){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx[fill?'fillStyle':'strokeStyle']=color;ctx[fill?'fill':'stroke']();}
function line(x,y,bx,by,color,width){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(bx,by);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function draw(){
 ctx.clearRect(0,0,W,H);ctx.fillStyle='#0b1421';ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#203040';ctx.lineWidth=1;
 for(let x=0;x<W;x+=60)line(x,0,x,H,'#182b38',1);
 for(let y=0;y<H;y+=60)line(0,y,W,y,'#182b38',1);
 ctx.strokeStyle='#33515c';ctx.lineWidth=2;ctx.strokeRect(10,10,W-20,H-20);
 circle(W/2,H/2,105,'#203845',false);circle(W/2,H/2,6,'#33515c');
 for(const h of hazards){
   const t=h.age-h.warn,ex=h.x+Math.cos(h.a)*1400,ey=h.y+Math.sin(h.a)*1400;
   ctx.save();
   if(t<0){
     ctx.globalAlpha=.25+.3*(h.age/h.warn);ctx.setLineDash([12,10]);
     if(h.k===3){circle(h.tx,h.ty,65,h.color);ctx.setLineDash([]);circle(h.tx,h.ty,65*(h.age/h.warn),h.color,false);}
     else {const angles=h.k===2?[-.48,-.24,0,.24,.48].map(d=>h.a+d):[h.a];for(const a of angles)line(h.x,h.y,h.x+Math.cos(a)*1400,h.y+Math.sin(a)*1400,h.color,h.k===0?14:2);}
     ctx.setLineDash([]);circle(h.x,h.y,15,h.color);
   }else if(h.k===0){ctx.globalAlpha=Math.max(0,1-t/.42);line(h.x,h.y,ex,ey,h.color,32);line(h.x,h.y,ex,ey,'#fffce4',8);}
   else if(h.k===3){ctx.globalAlpha=Math.max(0,1-t/.48);circle(h.tx,h.ty,65,h.color);circle(h.tx,h.ty,65+t*70,h.color,false);}
   else{
     const angles=h.k===2?[-.48,-.24,0,.24,.48].map(d=>h.a+d):[h.a];
     for(const a of angles){
       const c=projectile(h,t,a);
       if(h.k===5){for(let j=0;j<4;j++){ctx.beginPath();ctx.ellipse(c.x,c.y-j*8,29-j*5,12, t*6,0,Math.PI*2);ctx.strokeStyle=h.color;ctx.lineWidth=3;ctx.stroke();}}
       else if(h.k===2){line(c.x-Math.cos(a)*25,c.y-Math.sin(a)*25,c.x,c.y,h.color,4);line(c.x,c.y,c.x-Math.cos(a-.6)*12,c.y-Math.sin(a-.6)*12,h.color,3);line(c.x,c.y,c.x-Math.cos(a+.6)*12,c.y-Math.sin(a+.6)*12,h.color,3);}
       else {if(h.k===1)line(h.x,h.y,c.x,c.y,'#876538',3);circle(c.x,c.y,h.k===1?14:10,h.color);circle(c.x,c.y,4,'#ffffff');}
     }
   }
   ctx.restore();
 }
 if(state==='playing'){circle(target.x,target.y,6,'#f6c84a',false);}
 ctx.save();ctx.globalAlpha=inv>0?.45+.35*Math.sin(time*35):1;
 ctx.shadowColor='#f6c84a';ctx.shadowBlur=18;circle(p.x,p.y,R+3,'#f6c84a');ctx.shadowBlur=0;
 circle(p.x,p.y,R,'#193442');
 // Stylized masked swordsman: original geometric avatar, with visible hitbox.
 ctx.fillStyle='#f3e0b8';ctx.fillRect(p.x-6,p.y-5,12,6);ctx.fillStyle='#172030';ctx.fillRect(p.x-7,p.y-1,14,6);
 line(p.x+9,p.y+5,p.x+19,p.y-18,'#d4eef9',3);circle(p.x,p.y,3,'#ffffff');ctx.restore();
 if(flash>0){ctx.fillStyle='rgba(255,65,96,.18)';ctx.fillRect(0,0,W,H);}
}
function frame(now){const dt=Math.min((now-last)/1000,.035)||0;last=now;if(state==='playing')update(dt);draw();requestAnimationFrame(frame);}
function point(e){const b=canvas.getBoundingClientRect();target={x:clamp((e.clientX-b.left)*W/b.width,20,W-20),y:clamp((e.clientY-b.top)*H/b.height,20,H-20)};}
canvas.addEventListener('pointerdown',e=>{if(state!=='playing')return;canvas.focus();point(e);if(e.pointerType!=='mouse'){touchId=e.pointerId;canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(state==='playing'&&(e.pointerType==='mouse'||e.pointerId===touchId))point(e);});
canvas.addEventListener('pointerup',()=>touchId=null);
canvas.addEventListener('pointercancel',()=>touchId=null);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
 if(e.target.matches('select,input,textarea'))return;
 const k=e.key.toLowerCase();if(k==='escape'&&(state==='playing'||state==='paused')){e.preventDefault();pause();return;}
 if(state!=='playing')return;
 if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)){e.preventDefault();if(k===' ')dash();else keys.add(k);}
});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>{if(state==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
$('play').addEventListener('click',()=>state==='paused'?pause():start());
$('pause').addEventListener('click',pause);$('dash').addEventListener('click',dash);
hud();requestAnimationFrame(frame);
})();