(function(V){'use strict';
// Economia generale della Villa, DI PROVA: i Ducati si spendono solo dentro la villa
// (da bere al bancone, abiti in portineria). Non si cambiano con le monete dei giochi.
V.VILLA={
  salvataggio:'generale',
  economia:{
    moneta:{nome:'Ducati',simbolo:'◆',iniziale:100,regalo:50},
    trattenuta:0,
    perPartita:5,
    catalogo:[
      {id:'abito-lino',tipo:'abito',nome:'Completo di lino',prezzo:80,colore:'#e8dcc0',dettaglio:'#8a6a3a'},
      {id:'abito-sera',tipo:'abito',nome:'Abito da sera',prezzo:150,colore:'#1b1b22',dettaglio:'#d8b262'},
      {id:'abito-capitano',tipo:'abito',nome:'Divisa del Capitano',prezzo:300,colore:'#f4f4f4',dettaglio:'#1f3a8a'}
    ],
    bevande:[
      {id:'caffe',nome:'Caffè',prezzo:5,icona:'☕',minuti:10},
      {id:'limoncello',nome:'Limoncello',prezzo:12,icona:'🍋',minuti:15},
      {id:'spritz',nome:'Spritz',prezzo:20,icona:'🍹',minuti:20},
      {id:'champagne',nome:'Champagne',prezzo:60,icona:'🥂',minuti:30}
    ]
  }
};
})(globalThis.V=globalThis.V||{});
