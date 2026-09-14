(function(V){'use strict';
// Il tavolo da carte: disegno, gesti, orologio, turni dei bot.
// Il giocatore umano siede sempre al posto 0, in basso.
const ORA=()=>performance.now();
const LATI={2:['giu','su'],4:['giu','destra','su','sinistra']};

// Come appare il tavolo mentre la carta giocata è ancora sopra la presa.
function vistaPrima(prev,m){
  const v=structuredClone(prev), p=prev.turno;
  v.mani[p]=v.mani[p].filter(c=>c!==m.carta);
  if(!m.presa.length) v.tavola.push(m.carta);
  return v;
}
// Come appare a fine smazzata: prese nei mucchi, avanzi a chi ha preso per ultimo.
function vistaFinale(prev,m,S){
  const v=vistaPrima(prev,m), sq=S.squadra(prev,prev.turno);
  let ultima=prev.ultimaPresa;
  if(m.presa.length){ v.tavola=v.tavola.filter(c=>!m.presa.includes(c)); v.prese[sq].push(m.carta,...m.presa); ultima=sq; }
  if(ultima!==null){ v.prese[ultima].push(...v.tavola); v.tavola=[]; }
  return v;
}

class Tavolo{
  constructor(tela,op){
    this.tela=tela; this.ctx=tela.getContext('2d'); this.op=op; this.S=V.giochi[op.gioco];
    this.seme=op.seme; this.impronta=V.sha256(op.seme);
    this.st=this.S.nuovaPartita(op.seme,{giocatori:op.giocatori});
    this.rng=V.rng(V.sha256(op.seme+':bot'));
    this.lati=LATI[this.st.n];
    this.pos=Object.create(null); this.coda=[]; this.vista=null; this.evidenza=null;
    this.drag=null; this.scelta=null; this.scritte=[]; this.scaduti=0; this.scopeMie=0;
    this.pausa=false; this.finito=false; this.chiuso=false; this.ultimoTic=-1;
    this.scadenza=0; this.botAl=0; this.nascostoDa=0; this.t=ORA();
    this.misura();
    const m=this.xyMazzo();
    for(const id of V.mazzoNapoletano()) this.pos[id]={x:m.x,y:m.y,r:0,s:m.s,su:false,z:0};

    this.hGiu=e=>this.premi(e); this.hMuovi=e=>this.sposta(e); this.hSu=e=>this.rilascia(e);
    tela.addEventListener('pointerdown',this.hGiu);
    globalThis.addEventListener('pointermove',this.hMuovi);
    globalThis.addEventListener('pointerup',this.hSu);
    globalThis.addEventListener('pointercancel',this.hSu);
    this.ro=new ResizeObserver(()=>this.misura()); this.ro.observe(tela.parentElement||tela);
    this.hVis=()=>{
      if(document.hidden){ this.nascostoDa=ORA(); return; }
      if(!this.nascostoDa) return;
      const d=ORA()-this.nascostoDa; this.nascostoDa=0;
      this.scadenza+=d; this.botAl+=d; for(const c of this.coda) c.fino+=d;
    };
    document.addEventListener('visibilitychange',this.hVis);

    this.iniziaTurno();
    this.ciclo=t=>{ if(this.chiuso) return; this.fotogramma(t); this.raf=requestAnimationFrame(this.ciclo); };
    this.raf=requestAnimationFrame(this.ciclo);
  }

  chiudi(){
    this.chiuso=true; this.finito=true; cancelAnimationFrame(this.raf);
    this.tela.removeEventListener('pointerdown',this.hGiu);
    globalThis.removeEventListener('pointermove',this.hMuovi);
    globalThis.removeEventListener('pointerup',this.hSu);
    globalThis.removeEventListener('pointercancel',this.hSu);
    document.removeEventListener('visibilitychange',this.hVis);
    this.ro.disconnect();
  }

  // ---- misure e posizioni ------------------------------------------------
  misura(){
    const r=this.tela.getBoundingClientRect(), dpr=Math.min(globalThis.devicePixelRatio||1,2.5);
    this.W=Math.max(1,r.width); this.H=Math.max(1,r.height); this.dpr=dpr;
    this.tela.width=Math.round(this.W*dpr); this.tela.height=Math.round(this.H*dpr);
    const largo=this.W>this.H*1.15;
    // basso: telefono in orizzontale, poca altezza. La mano sporge dal bordo inferiore.
    this.basso=largo&&this.H<470;
    if(this.basso) this.cw=Math.min(this.W/9,(this.H*0.36)/1.62);
    else this.cw=Math.min(this.W/(largo?9:5.2),132,this.H/(largo?5.2:6.6));
    this.ch=this.cw*1.62; this.pad=10;
  }
  xyMazzo(){ return this.basso?{x:this.pad+this.cw*0.42+4,y:this.pad+34+this.ch*0.3,s:0.6}:{x:this.pad+this.cw*0.42+4,y:this.pad+40+this.ch*0.36,s:0.7}; }
  xyMucchio(sq){
    const mio=sq===this.S.squadra(this.st,0), s=this.basso?0.6:0.7;
    return {x:this.W-this.pad-this.cw*0.42-4,y:mio?this.H-this.pad-this.ch*s*0.55:this.pad+(this.basso?34:40)+this.ch*s*0.5,s};
  }
  sTop(){ return this.basso?0.45:0.55; }
  yManoSu(){ return this.pad+(this.basso?2:30)+this.ch*this.sTop()/2; }
  yManoGiu(){ return this.basso?this.H-this.pad-this.ch/2+this.ch*0.2:this.H-this.pad-this.ch/2-6; }
  cimaMano(){ return this.yManoGiu()-this.ch*0.55; }
  centro(){
    if(!this.basso) return {x:this.W/2,y:this.H*0.47};
    const alto=this.pad+2+this.ch*this.sTop(), basso=this.yManoGiu()-this.ch/2;
    return {x:this.W/2,y:(alto+basso)/2};
  }

  disponi(){
    const st=this.vista||this.st, out=[], cw=this.cw, ch=this.ch, c=this.centro();
    const mz=this.xyMazzo();
    st.mazzo.forEach((id,i)=>{ const k=st.mazzo.length-1-i;
      out.push({id,x:mz.x-Math.min(k,10)*0.6,y:mz.y-Math.min(k,10)*0.6,r:0,s:mz.s,su:false,z:10+k,basso:k>4}); });
    st.prese.forEach((pila,sq)=>{ const m=this.xyMucchio(sq);
      pila.forEach((id,i)=>out.push({id,x:m.x+((i*37)%7-3),y:m.y-Math.min(i,16)*0.5,r:(((i*53)%11)-5)*0.03,
        s:m.s,su:false,z:100+i,basso:i<pila.length-5})); });

    const lato=st.n===4?ch*this.sTop()+this.pad*2:(this.basso?cw+this.pad*2:this.pad*2), disp=this.W-lato*2, k=st.tavola.length;
    let s=1, colW=cw*1.1, rowH=ch*1.05;
    let cols=Math.max(2,Math.floor(disp/colW)), rows=Math.max(1,Math.ceil(k/cols));
    const alt=this.basso?(this.yManoGiu()-this.ch/2)-(this.pad+2+this.ch*this.sTop())-8:this.H*0.4;
    if(rows*rowH>alt){ s=Math.max(0.55,alt/(rows*rowH)); colW*=s; rowH*=s;
      cols=Math.max(2,Math.floor(disp/colW)); rows=Math.max(1,Math.ceil(k/cols)); }
    this.slot={};
    st.tavola.forEach((id,i)=>{
      const row=Math.floor(i/cols), inRow=Math.min(cols,k-row*cols), col=i-row*cols;
      const x=c.x+(col-(inRow-1)/2)*colW, y=c.y+(row-(rows-1)/2)*rowH;
      this.slot[id]={x,y,s}; out.push({id,x,y,r:0,s,su:true,z:300+i});
    });

    st.mani.forEach((mano,p)=>{
      const lt=this.lati[p], n=mano.length;
      mano.forEach((id,i)=>{ const o=i-(n-1)/2; let q;
        if(lt==='giu'){
          const sp=Math.min(cw*1.05,(this.W-2*this.pad)/Math.max(n,1)), alza=this.scelta===id?ch*0.16:0;
          q={x:this.W/2+o*sp,y:this.yManoGiu()-alza+Math.abs(o)*4,r:o*0.06,s:1,su:true,z:600+i};
        } else if(lt==='su') q={x:this.W/2+o*cw*0.42,y:this.yManoSu(),r:Math.PI+o*0.05,s:this.sTop(),su:false,z:500+i};
        else if(lt==='sinistra') q={x:this.pad+ch*this.sTop()/2,y:c.y+o*cw*0.42,r:Math.PI/2,s:this.sTop(),su:false,z:500+i};
        else q={x:this.W-this.pad-ch*this.sTop()/2,y:c.y+o*cw*0.42,r:-Math.PI/2,s:this.sTop(),su:false,z:500+i};
        q.id=id; out.push(q);
      });
    });

    if(this.evidenza){ const e=this.evidenza, sl=this.slot[e.su];
      if(sl) out.push({id:e.carta,x:sl.x+cw*0.24*sl.s,y:sl.y+ch*0.12*sl.s,r:0.08,s:sl.s,su:true,z:900}); }
    return out;
  }

  // ---- ciclo -------------------------------------------------------------
  fotogramma(t){
    const dt=Math.min(0.05,Math.max(0,(t-this.t)/1000)); this.t=t;
    const bersagli=this.disponi(), k=1-Math.exp(-dt*13);
    for(const b of bersagli){
      let p=this.pos[b.id]; if(!p) p=this.pos[b.id]={...b};
      b.mosso=Math.abs(p.x-b.x)+Math.abs(p.y-b.y)>1.5;
      if(this.drag&&this.drag.id===b.id&&this.drag.mosso){
        p.x=this.drag.x; p.y=this.drag.y-this.ch*0.12; p.r=0; p.s=1.08; p.su=true; p.z=1000; b.mosso=true; continue;
      }
      p.x+=(b.x-p.x)*k; p.y+=(b.y-p.y)*k; p.r+=(b.r-p.r)*k; p.s+=(b.s-p.s)*k; p.su=b.su; p.z=b.z;
    }
    while(this.coda.length&&t>=this.coda[0].fino&&!this.pausa){ this.coda.shift().fn(); }
    if(!this.coda.length&&!this.pausa&&!this.finito) this.logica(t);
    this.disegna(bersagli,t);
  }

  dopo(ms,fn){ this.coda.push({fino:ORA()+ms,fn}); this.coda.sort((a,b)=>a.fino-b.fino); }
  scritta(testo,ms,grande){ const t=ORA(); this.scritte.push({testo,da:t,fino:t+ms,grande:!!grande}); }

  logica(t){
    const st=this.st;
    if(st.finita) return this.termina();
    if(st.turno===0){
      const resta=this.scadenza-t, sec=Math.ceil(resta/1000);
      if(sec<=3&&sec>0&&sec!==this.ultimoTic){ this.ultimoTic=sec; V.suono('tic'); }
      if(resta<=0) this.tempoScaduto();
    } else if(t>=this.botAl){
      const p=st.turno;
      this.gioca(this.S.bot(st,p,this.op.livelli[p]||5,this.rng));
    }
  }

  iniziaTurno(){
    const t=ORA(); this.ultimoTic=-1;
    if(this.st.finita) return;
    if(this.st.turno===0) this.scadenza=t+this.op.secondi*1000;
    else this.botAl=t+650+this.rng()*500;
  }

  tempoScaduto(){
    this.scaduti++; this.scelta=null; this.drag=null; V.vibra('forte');
    if(this.scaduti>=3){
      this.scritta('Tre volte senza giocare: partita persa',2200);
      this.st=this.S.abbandona(this.st,0); return this.termina();
    }
    this.scritta(`Tempo scaduto (${this.scaduti}/3)`,1500);
    this.gioca(this.S.mossaDiRiserva(this.st,0));
  }

  gioca(m){
    const S=this.S, prev=this.st, p=prev.turno, next=S.applica(prev,m);
    this.st=next; this.scelta=null;
    V.suono('carta'); if(p===0) V.vibra('leggera');
    const chiusa=next.finita||next.smazzata!==prev.smazzata;
    if(next.ultimaMossa&&next.ultimaMossa.scopa){
      this.scritta('SCOPA!',1300,true); V.suono('scopa'); V.vibra('forte');
      if(p===0) this.scopeMie++;
    }
    if(!m.presa.length&&!chiusa){ this.vista=null; this.iniziaTurno(); return; }
    this.vista=vistaPrima(prev,m);
    this.evidenza=m.presa.length?{carta:m.carta,su:m.presa[0]}:null;
    this.dopo(m.presa.length?700:450,()=>{
      this.evidenza=null;
      if(m.presa.length) V.suono('presa');
      if(!chiusa){ this.vista=null; this.iniziaTurno(); return; }
      this.vista=vistaFinale(prev,m,S);
      this.dopo(850,()=>{
        if(next.finita) return this.termina();
        this.pausa=true;
        const continua=()=>{ if(this.chiuso) return; this.pausa=false; this.vista=null; this.iniziaTurno(); };
        if(this.op.alSmazzata) this.op.alSmazzata(next.ultimaSmazzata,next,continua); else continua();
      });
    });
  }

  termina(){
    if(this.finito) return;
    this.finito=true; this.drag=null; this.scelta=null;
    const st=this.st, vinto=st.vincitore===this.S.squadra(st,0);
    V.suono(vinto?'vittoria':'sconfitta'); if(vinto) V.vibra('successo');
    setTimeout(()=>{ if(!this.chiuso&&this.op.alFine) this.op.alFine({vinto,st,seme:this.seme,
      impronta:this.impronta,abbandono:st.abbandono!=null,scopeMie:this.scopeMie}); },700);
  }

  abbandona(){
    if(this.finito) return;
    this.coda=[]; this.pausa=false; this.st=this.S.abbandona(this.st,0); this.termina();
  }

  // ---- gesti -------------------------------------------------------------
  punto(e){ const r=this.tela.getBoundingClientRect(); return {x:e.clientX-r.left,y:e.clientY-r.top}; }
  mioTurno(){ return !this.finito&&!this.pausa&&!this.coda.length&&!this.st.finita&&this.st.turno===0; }
  sotto(ids,x,y){
    let meglio=null, z=-1;
    for(const id of ids){ const p=this.pos[id]; if(!p) continue;
      if(Math.abs(x-p.x)<=this.cw*p.s/2&&Math.abs(y-p.y)<=this.ch*p.s/2&&p.z>z){ meglio=id; z=p.z; } }
    return meglio;
  }
  premi(e){
    V.audio.attiva();
    if(!this.mioTurno()) return;
    const {x,y}=this.punto(e), id=this.sotto(this.st.mani[0],x,y);
    if(id){
      this.drag={id,x,y,sx:x,sy:y,mosso:false,pid:e.pointerId};
      try{ this.tela.setPointerCapture(e.pointerId); }catch(_){}
      e.preventDefault(); return;
    }
    if(this.scelta){ const sopra=this.sotto(this.st.tavola,x,y);
      if(sopra||y<this.cimaMano()) this.giocaVerso(this.scelta,x,y); else this.scelta=null; }
  }
  sposta(e){
    const d=this.drag; if(!d||e.pointerId!==d.pid) return;
    const {x,y}=this.punto(e); d.x=x; d.y=y;
    if(Math.hypot(x-d.sx,y-d.sy)>10) d.mosso=true;
  }
  rilascia(e){
    const d=this.drag; if(!d||e.pointerId!==d.pid) return;
    this.drag=null;
    if(!this.mioTurno()) return;
    const {x,y}=this.punto(e);
    if(!d.mosso){
      if(this.scelta===d.id) this.giocaVerso(d.id,null,null);
      else { this.scelta=d.id; V.suono('clic'); }
      return;
    }
    if(y>this.cimaMano()){ this.scelta=null; return; }
    this.giocaVerso(d.id,x,y);
  }
  // Lasciata su una carta del tavolo: la presa più piccola che la contiene.
  // Lasciata altrove: la calata se è permessa, altrimenti la prima presa obbligata.
  mossaVerso(id,x,y){
    const mosse=this.S.mosseLegali(this.st,0).filter(m=>m.carta===id);
    if(!mosse.length) return null;
    if(x!=null){ const t=this.sotto(this.st.tavola,x,y);
      if(t){ const c=mosse.filter(m=>m.presa.includes(t)).sort((a,b)=>a.presa.length-b.presa.length); if(c.length) return c[0]; } }
    return mosse.find(m=>!m.presa.length)||mosse[0];
  }
  giocaVerso(id,x,y){ const m=this.mossaVerso(id,x,y); if(m) this.gioca(m); }

  // ---- disegno -----------------------------------------------------------
  disegna(bersagli,t){
    const c=this.ctx, W=this.W, H=this.H;
    c.setTransform(this.dpr,0,0,this.dpr,0,0); c.clearRect(0,0,W,H);
    const g=c.createRadialGradient(W/2,H*0.45,20,W/2,H*0.45,Math.max(W,H)*0.75);
    g.addColorStop(0,'#2f7a52'); g.addColorStop(1,'#10321f');
    c.fillStyle=g; V.tondo(c,3,3,W-6,H-6,22); c.fill();
    c.strokeStyle='#d8b26266'; c.lineWidth=2; c.stroke();

    const luce=new Set(), forte=new Set(), attiva=this.drag?this.drag.id:this.scelta;
    if(attiva&&this.mioTurno()){
      this.S.mosseLegali(this.st,0).filter(m=>m.carta===attiva).forEach(m=>m.presa.forEach(id=>luce.add(id)));
      if(this.drag&&this.drag.mosso){ const m=this.mossaVerso(attiva,this.drag.x,this.drag.y); if(m) m.presa.forEach(id=>forte.add(id)); }
    }
    const visibili=bersagli.filter(b=>!b.basso||b.mosso).map(b=>b.id).sort((a,b)=>this.pos[a].z-this.pos[b].z);
    for(const id of visibili){ const p=this.pos[id];
      V.disegnaCarta(c,p.su?id:null,p.x,p.y,this.cw*p.s,this.ch*p.s,{r:p.r,luce:forte.has(id)?2:luce.has(id)?1:0}); }

    const st=this.vista||this.st, mz=this.xyMazzo();
    if(st.mazzo.length) this.pillola(String(st.mazzo.length),mz.x,mz.y+this.ch*0.36+12,'center',false);
    this.etichette(t);
    this.disegnaScritte(t);
  }

  pillola(testo,x,y,allinea,oro){
    const c=this.ctx; c.font='600 13px system-ui,sans-serif';
    const w=c.measureText(testo).width+16, h=24;
    const x0=allinea==='center'?x-w/2:allinea==='right'?x-w:x;
    c.fillStyle='#0b1a12cc'; V.tondo(c,x0,y-h/2,w,h,12); c.fill();
    if(oro){ c.strokeStyle='#e0b75a'; c.lineWidth=2; c.stroke(); }
    c.fillStyle='#f4ead2'; c.textAlign='left'; c.textBaseline='middle'; c.fillText(testo,x0+8,y+1);
    return {x0,w};
  }

  etichette(t){
    const c=this.ctx, st=this.st, nomi=this.op.nomi, cen=this.centro(), cw=this.cw, ch=this.ch;
    const pt=st.punti, pun=st.n===4?`Noi ${pt[0]} · Loro ${pt[1]}`:`${corto(nomi[0],10)} ${pt[0]} · ${corto(nomi[1],10)} ${pt[1]}`;
    this.pillola(`${pun}  /${st.obiettivo}`,this.pad,this.pad+12,'left',false);
    const attivo=!this.finito&&!this.pausa&&!this.coda.length&&!st.finita;
    st.mani.forEach((_,p)=>{
      const lt=this.lati[p], turno=attivo&&st.turno===p;
      let x,y,al='center';
      if(lt==='giu'){ if(this.basso){ x=this.W/2-cw*1.6-12; y=this.yManoGiu()-ch*0.12; al='right'; } else { x=this.W/2; y=this.yManoGiu()-ch/2-ch*0.16-18; } }
      else if(lt==='su'){ if(this.basso){ x=this.W/2+cw*0.42+ch*this.sTop()/2+12; y=this.yManoSu(); al='left'; } else { x=this.W/2; y=this.yManoSu()+ch*this.sTop()/2+14; } }
      else if(lt==='sinistra'){ x=this.pad; y=cen.y+(this.basso?cw*0.75+16:-cw*0.75-16); al='left'; }
      else { x=this.W-this.pad; y=cen.y+(this.basso?cw*0.75+16:-cw*0.75-16); al='right'; }
      const nome=(p===0?'Tu':corto(nomi[p],12))+(st.n===4&&p===2?' (compagno)':'');
      const spazio=turno?'     ':'';
      const box=this.pillola(spazio+nome,x,y,al,turno);
      if(!turno) return;
      const cx=box.x0+14, cy=y;
      if(p===0){
        const f=V.clamp((this.scadenza-t)/(this.op.secondi*1000),0,1);
        c.beginPath(); c.arc(cx,cy,7,-Math.PI/2,-Math.PI/2+Math.PI*2*f);
        c.strokeStyle=f<0.3?'#ff6b5a':'#e0b75a'; c.lineWidth=3; c.stroke();
      } else {
        for(let i=0;i<3;i++){ const a=0.3+0.7*Math.max(0,Math.sin(t/180-i*0.9));
          c.fillStyle=`rgba(224,183,90,${a})`; c.beginPath(); c.arc(cx-5+i*5,cy,2,0,Math.PI*2); c.fill(); }
      }
    });
    if(this.mioTurno()&&!this.drag&&!this.scelta&&this.scaduti===0&&st.smazzata===0&&st.mani[0].length===3&&st.mazzo.length>=30){
      if(this.basso) this.pillola('Trascina una carta',this.W/2-cw*1.6-12,this.yManoGiu()-ch*0.12-30,'right',false);
      else this.pillola('Trascina una carta sul tavolo',this.W/2,this.yManoGiu()-ch/2-ch*0.16-48,'center',false);
    }
  }

  disegnaScritte(t){
    const c=this.ctx;
    this.scritte=this.scritte.filter(s=>t<s.fino);
    for(const s of this.scritte){
      const f=(t-s.da)/(s.fino-s.da), alfa=f>0.75?(1-f)/0.25:1;
      c.save(); c.globalAlpha=Math.max(0,alfa);
      if(s.grande){
        const sc=1+0.35*(1-Math.min(1,f*5));
        c.translate(this.W/2,this.H*0.42); c.scale(sc,sc);
        c.font=`700 ${Math.round(this.cw*0.75)}px Georgia,serif`; c.textAlign='center'; c.textBaseline='middle';
        c.lineWidth=6; c.strokeStyle='#2a1a10'; c.strokeText(s.testo,0,0);
        c.fillStyle='#ffd66b'; c.fillText(s.testo,0,0);
      } else this.pillola(s.testo,this.W/2,this.H*0.3,'center',true);
      c.restore();
    }
  }
}
function corto(s,n){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }

V.Tavolo=Tavolo;
})(globalThis.V=globalThis.V||{});
