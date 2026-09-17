(function(V){'use strict';
// Il mondo da girare, visto dall'alto: stanze, muri, vetrate, mare, tavoli, avventori.
// La mappa arriva dalla zona; il mondo non sa nulla dei giochi.
const ORA=()=>performance.now();
const RAGGIO=14, VELOCITA=240, VICINO=56;
const PELLE=['#f1c9a5','#d9a47a','#a8744f','#7a4f31','#f5d6b8'];
V.COLORI_ABITO=['#c8342c','#2f6fb0','#3e8a4f','#8a4fb0','#d8962b','#2b9a9a','#333a44','#b0476f'];

// ---- motivi dei pavimenti (disegnati una volta) ---------------------------
const motivi={};
function motivo(ctx,tipo){
  if(motivi[tipo]) return motivi[tipo];
  const c=document.createElement('canvas'), g=c.getContext('2d');
  const disegni={
    marmo:()=>{ c.width=c.height=80; g.fillStyle='#e9e4da'; g.fillRect(0,0,80,80); g.fillStyle='#cfc7b8'; g.fillRect(0,0,40,40); g.fillRect(40,40,40,40);
      g.strokeStyle='#b9ae9a55'; g.lineWidth=1; g.beginPath(); g.moveTo(5,30); g.bezierCurveTo(20,20,30,45,60,35); g.stroke(); },
    marmoScuro:()=>{ c.width=c.height=80; g.fillStyle='#2b2f36'; g.fillRect(0,0,80,80); g.fillStyle='#e8e1d0'; g.fillRect(0,0,40,40); g.fillRect(40,40,40,40); },
    parquet:()=>{ c.width=120; c.height=40; const t=['#8a5a35','#7d5030','#96633b'];
      for(let r=0;r<2;r++) for(let k=0;k<3;k++){ g.fillStyle=t[(r+k)%3]; g.fillRect(k*40+(r?20:0)-20,r*20,40,20); g.strokeStyle='#5a3920'; g.strokeRect(k*40+(r?20:0)-20+.5,r*20+.5,40,20); } },
    cotto:()=>{ c.width=c.height=50; g.fillStyle='#b8643f'; g.fillRect(0,0,50,50); g.strokeStyle='#8e4a2e'; g.lineWidth=2; g.strokeRect(1,1,48,48); },
    tappeto:()=>{ c.width=c.height=60; g.fillStyle='#7a1f2b'; g.fillRect(0,0,60,60); g.strokeStyle='#d8b26255'; g.beginPath(); g.moveTo(30,6); g.lineTo(54,30); g.lineTo(30,54); g.lineTo(6,30); g.closePath(); g.stroke(); },
    tappetoBlu:()=>{ c.width=c.height=60; g.fillStyle='#1f3a5a'; g.fillRect(0,0,60,60); g.strokeStyle='#d8b26244'; g.strokeRect(10,10,40,40); },
    legno:()=>{ c.width=160; c.height=24; g.fillStyle='#a77b52'; g.fillRect(0,0,160,24); g.strokeStyle='#7c5634'; g.lineWidth=2; g.beginPath(); g.moveTo(0,23); g.lineTo(160,23); g.moveTo(90,0); g.lineTo(90,24); g.stroke(); },
    erba:()=>{ c.width=c.height=64; g.fillStyle='#4f7d3a'; g.fillRect(0,0,64,64); const r=V.rng('9f3a11c2');
      for(let i=0;i<40;i++){ g.fillStyle=r()<.5?'#5b8c44':'#446d32'; g.fillRect(r()*64,r()*64,2,4); } },
    ghiaia:()=>{ c.width=c.height=48; g.fillStyle='#cdbf9f'; g.fillRect(0,0,48,48); const r=V.rng('41be7a09');
      for(let i=0;i<30;i++){ g.fillStyle=r()<.5?'#b9aa88':'#ddd1b5'; g.beginPath(); g.arc(r()*48,r()*48,1.5,0,7); g.fill(); } }
  };
  (disegni[tipo]||disegni.marmo)();
  return (motivi[tipo]=ctx.createPattern(c,'repeat'));
}

V.Mondo=class{
  constructor(tela,op){
    this.tela=tela; this.ctx=tela.getContext('2d'); this.op=op;
    this.m=op.mappa; this.zone=op.zone||[];
    this.t=ORA(); this.pausa=false; this.chiuso=false;
    this.tasti=new Set(); this.joy=null; this.meta=null; this.percorso=null; this.azioneInSospeso=null;
    this.vicino=null; this.stanza=null; this.scritta=null;
    this.costruisci();
    const p=op.partenza||this.m.partenza;
    this.p={x:p.x,y:p.y,dir:0,passo:0,colore:op.colore||V.COLORI_ABITO[0]};
    this.avventori=this.creaAvventori(this.m.avventori||7);
    this.misura();

    this.hGiu=e=>this.premi(e); this.hMuovi=e=>this.sposta(e); this.hSu=e=>this.rilascia(e);
    this.hTasto=e=>this.tasto(e,true); this.hTastoSu=e=>this.tasto(e,false);
    tela.addEventListener('pointerdown',this.hGiu);
    globalThis.addEventListener('pointermove',this.hMuovi);
    globalThis.addEventListener('pointerup',this.hSu);
    globalThis.addEventListener('pointercancel',this.hSu);
    globalThis.addEventListener('keydown',this.hTasto);
    globalThis.addEventListener('keyup',this.hTastoSu);
    this.ro=new ResizeObserver(()=>this.misura()); this.ro.observe(tela.parentElement||tela);
    this.ciclo=t=>{ if(this.chiuso) return; this.ultimoFotogramma=ORA(); if(!this.pausa) this.fotogramma(t); else this.t=t; this.raf=requestAnimationFrame(this.ciclo); };
    this.raf=requestAnimationFrame(this.ciclo);
    // Battito di riserva: se il browser rallenta i fotogrammi, il mondo va avanti lo stesso.
    this.battito=setInterval(()=>{ if(!this.chiuso&&!this.pausa&&ORA()-(this.ultimoFotogramma||0)>220){ this.ultimoFotogramma=ORA(); this.fotogramma(ORA()); } },120);
  }
  chiudi(){
    this.chiuso=true; cancelAnimationFrame(this.raf); clearInterval(this.battito);
    this.tela.removeEventListener('pointerdown',this.hGiu);
    globalThis.removeEventListener('pointermove',this.hMuovi);
    globalThis.removeEventListener('pointerup',this.hSu);
    globalThis.removeEventListener('pointercancel',this.hSu);
    globalThis.removeEventListener('keydown',this.hTasto);
    globalThis.removeEventListener('keyup',this.hTastoSu);
    this.ro.disconnect();
  }
  ferma(){ this.pausa=true; this.tasti.clear(); this.joy=null; this.percorso=null; this.meta=null; }
  riprendi(){ this.pausa=false; this.t=ORA(); this.misura(); }

  // ---- costruzione ------------------------------------------------------
  costruisci(){
    const m=this.m, rett=[], cerchi=[];
    for(const w of m.muri) rett.push(w);
    for(const w of m.vetrate||[]) rett.push(w);
    for(const a of m.arredi||[]) if(a.solido!==false&&!a.pavimento) rett.push({x:a.x,y:a.y,w:a.w,h:a.h});
    if(m.mare) rett.push({x:-400,y:-400,w:m.larghezza+800,h:m.mare.y+400});
    rett.push({x:-400,y:-400,w:400,h:m.altezza+800},{x:m.larghezza,y:-400,w:400,h:m.altezza+800},
      {x:-400,y:m.altezza,w:m.larghezza+800,h:400});
    // porte verso zone che in questo ingresso non ci sono: chiuse
    this.porte=(m.porte||[]).filter(p=>{ const ok=this.zone.includes(p.verso); if(!ok) rett.push({x:p.x,y:p.y,w:p.w,h:p.h,chiusa:true}); return ok; });
    this.cancelli=(m.cancelli||[]).map(c=>Object.assign({},c));
    for(const c of this.cancelli) rett.push(c.rett={x:c.x,y:c.y,w:c.w,h:c.h});
    for(const t of m.tavoli) cerchi.push({x:t.x,y:t.y,r:t.r+18});
    this.ost={rett,cerchi};
    this.aggiornaCancelli(true);
  }
  aggiornaCancelli(forza){
    const liv=this.op.livello?this.op.livello():1; let cambiato=!!forza;
    for(const c of this.cancelli){ const aperto=liv>=(c.livelloMin||0);
      if(aperto!==c.aperto){ c.aperto=aperto; cambiato=true; } }
    if(!cambiato) return;
    const rett=this.ost.rett.filter(q=>!this.cancelli.some(c=>c.rett===q));
    for(const c of this.cancelli) if(!c.aperto) rett.push(c.rett);
    this.ost.rett=rett;
    this.griglia=new V.Griglia(this.m.larghezza,this.m.altezza,this.ost,RAGGIO+2);
  }
  stanzaIn(x,y){ return this.m.stanze.find(s=>x>=s.x&&y>=s.y&&x<s.x+s.w&&y<s.y+s.h)||null; }
  puntoLibero(stanza,r){
    for(let k=0;k<30;k++){ const x=stanza.x+40+r()*(stanza.w-80), y=stanza.y+40+r()*(stanza.h-80);
      const [i,j]=this.griglia.cellaDi(x,y); if(this.griglia.aperta(i,j)) return {x,y}; }
    return {x:stanza.x+stanza.w/2,y:stanza.y+stanza.h/2};
  }
  creaAvventori(n){
    const r=V.rng(V.sha256('avventori:'+this.m.id)), out=[], stanze=this.m.stanze.filter(s=>!s.esterna&&!s.livelloMin);
    for(let i=0;i<n;i++){
      const s=stanze[i%stanze.length], p=this.puntoLibero(s,r);
      out.push({x:p.x,y:p.y,dir:r()*6,passo:0,colore:V.COLORI_ABITO[(i+3)%V.COLORI_ABITO.length],pelle:PELLE[i%PELLE.length],
        percorso:null,attesa:r()*3,r});
    }
    return out;
  }

  // ---- misure e camera ---------------------------------------------------
  misura(){
    const r=this.tela.getBoundingClientRect(), dpr=Math.min(globalThis.devicePixelRatio||1,2);
    this.W=Math.max(1,r.width); this.H=Math.max(1,r.height); this.dpr=dpr;
    this.tela.width=Math.round(this.W*dpr); this.tela.height=Math.round(this.H*dpr);
    this.scala=V.clamp(Math.min(this.W,this.H)/560,0.55,1.35);
  }
  camera(){
    const s=this.scala, vw=this.W/s, vh=this.H/s, m=this.m;
    const minY=m.mare?Math.min(0,m.mare.y-260):0;
    let cx=V.clamp(this.p.x,vw/2,Math.max(vw/2,m.larghezza-vw/2)), cy=V.clamp(this.p.y,minY+vh/2,Math.max(minY+vh/2,m.altezza-vh/2));
    if(vw>m.larghezza) cx=m.larghezza/2;
    return {x:cx-vw/2,y:cy-vh/2,s};
  }
  aMondo(sx,sy){ const c=this.camera(); return {x:c.x+sx/c.s,y:c.y+sy/c.s}; }

  // ---- comandi -----------------------------------------------------------
  punto(e){ const r=this.tela.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  premi(e){
    if(this.pausa) return;
    V.audio&&V.audio.attiva();
    const q=this.punto(e);
    this.tocco={sx:q.x,sy:q.y,x:q.x,y:q.y,pid:e.pointerId,t:ORA()};
    try{ this.tela.setPointerCapture(e.pointerId); }catch(_){}
    e.preventDefault();
  }
  sposta(e){
    const t=this.tocco; if(!t||e.pointerId!==t.pid) return;
    const q=this.punto(e); t.x=q.x; t.y=q.y;
    if(!this.joy&&Math.hypot(q.x-t.sx,q.y-t.sy)>14){ this.joy={cx:t.sx,cy:t.sy}; this.percorso=null; this.meta=null; this.azioneInSospeso=null; }
  }
  rilascia(e){
    const t=this.tocco; if(!t||e.pointerId!==t.pid) return;
    this.tocco=null;
    if(this.joy){ this.joy=null; return; }
    if(this.pausa) return;
    const w=this.aMondo(t.x,t.y);
    const tav=this.m.tavoli.find(k=>Math.hypot(w.x-k.x,w.y-k.y)<k.r+22);
    const arr=(this.m.arredi||[]).find(a=>a.azione&&w.x>=a.x-10&&w.x<=a.x+a.w+10&&w.y>=a.y-10&&w.y<=a.y+a.h+10);
    const obj=tav?{tipo:'tavolo',ogg:tav}:arr?{tipo:'arredo',ogg:arr}:null;
    if(obj){
      if(this.vicino&&this.vicino.ogg===obj.ogg){ this.attiva(obj); return; }
      const c=obj.tipo==='tavolo'?{x:obj.ogg.x,y:obj.ogg.y}:{x:obj.ogg.x+obj.ogg.w/2,y:obj.ogg.y+obj.ogg.h/2};
      const d=Math.hypot(this.p.x-c.x,this.p.y-c.y)||1, raggio=obj.tipo==='tavolo'?obj.ogg.r+40:Math.max(obj.ogg.w,obj.ogg.h)/2+34;
      this.vaiA(c.x+(this.p.x-c.x)/d*raggio,c.y+(this.p.y-c.y)/d*raggio); this.azioneInSospeso=obj;
    } else { this.azioneInSospeso=null; this.vaiA(w.x,w.y); }
  }
  tasto(e,giu){
    if(this.pausa||e.target&&/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k=e.key.toLowerCase();
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){
      if(giu){ this.tasti.add(k); this.percorso=null; this.meta=null; this.azioneInSospeso=null; } else this.tasti.delete(k);
      e.preventDefault(); return;
    }
    if(giu&&(k==='enter'||k===' '||k==='e')&&this.vicino){ e.preventDefault(); this.attiva(this.vicino); }
  }
  vaiA(x,y){
    const p=this.griglia.percorso(this.p.x,this.p.y,x,y);
    this.percorso=p&&p.length?p:null; this.meta=this.percorso?this.percorso[this.percorso.length-1]:null;
  }
  attiva(obj){ this.azioneInSospeso=null; this.percorso=null; this.meta=null; if(this.op.alAttiva) this.op.alAttiva(obj); }

  // ---- movimento ---------------------------------------------------------
  muovi(ent,dx,dy,dt,vel){
    const len=Math.hypot(dx,dy); if(len<0.001) return false;
    const passo=Math.min(vel*dt,len);
    ent.x+=dx/len*passo; ent.y+=dy/len*passo; ent.dir=Math.atan2(dy,dx); ent.passo+=passo;
    for(let giro=0;giro<3;giro++){
      let spinto=false;
      for(const q of this.ost.rett){ const s=V.urtoRett(ent.x,ent.y,RAGGIO,q); if(s){ ent.x+=s.x; ent.y+=s.y; spinto=true; } }
      for(const c of this.ost.cerchi){ const s=V.urtoCerchio(ent.x,ent.y,RAGGIO,c); if(s){ ent.x+=s.x; ent.y+=s.y; spinto=true; } }
      if(!spinto) break;
    }
    return true;
  }
  seguiPercorso(ent,dt,vel){
    if(!ent.percorso||!ent.percorso.length) return false;
    const q=ent.percorso[0], dx=q.x-ent.x, dy=q.y-ent.y;
    if(Math.hypot(dx,dy)<6){ ent.percorso.shift(); return ent.percorso.length>0; }
    this.muovi(ent,dx,dy,dt,vel); return true;
  }

  fotogramma(t){
    const tot=Math.min(0.3,Math.max(0,(t-this.t)/1000)); this.t=t;
    const passi=Math.max(1,Math.ceil(tot/0.034));
    for(let k=0;k<passi;k++) this.aggiorna(tot/passi,t);
    this.disegna(t);
  }

  aggiorna(dt,t){
    // giocatore
    let dx=0, dy=0;
    if(this.tasti.has('a')||this.tasti.has('arrowleft')) dx--;
    if(this.tasti.has('d')||this.tasti.has('arrowright')) dx++;
    if(this.tasti.has('w')||this.tasti.has('arrowup')) dy--;
    if(this.tasti.has('s')||this.tasti.has('arrowdown')) dy++;
    if(this.joy&&this.tocco){ const jx=this.tocco.x-this.joy.cx, jy=this.tocco.y-this.joy.cy, l=Math.hypot(jx,jy);
      if(l>8){ dx=jx/l*Math.min(1,l/50); dy=jy/l*Math.min(1,l/50); } }
    if(dx||dy) this.muovi(this.p,dx,dy,dt,VELOCITA*Math.min(1,Math.hypot(dx,dy)));
    else if(this.percorso){ this.p.percorso=this.percorso; if(!this.seguiPercorso(this.p,dt,VELOCITA)){ this.percorso=null; this.meta=null; } }

    // avventori
    for(const a of this.avventori){
      if(a.attesa>0){ a.attesa-=dt; continue; }
      if(!this.seguiPercorso(a,dt,85)){
        const stanze=this.m.stanze.filter(s=>!s.esterna&&!s.livelloMin), s=stanze[Math.floor(a.r()*stanze.length)], p=this.puntoLibero(s,a.r);
        a.percorso=this.griglia.percorso(a.x,a.y,p.x,p.y); a.attesa=2+a.r()*5;
      }
    }

    // cosa c'è vicino
    let vic=null, best=Infinity;
    for(const k of this.m.tavoli){ const d=Math.hypot(this.p.x-k.x,this.p.y-k.y)-k.r; if(d<VICINO&&d<best){ best=d; vic={tipo:'tavolo',ogg:k}; } }
    for(const a of this.m.arredi||[]){ if(!a.azione) continue;
      const nx=V.clamp(this.p.x,a.x,a.x+a.w), ny=V.clamp(this.p.y,a.y,a.y+a.h), d=Math.hypot(this.p.x-nx,this.p.y-ny);
      if(d<VICINO&&d<best){ best=d; vic={tipo:'arredo',ogg:a}; } }
    for(const c of this.cancelli){ if(c.aperto) continue;
      const nx=V.clamp(this.p.x,c.x,c.x+c.w), ny=V.clamp(this.p.y,c.y,c.y+c.h);
      if(Math.hypot(this.p.x-nx,this.p.y-ny)<VICINO&&!vic) vic={tipo:'cancello',ogg:c}; }
    if((vic&&vic.ogg)!==(this.vicino&&this.vicino.ogg)){ this.vicino=vic; if(this.op.alVicino) this.op.alVicino(vic); }
    if(this.azioneInSospeso&&!this.percorso&&vic&&vic.ogg===this.azioneInSospeso.ogg) this.attiva(vic);

    // porte verso altre zone
    for(const p of this.porte){
      if(this.p.x>p.x&&this.p.x<p.x+p.w&&this.p.y>p.y&&this.p.y<p.y+p.h){ if(this.op.alPorta){ this.ferma(); this.op.alPorta(p); } break; }
    }
    // stanza
    const st=this.stanzaIn(this.p.x,this.p.y);
    if(st!==this.stanza){ this.stanza=st; if(st){ this.scritta={testo:st.nome,sotto:st.tag||'',da:t}; if(this.op.alStanza) this.op.alStanza(st); } }
  }

  // ---- disegno -----------------------------------------------------------
  disegna(t){
    const c=this.ctx, cam=this.camera(), m=this.m, s=cam.s;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    c.fillStyle='#0b2533'; c.fillRect(0,0,this.W,this.H);
    c.setTransform(this.dpr*s,0,0,this.dpr*s,-cam.x*s*this.dpr,-cam.y*s*this.dpr);
    const vis={x:cam.x-50,y:cam.y-50,w:this.W/s+100,h:this.H/s+100};

    if(m.mare) this.disegnaMare(c,vis,t);
    for(const st of m.stanze){ c.fillStyle=motivo(c,st.pavimento); c.fillRect(st.x,st.y,st.w,st.h); }
    for(const a of m.arredi||[]) if(a.pavimento) this.disegnaArredo(c,a,t);
    for(const a of m.arredi||[]) if(!a.pavimento) this.disegnaArredo(c,a,t);
    for(const k of m.tavoli) this.disegnaTavolo(c,k,t);

    const gente=[...this.avventori.map(a=>({...a,proprio:false})),{...this.p,proprio:true}].sort((a,b)=>a.y-b.y);
    for(const g of gente) this.disegnaPersona(c,g,t);

    for(const w of m.muri){ c.fillStyle='#3b2c22'; c.fillRect(w.x,w.y,w.w,w.h); c.fillStyle='#6d5543'; c.fillRect(w.x,w.y,w.w,Math.min(4,w.h)); }
    for(const w of m.vetrate||[]){ c.fillStyle='rgba(170,220,240,.35)'; c.fillRect(w.x,w.y,w.w,w.h);
      c.strokeStyle='#e8dcc0'; c.lineWidth=2; c.strokeRect(w.x,w.y,w.w,w.h);
      c.beginPath(); for(let x=w.x;x<w.x+w.w;x+=60){ c.moveTo(x,w.y); c.lineTo(x,w.y+w.h); } c.stroke(); }
    for(const q of this.ost.rett) if(q.chiusa){ c.fillStyle='#3b2c22'; c.fillRect(q.x,q.y,q.w,q.h); }
    for(const p of this.porte){ c.fillStyle='rgba(216,178,98,.25)'; c.fillRect(p.x,p.y,p.w,p.h); }
    for(const k of this.cancelli) if(!k.aperto){ c.fillStyle='#8a6a2a'; c.fillRect(k.x,k.y,k.w,k.h);
      c.strokeStyle='#e0b75a'; c.lineWidth=2; c.beginPath(); const lungo=k.w>k.h;
      for(let i=6;i<(lungo?k.w:k.h);i+=10){ if(lungo){ c.moveTo(k.x+i,k.y); c.lineTo(k.x+i,k.y+k.h); } else { c.moveTo(k.x,k.y+i); c.lineTo(k.x+k.w,k.y+i); } } c.stroke(); }

    if(this.meta){ const a=0.5+0.5*Math.sin(t/150); c.strokeStyle=`rgba(255,214,107,${a})`; c.lineWidth=3; c.beginPath(); c.arc(this.meta.x,this.meta.y,12,0,7); c.stroke(); }
    if(this.vicino&&this.vicino.tipo==='tavolo'){ const k=this.vicino.ogg; c.strokeStyle='#ffd66b'; c.lineWidth=4; c.setLineDash([10,8]); c.lineDashOffset=-t/40;
      c.beginPath(); c.arc(k.x,k.y,k.r+24,0,7); c.stroke(); c.setLineDash([]); }

    // luce del giorno
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    const ora=new Date().getHours()+new Date().getMinutes()/60;
    const tinta=ora>=21||ora<6?'rgba(10,20,60,.28)':ora>=18?'rgba(255,120,40,.10)':ora<8?'rgba(255,190,120,.08)':null;
    if(tinta){ c.fillStyle=tinta; c.fillRect(0,0,this.W,this.H); }
    this.disegnaInterfaccia(c,t);
  }

  disegnaMare(c,vis,t){
    const m=this.m, y0=m.mare.y;
    const g=c.createLinearGradient(0,vis.y,0,y0); g.addColorStop(0,'#0d3b5a'); g.addColorStop(1,'#1d6f8f');
    c.fillStyle=g; c.fillRect(vis.x,Math.min(vis.y,y0-10),vis.w,y0-Math.min(vis.y,y0-10));
    c.strokeStyle='rgba(255,255,255,.18)'; c.lineWidth=2;
    for(let row=0,y=y0-30;y>vis.y&&row<40;y-=38,row++){
      c.beginPath();
      for(let x=vis.x-40;x<vis.x+vis.w+40;x+=12){ const yy=y+Math.sin(x/60+t/900+row)*4; if(x===vis.x-40) c.moveTo(x,yy); else c.lineTo(x,yy); }
      c.stroke();
    }
    // scogliera
    c.fillStyle='#6b5a48'; c.beginPath(); c.moveTo(vis.x,y0);
    for(let x=Math.floor(vis.x/30)*30;x<vis.x+vis.w+30;x+=30) c.lineTo(x,y0-8-((x*7919)%17));
    c.lineTo(vis.x+vis.w,y0+30); c.lineTo(vis.x,y0+30); c.closePath(); c.fill();
    c.fillStyle='rgba(255,255,255,.35)';
    for(let x=Math.floor(vis.x/45)*45;x<vis.x+vis.w;x+=45){ const a=0.5+0.5*Math.sin(t/500+x); c.globalAlpha=a*0.6; c.fillRect(x,y0-14-((x*31)%9),18,3); }
    c.globalAlpha=1;
  }

  disegnaArredo(c,a,t){
    c.save();
    const tondo=(x,y,w,h,r)=>{ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); };
    const ombra=()=>{ c.fillStyle='rgba(0,0,0,.25)'; tondo(a.x+5,a.y+7,a.w,a.h,8); c.fill(); };
    switch(a.tipo){
      case 'tappeto': c.fillStyle=a.colore||'#7a1f2b'; tondo(a.x,a.y,a.w,a.h,6); c.fill(); c.strokeStyle='#d8b26288'; c.lineWidth=4; tondo(a.x+10,a.y+10,a.w-20,a.h-20,4); c.stroke(); break;
      case 'bancone': ombra(); c.fillStyle='#5a3920'; tondo(a.x,a.y,a.w,a.h,10); c.fill(); c.fillStyle='#8a5a35'; tondo(a.x+6,a.y+6,a.w-12,a.h-12,6); c.fill();
        for(let y=a.y+30;y<a.y+a.h-20;y+=46){ c.fillStyle='#d8e8e0'; c.beginPath(); c.arc(a.x+a.w/2,y,6,0,7); c.fill(); } break;
      case 'divano': ombra(); c.fillStyle=a.colore||'#6b1e2b'; tondo(a.x,a.y,a.w,a.h,14); c.fill(); c.fillStyle='rgba(255,255,255,.12)'; tondo(a.x+8,a.y+8,a.w-16,a.h-16,10); c.fill(); break;
      case 'libreria': ombra(); c.fillStyle='#4a2e1a'; c.fillRect(a.x,a.y,a.w,a.h);
        { const col=['#a33','#36a','#393','#b83','#636','#aa6']; let k=0; const lungo=a.w>a.h;
          for(let i=4;i<(lungo?a.w:a.h)-4;i+=9){ c.fillStyle=col[k++%col.length]; if(lungo) c.fillRect(a.x+i,a.y+4,6,a.h-8); else c.fillRect(a.x+4,a.y+i,a.w-8,6); } } break;
      case 'pianta': c.fillStyle='rgba(0,0,0,.25)'; c.beginPath(); c.arc(a.x+a.w/2+4,a.y+a.h/2+6,a.w/2,0,7); c.fill();
        c.fillStyle='#7a4a2a'; c.beginPath(); c.arc(a.x+a.w/2,a.y+a.h/2,a.w/2*0.55,0,7); c.fill();
        for(let i=0;i<7;i++){ const ang=i/7*6.28+Math.sin(t/1200+i)*0.05; c.fillStyle=i%2?'#3f7a36':'#4f9244'; c.beginPath(); c.ellipse(a.x+a.w/2+Math.cos(ang)*a.w*0.25,a.y+a.h/2+Math.sin(ang)*a.h*0.25,a.w*0.28,a.w*0.12,ang,0,7); c.fill(); } break;
      case 'statua': c.fillStyle='rgba(0,0,0,.25)'; c.beginPath(); c.arc(a.x+a.w/2+5,a.y+a.h/2+7,a.w/2,0,7); c.fill();
        c.fillStyle='#d9d4c7'; c.fillRect(a.x,a.y,a.w,a.h); c.fillStyle='#f2efe7'; c.beginPath(); c.arc(a.x+a.w/2,a.y+a.h/2,a.w*0.3,0,7); c.fill(); break;
      case 'fontana': c.fillStyle='#bdb6a6'; c.beginPath(); c.arc(a.x+a.w/2,a.y+a.h/2,a.w/2,0,7); c.fill();
        c.fillStyle='#3a8fb0'; c.beginPath(); c.arc(a.x+a.w/2,a.y+a.h/2,a.w/2-10,0,7); c.fill();
        c.strokeStyle='rgba(255,255,255,.5)'; c.lineWidth=2; for(let k=0;k<3;k++){ const r=((t/30+k*20)%(a.w/2-12)); c.beginPath(); c.arc(a.x+a.w/2,a.y+a.h/2,r,0,7); c.stroke(); } break;
      case 'cipresso': c.fillStyle='rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(a.x+a.w/2+8,a.y+a.h/2+10,a.w/2,a.h/2,0,0,7); c.fill();
        c.fillStyle='#24452a'; c.beginPath(); c.ellipse(a.x+a.w/2,a.y+a.h/2,a.w/2,a.h/2,0,0,7); c.fill(); c.fillStyle='#2f5a36'; c.beginPath(); c.ellipse(a.x+a.w/2-4,a.y+a.h/2-4,a.w/3,a.h/3,0,0,7); c.fill(); break;
      case 'ringhiera': c.fillStyle='#e8e1d0'; c.fillRect(a.x,a.y,a.w,a.h); c.fillStyle='#b8ad96'; for(let x=a.x;x<a.x+a.w;x+=18) c.fillRect(x,a.y,6,a.h); break;
      case 'bacheca': case 'banco': case 'portineria': {
        ombra(); c.fillStyle=a.tipo==='bacheca'?'#2a3b2e':a.tipo==='banco'?'#5a3920':'#34404a'; tondo(a.x,a.y,a.w,a.h,8); c.fill();
        c.strokeStyle='#d8b262'; c.lineWidth=3; c.stroke();
        const pulsa=0.6+0.4*Math.sin(t/400);
        c.fillStyle=`rgba(255,214,107,${pulsa})`; c.font='700 22px Georgia,serif'; c.textAlign='center'; c.textBaseline='middle';
        c.fillText(a.icona||'★',a.x+a.w/2,a.y+a.h/2+1);
        break; }
      default: ombra(); c.fillStyle=a.colore||'#555'; tondo(a.x,a.y,a.w,a.h,8); c.fill();
    }
    c.restore();
  }

  disegnaTavolo(c,k,t){
    const posti=k.giocatori||2, colTav=k.panno||'#1f6a45';
    for(let i=0;i<posti;i++){ const ang=Math.PI/2+i*2*Math.PI/posti, x=k.x+Math.cos(ang)*(k.r+16), y=k.y+Math.sin(ang)*(k.r+16);
      c.fillStyle='#4a2e1a'; c.beginPath(); c.arc(x,y,11,0,7); c.fill(); }
    c.fillStyle='rgba(0,0,0,.28)'; c.beginPath(); c.arc(k.x+6,k.y+9,k.r+6,0,7); c.fill();
    c.fillStyle='#6b4226'; c.beginPath(); if(k.forma==='quadrato') c.rect(k.x-k.r-6,k.y-k.r-6,2*k.r+12,2*k.r+12); else c.arc(k.x,k.y,k.r+6,0,7); c.fill();
    c.fillStyle=colTav; c.beginPath(); if(k.forma==='quadrato') c.rect(k.x-k.r,k.y-k.r,2*k.r,2*k.r); else c.arc(k.x,k.y,k.r,0,7); c.fill();
    if(this.op.disegnaSulTavolo) this.op.disegnaSulTavolo(c,k,t);
    // i giocatori del tavolo seduti (tutti tranne il posto libero, in basso)
    for(let i=1;i<posti;i++){ const ang=Math.PI/2+i*2*Math.PI/posti, x=k.x+Math.cos(ang)*(k.r+16), y=k.y+Math.sin(ang)*(k.r+16);
      this.disegnaPersona(c,{x,y,dir:ang+Math.PI,passo:0,colore:V.COLORI_ABITO[(k.x+k.y+i)%V.COLORI_ABITO.length],pelle:PELLE[(k.x+i)%PELLE.length],seduto:true},t); }
    if(k.etichetta){ c.font='600 15px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle';
      const w=c.measureText(k.etichetta).width+18, y=k.y-k.r-44;
      c.fillStyle='rgba(11,26,18,.8)'; c.beginPath(); c.roundRect?c.roundRect(k.x-w/2,y-13,w,26,13):c.rect(k.x-w/2,y-13,w,26); c.fill();
      c.fillStyle='#f4ead2'; c.fillText(k.etichetta,k.x,y+1); }
  }

  disegnaPersona(c,g,t){
    const oscilla=g.seduto?0:Math.sin(g.passo/7)*3;
    c.fillStyle='rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(g.x+3,g.y+8,RAGGIO,RAGGIO*0.6,0,0,7); c.fill();
    c.save(); c.translate(g.x,g.y); c.rotate(g.dir||0);
    c.fillStyle=g.colore; c.beginPath(); c.ellipse(0,oscilla*0.3,RAGGIO*0.8,RAGGIO,0,0,7); c.fill();
    c.fillStyle='rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(-3,0,RAGGIO*0.5,RAGGIO*0.8,0,0,7); c.fill();
    c.fillStyle=g.pelle||PELLE[0]; c.beginPath(); c.arc(4,0,RAGGIO*0.55,0,7); c.fill();
    c.restore();
    if(g.proprio){
      c.strokeStyle='#ffd66b'; c.lineWidth=2.5; c.beginPath(); c.arc(g.x,g.y,RAGGIO+5,0,7); c.stroke();
      const nome=this.op.nome||''; if(nome){ c.font='700 13px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle';
        c.lineWidth=4; c.strokeStyle='rgba(0,0,0,.6)'; c.strokeText(nome,g.x,g.y-RAGGIO-14); c.fillStyle='#fff'; c.fillText(nome,g.x,g.y-RAGGIO-14); }
    }
  }

  disegnaInterfaccia(c,t){
    if(this.joy&&this.tocco){ c.strokeStyle='rgba(255,255,255,.35)'; c.lineWidth=3; c.beginPath(); c.arc(this.joy.cx,this.joy.cy,50,0,7); c.stroke();
      const jx=this.tocco.x-this.joy.cx, jy=this.tocco.y-this.joy.cy, l=Math.hypot(jx,jy)||1, k=Math.min(1,50/l);
      c.fillStyle='rgba(255,214,107,.7)'; c.beginPath(); c.arc(this.joy.cx+jx*k,this.joy.cy+jy*k,20,0,7); c.fill(); }
    if(this.scritta){ const f=(t-this.scritta.da)/2600;
      if(f>=1) this.scritta=null;
      else { const a=f<0.15?f/0.15:f>0.75?(1-f)/0.25:1; c.save(); c.globalAlpha=a; c.textAlign='center'; c.textBaseline='middle';
        c.font=`${Math.round(V.clamp(this.W/18,20,34))}px Georgia,serif`; c.lineWidth=5; c.strokeStyle='rgba(0,0,0,.55)';
        c.strokeText(this.scritta.testo,this.W/2,42); c.fillStyle='#ffe3a0'; c.fillText(this.scritta.testo,this.W/2,42);
        if(this.scritta.sotto){ c.font='14px system-ui,sans-serif'; c.lineWidth=4; c.strokeText(this.scritta.sotto,this.W/2,72); c.fillStyle='#f4ead2'; c.fillText(this.scritta.sotto,this.W/2,72); }
        c.restore(); } }
  }
};
})(globalThis.V=globalThis.V||{});
