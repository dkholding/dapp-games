(function(V){'use strict';
// Carte napoletane disegnate a tracciati: nessuna immagine esterna.
const COL={D:'#b8860b',C:'#b3342b',S:'#2c5b8a',B:'#3e7a36'};
const FIG={8:'FANTE',9:'CAVALLO',10:'RE'};
const LETTERA={8:'F',9:'C',10:'R'};

V.tondo=function(c,x,y,w,h,r){
  c.beginPath(); c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
};

function simbolo(c,seme,x,y,r){
  c.save(); c.translate(x,y);
  c.lineWidth=Math.max(1,r*0.09); c.strokeStyle='#3a2a14'; c.fillStyle=COL[seme];
  if(seme==='D'){
    c.beginPath(); c.arc(0,0,r,0,Math.PI*2); c.fill(); c.stroke();
    c.strokeStyle='#f7e3a1';
    c.beginPath(); c.arc(0,0,r*0.62,0,Math.PI*2); c.stroke();
    c.beginPath();
    for(let i=0;i<8;i++){ const a=i*Math.PI/4; c.moveTo(0,0); c.lineTo(Math.cos(a)*r*0.45,Math.sin(a)*r*0.45); }
    c.stroke();
  } else if(seme==='C'){
    c.beginPath(); c.moveTo(-r*0.8,-r*0.75); c.lineTo(r*0.8,-r*0.75);
    c.quadraticCurveTo(r*0.75,r*0.1,r*0.12,r*0.25); c.lineTo(r*0.12,r*0.6); c.lineTo(r*0.5,r*0.9);
    c.lineTo(-r*0.5,r*0.9); c.lineTo(-r*0.12,r*0.6); c.lineTo(-r*0.12,r*0.25);
    c.quadraticCurveTo(-r*0.75,r*0.1,-r*0.8,-r*0.75); c.closePath(); c.fill(); c.stroke();
    c.fillStyle='#f7e3a1'; c.fillRect(-r*0.66,-r*0.7,r*1.32,r*0.13);
  } else if(seme==='S'){
    c.rotate(-0.5);
    c.beginPath(); c.moveTo(0,-r*1.05); c.lineTo(r*0.16,-r*0.8); c.lineTo(r*0.16,r*0.42);
    c.lineTo(-r*0.16,r*0.42); c.lineTo(-r*0.16,-r*0.8); c.closePath(); c.fill(); c.stroke();
    c.fillStyle='#b8860b'; c.fillRect(-r*0.55,r*0.4,r*1.1,r*0.16); c.strokeRect(-r*0.55,r*0.4,r*1.1,r*0.16);
    c.fillStyle='#6b3f1d'; c.fillRect(-r*0.1,r*0.56,r*0.2,r*0.44);
  } else {
    c.rotate(0.5);
    c.beginPath(); c.moveTo(-r*0.14,r); c.lineTo(-r*0.3,-r*0.8);
    c.quadraticCurveTo(0,-r*1.15,r*0.3,-r*0.8); c.lineTo(r*0.14,r); c.closePath(); c.fill(); c.stroke();
    c.fillStyle='#244a20';
    for(const [kx,ky] of [[-0.24,-0.35],[0.22,0.05],[-0.18,0.45]]){ c.beginPath(); c.arc(kx*r,ky*r,r*0.1,0,Math.PI*2); c.fill(); }
  }
  c.restore();
}

// id null = dorso. luce: 0 nessuna, 1 prendibile, 2 presa scelta.
V.disegnaCarta=function(c,id,x,y,w,h,op){
  const r=(op&&op.r)||0, luce=(op&&op.luce)||0, rad=w*0.1;
  c.save(); c.translate(x,y); c.rotate(r);
  c.fillStyle='rgba(0,0,0,.28)'; V.tondo(c,-w/2+w*0.03,-h/2+w*0.05,w,h,rad); c.fill();
  if(luce){ c.shadowColor=luce===2?'#ffe08a':'#ffcf5a'; c.shadowBlur=luce===2?24:12; }
  V.tondo(c,-w/2,-h/2,w,h,rad);
  if(id){
    c.fillStyle='#f6efdc'; c.fill(); c.shadowColor='transparent'; c.shadowBlur=0;
    c.lineWidth=luce?3:1; c.strokeStyle=luce?'#e0a82e':'#8a7a58'; c.stroke();
    const v=V.carta.valore(id), s=V.carta.seme(id), fig=FIG[v], et=LETTERA[v]||String(v);
    c.fillStyle=COL[s]; c.font=`700 ${Math.round(h*0.17)}px Georgia,serif`;
    c.textAlign='left'; c.textBaseline='top';
    c.fillText(et,-w/2+w*0.09,-h/2+h*0.05);
    c.save(); c.rotate(Math.PI); c.fillText(et,-w/2+w*0.09,-h/2+h*0.05); c.restore();
    if(fig){
      c.textAlign='center'; c.textBaseline='middle';
      c.font=`600 ${Math.round(Math.min(h*0.085,w*0.13))}px Georgia,serif`; c.fillText(fig,0,-h*0.1);
      simbolo(c,s,0,h*0.16,w*0.2);
    } else simbolo(c,s,0,h*0.02,w*0.26);
    if(op&&op.spenta){ V.tondo(c,-w/2,-h/2,w,h,rad); c.fillStyle='rgba(20,30,25,.45)'; c.fill(); }
  } else {
    const asp=V.aspettoCarte;
    c.fillStyle=asp?asp.dorso:'#6b1e24'; c.fill(); c.shadowColor='transparent'; c.shadowBlur=0;
    c.lineWidth=1; c.strokeStyle='#2a0c0e'; c.stroke();
    V.tondo(c,-w/2+w*0.08,-h/2+w*0.08,w-w*0.16,h-w*0.16,rad*0.6);
    c.strokeStyle=asp?asp.filo:'#d8b262aa'; c.stroke();
    c.save(); c.clip(); c.globalAlpha=0.3; c.beginPath();
    const passo=w*0.2;
    for(let k=-h;k<w+h;k+=passo){ c.moveTo(-w/2+k,-h/2); c.lineTo(-w/2+k-h,h/2); c.moveTo(-w/2+k-h,-h/2); c.lineTo(-w/2+k,h/2); }
    c.stroke(); c.restore();
  }
  c.restore();
};
})(globalThis.V=globalThis.V||{});
