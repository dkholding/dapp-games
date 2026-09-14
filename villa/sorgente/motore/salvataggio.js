(function(V){'use strict';
// Salvataggi della Villa: il giocatore è uno solo, ogni zona ha la sua chiave.
// Se il browser blocca il salvataggio si continua in memoria.
V.archivio=function(storage){
  let s=storage;
  if(s===undefined){ try{ s=globalThis.localStorage||null; }catch(e){ s=null; } }
  const memoria={};
  const leggi=k=>{
    let t=null;
    try{ t=s?s.getItem(k):null; }catch(e){ t=null; }
    if(t==null) t=memoria[k]??null;
    if(t==null) return null;
    try{ return JSON.parse(t); }catch(e){ return null; }
  };
  const scrivi=(k,v)=>{
    const t=JSON.stringify(v); memoria[k]=t;
    try{ if(s) s.setItem(k,t); }catch(e){ /* resta in memoria */ }
  };
  return {
    giocatore:()=>leggi('villa.giocatore.v1')||{nome:'',aspetto:0},
    salvaGiocatore:g=>scrivi('villa.giocatore.v1',g),
    zona:id=>leggi('villa.'+id+'.v1')||{},
    salvaZona:(id,dati)=>scrivi('villa.'+id+'.v1',dati)
  };
};
})(globalThis.V=globalThis.V||{});
