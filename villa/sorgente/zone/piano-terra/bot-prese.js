(function(V){'use strict';
// Bot di Briscola e Tressette. Usa solo ciò che vedrebbe un giocatore al suo posto: la propria mano,
// la mano in corso, la briscola scoperta, quante carte ha ciascuno, le carte già prese (ricordate
// secondo il livello), i segnali e, nel tressette a due, le carte pescate (che si mostrano).
const B=V.giochi.briscola, T=V.giochi.tressette;
const val=id=>V.carta.valore(id), seme=id=>V.carta.seme(id);

// Memoria: livello ≤3 non ricorda, 10 ricorda tutto; in mezzo ricorda le carte più forti.
const RANGHI={4:2,5:3,6:4,7:5,8:6,9:8};
function ricordate(G,st,livello){
  const k=livello>=10?10:(RANGHI[livello]||0);
  return k?st.prese.flat().filter(c=>G.forza(c)>10-k):[];
}

function contesto(G,st,posto,livello){
  const mie=st.mani[posto], viste=new Set([...mie,...st.mano.map(g=>g.carta),...ricordate(G,st,livello)]);
  if(G===B&&st.mazzo.length) viste.add(st.briscola);
  const ignote=V.mazzoNapoletano().filter(c=>!viste.has(c));
  // Carte di cui si sa chi le ha: pescate a vista (tressette a due) e il 3 di chi ha bussato.
  const note={};
  if(G===T&&livello>=4){
    for(const x of st.pescate) if(x.posto!==posto&&!viste.has(x.carta)) note[x.carta]=x.posto;
    for(const x of st.segnali) if(x.segnale==='busso'&&x.posto!==posto){ const tre='3'+seme(x.carta);
      if(!viste.has(tre)&&!(tre in note)) note[tre]=x.posto; }
  }
  return {mie,ignote,note,livello};
}

// Probabilità che fra h carte prese a caso da u ce ne sia almeno una delle b buone.
function almenoUna(b,h,u){
  if(b<=0||h<=0) return 0; h=Math.min(h,u); let q=1;
  for(let i=0;i<h;i++){ const f=(u-b-i)/(u-i); if(f<=0) return 1; q*=f; }
  return 1-q;
}

// Probabilità che qualcuno fra i giocatori indicati abbia una carta che batte.
function rischio(st,cx,batte,giocatori){
  if(!giocatori.length) return 0;
  const noteLoro=Object.keys(cx.note).filter(c=>giocatori.includes(cx.note[c]));
  if(noteLoro.some(batte)) return 1;
  const libere=cx.ignote.filter(c=>!(c in cx.note));
  const h=giocatori.reduce((a,q)=>a+st.mani[q].length,0)-noteLoro.length;
  return almenoUna(libere.filter(batte).length,h,libere.length);
}

// Chi deve ancora giocare dopo di me, diviso fra compagni e avversari.
function dopoDiMe(G,st,posto){
  const resto=[]; for(let k=1;k<st.n-st.mano.length;k++) resto.push((posto+k)%st.n);
  const mia=G.squadra(st,posto);
  return {compagni:resto.filter(q=>G.squadra(st,q)===mia),avversari:resto.filter(q=>G.squadra(st,q)!==mia)};
}

// Probabilità che la mia squadra prenda la mano se gioco c, e punti che ci sono in tavola.
function esito(G,st,posto,c,cx,sb){
  const dopo=[...st.mano,{posto,carta:c}], w=G.vincitoreMano(dopo,sb);
  const migliore=dopo.find(g=>g.posto===w).carta;
  const batte=x=>G.vincitoreMano([{posto:0,carta:migliore},{posto:1,carta:x}],sb)===1;
  const {compagni,avversari}=dopoDiMe(G,st,posto);
  const nostra=G.squadra(st,w)===G.squadra(st,posto);
  const pv=nostra?1-rischio(st,cx,batte,avversari):rischio(st,cx,batte,compagni)*0.8;
  const pt=G===B?B.punti:T.terzi;
  return {pv,tavola:dopo.reduce((a,g)=>a+pt(g.carta),0),w,nostra};
}

function valutaBriscola(st,posto,c,cx){
  const sb=seme(st.briscola), {pv,tavola}=esito(B,st,posto,c,cx,sb);
  let v=tavola*(2*pv-1);
  if(seme(c)===sb) v-=(2.5+B.forza(c)*0.6)*(st.mazzo.length?1:0.5);   // briscole da non sprecare
  return v-B.forza(c)*0.1;
}

const TIENI={3:2,2:1.2,1:0.4};
function valutaTressette(st,posto,c,cx){
  const {pv,tavola:t0,w}=esito(T,st,posto,c,cx);
  const ultima=st.mazzo.length===0&&st.mani[posto].length===1;
  const tavola=t0+(ultima?3:0);
  let v=tavola*(2*pv-1);
  if(!st.mano.length){                                         // apre: semi lunghi, conservare la mano
    v+=cx.mie.filter(x=>seme(x)===seme(c)).length*0.3+pv;
    if(st.n===4) for(const x of st.segnali)                     // tornare al seme dove il compagno ha bussato
      if(x.segnale==='busso'&&T.squadra(st,x.posto)===T.squadra(st,posto)&&x.posto!==posto&&seme(x.carta)===seme(c)
        &&cx.ignote.includes('3'+seme(c))) v+=2;
  } else {
    const prima=T.vincitoreMano(st.mano);
    if(st.n===4&&T.squadra(st,prima)===T.squadra(st,posto)&&w===posto) v-=1.5;   // non superare il compagno
  }
  v-=(TIENI[val(c)]||0)*(pv>0.5&&w===posto?0.4:1);               // tenere 3 e 2
  return v-T.forza(c)*0.05;
}

// Segnale di chi apre a coppie: busso se ha il 3 del seme, volo se è l'ultima, striscio se il seme è lungo.
function segnaleTressette(st,posto,c){
  const h=st.mani[posto], s=seme(c), delSeme=h.filter(x=>seme(x)===s);
  if(val(c)!==3&&delSeme.includes('3'+s)) return 'busso';
  if(delSeme.length===1) return 'volo';
  if(delSeme.length>=4) return 'striscio';
  return null;
}

// Finale a due col mazzo finito: al livello 10 le carte dell'altro sono tutte note, si calcola fino in fondo.
function finale(G,st,posto,cx){
  const alt=1-posto, sb=G===B?seme(st.briscola):null, pt=G===B?B.punti:T.terzi;
  if(cx.ignote.length!==st.mani[alt].length||cx.mie.length>5) return null;
  const legali=(h,mano)=>{ if(G===B||!mano.length) return h;
    const s=seme(mano[0].carta), x=h.filter(c=>seme(c)===s); return x.length?x:h; };
  const ord=a=>a.slice().sort((x,y)=>G.forza(x)-G.forza(y));
  const rec=(h,mano,turno)=>{
    if(mano.length===2){
      const w=G.vincitoreMano(mano,sb), fine=!h[0].length&&!h[1].length;
      const p=mano.reduce((a,g)=>a+pt(g.carta),0)+(G===T&&fine?3:0), d=w===posto?p:-p;
      return fine?d:d+rec(h,[],w);
    }
    let best=turno===posto?-Infinity:Infinity;
    for(const c of ord(legali(h[turno],mano))){
      const h2=h.slice(); h2[turno]=h[turno].filter(x=>x!==c);
      const r=rec(h2,[...mano,{posto:turno,carta:c}],1-turno);
      best=turno===posto?Math.max(best,r):Math.min(best,r);
    }
    return best;
  };
  const h=[]; h[posto]=cx.mie; h[alt]=cx.ignote;
  let scelta=null, top=-Infinity;
  for(const c of ord(legali(cx.mie,st.mano))){
    const h2=h.slice(); h2[posto]=cx.mie.filter(x=>x!==c);
    const r=rec(h2,[...st.mano,{posto,carta:c}],1-posto);
    if(r>top){ top=r; scelta=c; }
  }
  return scelta;
}

function creaBot(G,valuta){
  return function bot(st,posto,livello=5,rng=Math.random){
    const mosse=G.mosseLegali(st,posto);
    if(!mosse.length) return null;
    if(livello<=1) return mosse[Math.floor(rng()*mosse.length)];
    const semplici=mosse.filter(m=>!m.segnale), cx=contesto(G,st,posto,livello);
    let carta=livello>=10&&st.n===2&&st.mazzo.length===0?finale(G,st,posto,cx):null;
    if(!carta){
      let punti=-Infinity;
      for(const m of semplici){
        const v=valuta(st,posto,m.carta,cx)+(rng()-0.5)*(10-livello);
        if(v>punti){ punti=v; carta=m.carta; }
      }
    }
    if(G===T&&st.n===4&&!st.mano.length&&livello>=4){
      const s=segnaleTressette(st,posto,carta);
      if(s) return mosse.find(m=>m.carta===carta&&m.segnale===s);
    }
    return semplici.find(m=>m.carta===carta);
  };
}

B.bot=creaBot(B,valutaBriscola);
T.bot=creaBot(T,valutaTressette);
B.carteRicordate=(st,livello)=>ricordate(B,st,livello);
T.carteRicordate=(st,livello)=>ricordate(T,st,livello);
})(globalThis.V=globalThis.V||{});
