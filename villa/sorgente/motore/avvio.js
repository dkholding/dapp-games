(function(V){'use strict';
// Avvio di un ingresso della Villa: mondo da girare, tavoli, tornei, negozio, portineria.
if(typeof document==='undefined') return;
const $=id=>document.getElementById(id);
const ZONE_INGRESSO={carte:['piano-terra']};
const zoneIngresso=ZONE_INGRESSO[globalThis.INGRESSO]||['piano-terra'];
const A=V.archivio();
let zona=V.zone[zoneIngresso[0]], eco=null, mondo=null, tavolo=null, seduta=null, spostamentoOra=0;
const adesso=()=>Date.now()+spostamentoOra;

const tg=globalThis.Telegram&&globalThis.Telegram.WebApp;
if(tg){ try{ tg.ready(); tg.expand(); }catch(e){} }

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Math.round(n).toLocaleString('it-IT');
const oggi=()=>{ const d=new Date(adesso()); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const ore=ms=>{ const d=new Date(ms); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
function nuovoSeme(){ const b=new Uint8Array(16); crypto.getRandomValues(b); return Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''); }
const moneta=()=>zona.economia.moneta;
const soldi=n=>`${nf(n)} ${moneta().simbolo}`;
const nomeGioco=id=>(V.giochi[id]&&V.giochi[id].nome)||({briscola:'Briscola',tressette:'Tressette',scala40:'Scala 40',burraco:'Burraco'})[id]||id;

// Tavolo da usare per ogni gioco (le famiglie arrivano dai file di zona).
function classeTavolo(gioco){
  const f={scopa:'Tavolo',briscola:'TavoloMano',tressette:'TavoloMano',scala40:'TavoloCombinazioni',burraco:'TavoloCombinazioni'}[gioco];
  return f&&V[f]&&V.giochi[gioco]?V[f]:null;
}

// ---- avvisi e finestre ---------------------------------------------------
let timerAvviso=0;
function avviso(testo,ms=2600){ const el=$('avviso'); el.textContent=testo; el.hidden=false; clearTimeout(timerAvviso); timerAvviso=setTimeout(()=>{ el.hidden=true; },ms); }

function finestra(html,azioni,opzioni={}){
  const f=$('finestra'); f.innerHTML=html+'<div class="azioni"></div>';
  const box=f.querySelector('.azioni');
  for(const a of azioni){
    const b=document.createElement('button'); b.textContent=a.testo; if(a.primario) b.className='primario'; if(a.disattivo) b.disabled=true;
    b.onclick=()=>{ if(a.valida&&!a.valida()) return; V.suono('clic'); if(!a.tieni) chiudiFinestra(); if(a.fn) a.fn(); };
    box.appendChild(b);
  }
  $('velo').hidden=false; if(mondo) mondo.ferma();
  f.onclick=opzioni.alClic||null;
  const primo=box.querySelector('button.primario:not([disabled])')||box.querySelector('button'); if(primo) primo.focus();
}
function chiudiFinestra(){ $('velo').hidden=true; $('finestra').innerHTML=''; if(mondo&&!tavolo) mondo.riprendi(); }
$('velo').addEventListener('click',e=>{ if(e.target.id==='velo'&&!$('finestra').querySelector('[data-obbligatoria]')) chiudiFinestra(); });

$('finestra').addEventListener('click',e=>{
  const b=e.target.closest('[data-copia]'); if(!b) return;
  const testo=b.getAttribute('data-copia'), prima=b.textContent;
  const fatto=()=>{ b.textContent='Copiato ✓'; setTimeout(()=>{ b.textContent=prima; },1500); };
  const ripiego=()=>{ const el=document.getElementById(b.getAttribute('data-sorgente')); if(!el) return; const r=document.createRange(); r.selectNodeContents(el);
    const s=getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent='Selezionato: premi Ctrl+C'; };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(testo).then(fatto,ripiego); else ripiego();
});

// ---- testata -------------------------------------------------------------
function aggiornaTesta(){
  const g=A.giocatore();
  $('nomeG').textContent=g.nome||'';
  $('audio').textContent=g.muto?'🔇':'🔊'; V.audio.muto(!!g.muto);
  if(eco){ $('soldi').textContent=soldi(eco.saldo()); const av=eco.avanzamento(); $('livello').textContent='Liv. '+av.livello; $('livello').title=`${av.xp} / ${av.a} esperienza`; }
  const dorso=eco&&eco.equipaggiato(); V.aspettoCarte=dorso?{dorso:dorso.dorso,filo:dorso.filo}:null;
}

function chiediNome(poi){
  let nome='';
  const proposta=A.giocatore().nome||(tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user&&tg.initDataUnsafe.user.first_name)||'';
  finestra(`<h2 data-obbligatoria>Benvenuto nella Villa</h2><p>Come ti chiamano ai tavoli?</p>
    <input id="campoNome" maxlength="16" autocomplete="nickname" value="${esc(proposta)}">`,
    [{testo:'Entra',primario:true,
      valida:()=>{ nome=$('campoNome').value.trim().slice(0,16); if(!nome){ $('campoNome').focus(); return false; } return true; },
      fn:()=>{ A.salvaGiocatore(Object.assign(A.giocatore(),{nome})); aggiornaTesta(); if(mondo) mondo.op.nome=nome; if(poi) poi(); }}]);
  const campo=$('campoNome'); campo.focus(); campo.select();
  campo.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); $('finestra').querySelector('.azioni button').click(); } });
}

