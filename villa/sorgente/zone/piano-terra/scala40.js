(function(V){'use strict';
// Regole della Scala 40: funzioni pure, lo stato non si modifica mai sul posto.
// Turno: pesca → cala/attacca quante volte vuole → scarta. Ognuno gioca per sé (squadra = posto).
const R={gioco:'scala40'};
const MAX_RIMESCOLATE=3;   // poi, a mazzo finito, la smazzata si chiude senza chi chiude (evita partite infinite)
const C=()=>V.combinazioni;
const squadra=(st,posto)=>posto;
const attivi=st=>st.eliminati.flatMap((e,i)=>e?[]:[i]);
const dopo=(st,p)=>{ for(let k=1;k<=st.n;k++){ const q=(p+k)%st.n; if(!st.eliminati[q]) return q; } return p; };
const togli=(mano,carte)=>{ for(const c of carte) mano.splice(mano.indexOf(c),1); };
const penalita=mano=>mano.reduce((a,c)=>a+C().punti(c,R),0);

function smazza(st){
  st.mazzo=V.mescola(V.mazzoFrancese(),st.seme+':'+st.smazzata);
  st.mani=Array.from({length:st.n},()=>[]);
  const primo=dopo(st,st.mazziere), gira=attivi(st).length;
  for(let k=0;k<13;k++){ let q=primo; for(let i=0;i<gira;i++){ st.mani[q].push(st.mazzo.shift()); q=dopo(st,q); } }
  st.scarti=[st.mazzo.shift()];
  st.giochi=[]; st.aperto=new Array(st.n).fill(false);
  st.turno=primo; st.fase='pesca'; st.presaScarto=null; st.azioniTurno=0; st.rimescolate=0;
}

function nuovaPartita(seme,{giocatori=2,breve=false}={}){
  if(giocatori<2||giocatori>4) throw new Error('la scala 40 si gioca da 2 a 4');
  const st={gioco:'scala40',n:giocatori,obiettivo:breve?51:101,seme:String(seme),smazzata:0,mazziere:0,
    punti:new Array(giocatori).fill(0),eliminati:new Array(giocatori).fill(false),
    ultimaMossa:null,ultimaSmazzata:null,finita:false,vincitore:null,abbandono:null};
  smazza(st); return st;
}

// Apertura possibile con la mano (se deve è data, deve servire a calare quella carta): gruppi o null.
function apertura(mano,deve){
  const gr=C().suggerisci(mano,R).sort((a,b)=>C().valore(b,R)-C().valore(a,R));
  if(deve&&!gr.some(g=>g.includes(deve))) return null;
  while(gr.flat().length>=mano.length){
    let i=gr.length-1; while(i>=0&&deve&&gr[i].includes(deve)) i--;
    if(i<0) return null; gr.splice(i,1);
  }
  return gr.reduce((a,g)=>a+C().valore(g,R),0)>=40?gr:null;
}

function puoPescareScarto(st,posto){
  if(!st.scarti.length) return false;
  if(st.aperto[posto]) return true;
  const top=st.scarti[st.scarti.length-1];
  return !!apertura([...st.mani[posto],top],top);
}

// Dopo aver calato deve restare in mano una carta scartabile (non quella appena presa dagli scarti).
function controllaResto(st,posto,usate){
  const pr=st.presaScarto;
  if(!st.mani[posto].some(c=>!usate.includes(c)&&(!pr||c!==pr.carta))) throw new Error('deve restare una carta da scartare');
}

// Controlla una calata; se non va lancia l'errore col motivo.
function controllaCala(st,posto,gruppi){
  const mano=st.mani[posto];
  if(!Array.isArray(gruppi)||!gruppi.length||!gruppi.every(Array.isArray)) throw new Error('calata non valida');
  const tutte=gruppi.flat();
  if(new Set(tutte).size!==tutte.length) throw new Error('carta ripetuta');
  if(!tutte.every(c=>mano.includes(c))) throw new Error('carta non in mano');
  const esiti=gruppi.map(g=>C().valida(g,R));
  if(esiti.some(r=>!r)) throw new Error('combinazione non valida');
  controllaResto(st,posto,tutte);
  if(!st.aperto[posto]&&gruppi.reduce((a,g)=>a+C().valore(g,R),0)<40) throw new Error('per aprire servono 40 punti');
  return esiti;
}

function puoCalare(st,posto,gruppi){
  if(st.finita||st.turno!==posto||st.fase!=='gioca') return false;
  try{ controllaCala(st,posto,gruppi); return true; }catch(e){ return false; }
}

function controllaAttacca(st,posto,i,carte){
  const mano=st.mani[posto], g=st.giochi[i];
  if(!g) throw new Error('combinazione inesistente');
  if(!st.aperto[posto]) throw new Error('prima bisogna aprire');
  if(!Array.isArray(carte)||!carte.length||new Set(carte).size!==carte.length) throw new Error('carte non valide');
  if(!carte.every(c=>mano.includes(c))) throw new Error('carta non in mano');
  controllaResto(st,posto,carte);
  const r=C().puoAttaccare(g,carte,R);
  if(!r) throw new Error('non si attacca');
  return r;
}

function puoAttaccare(st,posto,i,carte){
  if(st.finita||st.turno!==posto||st.fase!=='gioca') return false;
  try{ controllaAttacca(st,posto,i,carte); return true; }catch(e){ return false; }
}

function scartiLegali(st,posto){
  const mano=st.mani[posto], pr=st.presaScarto;
  if(pr&&pr.obbligo&&mano.includes(pr.carta)) return [];
  if(mano.length===1&&!st.aperto[posto]) return [];
  return mano.filter(c=>!pr||c!==pr.carta);
}

function mosseLegali(st,posto){
  if(st.finita||st.turno!==posto) return [];
  if(st.fase==='pesca'){
    const m=[];
    if(st.mazzo.length) m.push({tipo:'pesca',da:'mazzo'});
    if(puoPescareScarto(st,posto)) m.push({tipo:'pesca',da:'scarto'});
    return m;
  }
  return scartiLegali(st,posto).map(carta=>({tipo:'scarta',carta}));
}

// Mazzo finito: si rimescolano gli scarti tranne quello in cima.
function rimescola(st){
  if(st.mazzo.length||st.scarti.length<2) return;
  const cima=st.scarti.pop();
  st.mazzo=V.mescola(st.scarti,st.seme+':'+st.smazzata+':r'+(st.rimescolate++));
  st.scarti=[cima];
}

function passaTurno(st,p){
  st.turno=dopo(st,p); st.fase='pesca'; st.presaScarto=null; st.azioniTurno=0;
  if(!st.mazzo.length&&st.rimescolate<MAX_RIMESCOLATE) rimescola(st);
  if(!st.mazzo.length) chiudiSmazzata(st,null);
}

function chiudiSmazzata(st,chi){
  const totale=new Array(st.n).fill(0), carte=new Array(st.n).fill(0);
  for(const p of attivi(st)){
    carte[p]=st.mani[p].length;
    totale[p]=p===chi?0:!st.aperto[p]?100:penalita(st.mani[p]);
    st.punti[p]+=totale[p];
  }
  const prima=attivi(st);
  st.ultimaSmazzata={smazzata:st.smazzata,chiude:chi,aperto:st.aperto.slice(),carte,totale,
    eliminati:st.eliminati.slice(),partita:st.punti.slice()};
  for(const p of prima) if(st.punti[p]>st.obiettivo) st.eliminati[p]=true;
  const rimasti=attivi(st);
  if(rimasti.length===1){ st.finita=true; st.vincitore=rimasti[0]; return; }
  if(!rimasti.length){
    // Tutti fuori insieme: vince chi ha meno punti, a pari punti il primo di mano.
    const min=Math.min(...prima.map(p=>st.punti[p]));
    for(let k=1;k<=st.n;k++){ const q=(st.mazziere+k)%st.n; if(prima.includes(q)&&st.punti[q]===min){ st.vincitore=q; break; } }
    st.finita=true; return;
  }
  st.smazzata++; st.mazziere=dopo(st,st.mazziere); smazza(st);
}

function applica(st0,m){
  if(st0.finita) throw new Error('partita finita');
  if(!m||typeof m!=='object') throw new Error('mossa non valida');
  const st=structuredClone(st0), p=st.turno, mano=st.mani[p];
  const base={posto:p,tipo:m.tipo,smazzata:st.smazzata};
  if(m.tipo==='pesca'){
    if(st.fase!=='pesca') throw new Error('hai già pescato');
    if(m.da==='mazzo'){
      if(!st.mazzo.length) throw new Error('mazzo finito');
      mano.push(st.mazzo.shift());
      st.ultimaMossa={...base,da:'mazzo'};
    } else if(m.da==='scarto'){
      if(!puoPescareScarto(st0,p)) throw new Error('non puoi prendere lo scarto');
      const c=st.scarti.pop(); mano.push(c);
      st.presaScarto={carta:c,obbligo:!st.aperto[p]};
      st.ultimaMossa={...base,da:'scarto',carta:c};
    } else throw new Error('mossa non valida');
    st.fase='gioca'; return st;
  }
  if(st.fase!=='gioca') throw new Error('prima bisogna pescare');
  if(m.tipo==='cala'){
    const esiti=controllaCala(st,p,m.gruppi);
    const apre=!st.aperto[p];
    for(const r of esiti){ togli(mano,r.ordine); st.giochi.push({squadra:p,posto:p,carte:r.ordine,tipo:r.tipo,jolly:r.jolly}); }
    st.aperto[p]=true; st.azioniTurno++;
    st.ultimaMossa={...base,gruppi:esiti.map(r=>r.ordine),apre};
    return st;
  }
  if(m.tipo==='attacca'){
    const r=controllaAttacca(st,p,m.gioco,m.carte);
    togli(mano,m.carte);
    Object.assign(st.giochi[m.gioco],{carte:r.ordine,jolly:r.jolly});
    st.azioniTurno++;
    st.ultimaMossa={...base,gioco:m.gioco,carte:m.carte.slice()};
    return st;
  }
  if(m.tipo==='scarta'){
    if(!mano.includes(m.carta)) throw new Error('carta non in mano');
    if(!scartiLegali(st,p).includes(m.carta)) throw new Error(st.presaScarto&&st.presaScarto.obbligo
      &&mano.includes(st.presaScarto.carta)?'devi aprire usando lo scarto preso':'scarto non valido');
    togli(mano,[m.carta]); st.scarti.push(m.carta);
    st.ultimaMossa={...base,carta:m.carta,chiude:mano.length===0};
    if(!mano.length) chiudiSmazzata(st,p); else passaTurno(st,p);
    return st;
  }
  throw new Error('mossa non valida');
}

// Abbandono (tre tempi scaduti): vince l'avversario, a 3-4 quello con meno punti.
function abbandona(st0,posto){
  const st=structuredClone(st0);
  st.finita=true; st.abbandono=posto; st.eliminati[posto]=true;
  let best=null;
  for(let k=1;k<st.n;k++){ const q=(posto+k)%st.n; if(!st.eliminati[q]&&(best===null||st.punti[q]<st.punti[best])) best=q; }
  st.vincitore=best;
  return st;
}

// Quando scade il tempo: pesca dal mazzo, poi scarta la carta che pesa di più (il jolly per ultimo).
function mossaDiRiserva(st,posto){
  if(st.finita||st.turno!==posto) return null;
  if(st.fase==='pesca') return mosseLegali(st,posto)[0]||null;
  const leg=scartiLegali(st,posto);
  if(!leg.length){
    const pr=st.presaScarto, gr=pr&&apertura(st.mani[posto],pr.carta);
    return gr?{tipo:'cala',gruppi:gr}:null;
  }
  const k=c=>V.francese.jolly(c)?-1:C().punti(c,R);
  const carta=leg.slice().sort((a,b)=>k(b)-k(a))[0];
  return {tipo:'scarta',carta};
}

function riepilogo(st){
  const d=st.ultimaSmazzata; if(!d) return null;
  const fuori=i=>d.eliminati[i];
  return {righe:[
    {nome:'Aperto',valori:d.aperto.map((a,i)=>fuori(i)?'—':a?'sì':'no')},
    {nome:'Carte in mano',valori:d.carte.map((x,i)=>fuori(i)?'—':x)},
    {nome:'Chiude',valori:d.carte.map((_,i)=>fuori(i)?'—':d.chiude===i?'sì':'·')},
    {nome:'Penalità',valori:d.totale.map((x,i)=>fuori(i)?'—':x)}],
    totale:d.totale.slice()};
}

V.giochi=V.giochi||{};
V.giochi.scala40={id:'scala40',nome:'Scala 40',giocatori:[2,4],nuovaPartita,mosseLegali,applica,abbandona,
  finita:st=>st.finita,punteggio:st=>st.punti,squadra,mossaDiRiserva,riepilogo,
  puoCalare,puoAttaccare,puoPescareScarto,apertura,penalita,regole:R,MAX_RIMESCOLATE};
})(globalThis.V=globalThis.V||{});
