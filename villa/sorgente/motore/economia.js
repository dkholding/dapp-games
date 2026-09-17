(function(V){'use strict';
// Economia di zona, DI PROVA: moneta, livello, poste, mazzi/scacchiere NFT segnaposto.
// Ogni zona ha il suo salvataggio: le monete non passano da una zona all'altra.
const MAX_MOVIMENTI=40;

V.Economia=class{
  constructor(archivio,idSalvataggio,conf){
    this.a=archivio; this.id=idSalvataggio; this.conf=conf;
    const base={soldi:conf.moneta.iniziale,ultimoRegalo:'',xp:0,giocate:0,vinte:0,scope:0,perGioco:{},
      nft:{posseduti:[],equip:null},tornei:{iscritti:{},storico:[]},movimenti:[]};
    const d=archivio.zona(idSalvataggio)||{};
    this.d=Object.assign(base,d);
    this.d.nft=Object.assign({posseduti:[],equip:null},d.nft);
    this.d.tornei=Object.assign({iscritti:{},storico:[]},d.tornei);
  }
  salva(){ this.a.salvaZona(this.id,this.d); }
  saldo(){ return this.d.soldi; }
  movimento(n,causale){ this.d.movimenti.unshift({n,causale,t:Date.now()}); this.d.movimenti.length=Math.min(this.d.movimenti.length,MAX_MOVIMENTI); }
  incassa(n,causale){ n=Math.floor(n); if(n<=0) return 0; this.d.soldi+=n; this.movimento(n,causale); this.salva(); return n; }
  paga(n,causale){ n=Math.floor(n); if(n<0||n>this.d.soldi) return false; this.d.soldi-=n; if(n) this.movimento(-n,causale); this.salva(); return true; }
  // Regalo del giorno: una volta per data (AAAA-MM-GG).
  regalo(oggi){
    if(this.d.ultimoRegalo===oggi) return 0;
    this.d.ultimoRegalo=oggi; return this.incassa(this.conf.moneta.regalo,'Regalo del giorno');
  }
  static sogliaLivello(l){ return 25*l*(l-1); }
  livello(){ let l=1; while(this.d.xp>=V.Economia.sogliaLivello(l+1)) l++; return l; }
  avanzamento(){ const l=this.livello(), a=V.Economia.sogliaLivello(l), b=V.Economia.sogliaLivello(l+1); return {livello:l,xp:this.d.xp,da:a,a:b,frazione:(this.d.xp-a)/(b-a)}; }
  // Posta: tutti versano, il vincitore (o la coppia) si divide il piatto meno la trattenuta.
  vincitaPerGiocatore(posta,giocatori){
    const piatto=posta*giocatori, vincitori=giocatori===4?2:1;
    return Math.floor(piatto*(1-this.conf.trattenuta)/vincitori);
  }
  registraPartita({gioco,vinto,scope=0,patta=false}){
    const prima=this.livello();
    this.d.giocate++; if(vinto) this.d.vinte++; this.d.scope+=scope;
    const g=this.d.perGioco[gioco]||(this.d.perGioco[gioco]={giocate:0,vinte:0});
    g.giocate++; if(vinto) g.vinte++;
    const xp=vinto?30:patta?18:10; this.d.xp+=xp; this.salva();
    return {xp,livello:this.livello(),salito:this.livello()>prima};
  }
  catalogo(){ return this.conf.catalogo; }
  possiede(id){ return this.d.nft.posseduti.includes(id); }
  compra(id){
    const o=this.conf.catalogo.find(x=>x.id===id);
    if(!o||this.possiede(id)||!this.paga(o.prezzo,'NFT di prova: '+o.nome)) return false;
    this.d.nft.posseduti.push(id); this.d.nft.equip=id; this.salva(); return true;
  }
  equipaggia(id){ if(id!==null&&!this.possiede(id)) return false; this.d.nft.equip=id; this.salva(); return true; }
  equipaggiato(){ return this.conf.catalogo.find(x=>x.id===this.d.nft.equip)||null; }
  // Consumabili (da bere): si pagano e restano "in mano" per qualche minuto.
  consuma(id,ora){
    const b=(this.conf.bevande||[]).find(x=>x.id===id);
    if(!b||!this.paga(b.prezzo,b.nome)) return false;
    this.d.bevanda={id,fino:ora+b.minuti*60000}; this.salva(); return true;
  }
  bevanda(ora){
    const x=this.d.bevanda; if(!x||x.fino<=ora) return null;
    return (this.conf.bevande||[]).find(b=>b.id===x.id)||null;
  }
};

// Tornei a orario: uno ogni mezz'ora (:00 e :30), il gioco ruota.
const MEZZORA=30*60*1000;
V.tornei={
  MEZZORA,
  programma(ora,giochi,quanti=3,iscrizione=100){
    const primo=Math.floor(ora/MEZZORA)+1, out=[];
    for(let k=-1;k<quanti;k++){ const slot=primo+k;
      out.push({id:'t'+slot,slot,gioco:giochi[((slot%giochi.length)+giochi.length)%giochi.length],inizio:slot*MEZZORA,iscrizione,posti:8}); }
    return out;
  },
  // 8 partecipanti: il giocatore (posto 0) e 7 bot con livelli ricavati dal torneo.
  tabellone(torneo,nomi){
    const r=V.rng(V.sha256('torneo:'+torneo.id)), liberi=nomi.slice(), p=[{nome:null,livello:0,umano:true}];
    for(let i=0;i<7;i++){ const k=Math.floor(r()*liberi.length); p.push({nome:liberi.splice(k,1)[0]||('Ospite '+i),livello:3+Math.floor(r()*6),umano:false}); }
    return {partecipanti:p,turni:[[0,1,2,3,4,5,6,7]],fase:0,eliminato:false,posizione:null};
  },
  // Probabilità di vittoria tra bot in stile Elo (4 livelli = 10 a 1).
  simula(livA,livB,rng){ return rng()<1/(1+Math.pow(10,(livB-livA)/4))?0:1; },
  // Dopo la partita del giocatore: simula le altre e costruisce il turno successivo.
  avanza(tab,vintoUmano,rng){
    const corrente=tab.turni[tab.fase], prossimo=[];
    for(let k=0;k<corrente.length;k+=2){
      const a=corrente[k], b=corrente[k+1], pa=tab.partecipanti[a], pb=tab.partecipanti[b];
      let w;
      if(pa.umano) w=vintoUmano?a:b; else if(pb.umano) w=vintoUmano?b:a;
      else w=V.tornei.simula(pa.livello,pb.livello,rng)===0?a:b;
      prossimo.push(w);
    }
    const inGioco=prossimo.includes(0), n=corrente.length;
    if(!inGioco&&!tab.eliminato){ tab.eliminato=true; tab.posizione=n===2?2:n===4?3:5; }
    tab.turni.push(prossimo); tab.fase++;
    if(prossimo.length===1&&prossimo[0]===0) tab.posizione=1;
    return tab;
  },
  avversario(tab){ const t=tab.turni[tab.fase], i=t.indexOf(0); if(i<0||t.length<2) return null; return tab.partecipanti[t[i%2?i-1:i+1]]; },
  // Premi sul piatto delle iscrizioni: 50% primo, 25% secondo, 12,5% ai semifinalisti.
  premio(posizione,iscrizione,posti=8){
    const piatto=iscrizione*posti; return posizione===1?piatto*0.5:posizione===2?piatto*0.25:posizione===3?piatto*0.125:0;
  },
  nomeFase(n){ return n===8?'Quarti':n===4?'Semifinale':n===2?'Finale':''; }
};
})(globalThis.V=globalThis.V||{});
