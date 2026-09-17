(function(V){'use strict';
// Bot di Scala 40 e Burraco. Usa solo ciò che vedrebbe un giocatore al suo posto: la propria mano,
// le combinazioni sul tavolo, gli scarti, i pozzetti già presi. Mai le mani degli altri, il mazzo o i pozzetti.
// Ogni chiamata restituisce UNA mossa della fase in corso; chi lo usa lo richiama finché il turno non cambia.
const C=()=>V.combinazioni, Fr=()=>V.francese;
const MAX_AZIONI=30;
const val=id=>Fr().valore(id), seme=id=>Fr().seme(id), jolly=id=>Fr().jolly(id);
const alto=v=>v===1?14:v;
const distanza=(a,b)=>Math.min(Math.abs(a-b),Math.abs(alto(a)-alto(b)));

// Quanto conviene tenere la carta c: matte sempre, poi carte vicine o uguali ad altre della mano.
function utilita(c,mano,R){
  if(C().selvaggia(c,R)) return 100;
  const v=val(c), s=seme(c); let u=0;
  for(const x of mano){
    if(x===c||C().selvaggia(x,R)) continue;
    const vx=val(x), sx=seme(x);
    if(vx===v){ if(sx!==s||R.gioco==='burraco') u+=2; }   // doppione nella Scala 40: non serve
    else if(sx===s){ const d=distanza(v,vx); if(d===1) u+=2; else if(d===2) u+=1; }
  }
  return u;
}

// La carta entrerebbe in una combinazione che può usare chi gioca dopo?
function servirebbeAlProssimo(G,st,posto,c){
  const q=(posto+1)%st.n;
  if(st.gioco==='scala40'&&!st.aperto[q]) return false;
  const sq=G.squadra(st,q);
  return st.giochi.some(g=>(st.gioco==='scala40'||g.squadra===sq)&&C().puoAttaccare(g,[c],G.regole));
}

function attaccabile(G,st,posto,c){
  const sq=G.squadra(st,posto);
  return st.giochi.some(g=>(st.gioco==='scala40'||g.squadra===sq)&&C().puoAttaccare(g,[c],G.regole));
}

function sceltaPesca(G,st,posto,livello,rng){
  const mosse=G.mosseLegali(st,posto), dalMazzo=mosse.find(m=>m.da==='mazzo')||mosse[0];
  const scarto=mosse.find(m=>m.da==='scarto');
  if(!scarto||livello<=1) return dalMazzo;
  const R=G.regole, mano=st.mani[posto];
  let prendi;
  if(st.gioco==='scala40'){
    const top=st.scarti[st.scarti.length-1];
    if(!st.aperto[posto]) prendi=true;   // offerto solo se con lui si apre
    else prendi=jolly(top)||attaccabile(G,st,posto,top)||C().suggerisci([...mano,top],R).some(g=>g.includes(top));
  } else {
    const monte=st.scarti, gr=C().suggerisci([...mano,...monte],R).flat();
    let utili=monte.filter(c=>gr.includes(c)||attaccabile(G,st,posto,c)||C().selvaggia(c,R)).length;
    prendi=utili>=(livello>=5?1:2)||monte.length>=6&&livello>=5;
    // Con pozzetto preso e poche carte il monte non si riesce a calare: si ripescherebbe e riscarterebbe.
    if(st.pozzettoPreso[G.squadra(st,posto)]&&mano.length+monte.length<4) prendi=false;
  }
  if(rng()<(10-livello)*0.03) prendi=!prendi;
  return prendi?scarto:dalMazzo;
}

// Toglie gruppi dal fondo finché la calata non diventa ammessa.
function calataAmmessa(G,st,posto,gr){
  gr=gr.slice();
  while(gr.length&&!G.puoCalare(st,posto,gr)) gr.pop();
  return gr.length?gr:null;
}

function bot(st,posto,livello=5,rng=Math.random){
  const G=V.giochi[st.gioco];
  if(!G||st.finita||st.turno!==posto) return null;
  if(st.fase==='pesca') return sceltaPesca(G,st,posto,livello,rng);
  const R=G.regole, mano=st.mani[posto], mosse=G.mosseLegali(st,posto);
  if(livello<=1) return mosse.length?mosse[Math.floor(rng()*mosse.length)]:G.mossaDiRiserva(st,posto);
  if(st.azioniTurno<MAX_AZIONI){
    // Calare.
    let gr=null;
    if(st.gioco==='scala40'&&!st.aperto[posto]) gr=G.apertura(mano,st.presaScarto&&st.presaScarto.carta);
    else if(st.gioco!=='scala40'||st.aperto[posto]) gr=C().suggerisci(mano,R);
    if(gr&&gr.length&&(gr=calataAmmessa(G,st,posto,gr))) return {tipo:'cala',gruppi:gr};
    // Attaccare (le matte solo a fine mano).
    const puoAttaccare=st.gioco!=='scala40'||st.aperto[posto];
    if(puoAttaccare) for(const c of mano){
      if(C().selvaggia(c,R)&&mano.length>3) continue;
      for(let i=0;i<st.giochi.length;i++) if(G.puoAttaccare(st,posto,i,[c])) return {tipo:'attacca',gioco:i,carte:[c]};
    }
  }
  if(!mosse.length) return G.mossaDiRiserva(st,posto);
  // Scartare la carta meno utile.
  let best=null, punti=Infinity;
  for(const m of mosse){
    let u=utilita(m.carta,mano,R)-C().punti(m.carta,R)*(st.gioco==='scala40'?0.05:0.02);
    if(livello>=6&&servirebbeAlProssimo(G,st,posto,m.carta)) u+=5;
    u+=(rng()-0.5)*(10-livello)*0.8;
    if(u<punti){ punti=u; best=m; }
  }
  return best;
}

V.giochi.scala40.bot=bot;
V.giochi.burraco.bot=bot;
V.botCombinazioni={bot,utilita};
})(globalThis.V=globalThis.V||{});
