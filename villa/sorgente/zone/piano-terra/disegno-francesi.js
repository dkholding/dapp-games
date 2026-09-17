(function(V){'use strict';
// Carte francesi per Scala 40 e Burraco, disegnate a tracciati. Il dorso è lo stesso delle napoletane.
const GLIFO={C:'♥',Q:'♦',F:'♣',P:'♠'};
const ROSSO=s=>s==='C'||s==='Q';

V.disegnaCartaFrancese=function(c,id,x,y,w,h,op){
  if(!id) return V.disegnaCarta(c,null,x,y,w,h,op);
  const F=V.francese, r=(op&&op.r)||0, luce=(op&&op.luce)||0, rad=w*0.1, sel=op&&op.selezionata;
  c.save(); c.translate(x,y); c.rotate(r);
  c.fillStyle='rgba(0,0,0,.28)'; V.tondo(c,-w/2+w*0.03,-h/2+w*0.05,w,h,rad); c.fill();
  if(luce||sel){ c.shadowColor=sel?'#7fd3ff':'#ffcf5a'; c.shadowBlur=sel?16:12; }
  V.tondo(c,-w/2,-h/2,w,h,rad);
  c.fillStyle='#fbf8f1'; c.fill(); c.shadowColor='transparent'; c.shadowBlur=0;
  c.lineWidth=sel?3:luce?3:1; c.strokeStyle=sel?'#3aa7e0':luce?'#e0a82e':'#9a9384'; c.stroke();
  if(F.jolly(id)){
    c.fillStyle='#7a2fa0'; c.textAlign='center'; c.textBaseline='middle';
    c.font=`700 ${Math.round(w*0.2)}px Georgia,serif`;
    c.save(); c.translate(-w*0.3,0); c.rotate(-Math.PI/2); c.fillText('JOLLY',0,0); c.restore();
    c.font=`${Math.round(w*0.46)}px Georgia,serif`; c.fillStyle='#d8962b'; c.fillText('★',w*0.08,0);
  } else {
    const s=F.seme(id), n=F.nome(id), col=ROSSO(s)?'#c0262d':'#1d2530';
    c.fillStyle=col; c.textAlign='center'; c.textBaseline='top';
    const fs=Math.round(h*0.17);
    // angolo in alto a sinistra: valore e seme uno sotto l'altro (visibile anche quando le carte si sovrappongono)
    c.font=`700 ${fs}px Georgia,serif`; c.fillText(n,-w/2+w*0.17,-h/2+h*0.04);
    c.font=`${Math.round(fs*0.95)}px Georgia,serif`; c.fillText(GLIFO[s],-w/2+w*0.17,-h/2+h*0.04+fs);
    c.textBaseline='middle';
    if(/[JQK]/.test(n)){
      c.strokeStyle=col; c.lineWidth=1.5; V.tondo(c,-w*0.2,-h*0.28,w*0.56,h*0.56,4); c.stroke();
      c.font=`700 ${Math.round(h*0.26)}px Georgia,serif`; c.fillText(n,w*0.08,-h*0.04);
      c.font=`${Math.round(h*0.14)}px Georgia,serif`; c.fillText(GLIFO[s],w*0.08,h*0.17);
    } else {
      c.font=`${Math.round(h*0.34)}px Georgia,serif`; c.fillText(GLIFO[s],w*0.1,h*0.06);
    }
  }
  if(op&&op.spenta){ V.tondo(c,-w/2,-h/2,w,h,rad); c.fillStyle='rgba(20,30,25,.45)'; c.fill(); }
  c.restore();
};
})(globalThis.V=globalThis.V||{});
