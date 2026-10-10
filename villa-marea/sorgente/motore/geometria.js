(function(V){'use strict';
// Geometria del mondo: muri, urti e percorsi. Niente DOM: si prova in node.
const SPESSORE=16;

// Muro lungo un asse con aperture [[da,a],...] misurate sullo stesso asse.
V.muro=function(x1,y1,x2,y2,aperture){
  const orizz=y1===y2, a0=orizz?Math.min(x1,x2):Math.min(y1,y2), a1=orizz?Math.max(x1,x2):Math.max(y1,y2);
  const buchi=(aperture||[]).map(([p,q])=>[Math.min(p,q),Math.max(p,q)]).sort((p,q)=>p[0]-q[0]);
  const pezzi=[]; let da=a0;
  for(const [p,q] of buchi){ if(p>da) pezzi.push([da,p]); da=Math.max(da,q); }
  if(da<a1) pezzi.push([da,a1]);
  return pezzi.map(([p,q])=>orizz
    ?{x:p,y:y1-SPESSORE/2,w:q-p,h:SPESSORE}
    :{x:x1-SPESSORE/2,y:p,w:SPESSORE,h:q-p});
};

// Spinta per far uscire un cerchio da un rettangolo (null se non si toccano).
V.urtoRett=function(cx,cy,r,q){
  const nx=V.clamp(cx,q.x,q.x+q.w), ny=V.clamp(cy,q.y,q.y+q.h), dx=cx-nx, dy=cy-ny, d2=dx*dx+dy*dy;
  if(d2>=r*r) return null;
  if(d2===0){
    const l=cx-q.x, rr=q.x+q.w-cx, t=cy-q.y, b=q.y+q.h-cy, m=Math.min(l,rr,t,b);
    if(m===l) return {x:-(l+r),y:0}; if(m===rr) return {x:rr+r,y:0};
    if(m===t) return {x:0,y:-(t+r)}; return {x:0,y:b+r};
  }
  const d=Math.sqrt(d2); return {x:dx/d*(r-d),y:dy/d*(r-d)};
};
V.urtoCerchio=function(cx,cy,r,c){
  const dx=cx-c.x, dy=cy-c.y, d=Math.hypot(dx,dy), min=r+c.r;
  if(d>=min) return null;
  if(d===0) return {x:min,y:0};
  return {x:dx/d*(min-d),y:dy/d*(min-d)};
};

// Mappa camminabile: ostacoli = {rett:[...], cerchi:[...]}.
V.Griglia=class{
  constructor(larghezza,altezza,ostacoli,raggio,cella=20){
    this.c=cella; this.nx=Math.ceil(larghezza/cella); this.ny=Math.ceil(altezza/cella);
    this.ost=ostacoli; this.r=raggio;
    this.bloccata=new Uint8Array(this.nx*this.ny);
    for(let j=0;j<this.ny;j++) for(let i=0;i<this.nx;i++)
      this.bloccata[j*this.nx+i]=this.libero((i+0.5)*cella,(j+0.5)*cella)?0:1;
  }
  libero(x,y,r=this.r){
    for(const q of this.ost.rett) if(V.urtoRett(x,y,r,q)) return false;
    for(const c of this.ost.cerchi) if(V.urtoCerchio(x,y,r,c)) return false;
    return true;
  }
  cellaDi(x,y){ return [V.clamp(Math.floor(x/this.c),0,this.nx-1),V.clamp(Math.floor(y/this.c),0,this.ny-1)]; }
  aperta(i,j){ return i>=0&&j>=0&&i<this.nx&&j<this.ny&&!this.bloccata[j*this.nx+i]; }
  vicinaLibera(i,j){
    if(this.aperta(i,j)) return [i,j];
    for(let raggio=1;raggio<12;raggio++)
      for(let dj=-raggio;dj<=raggio;dj++) for(let di=-raggio;di<=raggio;di++)
        if(Math.max(Math.abs(di),Math.abs(dj))===raggio&&this.aperta(i+di,j+dj)) return [i+di,j+dj];
    return null;
  }
  // Tratto percorribile: campiona ogni mezza cella.
  visibile(ax,ay,bx,by){
    const d=Math.hypot(bx-ax,by-ay), n=Math.ceil(d/(this.c/2));
    for(let k=1;k<n;k++){ const t=k/n, [i,j]=this.cellaDi(ax+(bx-ax)*t,ay+(by-ay)*t); if(!this.aperta(i,j)) return false; }
    return true;
  }
  // A* a 8 direzioni senza tagliare gli spigoli, poi il percorso si stira.
  percorso(ax,ay,bx,by){
    const s=this.vicinaLibera(...this.cellaDi(ax,ay)), g=this.vicinaLibera(...this.cellaDi(bx,by));
    if(!s||!g) return null;
    const nx=this.nx, idx=(i,j)=>j*nx+i, meta=idx(g[0],g[1]);
    const costo=new Float32Array(nx*this.ny).fill(Infinity), da=new Int32Array(nx*this.ny).fill(-1), chiusa=new Uint8Array(nx*this.ny);
    const aperti=[]; const h=(i,j)=>{ const dx=Math.abs(i-g[0]), dy=Math.abs(j-g[1]); return Math.max(dx,dy)+0.414*Math.min(dx,dy); };
    const spingi=(n,f)=>{ aperti.push([f,n]); let k=aperti.length-1;
      while(k>0){ const p=(k-1)>>1; if(aperti[p][0]<=aperti[k][0]) break; [aperti[p],aperti[k]]=[aperti[k],aperti[p]]; k=p; } };
    const togli=()=>{ const top=aperti[0], ult=aperti.pop();
      if(aperti.length){ aperti[0]=ult; let k=0;
        for(;;){ const l=2*k+1, r=l+1; let m=k;
          if(l<aperti.length&&aperti[l][0]<aperti[m][0]) m=l; if(r<aperti.length&&aperti[r][0]<aperti[m][0]) m=r;
          if(m===k) break; [aperti[m],aperti[k]]=[aperti[k],aperti[m]]; k=m; } }
      return top; };
    const i0=idx(s[0],s[1]); costo[i0]=0; spingi(i0,h(s[0],s[1]));
    let giri=0;
    while(aperti.length&&giri++<60000){
      const [,n]=togli(); if(chiusa[n]) continue; chiusa[n]=1;
      if(n===meta) break;
      const i=n%nx, j=(n-i)/nx;
      for(let dj=-1;dj<=1;dj++) for(let di=-1;di<=1;di++){
        if(!di&&!dj) continue; const a=i+di, b=j+dj; if(!this.aperta(a,b)) continue;
        if(di&&dj&&(!this.aperta(i+di,j)||!this.aperta(i,j+dj))) continue;
        const m=idx(a,b), nc=costo[n]+(di&&dj?1.414:1);
        if(nc<costo[m]){ costo[m]=nc; da[m]=n; spingi(m,nc+h(a,b)); }
      }
    }
    if(!chiusa[meta]) return null;
    const celle=[]; for(let n=meta;n!==-1;n=da[n]) celle.push(n); celle.reverse();
    const punti=celle.map(n=>{ const i=n%nx; return {x:(i+0.5)*this.c,y:((n-i)/nx+0.5)*this.c}; });
    const dentro=bx>=0&&by>=0&&bx<this.nx*this.c&&by<this.ny*this.c;
    if(dentro&&this.aperta(...this.cellaDi(bx,by))&&this.libero(bx,by)) punti[punti.length-1]={x:bx,y:by};
    const stirato=[]; let base={x:ax,y:ay}, k=0;
    while(k<punti.length){
      let lontano=k;
      for(let q=punti.length-1;q>k;q--) if(this.visibile(base.x,base.y,punti[q].x,punti[q].y)){ lontano=q; break; }
      stirato.push(punti[lontano]); base=punti[lontano]; k=lontano+1;
    }
    return stirato;
  }
};
})(globalThis.V=globalThis.V||{});