// ---- mondo ---------------------------------------------------------------
function nomiDelTavolo(def){
  const r=V.rng(V.sha256('nomi:'+def.id)), liberi=V.NOMI_BOT.slice(), out=[];
  for(let i=0;i<def.giocatori-1;i++) out.push(liberi.splice(Math.floor(r()*liberi.length),1)[0]);
  return out;
}
function descriviTavolo(def){
  if(def.tipo==='torneo') return "Tavolo d'Onore · tornei a orario";
  const tipo={amichevole:'amichevole',sfida:'sfida a posta',buio:'sfida al buio'}[def.tipo];
  const formula=def.giocatori===4?'in coppia':'a 2';
  return `${nomeGioco(def.gioco)} ${formula} · ${tipo}${def.tipo==='buio'?'':' · livello '+def.livelli[0]}`;
}
function avviaMondo(){
  const g=A.giocatore();
  mondo=new V.Mondo($('telaMondo'),{mappa:zona.mappa,zone:zoneIngresso,nome:g.nome,colore:V.COLORI_ABITO[g.aspetto||0],
    livello:()=>eco.livello(),
    alVicino:vic=>{
      for(const k of zona.mappa.tavoli) k.etichetta=null;
      const box=$('azioneVicino');
      if(!vic){ box.hidden=true; return; }
      let testo, bottone;
      if(vic.tipo==='tavolo'){ const d=vic.ogg; d.etichetta=d.tipo==='torneo'?"Tavolo d'Onore":nomeGioco(d.gioco);
        testo=descriviTavolo(d); bottone=d.tipo==='torneo'?'Tornei':classeTavolo(d.gioco)?'Siediti':'In allestimento'; }
      else if(vic.tipo==='arredo'){ testo=vic.ogg.nome; bottone='Apri'; }
      else { testo=`${vic.ogg.nome}: si entra dal livello ${vic.ogg.livelloMin}`; bottone=null; }
      box.querySelector('.testo').textContent=testo;
      const b=box.querySelector('button'); b.hidden=!bottone; if(bottone) b.textContent=bottone;
      box.hidden=false;
    },
    alAttiva:vic=>{ if(vic.tipo==='tavolo') apriTavolo(vic.ogg); else if(vic.tipo==='arredo') apriArredo(vic.ogg.azione); },
    alStanza:st=>{ $('luogo').textContent=st.nome; },
    disegnaSulTavolo:(c,k,t)=>{
      if(k.tipo==='torneo'){ c.fillStyle='#ffd66b'; c.font='700 34px Georgia,serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('🏆',k.x,k.y); return; }
      const n=k.giocatori===4?4:2;
      for(let i=0;i<n;i++){ const ang=Math.PI/2+i*2*Math.PI/n+Math.sin(t/1400+k.x)*0.05;
        c.save(); c.translate(k.x+Math.cos(ang)*k.r*0.45,k.y+Math.sin(ang)*k.r*0.45); c.rotate(ang+Math.PI/2);
        c.fillStyle=i===0?'#f6efdc':'#6b1e24'; c.fillRect(-7,-11,14,22); c.restore(); }
      if(k.tipo!=='amichevole'){ c.fillStyle=k.tipo==='buio'?'#111':'#d8b262'; c.beginPath(); c.arc(k.x,k.y,9,0,7); c.fill();
        c.fillStyle=k.tipo==='buio'?'#ddd':'#2a1a10'; c.font='700 12px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(k.tipo==='buio'?'?':'◉',k.x,k.y+1); }
    }
  });
  const st=mondo.stanzaIn(mondo.p.x,mondo.p.y); if(st) $('luogo').textContent=st.nome;
}
$('azioneVicino').querySelector('button').onclick=()=>{ V.audio.attiva(); if(mondo&&mondo.vicino) mondo.attiva(mondo.vicino); };

// ---- sedersi al tavolo ---------------------------------------------------
function salaDi(def){ return zona.mappa.stanze.find(s=>def.x>=s.x&&def.x<s.x+s.w&&def.y>=s.y&&def.y<s.y+s.h)||{}; }
function apriTavolo(def){
  if(def.tipo==='torneo') return pannelloTornei();
  if(!classeTavolo(def.gioco)) return finestra(`<h2>${esc(nomeGioco(def.gioco))}</h2><p>Questo tavolo è ancora in allestimento.</p>`,[{testo:'Va bene',primario:true}]);
  const sala=salaDi(def), nomi=nomiDelTavolo(def), coppia=def.giocatori===4;
  const chi=coppia?`Con <b>${esc(nomi[1])}</b>, contro <b>${esc(nomi[0])}</b> e <b>${esc(nomi[2])}</b>`:`Contro <b>${esc(nomi[0])}</b>`;
  const base=`<h2>${esc(nomeGioco(def.gioco))} ${coppia?'in coppia':'a 2'}</h2><p class="nota">${esc(sala.nome||'')} · ${def.secondi} s ${/scala|burraco/.test(def.gioco)?'a turno':'a mossa'}</p>`;
  if(def.tipo==='amichevole'){
    return finestra(`${base}<p>${chi} · livello ${def.livelli[0]}</p><p class="nota">Amichevole: nessuna posta.</p>`,
      [{testo:'Siediti',primario:true,fn:()=>siediti(def,{posta:0,nomi})},{testo:'Più tardi'}]);
  }
  if(def.tipo==='buio'){
    const posta=Math.floor((sala.postaMax||200)/2), puo=eco.saldo()>=posta;
    return finestra(`${base}<p>Avversario sconosciuto: livello e nome si scoprono a fine partita.</p>
      <p>Posta fissa <b>${soldi(posta)}</b> · chi vince prende ${soldi(eco.vincitaPerGiocatore(posta,def.giocatori))}</p>
      ${puo?'':`<p class="nota">Non hai abbastanza ${esc(moneta().nome)}.</p>`}`,
      [{testo:'Accetta la sfida',primario:true,disattivo:!puo,fn:()=>{
        const r=V.rng(V.sha256(nuovoSeme())), liv=2+Math.floor(r()*8), altri=V.NOMI_BOT.filter(n=>!nomi.includes(n)), nome=altri[Math.floor(r()*altri.length)];
        const d=Object.assign({},def,{livelli:def.livelli.map(()=>liv)});
        siediti(d,{posta,nomi:coppia?[nome,nomi[1],nomi[2]]:[nome],buio:true});
      }},{testo:'Più tardi'}]);
  }
  const passi=[25,50,100,200,500].filter(p=>p<=(sala.postaMax||200));
  let scelta=passi.find(p=>p<=eco.saldo()&&p>=50)||passi.find(p=>p<=eco.saldo());
  const disegna=()=>finestra(`${base}<p>${chi} · livello ${def.livelli[0]}</p><p>Scegli la posta:</p>
      <div class="scelte">${passi.map(p=>`<button data-posta="${p}" class="${p===scelta?'scelto':''}" ${p>eco.saldo()?'disabled':''}>${soldi(p)}</button>`).join('')}</div>
      <p class="nota">${scelta?`Chi vince prende ${soldi(eco.vincitaPerGiocatore(scelta,def.giocatori))} (trattenuta del 5%).`:`Non hai abbastanza ${esc(moneta().nome)}.`}</p>`,
    [{testo:'Siediti',primario:true,disattivo:!scelta,fn:()=>siediti(def,{posta:scelta,nomi})},{testo:'Più tardi'}],
    {alClic:e=>{ const b=e.target.closest('[data-posta]'); if(!b||b.disabled) return; scelta=+b.dataset.posta; V.suono('clic'); disegna(); }});
  disegna();
}

function siediti(def,{posta,nomi,buio=false,torneo=null}){
  if(!A.giocatore().nome) return chiediNome(()=>siediti(def,{posta,nomi,buio,torneo}));
  if(posta&&!eco.paga(posta,`Posta · ${nomeGioco(def.gioco)}`)) return avviso('Non hai abbastanza '+moneta().nome);
  const Classe=classeTavolo(def.gioco);
  seduta={def,posta,nomi,buio,torneo};
  if(mondo) mondo.ferma();
  $('schermoMondo').hidden=true; $('schermoTavolo').hidden=false; $('azioneVicino').hidden=true;
  $('titoloTavolo').textContent=`${nomeGioco(def.gioco)} · ${torneo?"Sala d'Onore":(salaDi(def).nome||'')}`;
  $('postaTavolo').textContent=posta?'Posta '+soldi(posta):torneo?V.tornei.nomeFase(torneo.tab.turni[torneo.tab.fase].length):'';
  aggiornaTesta();
  if(tavolo) tavolo.chiudi();
  const seme=nuovoSeme(), impronta=V.sha256(seme);
  $('impronta').textContent='🔒 '+impronta.slice(0,8); $('impronta').title='Mazzo sigillato. Impronta: '+impronta;
  const nomiVisti=buio?nomi.map((n,i)=>def.giocatori===4&&i===1?n:'???'):nomi;
  tavolo=new Classe($('tela'),{gioco:def.gioco,giocatori:def.giocatori,livelli:[0,...def.livelli],secondi:def.secondi,
    nomi:[A.giocatore().nome,...nomiVisti],seme,breve:!!def.breve||!!torneo,alSmazzata,alFine});
}

function lasciaTavolo(){
  if(!tavolo||tavolo.finito){ tornaAlMondo(); return; }
  finestra('<h2>Lasci il tavolo?</h2><p>La partita conta come persa.</p>',
    [{testo:'Resto',primario:true},{testo:'Lascio',fn:()=>tavolo&&tavolo.abbandona()}]);
}
function tornaAlMondo(){
  if(tavolo) tavolo.chiudi(); tavolo=null; seduta=null;
  $('schermoTavolo').hidden=true; $('schermoMondo').hidden=false;
  aggiornaTesta(); if(mondo){ mondo.aggiornaCancelli(); mondo.riprendi(); }
}

function tabella(G,st){
  const r=G.riepilogo&&G.riepilogo(st); if(!r) return '';
  const et=st.n===4?['Noi','Loro']:['Tu',...(seduta?seduta.nomi.slice(0,st.n-1):[])].map((n,i)=>i&&seduta&&seduta.buio?'???':n);
  return `<table class="conti"><tr><th></th>${et.map(e=>`<th>${esc(e)}</th>`).join('')}</tr>
    ${r.righe.map(riga=>`<tr><td>${esc(riga.nome)}</td>${riga.valori.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}
    <tr class="tot"><td>Smazzata</td>${r.totale.map(x=>`<td>${x>0?'+':''}${esc(x)}</td>`).join('')}</tr>
    <tr class="tot"><td>Partita</td>${st.punti.map(x=>`<td>${esc(x)}</td>`).join('')}</tr></table>`;
}
function alSmazzata(r,st,continua){
  const G=V.giochi[st.gioco];
  finestra(`<h2 data-obbligatoria>Fine smazzata</h2>${tabella(G,st)}${st.obiettivo?`<p class="nota">Si vince a ${esc(st.obiettivo)} punti.</p>`:''}`,
    [{testo:'Continua',primario:true,fn:continua}]);
}

function alFine(e){
  const st=e.st, G=V.giochi[st.gioco], s=seduta; if(!s) return;
  const esito=eco.registraPartita({gioco:st.gioco,vinto:e.vinto,scope:e.scopeMie||0,patta:!!e.patta});
  let righeSoldi='';
  if(s.posta){
    if(e.vinto){ const v=eco.vincitaPerGiocatore(s.posta,s.def.giocatori); eco.incassa(v,`Vincita · ${nomeGioco(st.gioco)}`); righeSoldi=`<p class="soldi piu">+${soldi(v)}</p>`; }
    else righeSoldi=`<p class="soldi meno">−${soldi(s.posta)}</p>`;
  }
  let torneoHtml='', azioni;
  if(s.torneo){
    const T=V.tornei, tab=s.torneo.tab, fase=T.nomeFase(tab.turni[tab.fase].length);
    T.avanza(tab,e.vinto,V.rng(V.sha256(s.torneo.id+':'+tab.fase)));
    eco.d.tornei.iscritti[s.torneo.id]={stato:'in corso',tab}; eco.salva();
    if(tab.posizione){
      const premio=T.premio(tab.posizione,s.torneo.iscrizione);
      if(premio) eco.incassa(premio,`Torneo · ${tab.posizione}° posto`);
      eco.d.tornei.iscritti[s.torneo.id]={stato:'finito',posizione:tab.posizione};
      eco.d.tornei.storico.unshift({id:s.torneo.id,gioco:st.gioco,posizione:tab.posizione,premio,t:adesso()}); eco.salva();
      torneoHtml=`<p class="soldi ${premio?'piu':''}">${tab.posizione===1?'🏆 Hai vinto il torneo!':`Torneo finito: ${tab.posizione===2?'secondo posto':tab.posizione===3?'semifinale':'fuori ai quarti'}`}${premio?` · +${soldi(premio)}`:''}</p>`;
      azioni=[{testo:"Torna nella Sala d'Onore",primario:true,fn:tornaAlMondo}];
    } else {
      const avv=T.avversario(tab);
      torneoHtml=`<p class="soldi piu">${esc(fase)} superata. Prossimo turno: ${esc(T.nomeFase(tab.turni[tab.fase].length))} contro ${esc(avv.nome)} (livello ${avv.livello}).</p>`;
      azioni=[{testo:'Gioca il prossimo turno',primario:true,fn:()=>giocaTorneo(s.torneo.id)},{testo:'Più tardi',fn:tornaAlMondo}];
    }
  }
  const ok=V.sha256(e.seme)===e.impronta;
  const svelato=s.buio?`<p class="nota">Il tuo avversario era <b>${esc(s.nomi[0])}</b>, livello ${s.def.livelli[0]}.</p>`:'';
  const livello=esito.salito?`<p class="soldi piu">Sei salito al livello ${esito.livello}!${esito.livello===5?" Si apre la Sala d'Onore.":''}</p>`:`<p class="nota">+${esito.xp} esperienza</p>`;
  const titolo=e.patta?'Patta':e.vinto?'Hai vinto!':'Hai perso';
  const et=st.n===4?['Noi','Loro']:['Tu',...s.nomi.slice(0,st.n-1)];
  finestra(`<h2 data-obbligatoria class="${e.vinto?'vinto':'perso'}">${titolo}</h2>
    ${st.punti&&st.punti.length===et.length?`<p class="punteggio">${et.map((n,i)=>`${esc(n)} ${esc(st.punti[i])}`).join(' – ')}</p>`:''}
    ${righeSoldi}${torneoHtml}${livello}${svelato}
    ${e.abbandono?'<p class="nota">Partita chiusa per abbandono.</p>':tabella(G,st)}
    <details class="verifica"><summary>Verifica la mescolata ${ok?'✔':'✖'}</summary>
      <p>Prima della partita il mazzo era sigillato con questa impronta:</p><code>${e.impronta}</code>
      <p>Il seme, rivelato adesso:</p><code id="semeRivelato">${e.seme}</code>
      <button class="copia" data-copia="${e.seme}" data-sorgente="semeRivelato">Copia il seme</button>
      <p class="nota">SHA-256 del seme ${ok?'corrisponde':'NON corrisponde'} all'impronta. La smazzata numero n si mescola con il seme seguito da «:n».</p>
    </details>`,
    azioni||[{testo:'Rivincita',primario:true,fn:()=>{ tornaAlMondo(); apriTavolo(s.def); }},{testo:'Alzati dal tavolo',fn:tornaAlMondo}]);
  aggiornaTesta();
}

// ---- tornei --------------------------------------------------------------
function statoTorneo(t){
  const isc=eco.d.tornei.iscritti[t.id], ora=adesso();
  if(isc&&isc.stato==='finito') return 'finito';
  if(ora<t.inizio) return isc?'iscritto':'aperto';
  if(ora<t.inizio+15*60*1000) return isc?'in corso':'chiuso';
  return isc&&isc.stato==='in corso'?'in corso':isc?'saltato':'chiuso';
}
function pannelloTornei(){
  const conf=zona.tornei, prog=V.tornei.programma(adesso(),conf.giochi,3,conf.iscrizione), liv=eco.livello();
  const righe=prog.map(t=>{
    const s=statoTorneo(t);
    const bottone=s==='aperto'?`<button data-iscrivi="${t.id}" ${liv<5?'disabled':''}>Iscriviti · ${soldi(t.iscrizione)}</button>`
      :s==='in corso'?`<button class="primario" data-gioca="${t.id}">Gioca</button>`
      :s==='iscritto'?'<span class="stato">Iscritto ✓</span>':s==='finito'?'<span class="stato">Concluso</span>':'<span class="stato">Chiuso</span>';
    return `<div class="riga-torneo"><div><b>${ore(t.inizio)}</b> · ${esc(nomeGioco(t.gioco))}<br><small>8 giocatori · premi ${soldi(t.iscrizione*4)} / ${soldi(t.iscrizione*2)} / ${soldi(t.iscrizione)}</small></div>${bottone}</div>`;
  }).join('');
  const storico=eco.d.tornei.storico.slice(0,5).map(x=>`<li>${esc(nomeGioco(x.gioco))}: ${x.posizione}°${x.premio?' · +'+soldi(x.premio):''}</li>`).join('');
  finestra(`<h2>Bacheca dei tornei</h2><p class="nota">Un torneo ogni mezz'ora. Iscriviti prima dell'orario e gioca al Tavolo d'Onore entro 15 minuti dall'inizio.${liv<5?' Serve il livello 5.':''}</p>
    ${righe}${storico?`<h3>I tuoi ultimi tornei</h3><ul>${storico}</ul>`:''}`,[{testo:'Chiudi',primario:true}],
    {alClic:e=>{
      const i=e.target.closest('[data-iscrivi]'), g=e.target.closest('[data-gioca]');
      if(i&&!i.disabled){ const t=prog.find(x=>x.id===i.dataset.iscrivi);
        if(!eco.paga(t.iscrizione,`Iscrizione torneo · ${nomeGioco(t.gioco)}`)) return avviso('Non hai abbastanza '+moneta().nome);
        eco.d.tornei.iscritti[t.id]={stato:'iscritto',gioco:t.gioco,inizio:t.inizio,iscrizione:t.iscrizione}; eco.salva();
        V.suono('clic'); aggiornaTesta(); pannelloTornei(); }
      if(g){ chiudiFinestra(); giocaTorneo(g.dataset.gioca); }
    }});
}
function giocaTorneo(id){
  const prog=V.tornei.programma(adesso()-60*60*1000,zona.tornei.giochi,6,zona.tornei.iscrizione), t=prog.find(x=>x.id===id);
  const isc=eco.d.tornei.iscritti[id]; if(!t||!isc) return;
  const tab=isc.tab||V.tornei.tabellone(t,V.NOMI_BOT);
  isc.stato='in corso'; isc.tab=tab; eco.salva();
  const avv=V.tornei.avversario(tab);
  if(!classeTavolo(t.gioco)) return avviso('Il tavolo di '+nomeGioco(t.gioco)+' è in allestimento');
  const def={id:'torneo-'+id,gioco:t.gioco,giocatori:2,tipo:'torneo',livelli:[avv.livello],secondi:/scala|burraco/.test(t.gioco)?20:8,breve:true};
  siediti(def,{posta:0,nomi:[avv.nome],torneo:{id,tab,iscrizione:t.iscrizione}});
}
// Rimborso dei tornei non giocati; avviso quando uno inizia.
function controllaTornei(){
  if(!eco) return;
  for(const [id,isc] of Object.entries(eco.d.tornei.iscritti)){
    if(isc.stato==='iscritto'&&adesso()>=isc.inizio&&adesso()<isc.inizio+15*60*1000&&!isc.avvisato){
      isc.avvisato=true; eco.salva(); avviso(`Il torneo di ${nomeGioco(isc.gioco)} è iniziato: vai al Tavolo d'Onore`,6000);
    }
    if(isc.stato==='iscritto'&&adesso()>=isc.inizio+15*60*1000){
      isc.stato='finito'; eco.incassa(isc.iscrizione,'Torneo saltato: iscrizione restituita'); eco.salva(); aggiornaTesta();
      avviso('Torneo saltato: iscrizione restituita');
    }
  }
}
setInterval(controllaTornei,5000);

