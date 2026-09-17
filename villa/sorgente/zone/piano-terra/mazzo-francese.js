(function(V){'use strict';
// Carte francesi: id = nome + seme + '#' + copia, es. '10C#1', 'QP#2'; i jolly sono 'JK#1'..'JK#4'.
V.SEMI_FRANCESI=['C','Q','F','P'];   // cuori, quadri, fiori, picche
V.NOMI_SEMI_FRANCESI={C:'cuori',Q:'quadri',F:'fiori',P:'picche'};
const NOMI=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const base=id=>id.split('#')[0];
const jolly=id=>base(id)==='JK';
V.francese={
  NOMI,
  base,
  jolly,
  seme:id=>jolly(id)?null:base(id).slice(-1),
  nome:id=>jolly(id)?'JK':base(id).slice(0,-1),
  valore:id=>jolly(id)?0:NOMI.indexOf(base(id).slice(0,-1))+1,   // A=1 … K=13, jolly 0
  chiave:(v,s)=>NOMI[v-1]+s,                                       // (1,'C') → 'AC'
};
V.mazzoFrancese=(copie=2,jolly=4)=>{
  const out=[];
  for(let k=1;k<=copie;k++) for(const s of V.SEMI_FRANCESI) for(const n of NOMI) out.push(n+s+'#'+k);
  for(let j=1;j<=jolly;j++) out.push('JK#'+j);
  return out;
};
})(globalThis.V=globalThis.V||{});
