(function(V){'use strict';
// Il piano terra: per ora solo il Salotto del Bar con i tavoli di Scopa.
// Nei tavoli a 4 gli avversari sono i posti 1 e 3, il compagno il posto 2.
V.zone=V.zone||{};
V.zone['piano-terra']={
  id:'piano-terra', nome:'Piano terra', salvataggio:'carte',
  sale:[{
    id:'bar', nome:'Salotto del Bar',
    tag:'Divani di velluto e vetrate sul mare · si gioca per il gusto di giocare',
    tavoli:[
      {id:'bar-1',gioco:'scopa',giocatori:2,livelli:[3],secondi:20,avversari:['Nonna Pina']},
      {id:'bar-2',gioco:'scopa',giocatori:2,livelli:[7],secondi:20,avversari:['Il Marchese']},
      {id:'bar-3',gioco:'scopa',giocatori:4,livelli:[5,5,5],secondi:20,avversari:['Zio Tonino','Rosetta','Il Dottore']}
    ]
  }]
};
})(globalThis.V=globalThis.V||{});
