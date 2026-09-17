(function(V){'use strict';
// Il piano terra della Villa: sei sale con vetrate sul mare.
// Nord = mare. Coordinate in unità del mondo. Nei tavoli a 4 il compagno è il posto 2.
const Y_VETRATA=420, Y_MEZZO=1040, Y_SUD=1720, X1=900, X2=1600, LARGO=2400;
const R=58;

const muri=[
  ...V.muro(0,Y_MEZZO,LARGO,Y_MEZZO,[[400,520],[1180,1320],[1940,2060]]),
  ...V.muro(X1,Y_VETRATA,X1,Y_SUD,[[680,800],[1320,1440]]),
  ...V.muro(X2,Y_VETRATA,X2,Y_SUD,[[680,800],[1320,1440]]),
  ...V.muro(0,Y_SUD,LARGO,Y_SUD,[[1200,1300]]),
  ...V.muro(0,Y_VETRATA,0,Y_SUD,[]),
  ...V.muro(LARGO,Y_VETRATA,LARGO,Y_SUD,[])
];
const vetrate=V.muro(0,Y_VETRATA,LARGO,Y_VETRATA,[[420,500],[1210,1290],[1960,2040]]);

const t=(id,x,y,gioco,giocatori,tipo,livello,extra)=>Object.assign({id,x,y,r:R,gioco,giocatori,tipo,livelli:new Array(giocatori-1).fill(livello)},extra||{});

V.NOMI_BOT=['Nonna Pina','Il Marchese','Zio Tonino','Rosetta','Il Dottore','Donna Carmela','Peppino','Totò',
  'La Contessa','Ciccio','Mastro Gino','Zia Assunta','Il Capitano','Nennella','Don Vito','Filomena','Il Notaio','Gegè'];

V.zone=V.zone||{};
V.zone['piano-terra']={
  id:'piano-terra', nome:'Piano terra', salvataggio:'carte',
  economia:{ moneta:{nome:'Fiches',simbolo:'◉',iniziale:1000,regalo:100}, trattenuta:0.05,
    catalogo:[
      {id:'dorso-riviera',nome:'Mazzo Riviera',prezzo:300,dorso:'#1f5a8a',filo:'#bfe3ff'},
      {id:'dorso-barocco',nome:'Mazzo Barocco',prezzo:800,dorso:'#3a2a0a',filo:'#ffd66b'},
      {id:'dorso-liberty',nome:'Mazzo Liberty',prezzo:1500,dorso:'#1f4a32',filo:'#e8c9ff'}
    ]},
  tornei:{ giochi:['scopa','briscola','tressette','scala40','burraco'], iscrizione:100, sala:'onore' },
  mappa:{
    id:'piano-terra', larghezza:LARGO, altezza:Y_SUD+40, mare:{y:300},
    partenza:{x:1250,y:1640},
    stanze:[
      {id:'veranda-vista',nome:'Veranda',esterna:true,x:0,y:300,w:LARGO,h:Y_VETRATA-300,pavimento:'legno'},
      {id:'scopa',nome:'Salone della Scopa',tag:'Marmi, specchi e sfide a posta',x:0,y:Y_VETRATA,w:X1,h:Y_MEZZO-Y_VETRATA,pavimento:'marmo',postaMax:200},
      {id:'briscola',nome:'Sala di Briscola e Tressette',tag:'Parquet e silenzio: si conta ogni carta',x:X1,y:Y_VETRATA,w:X2-X1,h:Y_MEZZO-Y_VETRATA,pavimento:'parquet',postaMax:200},
      {id:'biblioteca',nome:'Biblioteca',tag:'Scala 40 e Burraco tra i libri',x:X2,y:Y_VETRATA,w:LARGO-X2,h:Y_MEZZO-Y_VETRATA,pavimento:'tappetoBlu',postaMax:500},
      {id:'bar',nome:'Salotto del Bar',tag:'Divani di velluto · si gioca per il gusto di giocare',x:0,y:Y_MEZZO,w:X1,h:Y_SUD-Y_MEZZO,pavimento:'cotto',postaMax:0},
      {id:'atrio',nome:'Atrio',tag:'Bacheca dei tornei e banco del negozio',x:X1,y:Y_MEZZO,w:X2-X1,h:Y_SUD-Y_MEZZO,pavimento:'marmoScuro'},
      {id:'onore',nome:"Sala d'Onore",tag:'Tornei a orario · si entra dal livello 5',x:X2,y:Y_MEZZO,w:LARGO-X2,h:Y_SUD-Y_MEZZO,pavimento:'tappeto',livelloMin:5}
    ],
    muri, vetrate,
    porte:[
      {x:420,y:Y_VETRATA-40,w:80,h:30,verso:'veranda',arrivo:{x:460,y:520},nome:'Veranda'},
      {x:1210,y:Y_VETRATA-40,w:80,h:30,verso:'veranda',arrivo:{x:1250,y:520},nome:'Veranda'},
      {x:1960,y:Y_VETRATA-40,w:80,h:30,verso:'veranda',arrivo:{x:2000,y:520},nome:'Veranda'},
      {x:1200,y:Y_SUD+8,w:100,h:30,verso:'giardino',arrivo:{x:1250,y:300},nome:'Giardino'}
    ],
    cancelli:[{x:X2-8,y:1320,w:16,h:120,livelloMin:5,nome:"Sala d'Onore"}],
    arredi:[
      {tipo:'bancone',x:40,y:1100,w:70,h:560,azione:'bar',nome:'Bancone del Bar · da bere coi Ducati'},
      {tipo:'divano',x:160,y:1680-40,w:160,h:36,colore:'#6b1e2b'},
      {tipo:'pianta',x:830,y:1080,w:50,h:50},{tipo:'pianta',x:20,y:460,w:50,h:50},{tipo:'pianta',x:830,y:960,w:50,h:50},
      {tipo:'tappeto',x:1080,y:1180,w:340,h:420,colore:'#5a1f2b',pavimento:true,solido:false},
      {tipo:'bacheca',x:940,y:1080,w:150,h:50,azione:'tornei',icona:'🏆',nome:'Bacheca dei tornei'},
      {tipo:'banco',x:1430,y:1500,w:140,h:60,azione:'negozio',icona:'◉',nome:'Banco del negozio'},
      {tipo:'portineria',x:940,y:1560,w:120,h:60,azione:'profilo',icona:'✉',nome:'Portineria'},
      {tipo:'statua',x:1470,y:1100,w:60,h:60},
      {tipo:'libreria',x:2340,y:460,w:40,h:540},{tipo:'libreria',x:1640,y:960,w:260,h:40},
      {tipo:'pianta',x:1640,y:460,w:50,h:50},
      {tipo:'tappeto',x:1760,y:1160,w:480,h:440,colore:'#7a1f2b',pavimento:true,solido:false},
      {tipo:'statua',x:1640,y:1080,w:50,h:50},{tipo:'statua',x:2320,y:1080,w:50,h:50},
      {tipo:'statua',x:1640,y:1640,w:50,h:50},{tipo:'statua',x:2320,y:1640,w:50,h:50},
      {tipo:'ringhiera',x:0,y:300,w:LARGO,h:10,solido:false}
    ],
    tavoli:[
      // Salotto del Bar: amichevoli
      t('bar-scopa',280,1200,'scopa',2,'amichevole',3,{secondi:20}),
      t('bar-scopa4',560,1200,'scopa',4,'amichevole',4,{secondi:20}),
      t('bar-briscola',800,1200,'briscola',2,'amichevole',3,{secondi:20}),
      t('bar-tressette',280,1560,'tressette',2,'amichevole',4,{secondi:20}),
      t('bar-scala40',560,1560,'scala40',2,'amichevole',3,{secondi:40,breve:true}),
      t('bar-burraco',800,1560,'burraco',2,'amichevole',3,{secondi:40,breve:true}),
      // Salone della Scopa
      t('scopa-sfida',230,640,'scopa',2,'sfida',4,{secondi:12}),
      t('scopa-buio',660,640,'scopa',2,'buio',6,{secondi:12}),
      t('scopa-coppie',230,880,'scopa',4,'sfida',6,{secondi:12}),
      t('scopa-forte',660,880,'scopa',2,'sfida',8,{secondi:12}),
      // Briscola e Tressette
      t('briscola-sfida',1080,640,'briscola',2,'sfida',4,{secondi:12}),
      t('tressette-sfida',1420,640,'tressette',2,'sfida',5,{secondi:12}),
      t('briscola-buio',1080,880,'briscola',4,'buio',5,{secondi:12}),
      t('tressette-coppie',1420,880,'tressette',4,'sfida',6,{secondi:12}),
      // Biblioteca
      t('scala40-sfida',1800,640,'scala40',2,'sfida',5,{secondi:30}),
      t('burraco-sfida',2180,640,'burraco',2,'sfida',5,{secondi:30,breve:true}),
      t('scala40-buio',1800,860,'scala40',2,'buio',6,{secondi:30,breve:true}),
      t('burraco-coppie',2180,860,'burraco',4,'sfida',6,{secondi:30,breve:true}),
      // Sala d'Onore
      t('onore',2000,1380,'torneo',4,'torneo',7,{r:74,panno:'#6b1e2b',secondi:8})
    ]
  }
};
})(globalThis.V=globalThis.V||{});
