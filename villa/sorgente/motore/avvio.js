(function(V){'use strict';
// Avvio dell'ingresso: nome del giocatore, sala, tavoli, finestre di fine smazzata e di fine partita.
if(typeof document==='undefined') return;
const $=id=>document.getElementById(id);
const A=V.archivio();
const ZONA=V.zone['piano-terra'], SALA=ZONA.sale[0];
let tavolo=null, def=null;

const tg=globalThis.Telegram&&globalThis.Telegram.WebApp;
if(tg){ try{ tg.ready(); tg.expand(); }catch(e){} }

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statistiche=()=>Object.assign({giocate:0,vinte:0,scope:0},A.zona(ZONA.salvataggio));
function nuovoSeme(){ const b=new Uint8Array(16); crypto.getRandomValues(b); return Array.from(b,x=>x.toString(16).padStart(2,'0')).join(''); }

// ---- finestre ------------------------------------------------------------
// azioni: [{testo, primario, valida(), fn()}]; la finestra si chiude prima di fn.
function finestra(html,azioni){
  const f=$('finestra'); f.innerHTML=html+'<div class="azioni"></div>';
  const box=f.querySelector('.azioni');
  for(const a of azioni){
    const b=document.createElement('button'); b.textContent=a.testo; if(a.primario) b.className='primario';
    b.onclick=()=>{ if(a.valida&&!a.valida()) return; V.suono('clic'); chiudiFinestra(); if(a.fn) a.fn(); };
    box.appendChild(b);
  }
  $('velo').hidden=false;
  const primo=box.querySelector('button.primario')||box.querySelector('button'); if(primo) primo.focus();
}
function chiudiFinestra(){ $('velo').hidden=true; $('finestra').innerHTML=''; }

$('finestra').addEventListener('click',e=>{
  const b=e.target.closest('[data-copia]'); if(!b) return;
  const testo=b.getAttribute('data-copia');
  const fatto=()=>{ b.textContent='Copiato ✓'; setTimeout(()=>{ b.textContent='Copia il seme'; },1500); };
  const ripiego=()=>{ const el=$('semeRivelato'); if(!el) return; const r=document.createRange(); r.selectNodeContents(el);
    const s=getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent='Selezionato: premi Ctrl+C'; };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(testo).then(fatto,ripiego); else ripiego();
});

function chiediNome(poi){
  let nome='';
  finestra(`<h2>Benvenuto nella Villa</h2><p>Come ti chiamano al tavolo?</p>
    <input id="campoNome" maxlength="16" autocomplete="nickname" value="${esc(A.giocatore().nome)}">`,
    [{testo:'Entra',primario:true,
      valida:()=>{ nome=$('campoNome').value.trim().slice(0,16); if(!nome){ $('campoNome').focus(); return false; } return true; },
      fn:()=>{ A.salvaGiocatore(Object.assign(A.giocatore(),{nome})); aggiornaTesta(); if(poi) poi(); }}]);
  const campo=$('campoNome'); campo.focus();
  campo.addEventListener('keydown',e=>{ if(e.key==='Enter') $('finestra').querySelector('.azioni button').click(); });
}

// ---- schermate -----------------------------------------------------------
function aggiornaTesta(){
  const g=A.giocatore();
  $('nomeG').textContent=g.nome||'';
  $('audio').textContent=g.muto?'🔇':'🔊';
  V.audio.muto(!!g.muto);
}

function mostraSala(){
  $('nomeSala').textContent=SALA.nome; $('tagSala').textContent=SALA.tag;
  const box=$('tavoli'); box.innerHTML='';
  for(const t of SALA.tavoli){
    const G=V.giochi[t.gioco], coppia=t.giocatori===4;
    const el=document.createElement('button'); el.className='scheda-tavolo';
    el.innerHTML=`<span class="gioco">${esc(G.nome)}</span>
      <span class="formula">${coppia?'a 4, in coppia':'a 2'} · ${t.secondi} s a mossa</span>
      <span class="chi">${coppia?`Con ${esc(t.avversari[1])}, contro ${esc(t.avversari[0])} e ${esc(t.avversari[2])}`:`Contro ${esc(t.avversari[0])}`}</span>
      <span class="livello">Livello ${t.livelli[0]}</span>
      <span class="siediti">Siediti</span>`;
    el.onclick=()=>{ V.audio.attiva(); V.suono('clic'); siediti(t); };
    box.appendChild(el);
  }
  const s=statistiche();
  $('stat').textContent=`Partite ${s.giocate} · vinte ${s.vinte} · scope fatte ${s.scope}`;
  $('schermoTavolo').hidden=true; $('schermoSala').hidden=false;
}

function siediti(t){
  if(!A.giocatore().nome) return chiediNome(()=>siediti(t));
  def=t;
  $('schermoSala').hidden=true; $('schermoTavolo').hidden=false;
  $('titoloTavolo').textContent=`${V.giochi[t.gioco].nome} · ${SALA.nome}`;
  if(tavolo) tavolo.chiudi();
  const seme=nuovoSeme(), impronta=V.sha256(seme);
  $('impronta').textContent='🔒 '+impronta.slice(0,8);
  $('impronta').title='Mazzo sigillato. Impronta: '+impronta;
  tavolo=new V.Tavolo($('tela'),{gioco:t.gioco,giocatori:t.giocatori,livelli:[0,...t.livelli],
    secondi:t.secondi,nomi:[A.giocatore().nome,...t.avversari],seme,alSmazzata,alFine});
}

function lasciaTavolo(){
  if(!tavolo||tavolo.finito){ if(tavolo) tavolo.chiudi(); tavolo=null; return mostraSala(); }
  finestra('<h2>Lasci il tavolo?</h2><p>La partita conta come persa.</p>',
    [{testo:'Resto',primario:true},{testo:'Lascio',fn:()=>tavolo&&tavolo.abbandona()}]);
}

// ---- conti ---------------------------------------------------------------
function etichette(st){ return st.n===4?['Noi','Loro']:['Tu',def.avversari[0]]; }
function tabella(r,st){
  const et=etichette(st);
  const righe=[['Carte',r.carte,r.valori.carte],['Denari',r.denari,r.valori.denari],['Settebello',r.settebello],
    ['Primiera',r.primiera,r.valori.primiera],['Scope',r.scope]];
  return `<table class="conti"><tr><th></th>${et.map(e=>`<th>${esc(e)}</th>`).join('')}</tr>
    ${righe.map(([n,p,v])=>`<tr><td>${n}</td>${p.map((x,i)=>`<td>${x?`<b>+${x}</b>`:'·'}${v?` <small>(${v[i]})</small>`:''}</td>`).join('')}</tr>`).join('')}
    <tr class="tot"><td>Smazzata</td>${r.totale.map(x=>`<td>+${x}</td>`).join('')}</tr>
    <tr class="tot"><td>Partita</td>${st.punti.map(x=>`<td>${x}</td>`).join('')}</tr></table>`;
}
function alSmazzata(r,st,continua){
  finestra(`<h2>Fine smazzata</h2>${tabella(r,st)}<p class="nota">Si vince arrivando a ${st.obiettivo} punti.</p>`,
    [{testo:'Continua',primario:true,fn:continua}]);
}
function alFine(e){
  const st=e.st, s=statistiche();
  s.giocate++; if(e.vinto) s.vinte++; s.scope+=e.scopeMie;
  A.salvaZona(ZONA.salvataggio,s);
  const ok=V.sha256(e.seme)===e.impronta;
  finestra(`<h2 class="${e.vinto?'vinto':'perso'}">${e.vinto?'Hai vinto!':'Hai perso'}</h2>
    <p class="punteggio">${etichette(st).map((n,i)=>`${esc(n)} ${st.punti[i]}`).join(' – ')}</p>
    ${e.abbandono?'<p class="nota">Partita chiusa per abbandono.</p>':''}
    ${st.ultimaSmazzata&&!e.abbandono?tabella(st.ultimaSmazzata,st):''}
    <details class="verifica"><summary>Verifica la mescolata ${ok?'✔':'✖'}</summary>
      <p>Prima della partita il mazzo era sigillato con questa impronta:</p><code>${e.impronta}</code>
      <p>Il seme, rivelato adesso:</p><code id="semeRivelato">${e.seme}</code>
      <button class="copia" data-copia="${e.seme}">Copia il seme</button>
      <p class="nota">SHA-256 del seme ${ok?'corrisponde':'NON corrisponde'} all'impronta. La smazzata numero n si mescola con il seme seguito da «:n».</p>
    </details>`,
    [{testo:'Rivincita',primario:true,fn:()=>siediti(def)},
     {testo:'Torna al '+SALA.nome.replace(/^Salotto del /,''),fn:()=>{ if(tavolo) tavolo.chiudi(); tavolo=null; mostraSala(); }}]);
}

// Maniglia per i collaudi automatici nel browser (sola lettura del tavolo in corso).
globalThis.__villa={ tavolo:()=>tavolo };

// ---- partenza ------------------------------------------------------------
$('audio').onclick=()=>{ V.audio.attiva(); const g=A.giocatore(); g.muto=!g.muto; A.salvaGiocatore(g); aggiornaTesta(); V.suono('clic'); };
$('esci').onclick=()=>{ V.suono('clic'); lasciaTavolo(); };
aggiornaTesta();
mostraSala();
if(!A.giocatore().nome) chiediNome();
})(globalThis.V=globalThis.V||{});
