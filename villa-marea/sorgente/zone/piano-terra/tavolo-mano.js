(function(V){'use strict';
// Tavolo dei giochi a mani (Briscola, Tressette): ognuno cala una carta davanti a sé,
// chi vince la mano raccoglie. Riusa disegno, gesti e orologio del tavolo della Scopa.
const ORA=()=>performance.now();
const NOMI_SEGNALI={busso:'Busso',striscio:'Striscio',volo:'Volo'};

// La mano appena chiusa resta sul tavolo per un attimo.
function vistaMano(prev,m){
  const v=structuredClone(prev), p=prev.turno;
  v.mani[p]=v.mani[p].filter(c=>c!==m.carta);
  v.mano=[...v.mano,{posto:p,carta:m.carta}];
  return v;
}
function vistaRaccolta(prev,m,vincitore,S){
  const v=vistaMano(prev,m);
  v.prese[S.squadra(prev,vincitore)].push(...v.mano.map(g=>g.carta));
  v.mano=[];
  return v;
}

class TavoloMano extends V.Tavolo{
  opzioniPartita(op){
    const o={giocatori:op.giocatori};
    if(op.gioco==='tressette') o.obiettivo=op.breve?11:21;
    return o;
  }

  disponiMazzo(st,out){
    const mz=this.xyMazzo(), br=st.briscola, coperte=st.mazzo.filter(id=>id!==br);
    coperte.forEach((id,i)=>{ const k=coperte.length-1-i;
      out.push({id,x:mz.x-Math.min(k,10)*0.6,y:mz.y-Math.min(k,10)*0.6,r:0,s:mz.s,su:false,z:10+k,basso:k>4}); });
    if(br&&st.mazzo.includes(br))
      out.push({id:br,x:mz.x+this.cw*mz.s*0.55,y:mz.y+this.ch*mz.s*0.12,r:Math.PI/2,s:mz.s,su:true,z:5});
  }

  xyGiocata(p){
    const c=this.centro(), cw=this.cw, ch=this.ch, lt=this.lati[p];
    const d=this.basso?0.3:0.42;
    if(lt==='giu') return {x:c.x,y:c.y+ch*d,r:0.04};
    if(lt==='su') return {x:c.x,y:c.y-ch*d,r:-0.05};
    if(lt==='destra') return {x:c.x+cw*0.95,y:c.y,r:0.12};
    return {x:c.x-cw*0.95,y:c.y,r:-0.1};
  }
  disponiCentro(st,out){
    (st.mano||[]).forEach((g,i)=>{ const q=this.xyGiocata(g.posto);
      out.push({id:g.carta,x:q.x,y:q.y,r:q.r,s:this.basso?0.85:0.95,su:true,z:300+i}); });
  }

  // Nessuna presa da scegliere: basta lasciare la carta sopra la propria mano.
  mossaVerso(id){
    const mosse=this.S.mosseLegali(this.st,0).filter(m=>m.carta===id);
    if(!mosse.length) return null;
    const conSegnale=this.segnale&&mosse.find(m=>m.segnale===this.segnale);
    return conSegnale||mosse.find(m=>!m.segnale)||mosse[0];
  }
  luci(){ return {luce:new Set(),forte:new Set()}; }

  puoSegnalare(){ return this.mioTurno()&&this.S.mosseLegali(this.st,0).some(m=>m.segnale); }

  // Punti delle carte già prese (solo per mostrarli).
  puntiCarte(){
    const st=this.st, S=this.S;
    if(st.gioco==='briscola') return st.prese.map(p=>p.reduce((a,c)=>a+S.punti(c),0));
    if(st.terzi) return st.terzi.map(t=>Math.floor(t/3));
    return null;
  }

  gioca(m){
    if(!m) return;
    const S=this.S, prev=this.st, p=prev.turno, next=S.applica(prev,m), u=next.ultimaMossa;
    this.st=next; this.scelta=null; this.segnale=null;
    V.suono('carta'); if(p===0){ V.vibra('leggera'); this.mosseFatte=true; }
    if(u.segnale) this.scritta(`${p===0?'Tu':this.op.nomi[p]}: ${NOMI_SEGNALI[u.segnale]}!`,1800);
    const chiusa=next.finita||next.smazzata!==prev.smazzata;
    if(!u.chiudeMano){ this.vista=null; this.iniziaTurno(); return; }
    // mano chiusa: si guarda un attimo, poi si raccoglie e si pesca
    this.vista=vistaMano(prev,m);
    const w=u.vincitore, mio=S.squadra(prev,w)===S.squadra(prev,0);
    this.dopo(950,()=>{
      V.suono('presa');
      if(mio&&(u.presa||[]).some(g=>V.carta.valore(g.carta)===1||V.carta.valore(g.carta)===3)&&prev.gioco==='briscola') V.vibra('leggera');
      if(!chiusa){
        this.vista=null;
        if(prev.n===2&&prev.gioco==='tressette'&&u.pescate){
          this.scoperte=this.scoperte||{};
          for(const q of u.pescate) if(q.posto!==0) this.scoperte[q.carta]=ORA()+1600;
        }
        this.iniziaTurno(); return;
      }
      this.vista=vistaRaccolta(prev,m,w,S);
      this.dopo(850,()=>{
        if(next.finita) return this.termina();
        this.pausa=true;
        const continua=()=>{ if(this.chiuso) return; this.pausa=false; this.vista=null; this.iniziaTurno(); };
        if(this.op.alSmazzata) this.op.alSmazzata(next.ultimaSmazzata,next,continua); else continua();
      });
    });
  }

  // ---- segnali del Tressette a coppie ------------------------------------
  bottoniSegnali(){
    if(!this.puoSegnalare()) return [];
    const w=76, h=34, y=this.yManoGiu()-this.ch/2-this.ch*0.16-58, x0=this.W/2-(w*3+16)/2;
    return Object.keys(NOMI_SEGNALI).map((k,i)=>({k,x:x0+i*(w+8),y,w,h}));
  }
  premi(e){
    const {x,y}=this.punto(e);
    const b=this.bottoniSegnali().find(q=>x>=q.x&&x<=q.x+q.w&&y>=q.y-6&&y<=q.y+q.h+6);
    if(b){ this.segnale=this.segnale===b.k?null:b.k; V.suono('clic'); e.preventDefault(); return; }
    super.premi(e);
  }
  disegnaExtra(c){
    for(const b of this.bottoniSegnali()){
      const on=this.segnale===b.k;
      c.fillStyle=on?'#e0b75a':'#0b1a12cc'; V.tondo(c,b.x,b.y,b.w,b.h,10); c.fill();
      c.strokeStyle='#e0b75a'; c.lineWidth=1.5; c.stroke();
      c.fillStyle=on?'#2a1a10':'#f4ead2'; c.font='600 13px system-ui,sans-serif'; c.textAlign='center'; c.textBaseline='middle';
      c.fillText(NOMI_SEGNALI[b.k],b.x+b.w/2,b.y+b.h/2+1);
    }
    const pc=this.puntiCarte();
    if(pc){ const mio=this.S.squadra(this.st,0);
      const mz=this.xyMazzo();
      this.pillola(`Punti: ${pc[mio]} – ${pc[1-mio]}`,this.pad,mz.y+this.ch*mz.s*0.5+(this.st.mazzo.length?40:14),'left',false); }
  }
}

V.TavoloMano=TavoloMano;
})(globalThis.V=globalThis.V||{});
