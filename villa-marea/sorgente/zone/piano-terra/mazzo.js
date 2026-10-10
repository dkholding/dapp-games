(function(V){'use strict';
// Carte napoletane: id = valore + seme, es. '7D'. 8 fante, 9 cavallo, 10 re.
V.SEMI=['D','C','S','B'];   // denari, coppe, spade, bastoni
V.NOMI_SEMI={D:'denari',C:'coppe',S:'spade',B:'bastoni'};
V.carta={ valore:id=>parseInt(id,10), seme:id=>id.slice(-1) };
V.mazzoNapoletano=()=>V.SEMI.flatMap(s=>[1,2,3,4,5,6,7,8,9,10].map(v=>v+s));
})(globalThis.V=globalThis.V||{});
