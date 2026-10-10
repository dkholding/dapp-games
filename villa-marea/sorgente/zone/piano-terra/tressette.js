(function(V){'use strict';
// Regole del Tressette: funzioni pure, lo stato non si modifica mai sul posto.
// I punti si tengono in terzi (A=3, 3/2/figure=1) e si arrotondano per difetto a fine smazzata.
const FORZA={3:10,2:9,1:8,10:7,9:6,8:5,7:4,6:3,5:2,4:1};   // 3>2>A>R>C>F>7>6>5>4
const TERZI={1:3,2:1,3:1,10:1,9:1,8:1};
const SEGNALI=['busso','striscio','volo'];
const val=id=>V.carta.valore(id), seme=id=>V.carta.seme(id);
const forza=id=>FORZA[val(id)], terzi=id=>TERZI[val(id)]||0;
const squadra=(st,posto)=>st.n===4?posto%2:posto;
const nSquadre=st=>st.n===4?2:st.n;

// Prende la carta più forte del seme di uscita. mano=[{posto,carta}]
function vincitoreMano(mano){
  let m=mano[0];
  for(const g of mano.slice(1)) if(seme(g.carta)===seme(m.carta)&&forza(g.carta)>forza(m.carta)) m=g;
  return m.posto;
}

// Dieci carte a testa; a due ne restano venti nel mazzo.
function smazza(st){
  st.mazzo=V.mescola(V.mazzoNapoletano(),st.seme+':'+st.smazzata);
  st.mani=Array.from({length:st.n},()=>[]);
  const primo=(st.mazziere+1)%st.n;
  for(let k=0;k<10;k++) for(let i=0;i<st.n;i++) st.mani[(primo+i)%st.n].push(st.mazzo.shift());
  st.mano=[]; st.prese=Array.from({length:nSquadre(st)},()=>[]);
  st.terzi=new Array(nSquadre(st)).fill(0);
  st.segnali=[]; st.pescate=[]; st.ultimaPresa=null;
  st.turno=primo;
}

// terziCarte per squadra, ultima = [1,0] per chi ha fatto l'ultima presa.
function contaSmazzata(pr,ultima){
  const terziCarte=pr.map(p=>p.reduce((a,c)=>a+terzi(c),0));
  const u=pr.map((_,i)=>i===ultima?1:0);
  return {carte:pr.map(p=>p.length),terziCarte,puntiCarte:terziCarte.map(t=>Math.floor(t/3)),ultima:u,
    totale:terziCarte.map((t,i)=>Math.floor((t+3*u[i])/3))};
}

function chiudiSmazzata(st){
  const d=contaSmazzata(st.prese,st.ultimaPresa);
  d.totale.forEach((x,i)=>{ st.punti[i]+=x; });
  d.smazzata=st.smazzata; d.partita=st.punti.slice(); st.ultimaSmazzata=d;
  const max=Math.max(...st.punti), primi=st.punti.flatMap((x,i)=>x===max?[i]:[]);
  if(max>=st.obiettivo&&primi.length===1){ st.finita=true; st.vincitore=primi[0]; }
  else { st.smazzata++; st.mazziere=(st.mazziere+1)%st.n; smazza(st); }
}

function nuovaPartita(seme,{giocatori=2,obiettivo=21}={}){
  if(giocatori!==2&&giocatori!==4) throw new Error('il tressette si gioca in 2 o in 4');
  const st={gioco:'tressette',n:giocatori,obiettivo,seme:String(seme),smazzata:0,mazziere:0,
    punti:new Array(giocatori===4?2:giocatori).fill(0),ultimaMossa:null,ultimaSmazzata:null,
    finita:false,vincitore:null,abbandono:null};
  smazza(st); return st;
}

// Carte giocabili: obbligo di rispondere al seme se si può.
function carteGiocabili(st,posto){
  const h=st.mani[posto];
  if(!st.mano.length) return h.slice();
  const s=seme(st.mano[0].carta), stesso=h.filter(c=>seme(c)===s);
  return stesso.length?stesso:h.slice();
}
const puoSegnalare=st=>st.n===4&&st.mano.length===0;

// A coppie chi apre la mano può accompagnare la carta con un segnale al compagno.
function mosseLegali(st,posto){
  if(st.finita||st.turno!==posto) return [];
  const carte=carteGiocabili(st,posto);
  return puoSegnalare(st)?carte.flatMap(c=>[{carta:c},...SEGNALI.map(s=>({carta:c,segnale:s}))])
    :carte.map(c=>({carta:c}));
}

function applica(st0,m){
  if(st0.finita) throw new Error('partita finita');
  if(!m) throw new Error('mossa non valida');
  const st=structuredClone(st0), p=st.turno, mano=st.mani[p], i=mano.indexOf(m.carta);
  if(i<0) throw new Error('carta non in mano');
  if(!carteGiocabili(st,p).includes(m.carta)) throw new Error('bisogna rispondere al seme');
  if(m.segnale&&!(puoSegnalare(st)&&SEGNALI.includes(m.segnale))) throw new Error('segnale non valido');
  mano.splice(i,1); st.mano.push({posto:p,carta:m.carta});
  st.ultimaMossa={posto:p,carta:m.carta,chiudeMano:false,smazzata:st.smazzata};
  if(m.segnale){ st.ultimaMossa.segnale=m.segnale; st.segnali.push({posto:p,carta:m.carta,segnale:m.segnale}); }
  if(st.mano.length<st.n){ st.turno=(p+1)%st.n; return st; }
  // Mano chiusa: prende chi vince; a due si pesca (prima il vincitore) e le carte pescate si vedono.
  const w=vincitoreMano(st.mano), sq=squadra(st,w), pescate=[];
  st.prese[sq].push(...st.mano.map(g=>g.carta));
  st.terzi[sq]+=st.mano.reduce((a,g)=>a+terzi(g.carta),0);
  st.ultimaPresa=sq;
  Object.assign(st.ultimaMossa,{chiudeMano:true,vincitore:w,presa:st.mano,pescate});
  st.mano=[];
  if(st.mazzo.length) for(let k=0;k<st.n;k++){ const q=(w+k)%st.n, c=st.mazzo.shift();
    st.mani[q].push(c); pescate.push({posto:q,carta:c}); st.pescate.push({posto:q,carta:c}); }
  st.turno=w;
  if(st.mani.every(h=>h.length===0)){ st.terzi[sq]+=3; st.ultimaMossa.ultima=true; chiudiSmazzata(st); }
  return st;
}

// Abbandono (tre tempi scaduti): vince la squadra avversaria.
function abbandona(st0,posto){
  const st=structuredClone(st0), sq=squadra(st,posto);
  st.finita=true; st.abbandono=posto;
  st.vincitore=st.n===4?1-sq:1-posto;
  return st;
}

// Quando scade il tempo: la carta giocabile più debole, senza segnale.
function mossaDiRiserva(st,posto){
  return mosseLegali(st,posto).filter(m=>!m.segnale).sort((a,b)=>forza(a.carta)-forza(b.carta))[0]||null;
}

// Tabella dei risultati della smazzata appena chiusa (totale = punteggio della partita).
function riepilogo(st){
  const d=st.ultimaSmazzata; if(!d) return null;
  return {righe:[{nome:'Carte prese',valori:d.carte},{nome:'Punti delle carte',valori:d.puntiCarte},
    {nome:'Ultima presa',valori:d.ultima}],totale:d.totale.slice()};
}

V.giochi=V.giochi||{};
V.giochi.tressette={id:'tressette',nome:'Tressette',giocatori:[2,4],nuovaPartita,mosseLegali,applica,abbandona,
  finita:st=>st.finita,punteggio:st=>st.punti,squadra,mossaDiRiserva,riepilogo,
  vincitoreMano,contaSmazzata,forza,terzi,SEGNALI};
})(globalThis.V=globalThis.V||{});
