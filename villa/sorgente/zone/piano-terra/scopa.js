(function(V){'use strict';
// Regole della Scopa: funzioni pure, lo stato non si modifica mai sul posto.
const PRIMIERA={7:21,6:18,1:16,5:15,4:14,3:13,2:12,8:10,9:10,10:10};
const val=id=>V.carta.valore(id);
const squadra=(st,posto)=>st.n===4?posto%2:posto;
const nSquadre=st=>st.n===4?2:st.n;
const stesse=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));

function somme(carte,obiettivo){
  const out=[];
  const rec=(i,acc,s)=>{
    if(s===obiettivo){ if(acc.length>=2) out.push(acc.slice()); return; }
    for(let j=i;j<carte.length;j++){ const v=val(carte[j]);
      if(s+v<=obiettivo){ acc.push(carte[j]); rec(j+1,acc,s+v); acc.pop(); } }
  };
  rec(0,[],0); return out;
}

// Se in tavola c'è una carta dello stesso valore si prende quella, altrimenti una somma.
function prese(tavola,carta){
  const singole=tavola.filter(t=>val(t)===val(carta));
  return singole.length?singole.map(t=>[t]):somme(tavola,val(carta));
}

function distribuisci(st){ for(let k=0;k<3;k++) for(let p=0;p<st.n;p++) st.mani[p].push(st.mazzo.shift()); }

function smazza(st){
  st.mazzo=V.mescola(V.mazzoNapoletano(),st.seme+':'+st.smazzata);
  st.tavola=st.mazzo.splice(0,4);
  st.mani=Array.from({length:st.n},()=>[]); distribuisci(st);
  st.prese=Array.from({length:nSquadre(st)},()=>[]);
  st.scope=new Array(nSquadre(st)).fill(0);
  st.ultimaPresa=null; st.turno=(st.mazziere+1)%st.n;
}

function valorePrimiera(carte){
  let tot=0;
  for(const s of V.SEMI){
    const delSeme=carte.filter(c=>V.carta.seme(c)===s);
    if(!delSeme.length) return 0;
    tot+=Math.max(...delSeme.map(c=>PRIMIERA[val(c)]));
  }
  return tot;
}

function contaSmazzata(pr,scope){
  const ns=pr.length, zero=()=>new Array(ns).fill(0);
  const unico=arr=>{ const m=Math.max(...arr), w=arr.flatMap((x,i)=>x===m?[i]:[]); return w.length===1?w[0]:-1; };
  const valori={ carte:pr.map(p=>p.length),
    denari:pr.map(p=>p.filter(c=>V.carta.seme(c)==='D').length),
    primiera:pr.map(valorePrimiera) };
  const r={carte:zero(),denari:zero(),settebello:zero(),primiera:zero(),scope:scope.slice(),totale:zero(),valori};
  let w=unico(valori.carte); if(w>=0) r.carte[w]=1;
  w=unico(valori.denari); if(w>=0) r.denari[w]=1;
  pr.forEach((p,i)=>{ if(p.includes('7D')) r.settebello[i]=1; });
  w=unico(valori.primiera); if(w>=0&&valori.primiera[w]>0) r.primiera[w]=1;
  for(let i=0;i<ns;i++) r.totale[i]=r.carte[i]+r.denari[i]+r.settebello[i]+r.primiera[i]+r.scope[i];
  return r;
}

function chiudiSmazzata(st){
  if(st.ultimaPresa!==null) st.prese[st.ultimaPresa].push(...st.tavola);
  st.tavola=[];
  const d=contaSmazzata(st.prese,st.scope);
  d.totale.forEach((x,i)=>{ st.punti[i]+=x; });
  d.smazzata=st.smazzata; st.ultimaSmazzata=d;
  const max=Math.max(...st.punti), primi=st.punti.flatMap((x,i)=>x===max?[i]:[]);
  if(max>=st.obiettivo&&primi.length===1){ st.finita=true; st.vincitore=primi[0]; }
  else { st.smazzata++; st.mazziere=(st.mazziere+1)%st.n; smazza(st); }
}

function nuovaPartita(seme,{giocatori=2,obiettivo=11}={}){
  if(giocatori!==2&&giocatori!==4) throw new Error('la scopa si gioca in 2 o in 4');
  const st={gioco:'scopa',n:giocatori,obiettivo,seme:String(seme),smazzata:0,mazziere:0,
    punti:new Array(giocatori===4?2:giocatori).fill(0),ultimaMossa:null,ultimaSmazzata:null,
    finita:false,vincitore:null,abbandono:null};
  smazza(st); return st;
}

function mosseLegali(st,posto){
  if(st.finita||st.turno!==posto) return [];
  return st.mani[posto].flatMap(c=>{
    const o=prese(st.tavola,c);
    return o.length?o.map(p=>({carta:c,presa:p})):[{carta:c,presa:[]}];
  });
}

function applica(st0,m){
  if(st0.finita) throw new Error('partita finita');
  const st=structuredClone(st0), p=st.turno, mano=st.mani[p], i=mano.indexOf(m.carta);
  if(i<0) throw new Error('carta non in mano');
  const presa=m.presa||[], legali=prese(st.tavola,m.carta);
  if(legali.length?!legali.some(o=>stesse(o,presa)):presa.length) throw new Error('presa non valida');
  mano.splice(i,1);
  const sq=squadra(st,p);
  st.ultimaMossa={posto:p,carta:m.carta,presa:presa.slice(),scopa:false,smazzata:st.smazzata};
  if(presa.length){
    st.tavola=st.tavola.filter(t=>!presa.includes(t));
    st.prese[sq].push(m.carta,...presa); st.ultimaPresa=sq;
    const ultimaCarta=st.mazzo.length===0&&st.mani.every(h=>h.length===0);
    if(st.tavola.length===0&&!ultimaCarta){ st.scope[sq]++; st.ultimaMossa.scopa=true; }
  } else st.tavola.push(m.carta);
  st.turno=(p+1)%st.n;
  if(st.mani.every(h=>h.length===0)){ if(st.mazzo.length) distribuisci(st); else chiudiSmazzata(st); }
  return st;
}

// Abbandono (tre tempi scaduti): vince la squadra avversaria.
function abbandona(st0,posto){
  const st=structuredClone(st0), sq=squadra(st,posto);
  st.finita=true; st.abbandono=posto;
  st.vincitore=st.n===4?1-sq:1-posto;
  return st;
}

// Quando scade il tempo: la carta di valore più basso.
function mossaDiRiserva(st,posto){
  return mosseLegali(st,posto).sort((a,b)=>val(a.carta)-val(b.carta))[0]||null;
}

V.giochi=V.giochi||{};
V.giochi.scopa={id:'scopa',nome:'Scopa',giocatori:[2,4],nuovaPartita,mosseLegali,applica,abbandona,
  finita:st=>st.finita,punteggio:st=>st.punti,squadra,prese,contaSmazzata,valorePrimiera,mossaDiRiserva};
})(globalThis.V=globalThis.V||{});