// ---- negozio e portineria ------------------------------------------------
function apriArredo(azione){ if(azione==='tornei') pannelloTornei(); else if(azione==='negozio') pannelloNegozio(); else pannelloProfilo(); }
function pannelloNegozio(){
  const righe=eco.catalogo().map(o=>{
    const ha=eco.possiede(o.id), usa=eco.d.nft.equip===o.id;
    const b=usa?'<span class="stato">In uso</span>':ha?`<button data-usa="${o.id}">Usa</button>`:`<button data-compra="${o.id}" ${eco.saldo()<o.prezzo?'disabled':''}>Compra · ${soldi(o.prezzo)}</button>`;
    return `<div class="riga-torneo"><div class="campione" style="background:${o.dorso};border-color:${o.filo}"></div><div class="cresci"><b>${esc(o.nome)}</b><br><small>Dorso delle carte</small></div>${b}</div>`;
  }).join('');
  finestra(`<h2>Banco del negozio</h2><p class="nota">NFT di prova: pochi oggetti per provare l'impianto. Il catalogo vero arriverà più avanti.</p>${righe}
    ${eco.d.nft.equip?'<p><button data-usa="">Torna al mazzo classico</button></p>':''}`,[{testo:'Chiudi',primario:true}],
    {alClic:e=>{
      const c=e.target.closest('[data-compra]'), u=e.target.closest('[data-usa]');
      if(c&&!c.disabled){ if(eco.compra(c.dataset.compra)){ V.suono('vittoria'); aggiornaTesta(); pannelloNegozio(); } }
      if(u){ eco.equipaggia(u.dataset.usa||null); V.suono('clic'); aggiornaTesta(); pannelloNegozio(); }
    }});
}
function pannelloProfilo(){
  const g=A.giocatore(), av=eco.avanzamento(), d=eco.d;
  const giochi=Object.entries(d.perGioco).map(([k,v])=>`<tr><td>${esc(nomeGioco(k))}</td><td>${v.giocate}</td><td>${v.vinte}</td></tr>`).join('');
  const mov=d.movimenti.slice(0,8).map(m=>`<li><span class="${m.n>0?'piu':'meno'}">${m.n>0?'+':''}${nf(m.n)}</span> ${esc(m.causale)}</li>`).join('');
  finestra(`<h2>Portineria</h2>
    <p><b>${esc(g.nome)}</b> · livello ${av.livello}</p>
    <div class="barra-xp"><span style="width:${Math.round(av.frazione*100)}%"></span></div>
    <p class="nota">${av.xp} esperienza · prossimo livello a ${av.a}</p>
    <p>Colore dell'abito:</p><div class="scelte">${V.COLORI_ABITO.map((c,i)=>`<button class="colore ${i===(g.aspetto||0)?'scelto':''}" data-colore="${i}" style="background:${c}" aria-label="Colore ${i+1}"></button>`).join('')}</div>
    <p>${esc(moneta().nome)}: <b>${soldi(eco.saldo())}</b> · partite ${d.giocate} · vinte ${d.vinte}${d.scope?` · scope ${d.scope}`:''}</p>
    ${giochi?`<table class="conti"><tr><th>Gioco</th><th>Partite</th><th>Vinte</th></tr>${giochi}</table>`:''}
    <h3>Wallet TON</h3>
    ${g.wallet?`<code id="indirizzoWallet">${esc(g.wallet)}</code><button class="copia" data-copia="${esc(g.wallet)}" data-sorgente="indirizzoWallet">Copia l'indirizzo</button>`
      :'<p><button data-wallet="1">Collega un wallet di prova</button></p>'}
    <p class="nota">Di prova: serve solo come identità, nessuna transazione.</p>
    ${mov?`<h3>Ultimi movimenti</h3><ul class="movimenti">${mov}</ul>`:''}`,
    [{testo:'Cambia nome',fn:()=>chiediNome()},{testo:'Chiudi',primario:true}],
    {alClic:e=>{
      const c=e.target.closest('[data-colore]'), w=e.target.closest('[data-wallet]');
      if(c){ const gg=A.giocatore(); gg.aspetto=+c.dataset.colore; A.salvaGiocatore(gg); if(mondo) mondo.p.colore=V.COLORI_ABITO[gg.aspetto]; V.suono('clic'); pannelloProfilo(); }
      if(w){ const cs='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-', b=new Uint8Array(46); crypto.getRandomValues(b);
        const gg=A.giocatore(); gg.wallet='EQ'+Array.from(b,x=>cs[x%cs.length]).join(''); A.salvaGiocatore(gg); V.suono('clic'); pannelloProfilo(); }
    }});
}

// ---- menu ----------------------------------------------------------------
$('menu').onclick=()=>{ V.audio.attiva(); V.suono('clic');
  finestra('<h2>La Villa</h2>',[{testo:'Portineria',fn:pannelloProfilo},{testo:'Bacheca dei tornei',fn:pannelloTornei},{testo:'Negozio',fn:pannelloNegozio},{testo:'Chiudi',primario:true}]); };
$('audio').onclick=()=>{ V.audio.attiva(); const g=A.giocatore(); g.muto=!g.muto; A.salvaGiocatore(g); aggiornaTesta(); V.suono('clic'); };
$('esci').onclick=()=>{ V.suono('clic'); lasciaTavolo(); };

// Maniglia per i collaudi automatici nel browser.
globalThis.__villa={ tavolo:()=>tavolo, mondo:()=>mondo, economia:()=>eco, spostaOra:ms=>{ spostamentoOra+=ms; controllaTornei(); } };

// ---- partenza ------------------------------------------------------------
eco=new V.Economia(A,zona.salvataggio,zona.economia);
// Chi aveva giocato alla prima versione: tiene le statistiche.
if(eco.d.giocate&&!eco.d.perGioco.scopa){ eco.d.perGioco.scopa={giocate:eco.d.giocate,vinte:eco.d.vinte}; eco.salva(); }
aggiornaTesta();
avviaMondo();
const regalo=eco.regalo(oggi());
if(!A.giocatore().nome) chiediNome(()=>{ if(regalo) avviso(`Regalo del giorno: +${soldi(regalo)}`); });
else if(regalo) avviso(`Regalo del giorno: +${soldi(regalo)}`);
aggiornaTesta();
})(globalThis.V=globalThis.V||{});
