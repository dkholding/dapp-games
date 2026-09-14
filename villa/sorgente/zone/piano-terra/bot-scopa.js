(function(V){'use strict';
// Bot della Scopa. Usa solo ciò che vedrebbe un giocatore al suo posto:
// la propria mano, la tavola e le carte già prese da tutti.
const S=V.giochi.scopa, val=id=>V.carta.valore(id);

const carteViste=(st,posto)=>[...st.prese.flat(),...st.tavola,...st.mani[posto]];

function valuta(st,m,livello,viste){
  const tutte=[m.carta,...m.presa]; let v=0;
  if(m.presa.length){
    v+=tutte.length;
    v+=tutte.filter(c=>V.carta.seme(c)==='D').length*1.5;
    if(tutte.includes('7D')) v+=10;
    v+=tutte.filter(c=>val(c)===7).length*3;
    if(m.presa.length===st.tavola.length) v+=15;          // scopa (o quasi, all'ultima carta)
  } else {
    if(val(m.carta)===7) v-=4;
    if(m.carta==='7D') v-=12;
    if(V.carta.seme(m.carta)==='D') v-=1;
  }
  // Rischio di lasciare una scopa facile all'avversario.
  const resto=m.presa.length?st.tavola.filter(t=>!m.presa.includes(t)):[...st.tavola,m.carta];
  const somma=resto.reduce((a,c)=>a+val(c),0);
  if(resto.length&&somma<=10){
    let rischio=8;
    if(viste){ const uscite=viste.filter(c=>val(c)===somma).length; rischio*=Math.max(0,4-uscite)/4; }
    v-=rischio*(livello/10);
  }
  return v;
}

function bot(st,posto,livello=5,rng=Math.random){
  const mosse=S.mosseLegali(st,posto);
  if(!mosse.length) return null;
  if(livello<=1) return mosse[Math.floor(rng()*mosse.length)];
  const viste=livello>=6?carteViste(st,posto):null;
  let migliore=mosse[0], punti=-Infinity;
  for(const m of mosse){
    const v=valuta(st,m,livello,viste)+(rng()-0.5)*(10-livello)*1.2;
    if(v>punti){ punti=v; migliore=m; }
  }
  return migliore;
}

S.bot=bot; S.carteViste=carteViste;
})(globalThis.V=globalThis.V||{});
