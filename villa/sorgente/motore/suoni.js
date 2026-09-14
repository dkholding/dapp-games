(function(V){'use strict';
// Suoni sintetizzati con WebAudio (nessun file audio) e vibrazione.
let ac=null, muto=false;
V.audio={
  attiva(){ try{
    if(!ac){ const C=globalThis.AudioContext||globalThis.webkitAudioContext; if(C) ac=new C(); }
    if(ac&&ac.state==='suspended') ac.resume();
  }catch(e){} },
  muto(m){ if(m!==undefined) muto=!!m; return muto; }
};

function tono(f,dur,tipo,vol,ritardo){
  const t=ac.currentTime+ritardo, o=ac.createOscillator(), g=ac.createGain();
  o.type=tipo; o.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t+dur+0.02);
}
function fruscio(dur,vol,ritardo,freq){
  const t=ac.currentTime+ritardo, n=Math.floor(ac.sampleRate*dur);
  const b=ac.createBuffer(1,n,ac.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const s=ac.createBufferSource(), f=ac.createBiquadFilter(), g=ac.createGain();
  s.buffer=b; f.type='bandpass'; f.frequency.value=freq; g.gain.value=vol;
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const SUONI={
  carta:()=>fruscio(.09,.35,0,3000),
  presa:()=>{ fruscio(.06,.3,0,1800); fruscio(.06,.3,.07,1500); },
  scopa:()=>[523,659,784,1047].forEach((f,i)=>tono(f,.18,'triangle',.18,i*.08)),
  tic:()=>tono(1400,.05,'square',.04,0),
  clic:()=>tono(900,.04,'sine',.07,0),
  vittoria:()=>[523,659,784,1047,1319].forEach((f,i)=>tono(f,.25,'triangle',.16,i*.11)),
  sconfitta:()=>[392,349,311,262].forEach((f,i)=>tono(f,.3,'sine',.14,i*.14))
};
V.suono=function(nome){
  if(muto||!ac||ac.state!=='running') return;
  try{ if(SUONI[nome]) SUONI[nome](); }catch(e){}
};
V.vibra=function(tipo){
  try{
    const h=globalThis.Telegram&&globalThis.Telegram.WebApp&&globalThis.Telegram.WebApp.HapticFeedback;
    if(h){ if(tipo==='successo') h.notificationOccurred('success'); else h.impactOccurred(tipo==='forte'?'heavy':'light'); return; }
    if(globalThis.navigator&&navigator.vibrate) navigator.vibrate(tipo==='forte'?[30,40,60]:tipo==='successo'?[20,30,20]:12);
  }catch(e){}
};
})(globalThis.V=globalThis.V||{});
