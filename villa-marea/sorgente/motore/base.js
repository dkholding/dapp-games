(function(V){'use strict';
// Costanti SHA-256 ricavate dai numeri primi, così non servono tabelle scritte a mano.
const K=[],H0=[];
{ const frac=x=>((x-Math.floor(x))*4294967296)|0; let n=2,c=0;
  while(c<64){ let primo=true; for(let f=2;f*f<=n;f++) if(n%f===0){primo=false;break}
    if(primo){ if(c<8) H0[c]=frac(Math.sqrt(n)); K[c]=frac(Math.cbrt(n)); c++; } n++; } }

// Impronta del seme: si mostra prima della partita, il seme dopo.
V.sha256=function(testo){
  const b=Array.from(new TextEncoder().encode(testo)); const bit=b.length*8;
  b.push(0x80); while(b.length%64!==56) b.push(0);
  const hi=Math.floor(bit/4294967296), lo=bit>>>0;
  b.push(hi>>>24&255,hi>>>16&255,hi>>>8&255,hi&255,lo>>>24&255,lo>>>16&255,lo>>>8&255,lo&255);
  const H=H0.slice(), w=new Array(64);
  for(let o=0;o<b.length;o+=64){
    for(let i=0;i<16;i++) w[i]=(b[o+4*i]<<24)|(b[o+4*i+1]<<16)|(b[o+4*i+2]<<8)|b[o+4*i+3];
    for(let i=16;i<64;i++){ const x=w[i-15], y=w[i-2];
      const s0=((x>>>7)|(x<<25))^((x>>>18)|(x<<14))^(x>>>3);
      const s1=((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)|0; }
    let [a,bb,c,d,e,f,g,h]=H;
    for(let i=0;i<64;i++){
      const t1=(h+(((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7)))+((e&f)^(~e&g))+K[i]+w[i])|0;
      const t2=((((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)))+((a&bb)^(a&c)^(bb&c)))|0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=bb; bb=a; a=(t1+t2)|0; }
    H[0]=(H[0]+a)|0; H[1]=(H[1]+bb)|0; H[2]=(H[2]+c)|0; H[3]=(H[3]+d)|0;
    H[4]=(H[4]+e)|0; H[5]=(H[5]+f)|0; H[6]=(H[6]+g)|0; H[7]=(H[7]+h)|0;
  }
  return H.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
};

// Numeri casuali ripetibili (mulberry32) a partire da un'impronta esadecimale.
V.rng=function(hex){ let s=parseInt(hex.slice(0,8),16)>>>0;
  return function(){ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15),1|s);
    t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; };

V.mescola=function(arr,seme){ const r=V.rng(V.sha256(String(seme))), a=arr.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

V.clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
})(globalThis.V=globalThis.V||{});
