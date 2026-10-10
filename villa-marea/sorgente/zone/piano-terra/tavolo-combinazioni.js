(function(V){'use strict';
// Tavolo di Scala 40 e Burraco: si pesca, si calano combinazioni, si attacca, si scarta.
// Le carte si selezionano con un tocco; i pulsanti Cala / Scarta / Ordina / Aiuto sono sul tavolo.
const ORA=()=>performance.now();
const MAX_AZIONI_BOT=40;

class TavoloCombinazioni extends V.Tavolo{
  opzioniPartita(op){ return {giocatori:op.giocatori,breve:!!op.breve}; }
  tutteLeCarte(){ return V.mazzoFrancese(); }
  regole(){ return {gioco:this.st.gioco}; }

  misura(){
    super.misura();
    this.cw*=this.basso?0.74:0.8; this.ch=this.cw*1.45;
    this.sel=this.sel||new Set(); this.ordine=this.ordine||'seme';
    this.mosseFatte=true;   // niente suggerimento della Scopa: qui ci sono i pulsanti
  }
  larghezzaBottoni(){ return this.basso?Math.min(112,this.W*0.16):0; }
  riservaLati(st){ return st.n===4?this.ch*this.sTop()*0.9+this.pad*2+6:0; }
  xyScarti(){ const m=this.xyMazzo(); return {x:m.x+this.cw*0.95,y:m.y,s:m.s}; }
  xyPozzetti(){ const m=this.xyMazzo(), s=m.s*0.8; return {x:this.W-this.pad-this.ch*s/2-4,y:m.y,s}; }

  // ---- disposizione ------------------------------------------------------
  disponiMazzo(st,out){
    super.disponiMazzo(st,out);
    const sc=this.xyScarti(), n=st.scarti.length, vis=Math.min(n,6);
    st.scarti.forEach((id,i)=>{ const k=i-(n-vis); const dentro=k>=0;
      out.push({id,x:sc.x+(dentro?k:0)*this.cw*sc.s*0.26,y:sc.y,r:0,s:sc.s,su:dentro,z:200+i,basso:!dentro&&i<n-vis-1}); });
    this.rettScarti={x:sc.x-this.cw*sc.s/2,y:sc.y-this.ch*sc.s/2,w:this.cw*sc.s*(1+0.26*Math.max(0,vis-1)),h:this.ch*sc.s};
    if(st.pozzetti){ const q=this.xyPozzetti();
      st.pozzetti.forEach((pz,k)=>pz.forEach((id,i)=>out.push({id,x:q.x-k*this.cw*q.s*0.5,y:q.y+k*6-i*0.4,
        r:Math.PI/2,s:q.s,su:false,z:40+k*20+i,basso:i<pz.length-2}))); }
  }
  disponiPrese(){}
  xEtichettaSu(){ return this.W*0.64; }
  xyEtichettaGiu(){ return this.basso?{x:this.pad,y:this.yManoGiu()-this.ch/2-30,al:'left'}:{x:this.W/2,y:this.yManoGiu()-this.ch/2-this.ch*0.22-16,al:'center'}; }

  disponiCentro(st,out){
    const mio=this.S.squadra(st,0), sc=this.xyScarti();
    const alto=sc.y+this.ch*0.36+30, basso=this.basso?this.yManoGiu()-this.ch/2-12:this.yBottoni()-52;
    const ris=this.riservaLati(st), destra=this.basso?this.larghezzaBottoni()+10:0;
    const x0=this.pad+ris, w=this.W-2*this.pad-2*ris-destra, giochi=st.giochi.map((g,i)=>({g,i}));
    const loro=giochi.filter(x=>x.g.squadra!==mio), miei=giochi.filter(x=>x.g.squadra===mio);
    let s=0.62, righe;
    for(;s>=0.34;s-=0.04){
      const larg=g=>this.cw*s*(1+0.3*(g.carte.length-1))+8, h=this.ch*s+6;
      const flusso=lista=>{ let rr=[], x=0; for(const e of lista){ const lw=larg(e.g); if(x+lw>w&&x>0){ rr.push(x); x=0; } x+=lw; } if(x) rr.push(x); return rr.length; };
      righe=flusso(loro)+flusso(miei);
      if(righe*h<=basso-alto) break;
    }
    const larg=g=>this.cw*s*(1+0.3*(g.carte.length-1)), h=this.ch*s+6;
    this.rettGiochi=[];
    const posa=(lista,y0,dir)=>{ let x=x0, y=y0;
      for(const {g,i} of lista){
        const lw=larg(g);
        if(x+lw>x0+w&&x>x0){ x=x0; y+=dir*h; }
        const yc=y+(dir>0?this.ch*s/2:-this.ch*s/2);
        g.carte.forEach((id,k)=>out.push({id,x:x+this.cw*s/2+k*this.cw*s*0.3,y:yc,r:0,s,su:true,z:320+i*20+k}));
        this.rettGiochi.push({i,x,y:yc-this.ch*s/2,w:lw,h:this.ch*s});
        x+=lw+8;
      }
    };
    posa(loro,alto,1);
    posa(miei,basso,-1);
  }

  ordinata(mano){
    const F=V.francese, OS={C:0,Q:1,F:2,P:3};
    const k=id=>F.jolly(id)?[9,99]:this.ordine==='seme'?[OS[F.seme(id)],F.valore(id)]:[F.valore(id),OS[F.seme(id)]];
    return mano.slice().sort((a,b)=>{ const x=k(a), y=k(b); return x[0]-y[0]||x[1]-y[1]||(a<b?-1:1); });
  }
  disponiMani(st,out){
    const cw=this.cw, ch=this.ch, c=this.centro();
    st.mani.forEach((mano,p)=>{
      const lt=this.lati[p], n=mano.length;
      if(lt==='giu'){
        const largo=this.W-2*this.pad-this.larghezzaBottoni()-(this.basso?10:0), cx=this.pad+largo/2;
        const sp=Math.min(cw*0.62,(largo-cw)/Math.max(n-1,1));
        this.ordinata(mano).forEach((id,i)=>{ const o=i-(n-1)/2;
          out.push({id,x:cx+o*sp,y:this.yManoGiu()-(this.sel.has(id)?ch*0.22:0),r:0,s:1,su:true,z:600+i}); });
        return;
      }
      const s=this.sTop()*0.9;
      mano.forEach((id,i)=>{ const o=i-(n-1)/2; let q;
        if(lt==='su'){ const sp=Math.min(cw*0.26,this.W*0.3/Math.max(n,1)); q={x:this.W*0.64+o*sp,y:this.yManoSu(),r:Math.PI,s}; }
        else { const sp=Math.min(cw*0.24,this.H*0.3/Math.max(n,1)); q={x:lt==='sinistra'?this.pad+ch*s/2:this.W-this.pad-ch*s/2,y:c.y+o*sp,r:lt==='sinistra'?Math.PI/2:-Math.PI/2,s}; }
        out.push(Object.assign(q,{id,su:false,z:500+i}));
      });
    });
  }
  disegnaUna(c,id,x,y,w,h,op){
    if(id&&this.sel.has(id)) op.selezionata=true;
    V.disegnaCartaFrancese(c,id,x,y,w,h,op);
  }
  luci(){ return {luce:new Set(),forte:new Set()}; }
  giocabili(){ return null; }

  // ---- pulsanti ----------------------------------------------------------
  yBottoni(){ return this.yManoGiu()-this.ch/2-0.3*this.ch-40; }
  bottoni(){
    if(!this.mioTurno()) return [];
    const st=this.st, gioca=st.fase==='gioca', sel=[...this.sel];
    const gruppi=gioca&&sel.length>=3?this.dividi(sel):null;
    const scarta=gioca&&sel.length===1&&this.S.mosseLegali(st,0).some(m=>m.carta===sel[0]);
    const voci=[
      {k:'cala',testo:'Cala',ok:!!(gruppi&&this.S.puoCalare(st,0,gruppi))},
      {k:'scarta',testo:'Scarta',ok:scarta},
      {k:'ordina',testo:this.ordine==='seme'?'Per valore':'Per seme',ok:true},
      {k:'aiuto',testo:'Aiuto',ok:gioca}
    ];
    if(this.basso){ const w=this.larghezzaBottoni(), h=36, y0=this.xyMazzo().y-this.ch*0.3+4;
      return voci.map((v,i)=>Object.assign(v,{x:this.W-this.pad-w,y:y0+i*(h+6)+34,w,h})); }
    const w=Math.min(96,(this.W-2*this.pad-24)/4), h=38, y=this.yBottoni()-h/2, x0=this.W/2-(w*4+24)/2;
    return voci.map((v,i)=>Object.assign(v,{x:x0+i*(w+8),y,w,h}));
  }
  dividi(sel){
    const R=this.regole();
    if(V.combinazioni.valida(sel,R)) return [sel];
    const sug=V.combinazioni.suggerisci(sel,R), usate=sug.flat();
    return usate.length===sel.length?sug:null;
  }
  disegnaExtra(c){
    for(const b of this.bottoni()){
      c.globalAlpha=b.ok?1:0.4;
      c.fillStyle=b.k==='cala'&&b.ok?'#e0b75a':'#0b1a12dd'; V.tondo(c,b.x,b.y,b.w,b.h,10); c.fill();
      c.strokeStyle='#e0b75a'; c.lineWidth=1.5; c.stroke();
      c.fillStyle=b.k==='cala'&&b.ok?'#2a1a10':'#f4ead2'; c.font='600 14px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle';
      c.fillText(b.testo,b.x+b.w/2,b.y+b.h/2+1);
      c.globalAlpha=1;
    }
    const st=this.st, mz=this.xyMazzo();
    if(this.mioTurno()){
      const t=st.fase==='pesca'?'Pesca: tocca il mazzo o gli scarti':'Scegli le carte · tocca una combinazione per attaccare';
      if(this.basso) this.pillola(st.fase==='pesca'?'Pesca':'Scegli le carte',this.pad,this.yManoGiu()-this.ch/2-2,'left',false);
      else this.pillola(t,this.W/2,this.yBottoni()-32,'center',false);
      if(st.fase==='pesca'){ c.strokeStyle='#ffd66b'; c.lineWidth=2; c.setLineDash([6,5]);
        V.tondo(c,mz.x-this.cw*mz.s/2-4,mz.y-this.ch*mz.s/2-4,this.cw*mz.s+8,this.ch*mz.s+8,8); c.stroke();
        const r=this.rettScarti; if(r&&this.S.mosseLegali(st,0).some(m=>m.da==='scarto')){ V.tondo(c,r.x-4,r.y-4,r.w+8,r.h+8,8); c.stroke(); }
        c.setLineDash([]); }
    }
    const yStato=this.basso?this.pad+12:mz.y+this.ch*0.36+12;
    if(st.gioco==='scala40'){
      const a=st.aperto&&st.aperto[0];
      this.pillola(a?'Hai aperto':'Apertura: 40 punti',this.W-this.pad,yStato,'right',false);
    } else if(st.pozzettoPreso){
      const mio=this.S.squadra(st,0);
      this.pillola(st.pozzettoPreso[mio]?'Pozzetto preso':'Pozzetto da prendere',this.W-this.pad,yStato,'right',false);
    }
  }

  // ---- gesti -------------------------------------------------------------
  dentro(r,x,y,m=6){ return r&&x>=r.x-m&&x<=r.x+r.w+m&&y>=r.y-m&&y<=r.y+r.h+m; }
  premi(e){
    V.audio.attiva();
    if(!this.mioTurno()) return;
    const {x,y}=this.punto(e), st=this.st;
    const b=this.bottoni().find(q=>this.dentro(q,x,y,4));
    if(b){ e.preventDefault(); if(b.ok) this.pulsante(b.k); return; }
    if(st.fase==='pesca'){
      const mz=this.xyMazzo(), rm={x:mz.x-this.cw*mz.s/2,y:mz.y-this.ch*mz.s/2,w:this.cw*mz.s,h:this.ch*mz.s};
      if(this.dentro(rm,x,y,10)) return this.agisci({tipo:'pesca',da:'mazzo'});
      if(this.dentro(this.rettScarti,x,y,10)){
        if(this.S.mosseLegali(st,0).some(m=>m.da==='scarto')) return this.agisci({tipo:'pesca',da:'scarto'});
        return this.scritta(st.gioco==='scala40'?'Gli scarti si prendono solo per aprire subito':'Adesso non puoi prendere gli scarti',1600);
      }
    }
    const id=this.sotto(st.mani[0],x,y);
    if(id){ this.drag={id,x,y,sx:x,sy:y,mosso:false,pid:e.pointerId}; try{ this.tela.setPointerCapture(e.pointerId); }catch(_){} e.preventDefault(); return; }
    const g=(this.rettGiochi||[]).find(r=>this.dentro(r,x,y));
    if(g&&this.sel.size) this.attacca(g.i,[...this.sel]);
  }
  rilascia(e){
    const d=this.drag; if(!d||e.pointerId!==d.pid) return;
    this.drag=null;
    if(!this.mioTurno()) return;
    const {x,y}=this.punto(e);
    if(!d.mosso){ if(this.sel.has(d.id)) this.sel.delete(d.id); else this.sel.add(d.id); V.suono('clic'); return; }
    if(this.st.fase!=='gioca') return;
    if(this.dentro(this.rettScarti,x,y,16)){ this.sel.clear(); return this.agisci({tipo:'scarta',carta:d.id}); }
    const g=(this.rettGiochi||[]).find(r=>this.dentro(r,x,y,8));
    if(g){ const carte=this.sel.has(d.id)?[...this.sel]:[d.id]; this.attacca(g.i,carte); }
  }
  attacca(i,carte){
    if(this.st.fase!=='gioca') return;
    if(!this.S.puoAttaccare(this.st,0,i,carte)) return this.scritta('Non si attacca lì',1300);
    this.agisci({tipo:'attacca',gioco:i,carte});
  }
  pulsante(k){
    V.suono('clic');
    const st=this.st, sel=[...this.sel];
    if(k==='ordina'){ this.ordine=this.ordine==='seme'?'valore':'seme'; return; }
    if(k==='scarta') return this.agisci({tipo:'scarta',carta:sel[0]});
    if(k==='cala') return this.agisci({tipo:'cala',gruppi:this.dividi(sel)});
    if(k==='aiuto'){
      const sug=V.combinazioni.suggerisci(st.mani[0],this.regole());
      if(!sug.length){ this.scritta('Nessuna combinazione in mano',1400); return; }
      const scelta=st.gioco==='scala40'&&!st.aperto[0]?sug.flat():sug[0];
      this.sel=new Set(scelta);
      if(st.gioco==='scala40'&&!st.aperto[0]&&!this.S.puoCalare(st,0,sug)) this.scritta('Non arrivi ancora a 40 punti',1600);
    }
  }

  // ---- mosse ---------------------------------------------------------------
  agisci(m){
    if(!m) return;
    const S=this.S, prev=this.st, p=prev.turno;
    let next;
    try{ next=S.applica(prev,m); }
    catch(err){ if(p===0){ this.scritta(err.message.charAt(0).toUpperCase()+err.message.slice(1),1800); V.vibra('forte'); return; } throw err; }
    this.st=next;
    if(p===0){ this.mosseFatte=true; V.vibra('leggera'); for(const id of [...this.sel]) if(!next.mani[0].includes(id)) this.sel.delete(id); }
    V.suono(m.tipo==='cala'||m.tipo==='attacca'?'presa':'carta');
    if(m.tipo==='cala'||m.tipo==='attacca'){
      const nuovi=next.giochi.filter((g,i)=>g.carte.length>=7&&!(prev.giochi[i]&&prev.giochi[i].carte.length>=7));
      if(prev.gioco==='burraco'&&nuovi.length){ this.scritta('BURRACO!',1400,true); V.suono('scopa'); V.vibra('forte'); }
    }
    if(next.pozzettoPreso&&prev.pozzettoPreso&&next.pozzettoPreso.some((v,i)=>v&&!prev.pozzettoPreso[i])) this.scritta(`${p===0?'Hai':this.op.nomi[p]+' ha'} preso il pozzetto`,1600);
    if(prev.gioco==='scala40'&&next.aperto&&!prev.aperto[p]&&next.aperto[p]) this.scritta(`${p===0?'Hai aperto!':this.op.nomi[p]+' ha aperto'}`,1400);
    const chiusa=next.finita||next.smazzata!==prev.smazzata;
    if(chiusa){
      this.vista=prev; this.sel.clear();
      if(!next.finita||next.abbandono==null) this.scritta(next.ultimaSmazzata&&next.finita?'Partita finita':'Smazzata chiusa',1400);
      this.dopo(1100,()=>{
        if(next.finita) return this.termina();
        this.pausa=true;
        const continua=()=>{ if(this.chiuso) return; this.pausa=false; this.vista=null; this.azioniBot=0; this.iniziaTurno(); };
        if(this.op.alSmazzata) this.op.alSmazzata(next.ultimaSmazzata,next,continua); else continua();
      });
      return;
    }
    if(next.turno!==p){ this.azioniBot=0; this.iniziaTurno(); }
    else if(p!==0) this.botAl=ORA()+(m.tipo==='pesca'?700:550);
  }

  logica(t){
    const st=this.st;
    if(st.finita) return this.termina();
    if(st.turno===0){
      const resta=this.scadenza-t, sec=Math.ceil(resta/1000);
      if(sec<=5&&sec>0&&sec!==this.ultimoTic){ this.ultimoTic=sec; V.suono('tic'); }
      if(resta<=0) this.tempoScaduto();
    } else if(t>=this.botAl){
      const p=st.turno;
      this.azioniBot=(this.azioniBot||0)+1;
      const m=this.azioniBot>MAX_AZIONI_BOT?this.S.mossaDiRiserva(st,p):this.S.bot(st,p,this.op.livelli[p]||5,this.rng);
      this.agisci(m||this.S.mossaDiRiserva(st,p));
    }
  }
  tempoScaduto(){
    this.scaduti++; this.sel.clear(); this.drag=null; V.vibra('forte');
    if(this.scaduti>=3){ this.scritta('Tre volte senza giocare: partita persa',2200); this.st=this.S.abbandona(this.st,0); return this.termina(); }
    this.scritta(`Tempo scaduto (${this.scaduti}/3)`,1500);
    for(let k=0;k<4&&this.st.turno===0&&!this.st.finita&&!this.coda.length;k++) this.agisci(this.S.mossaDiRiserva(this.st,0));
  }
}

V.TavoloCombinazioni=TavoloCombinazioni;
})(globalThis.V=globalThis.V||{});
