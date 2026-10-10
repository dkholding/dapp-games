(function(V){'use strict';
// Regole del Burraco: funzioni pure, lo stato non si modifica mai sul posto.
// Turno: pesca (dal mazzo una carta, dagli scarti tutto il monte) → cala/attacca → scarta.
// A 4 si gioca in coppia (0 e 2 contro 1 e 3); a 2 ognuno per sé.
const R={gioco:'burraco'};
const C=()=>V.combinazioni;
const squadra=(st,posto)=>st.n===4?posto%2:posto;
const togli=(mano,carte)=>{ for(const c of carte) mano.splice(mano.indexOf(c),1); };
const valoreCarte=carte=>carte.reduce((a,c)=>a+C().punti(c,R),0);
const haBurraco=(st,sq)=>st.giochi.some(g=>g.squadra===sq&&g.carte.length>=7);

function smazza(st){
  st.mazzo=V.mescola(V.mazzoFrancese(),st.seme+':'+st.smazzata);
  st.mani=Array.from({length:st.n},()=>[]);
  const primo=(st.mazziere+1)%st.n;
  for(let k=0;k<11;k++) for(let i=0;i<st.n;i++) st.mani[(primo+i)%st.n].push(st.mazzo.shift());
  st.pozzetti=[st.mazzo.splice(0,11),st.mazzo.splice(0,11)];
  st.pozzettoPreso=[false,false];
  st.scarti=[st.mazzo.shift()];
  st.giochi=[];
  st.turno=primo; st.fase='pesca'; st.azioniTurno=0; st.scartoPreso=null;
}

function nuovaPartita(seme,{giocatori=2,breve=false}={}){
  if(giocatori!==2&&giocatori!==4) throw new Error('il burraco si gioca in 2 o in 4');
  const st={gioco:'burraco',n:giocatori,obiettivo:breve?1005:2005,seme:String(seme),smazzata:0,mazziere:0,
    punti:[0,0],ultimaMossa:null,ultimaSmazzata:null,finita:false,vincitore:null,abbandono:null};
  smazza(st); return st;
}

// Quante carte possono restare in mano dopo aver calato/attaccato.
// 0 solo se il pozzetto è ancora da prendere; 1 solo se poi si può chiudere (pozzetto preso e un burraco).
function controllaResto(st,posto,resto,burracoDopo){
  const sq=squadra(st,posto);
  if(st.pozzettoPreso[sq]){
    if(resto<1) throw new Error('per chiudere bisogna scartare');
    if(resto<2&&!burracoDopo) throw new Error('per chiudere serve un burraco');
  }
}

// Mano vuota a metà turno: si prende il pozzetto e si continua.
function prendiPozzetto(st,posto){
  const sq=squadra(st,posto);
  st.mani[posto]=st.pozzetti[sq]; st.pozzetti[sq]=[]; st.pozzettoPreso[sq]=true;
}

function controllaCala(st,posto,gruppi){
  const mano=st.mani[posto];
  if(!Array.isArray(gruppi)||!gruppi.length||!gruppi.every(Array.isArray)) throw new Error('calata non valida');
  const tutte=gruppi.flat();
  if(new Set(tutte).size!==tutte.length) throw new Error('carta ripetuta');
  if(!tutte.every(c=>mano.includes(c))) throw new Error('carta non in mano');
  const esiti=gruppi.map(g=>C().valida(g,R));
  if(esiti.some(r=>!r)) throw new Error('combinazione non valida');
  controllaResto(st,posto,mano.length-tutte.length,haBurraco(st,squadra(st,posto))||gruppi.some(g=>g.length>=7));
  return esiti;
}

function controllaAttacca(st,posto,i,carte){
  const mano=st.mani[posto], g=st.giochi[i];
  if(!g) throw new Error('combinazione inesistente');
  if(g.squadra!==squadra(st,posto)) throw new Error('si attacca solo alle proprie combinazioni');
  if(!Array.isArray(carte)||!carte.length||new Set(carte).size!==carte.length) throw new Error('carte non valide');
  if(!carte.every(c=>mano.includes(c))) throw new Error('carta non in mano');
  const r=C().puoAttaccare(g,carte,R);
  if(!r) throw new Error('non si attacca');
  controllaResto(st,posto,mano.length-carte.length,haBurraco(st,g.squadra)||r.ordine.length>=7);
  return r;
}

const prova=f=>{ try{ f(); return true; }catch(e){ return false; } };
function puoCalare(st,posto,gruppi){
  return !st.finita&&st.turno===posto&&st.fase==='gioca'&&prova(()=>controllaCala(st,posto,gruppi));
}
function puoAttaccare(st,posto,i,carte){
  return !st.finita&&st.turno===posto&&st.fase==='gioca'&&prova(()=>controllaAttacca(st,posto,i,carte));
}

// Chi ha preso un monte di una carta sola non può riscartarla subito.
function scartiLegali(st,posto){
  const mano=st.mani[posto], sq=squadra(st,posto);
  if(mano.length===1&&st.pozzettoPreso[sq]&&!haBurraco(st,sq)) return [];
  return mano.filter(c=>c!==st.scartoPreso||mano.length===1);
}

function mosseLegali(st,posto){
  if(st.finita||st.turno!==posto) return [];
  if(st.fase==='pesca'){
    const m=[];
    if(st.mazzo.length) m.push({tipo:'pesca',da:'mazzo'});
    if(st.scarti.length) m.push({tipo:'pesca',da:'scarto'});
    return m;
  }
  return [...new Set(scartiLegali(st,posto))].map(carta=>({tipo:'scarta',carta}));
}

function passaTurno(st,p){
  st.turno=(p+1)%st.n; st.fase='pesca'; st.azioniTurno=0; st.scartoPreso=null;
  if(st.mazzo.length<2) chiudiSmazzata(st,null);
}

// Punti della smazzata per squadra.
function contaSmazzata(st,chi){
  const z=()=>[0,0];
  const d={calate:z(),mano:z(),puliti:z(),sporchi:z(),burraco:z(),chiusura:z(),pozzetto:z(),totale:z()};
  for(const g of st.giochi){
    d.calate[g.squadra]+=valoreCarte(g.carte);
    if(g.carte.length>=7){
      const pulito=!(C().valida(g.carte,R)||{jolly:[1]}).jolly.length;
      if(pulito){ d.puliti[g.squadra]++; d.burraco[g.squadra]+=200; }
      else { d.sporchi[g.squadra]++; d.burraco[g.squadra]+=100; }
    }
  }
  st.mani.forEach((h,p)=>{ d.mano[squadra(st,p)]-=valoreCarte(h); });
  if(chi!==null) d.chiusura[squadra(st,chi)]=100;
  for(let s=0;s<2;s++){
    if(!st.pozzettoPreso[s]) d.pozzetto[s]=-100;
    d.totale[s]=d.calate[s]+d.mano[s]+d.burraco[s]+d.chiusura[s]+d.pozzetto[s];
  }
  return d;
}

function chiudiSmazzata(st,chi){
  const d=contaSmazzata(st,chi);
  d.totale.forEach((x,i)=>{ st.punti[i]+=x; });
  d.smazzata=st.smazzata; d.chiude=chi; d.partita=st.punti.slice(); st.ultimaSmazzata=d;
  const max=Math.max(...st.punti), primi=st.punti.flatMap((x,i)=>x===max?[i]:[]);
  if(max>=st.obiettivo&&primi.length===1){ st.finita=true; st.vincitore=primi[0]; }
  else { st.smazzata++; st.mazziere=(st.mazziere+1)%st.n; smazza(st); }
}

function applica(st0,m){
  if(st0.finita) throw new Error('partita finita');
  if(!m||typeof m!=='object') throw new Error('mossa non valida');
  const st=structuredClone(st0), p=st.turno, sq=squadra(st,p);
  const base={posto:p,tipo:m.tipo,smazzata:st.smazzata};
  if(m.tipo==='pesca'){
    if(st.fase!=='pesca') throw new Error('hai già pescato');
    if(m.da==='mazzo'){
      if(!st.mazzo.length) throw new Error('mazzo finito');
      st.mani[p].push(st.mazzo.shift());
      st.ultimaMossa={...base,da:'mazzo'};
    } else if(m.da==='scarto'){
      if(!st.scarti.length) throw new Error('niente scarti');
      const presi=st.scarti; st.scarti=[];
      st.mani[p].push(...presi);
      st.scartoPreso=presi.length===1?presi[0]:null;
      st.ultimaMossa={...base,da:'scarto',carte:presi.slice()};
    } else throw new Error('mossa non valida');
    st.fase='gioca'; return st;
  }
  if(st.fase!=='gioca') throw new Error('prima bisogna pescare');
  if(m.tipo==='cala'||m.tipo==='attacca'){
    if(m.tipo==='cala'){
      const esiti=controllaCala(st,p,m.gruppi);
      for(const r of esiti){ togli(st.mani[p],r.ordine); st.giochi.push({squadra:sq,posto:p,carte:r.ordine,tipo:r.tipo,jolly:r.jolly}); }
      st.ultimaMossa={...base,gruppi:esiti.map(r=>r.ordine)};
    } else {
      const r=controllaAttacca(st,p,m.gioco,m.carte);
      togli(st.mani[p],m.carte);
      Object.assign(st.giochi[m.gioco],{carte:r.ordine,jolly:r.jolly});
      st.ultimaMossa={...base,gioco:m.gioco,carte:m.carte.slice()};
    }
    st.azioniTurno++;
    if(!st.mani[p].length){ prendiPozzetto(st,p); st.ultimaMossa.pozzetto=true; }
    return st;
  }
  if(m.tipo==='scarta'){
    const mano=st.mani[p];
    if(!mano.includes(m.carta)) throw new Error('carta non in mano');
    if(!scartiLegali(st,p).includes(m.carta)) throw new Error(m.carta===st.scartoPreso?'non si riscarta la carta appena presa':'per chiudere serve un burraco');
    togli(mano,[m.carta]); st.scarti.push(m.carta);
    st.ultimaMossa={...base,carta:m.carta,chiude:false,pozzetto:false};
    if(!mano.length){
      if(!st.pozzettoPreso[sq]){ prendiPozzetto(st,p); st.ultimaMossa.pozzetto=true; }   // lo guarda al prossimo turno
      else { st.ultimaMossa.chiude=true; chiudiSmazzata(st,p); return st; }
    }
    passaTurno(st,p);
    return st;
  }
  throw new Error('mossa non valida');
}

// Abbandono (tre tempi scaduti): vince la squadra avversaria.
function abbandona(st0,posto){
  const st=structuredClone(st0);
  st.finita=true; st.abbandono=posto; st.vincitore=1-squadra(st,posto);
  return st;
}

// Quando scade il tempo: pesca dal mazzo, poi scarta la carta che vale di più (matte per ultime).
function mossaDiRiserva(st,posto){
  if(st.finita||st.turno!==posto) return null;
  if(st.fase==='pesca') return mosseLegali(st,posto)[0]||null;
  const k=c=>C().selvaggia(c,R)?-1:C().punti(c,R);
  const carta=scartiLegali(st,posto).sort((a,b)=>k(b)-k(a))[0];
  return carta?{tipo:'scarta',carta}:null;
}

function riepilogo(st){
  const d=st.ultimaSmazzata; if(!d) return null;
  const segno=a=>a.map(x=>x>0?'+'+x:x<0?String(x):'·');
  return {righe:[
    {nome:'Carte calate',valori:segno(d.calate)},
    {nome:'Carte in mano',valori:segno(d.mano)},
    {nome:'Burraco',valori:d.burraco.map((x,i)=>(x?'+'+x:'·')+` (${d.puliti[i]} puliti, ${d.sporchi[i]} sporchi)`)},
    {nome:'Chiusura',valori:segno(d.chiusura)},
    {nome:'Pozzetto non preso',valori:segno(d.pozzetto)}],
    totale:d.totale.slice()};
}

V.giochi=V.giochi||{};
V.giochi.burraco={id:'burraco',nome:'Burraco',giocatori:[2,4],nuovaPartita,mosseLegali,applica,abbandona,
  finita:st=>st.finita,punteggio:st=>st.punti,squadra,mossaDiRiserva,riepilogo,
  puoCalare,puoAttaccare,contaSmazzata,haBurraco,regole:R};
})(globalThis.V=globalThis.V||{});
