(function(V){'use strict';
// Regole della Briscola: funzioni pure, lo stato non si modifica mai sul posto.
const FORZA={1:10,3:9,10:8,9:7,8:6,7:5,6:4,5:3,4:2,2:1};   // A>3>R>C>F>7>6>5>4>2
const PUNTI={1:11,3:10,10:4,9:3,8:2};                      // 120 in tutto
const val=id=>V.carta.valore(id), seme=id=>V.carta.seme(id);
const forza=id=>FORZA[val(id)], punti=id=>PUNTI[val(id)]||0;
const squadra=(st,posto)=>st.n===4?posto%2:posto;
const nSquadre=st=>st.n===4?2:st.n;

// Chi prende: la briscola più alta, altrimenti la più alta del seme di uscita. mano=[{posto,carta}]
function vincitoreMano(mano,semeBriscola){
  let m=mano[0];
  for(const g of mano.slice(1)){
    const sg=seme(g.carta), sm=seme(m.carta);
    if(sg===semeBriscola&&sm!==semeBriscola||sg===sm&&forza(g.carta)>forza(m.carta)) m=g;
  }
  return m.posto;
}

// Tre carte a testa a partire da chi gioca per primo; la carta dopo è la briscola, in fondo al mazzo.
function smazza(st){
  st.mazzo=V.mescola(V.mazzoNapoletano(),st.seme+':'+st.smazzata);
  st.mani=Array.from({length:st.n},()=>[]);
  const primo=(st.mazziere+1)%st.n;
  for(let k=0;k<3;k++) for(let i=0;i<st.n;i++) st.mani[(primo+i)%st.n].push(st.mazzo.shift());
  st.briscola=st.mazzo.shift(); st.mazzo.push(st.briscola);
  st.mano=[]; st.prese=Array.from({length:nSquadre(st)},()=>[]);
  st.turno=primo;
}

function contaSmazzata(pr){
  const valori=pr.map(p=>p.reduce((a,c)=>a+punti(c),0));
  const vinta=valori.map(v=>v>60?1:0);
  return {carte:pr.map(p=>p.length),valori,vinta,pareggio:!vinta.some(x=>x),totale:vinta.slice()};
}

function chiudiSmazzata(st){
  const d=contaSmazzata(st.prese);
  d.totale.forEach((x,i)=>{ st.punti[i]+=x; });
  d.smazzata=st.smazzata; d.partita=st.punti.slice(); st.ultimaSmazzata=d;
  const max=Math.max(...st.punti), primi=st.punti.flatMap((x,i)=>x===max?[i]:[]);
  if(max>=st.obiettivo&&primi.length===1){ st.finita=true; st.vincitore=primi[0]; }
  else { st.smazzata++; st.mazziere=(st.mazziere+1)%st.n; smazza(st); }
}

// obiettivo = smazzate da vincere: 1 partita secca, 2 breve, 3 lunga.
function nuovaPartita(seme,{giocatori=2,obiettivo=1}={}){
  if(giocatori!==2&&giocatori!==4) throw new Error('la briscola si gioca in 2 o in 4');
  const st={gioco:'briscola',n:giocatori,obiettivo,seme:String(seme),smazzata:0,mazziere:0,
    punti:new Array(giocatori===4?2:giocatori).fill(0),ultimaMossa:null,ultimaSmazzata:null,
    finita:false,vincitore:null,abbandono:null};
  smazza(st); return st;
}

// Nessun obbligo di rispondere al seme: vale ogni carta in mano.
function mosseLegali(st,posto){
  if(st.finita||st.turno!==posto) return [];
  return st.mani[posto].map(c=>({carta:c}));
}

function applica(st0,m){
  if(st0.finita) throw new Error('partita finita');
  if(!m||m.segnale) throw new Error('mossa non valida');
  const st=structuredClone(st0), p=st.turno, mano=st.mani[p], i=mano.indexOf(m.carta);
  if(i<0) throw new Error('carta non in mano');
  mano.splice(i,1); st.mano.push({posto:p,carta:m.carta});
  st.ultimaMossa={posto:p,carta:m.carta,chiudeMano:false,smazzata:st.smazzata};
  if(st.mano.length<st.n){ st.turno=(p+1)%st.n; return st; }
  // Mano chiusa: prende chi vince, poi si pesca a partire da lui.
  const w=vincitoreMano(st.mano,seme(st.briscola)), pescate=[];
  st.prese[squadra(st,w)].push(...st.mano.map(g=>g.carta));
  Object.assign(st.ultimaMossa,{chiudeMano:true,vincitore:w,presa:st.mano,pescate});
  st.mano=[];
  if(st.mazzo.length) for(let k=0;k<st.n;k++){ const q=(w+k)%st.n, c=st.mazzo.shift();
    st.mani[q].push(c); pescate.push({posto:q,carta:c}); }
  st.turno=w;
  if(st.mani.every(h=>h.length===0)) chiudiSmazzata(st);
  return st;
}

// Abbandono (tre tempi scaduti): vince la squadra avversaria.
function abbandona(st0,posto){
  const st=structuredClone(st0), sq=squadra(st,posto);
  st.finita=true; st.abbandono=posto;
  st.vincitore=st.n===4?1-sq:1-posto;
  return st;
}

// Quando scade il tempo: la carta più debole (a parità, non di briscola).
function mossaDiRiserva(st,posto){
  const sb=st.briscola&&seme(st.briscola), k=c=>forza(c)*2+(seme(c)===sb?1:0);
  return mosseLegali(st,posto).sort((a,b)=>k(a.carta)-k(b.carta))[0]||null;
}

// Tabella dei risultati della smazzata appena chiusa (totale = punteggio della partita).
function riepilogo(st){
  const d=st.ultimaSmazzata; if(!d) return null;
  return {righe:[{nome:'Carte prese',valori:d.carte},{nome:'Punti',valori:d.valori},
    {nome:'Smazzata vinta',valori:d.vinta}],totale:d.vinta.slice()};
}

V.giochi=V.giochi||{};
V.giochi.briscola={id:'briscola',nome:'Briscola',giocatori:[2,4],nuovaPartita,mosseLegali,applica,abbandona,
  finita:st=>st.finita,punteggio:st=>st.punti,squadra,mossaDiRiserva,riepilogo,
  vincitoreMano,contaSmazzata,forza,punti};
})(globalThis.V=globalThis.V||{});
