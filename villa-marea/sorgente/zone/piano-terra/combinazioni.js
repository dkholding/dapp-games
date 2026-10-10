(function(V){'use strict';
// Combinazioni di Scala 40 e Burraco (carte francesi): funzioni pure.
// Scala = stesso seme, valori consecutivi (asso basso A-2-3 o alto Q-K-A, niente giro K-A-2).
// Tris = stesso valore (nella Scala 40 semi tutti diversi e al massimo 4 carte).
// Matte: il jolly; nel Burraco anche i 2 (pinelle), che però in scala al loro posto contano naturali.
// Al massimo una matta per combinazione.
const F=()=>V.francese;
const val=id=>F().valore(id), seme=id=>F().seme(id), jolly=id=>F().jolly(id);
const gioco=r=>(r&&r.gioco)||'scala40';
const selvaggia=(id,g)=>jolly(id)||g==='burraco'&&val(id)===2;
const ORDINE_SEMI={C:0,Q:1,F:2,P:3};

// Mette in fila le naturali (tutte dello stesso seme) e riempie i buchi con la matta.
function disponi(nat,wild,g){
  const s=seme(nat[0]);
  if(nat.some(c=>seme(c)!==s)) return null;
  const assi=nat.filter(c=>val(c)===1), resto=nat.filter(c=>val(c)!==1);
  if(assi.length>(g==='burraco'?2:1)) return null;
  const mappa0=new Map();
  for(const c of resto){ if(mappa0.has(val(c))) return null; mappa0.set(val(c),c); }
  const opzioni=assi.length===0?[[]]:assi.length===1?[[1],[14]]:[[1,14]];
  for(const pa of opzioni){
    const mappa=new Map(mappa0);
    pa.forEach((p,i)=>mappa.set(p,assi[i]));
    const ps=[...mappa.keys()].sort((a,b)=>a-b), lo=ps[0], hi=ps[ps.length-1];
    const buchi=hi-lo+1-ps.length;
    if(buchi>wild.length) continue;
    let a=lo,b=hi;
    if(wild.length>buchi){ if(hi<14) b=hi+1; else if(lo>1) a=lo-1; else continue; }
    if(g!=='burraco'&&a===1&&b===14) continue;
    const ordine=[], pos=[];
    for(let p=a;p<=b;p++){ ordine.push(mappa.get(p)||wild[0]); pos.push(p); }
    return {tipo:'scala',ordine,pos,jolly:wild.slice()};
  }
  return null;
}

function scala(carte,g){
  const J=carte.filter(jolly), altre=carte.filter(c=>!jolly(c));
  const due=g==='burraco'?altre.filter(c=>val(c)===2):[];
  const fisse=altre.filter(c=>!due.includes(c));
  let best=null;
  for(let mask=0;mask<1<<due.length;mask++){
    const nat=fisse.slice(), wild=J.slice();
    due.forEach((c,i)=>(mask>>i&1?nat:wild).push(c));
    if(wild.length>1||!nat.length) continue;
    if(best&&wild.length>=best.jolly.length) continue;
    const r=disponi(nat,wild,g);
    if(r) best=r;
  }
  return best;
}

function tris(carte,g){
  const wild=carte.filter(c=>selvaggia(c,g)), nat=carte.filter(c=>!selvaggia(c,g));
  if(wild.length>1||nat.length<2) return null;
  const v=val(nat[0]);
  if(nat.some(c=>val(c)!==v)) return null;
  if(g==='scala40'&&(carte.length>4||new Set(nat.map(seme)).size!==nat.length)) return null;
  nat.sort((a,b)=>ORDINE_SEMI[seme(a)]-ORDINE_SEMI[seme(b)]);
  const ordine=[...nat,...wild];
  return {tipo:'tris',ordine,pos:ordine.map(()=>v),jolly:wild};
}

// → {tipo, ordine, pos, jolly} oppure null.
function valida(carte,regole){
  const g=gioco(regole);
  if(!Array.isArray(carte)||carte.length<3||new Set(carte).size!==carte.length) return null;
  if(carte.every(c=>selvaggia(c,g))) return null;
  return scala(carte,g)||tris(carte,g);
}

// Punti di una carta: in mano (penalità della Scala 40) o sul tavolo (Burraco).
function punti(id,regole){
  const v=val(id);
  if(gioco(regole)==='burraco'){
    if(jolly(id)) return 30;
    if(v===2) return 20;
    if(v===1) return 15;
    return v>=8?10:5;
  }
  if(jolly(id)) return 25;
  if(v===1) return 11;
  return v>=11?10:v;
}

// Punti di una combinazione. Scala 40: valore d'apertura (la matta vale la carta che sostituisce,
// l'asso vale 1 solo in scala bassa). Burraco: somma dei valori delle carte.
function valore(carte,regole){
  const r=valida(carte,regole); if(!r) return 0;
  if(gioco(regole)==='burraco') return r.ordine.reduce((a,c)=>a+punti(c,regole),0);
  return r.pos.reduce((a,p)=>a+(p===1&&r.tipo==='scala'?1:p===1||p===14?11:p>=11?10:p),0);
}

// Attaccare carte a una combinazione già sul tavolo ({carte, tipo}): la nuova combinazione o null.
function puoAttaccare(g,carte,regole){
  if(!g||!Array.isArray(carte)||!carte.length) return null;
  const r=valida([...g.carte,...carte],regole);
  return r&&r.tipo===g.tipo?r:null;
}

// Suggerimento: combinazioni disgiunte scelte fra quelle possibili con la mano (ricerca limitata).
const LIMITE=300;
function suggerisci(mano,regole){
  const g=gioco(regole), Fr=F(), bur=g==='burraco';
  const copie=new Map(), jol=[];
  for(const c of mano){ if(jolly(c)){ jol.push(c); continue; }
    const k=Fr.base(c); if(!copie.has(k)) copie.set(k,[]); copie.get(k).push(c); }
  const disp=new Map([...copie].map(([k,a])=>[k,a.length]));
  const ha=k=>(disp.get(k)||0)>0;
  const cand=[], visti=new Set();
  const aggiungi=(chiavi,wild)=>{
    const nome=chiavi.join(',')+'|'+wild; if(visti.has(nome)) return; visti.add(nome);
    const finte=chiavi.map((k,i)=>k+'#'+(i+10)); if(wild) finte.push('JK#99');
    const r=valida(finte,regole); if(!r) return;
    const v=valore(finte,regole);
    cand.push({chiavi,wild,score:v+finte.length*3-wild*(bur?10:2)});
  };
  // Scale: ogni tratto con al massimo un buco (riempito dalla matta), anche col buco a un'estremità.
  for(const s of V.SEMI_FRANCESI){
    const k=p=>Fr.chiave(p===14?1:p,s);
    for(let a=1;a<=14;a++){
      let manca=0; const chiavi=[];
      for(let b=a;b<=14;b++){
        if(!bur&&a===1&&b===14) break;
        if(ha(k(b))&&!(b===14&&a===1&&disp.get(k(b))<2)) chiavi.push(k(b));
        else if(++manca>1) break;
        if(b-a+1<3||chiavi.length<2) continue;
        aggiungi(chiavi.slice(),manca);
      }
    }
  }
  // Tris / combinazioni.
  for(let v=1;v<=13;v++){
    if(bur&&v===2) continue;
    if(bur){
      const lista=[];
      for(const s of V.SEMI_FRANCESI){ const kk=Fr.chiave(v,s); for(let i=0;i<(disp.get(kk)||0);i++) lista.push(kk); }
      for(let n=2;n<=lista.length;n++){ if(n>=3) aggiungi(lista.slice(0,n),0); aggiungi(lista.slice(0,n),1); }
    } else {
      const semi=V.SEMI_FRANCESI.filter(s=>ha(Fr.chiave(v,s)));
      for(let m=1;m<1<<semi.length;m++){
        const chiavi=semi.filter((_,i)=>m>>i&1).map(s=>Fr.chiave(v,s));
        if(chiavi.length>=3) aggiungi(chiavi,0);
        if(chiavi.length>=2&&chiavi.length<=3) aggiungi(chiavi,1);
      }
    }
  }
  cand.sort((a,b)=>b.score-a.score);
  let jd=jol.length, best={score:0,sel:[]}, nodi=0;
  const prendi=c=>{
    for(const k of c.chiavi) disp.set(k,disp.get(k)-1);
    let ok=c.chiavi.every(k=>disp.get(k)>=0), usata=null;
    if(ok&&c.wild){
      if(jd>0){ jd--; usata='JK'; }
      else if(bur){ for(const s of V.SEMI_FRANCESI){ const kk=Fr.chiave(2,s); if(ha(kk)){ disp.set(kk,disp.get(kk)-1); usata=kk; break; } } }
      if(!usata) ok=false;
    }
    if(!ok){ for(const k of c.chiavi) disp.set(k,disp.get(k)+1); return null; }
    return {c,usata};
  };
  const rendi=x=>{
    for(const k of x.c.chiavi) disp.set(k,disp.get(k)+1);
    if(x.usata==='JK') jd++; else if(x.usata) disp.set(x.usata,disp.get(x.usata)+1);
  };
  const sel=[];
  const rec=(i,score)=>{
    if(score>best.score) best={score,sel:sel.slice()};
    if(++nodi>LIMITE) return;
    for(let j=i;j<cand.length&&nodi<=LIMITE;j++){
      const x=prendi(cand[j]); if(!x) continue;
      sel.push(x); rec(j,score+cand[j].score); sel.pop(); rendi(x);
    }
  };
  rec(0,0);
  // Dalle chiavi alle carte vere.
  const pool=new Map([...copie].map(([k,a])=>[k,a.slice()])), jp=jol.slice(), out=[];
  for(const x of best.sel){
    const carte=x.c.chiavi.map(k=>pool.get(k).shift());
    if(x.usata==='JK') carte.push(jp.shift()); else if(x.usata) carte.push(pool.get(x.usata).shift());
    const r=valida(carte,regole);
    if(r) out.push(r.ordine);
  }
  return out;
}

V.combinazioni={valida,valore,punti,puoAttaccare,suggerisci,selvaggia:(id,regole)=>selvaggia(id,gioco(regole))};
})(globalThis.V=globalThis.V||{});
