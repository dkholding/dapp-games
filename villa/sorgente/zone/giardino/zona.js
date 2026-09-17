(function(V){'use strict';
// Il giardino: l'ingresso della villa intera. Dal cancello (sud) il viale di cipressi
// porta alla scalinata (piano terra); il sentiero a est porta alla veranda.
const LARGO=2400, ALTO=1500, Y_FACCIATA=260;

const muri=[
  ...V.muro(0,ALTO-20,LARGO,ALTO-20,[[1150,1350]]),          // recinzione sud col cancello
  ...V.muro(20,Y_FACCIATA,20,ALTO-20,[]),
  ...V.muro(LARGO-20,Y_FACCIATA+140,LARGO-20,ALTO-20,[])
];

const siepi=[];
for(const x of [140,700,1500,2060]) siepi.push({tipo:'siepe',x,y:520,w:200,h:40},{tipo:'siepe',x,y:1000,w:200,h:40});
const cipressi=[];
for(let y=520;y<=1320;y+=160) cipressi.push({tipo:'cipresso',x:1070,y,w:50,h:70},{tipo:'cipresso',x:1380,y,w:50,h:70});

V.zone=V.zone||{};
V.zone.giardino={
  id:'giardino', nome:'Giardino', salvataggio:null,
  mappa:{
    id:'giardino', larghezza:LARGO, altezza:ALTO,
    partenza:{x:1250,y:1400},
    stanze:[
      {id:'prato',nome:'Il giardino',tag:'Cipressi, siepi e il profumo del mare',x:0,y:Y_FACCIATA,w:LARGO,h:ALTO-Y_FACCIATA,pavimento:'erba'},
      {id:'viale',nome:'Il viale dei cipressi',tag:'In fondo, la scalinata della villa',x:1130,y:420,w:240,h:ALTO-420,pavimento:'ghiaia'},
      {id:'piazzale',nome:'Il piazzale',tag:'A nord il piano terra · a est il sentiero per la veranda',x:200,y:Y_FACCIATA,w:LARGO-220,h:160,pavimento:'ghiaia'},
      {id:'sentiero',nome:'Il sentiero della scogliera',tag:'Porta alla veranda sul mare',x:1900,y:Y_FACCIATA,w:500,h:140,pavimento:'ghiaia'}
    ],
    muri, vetrate:[],
    porte:[
      {x:1200,y:Y_FACCIATA-34,w:100,h:30,verso:'piano-terra',arrivo:{x:1250,y:1660},nome:'Piano terra · Carte'},
      {x:LARGO-18,y:Y_FACCIATA+10,w:30,h:120,verso:'veranda',arrivo:{x:120,y:400},nome:'Veranda · Scacchi'}
    ],
    cancelli:[],
    arredi:[
      {tipo:'facciata',x:0,y:0,w:LARGO,h:Y_FACCIATA,portone:{x:1200,w:100},solido:false,pavimento:true},
      {tipo:'vuoto',x:0,y:-20,w:1200,h:Y_FACCIATA+10},{tipo:'vuoto',x:1300,y:-20,w:LARGO-1300,h:Y_FACCIATA+10},
      {tipo:'vuoto',x:1200,y:-20,w:100,h:Y_FACCIATA-40},
      {tipo:'scalinata',x:1170,y:Y_FACCIATA,w:160,h:70,pavimento:true,solido:false},
      {tipo:'fontana',x:1170,y:640,w:160,h:160},
      {tipo:'cancello',x:1150,y:ALTO-30,w:200,h:20,solido:false,pavimento:true},
      {tipo:'portineria',x:1400,y:1330,w:130,h:70,azione:'profilo',icona:'✉',nome:'Portineria'},
      {tipo:'cartello',x:850,y:1320,w:60,h:60,testo:['↑ Carte','→ Scacchi']},
      {tipo:'cartello',x:1820,y:Y_FACCIATA+30,w:60,h:60,testo:['→ Veranda']},
      ...siepi, ...cipressi,
      {tipo:'aiuola',x:300,y:700,w:360,h:180},{tipo:'aiuola',x:1760,y:700,w:360,h:180},
      {tipo:'aiuola',x:300,y:1150,w:360,h:180},{tipo:'aiuola',x:1760,y:1150,w:360,h:180},
      {tipo:'lampione',x:1100,y:1400,w:24,h:24},{tipo:'lampione',x:1376,y:1400,w:24,h:24}
    ],
    tavoli:[],
    avventori:6
  }
};
})(globalThis.V=globalThis.V||{});
