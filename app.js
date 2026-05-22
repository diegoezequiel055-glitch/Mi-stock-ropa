import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp({
  apiKey:"AIzaSyBdw_kkoaFUKGl2HX4FfUEV-I-0SR0n1go",
  authDomain:"mi-stock-ropa.firebaseapp.com",
  projectId:"mi-stock-ropa",
  storageBucket:"mi-stock-ropa.firebasestorage.app",
  messagingSenderId:"517134595094",
  appId:"1:517134595094:web:f3ce949a1ef8d09d5db137"
});
const auth = getAuth(app);
const db   = getFirestore(app);

// ── STATE ──
let stockData   = [];
let ventasData  = [];
let comprasData = [];
let gastosData  = [];
let dateFilter     = 'all';
let compraFilter   = 'all';
let gastoFilter    = 'all';
let cobrosFilter   = 'activos';
let tipoVenta      = 'minorista';
let curvaItems     = [];
let cpItems        = [];
let cpActualizaStock = true; // toggle: si la compra suma al stock o solo guarda historial
let confirmCb      = null;
let unsubStock = null, unsubVentas = null, unsubCompras = null, unsubGastos = null, unsubCuotas = null, unsubReservas = null;
let cuotasData  = [];
let reservasData = [];
let reservaFilter = 'activas';
let lastCatList = '';
let currentEditId = null;

// ── INITIAL STOCK ──
const INITIAL = [
  {cat:"Bermuda",modelo:"Jean (Liquidación)",color:"Jean claro con brillos",talle:"44",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Bermuda",modelo:"Jean (Liquidación)",color:"Negro con estampas",talle:"44",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Bermuda",modelo:"Jean (Liquidación)",color:"Jean claro",talle:"48",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Buzo",modelo:"Algodón sin frisa (Liquidación)",color:"",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Campera",modelo:"Puffer Nike Reflex",color:"",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Campera",modelo:"Puffer Nike Reflex",color:"",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Campera",modelo:"Puffer Nike Reflex",color:"",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2025 Jugador",color:"",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga corta)",color:"Titular",talle:"S",qty:2,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga corta)",color:"Titular",talle:"M",qty:3,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga corta)",color:"Titular",talle:"L",qty:3,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga corta)",color:"Titular",talle:"XL",qty:4,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga corta)",color:"Titular",talle:"XXL",qty:4,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga larga)",color:"Titular",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga larga)",color:"Titular",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga larga)",color:"Titular",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga larga)",color:"Titular",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Argentina 2026 Juego (Manga larga)",color:"Titular",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Barcelona Titular",color:"",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Boca Jugador Titular",color:"",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Boca NFL",color:"",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Boca Suplente Original",color:"",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Boca (Camisa)",color:"",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Boca Conjunto (Remera + Short)",color:"",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Celtics Musculosa",color:"Negra",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Chelsea Total 90 Hincha",color:"",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Chelsea Total 90 Hincha",color:"",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Chelsea Total 90 Hincha",color:"",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Chelsea Total 90 Jugador",color:"",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Flamengo Hincha",color:"Beige",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Flamengo Hincha",color:"Beige",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Flamengo Hincha",color:"Blanco con rojo",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Independiente Hincha",color:"",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Japón Hincha",color:"",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Juventus Hincha (Cuello V)",color:"",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Newcastle Jugador",color:"Blanco con negro",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Real Madrid (Chomba Dragón)",color:"",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Sao Paulo Jugador",color:"Negra",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Sao Paulo Jugador",color:"Negra",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Sao Paulo Jugador",color:"Negra",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Camiseta",modelo:"Sao Paulo Jugador",color:"Negra",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Algodón Importado (Liquidación)",color:"",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Barcelona",color:"Negro",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Boca Entrenamiento",color:"Amarillo",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Juventus (Con campera)",color:"Negro con rosa",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Juventus (Con campera)",color:"Negro con rosa",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Lacoste G5",color:"Azul con blanco",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Lacoste G5",color:"Azul",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Lacoste G5",color:"Negro con verde",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Lacoste (Tiras laterales)",color:"Azul",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Lacoste (Tiras laterales)",color:"Negro",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Lino (Liquidación)",color:"Beige",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Lino (Liquidación)",color:"Beige",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Milan Entrenamiento",color:"Negro",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Palmeiras (Con campera y capucha)",color:"",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Real Madrid Entrenamiento",color:"Beige",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Conjunto",modelo:"Spurs NBA",color:"Negro",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Jean",modelo:"Desgastado (Liquidación)",color:"Óxido",talle:"40",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Argentina Juego",color:"Azul",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Argentina Juego",color:"Azul",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Argentina Juego",color:"Azul",talle:"L",qty:2,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Argentina Juego",color:"Blanco",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Argentina Juego",color:"Blanco",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Argentina Juego",color:"Blanco",talle:"XL",qty:4,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Argentina Juego",color:"Blanco",talle:"XXL",qty:2,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Boca",color:"Versión de juego",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Importado Jordan",color:"Camuflaje blanco",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Importado Jordan",color:"Camuflaje negro",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Importado Jordan",color:"Negro básico",talle:"M",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Importado Jordan",color:"Negro con rojo",talle:"L",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Importado Jordan",color:"Negro con violeta",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Importado Jordan",color:"Negro con violeta",talle:"M",qty:2,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Importado Jordan",color:"Negro con violeta",talle:"XXL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"Importado iJordan",color:"Negro con rojo",talle:"S",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"NBA Importado Celtics",color:"Verde",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"NBA Importado Grizzlies",color:"",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
  {cat:"Short",modelo:"NBA Importado Magic",color:"Negro",talle:"XL",qty:1,pventa:null,pcosto:null,pmayorista:null},
];

// ── INIT ──
async function init() {
  try {
    document.getElementById('loader-msg').textContent = 'Autenticando...';
    await signInAnonymously(auth);
    document.getElementById('loader-msg').textContent = 'Conectando con la nube...';
    const metaRef  = doc(db,'meta','init');
    const metaSnap = await getDoc(metaRef);
    if (!metaSnap.exists()) {
      document.getElementById('loader-msg').textContent = 'Cargando stock inicial...';
      await setDoc(metaRef,{done:true,ts:Date.now()});
      const batch = writeBatch(db);
      for (const p of INITIAL) { const r=doc(collection(db,'stock')); batch.set(r,{...p,createdAt:Date.now()}); }
      await batch.commit();
    }
    // Setear fecha de hoy en formularios
    const hoy = new Date().toISOString().slice(0,10);
    document.getElementById('cp-fecha').value = hoy;
    document.getElementById('ga-fecha').value = hoy;
    document.getElementById('cuo-fecha1').value = hoy;
    // Fecha default reserva: 7 días desde hoy
    const en7 = new Date(); en7.setDate(en7.getDate()+7);
    const resFecha = document.getElementById('res-fecha');
    if (resFecha) resFecha.value = en7.toISOString().slice(0,10);
    startListeners();
  } catch(err) {
    console.error(err);
    const loader = document.getElementById('loader');
    loader.querySelector('.loader-bar').style.display='none';
    const msg = loader.querySelector('#loader-msg');
    msg.className='loader-error';
    msg.innerHTML=`No se pudo conectar.<br><small style="color:var(--muted)">${err.message}</small>`;
    const btn=document.createElement('button'); btn.className='loader-retry'; btn.textContent='↺ Reintentar'; btn.onclick=()=>location.reload();
    loader.appendChild(btn);
  }
}

function startListeners() {
  if(unsubStock)  unsubStock();
  if(unsubVentas) unsubVentas();
  if(unsubCuotas) unsubCuotas();

  unsubStock = onSnapshot(collection(db,'stock'), snap=>{
    stockData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderStock(); populateCategoryFilter(); fillVentaCats(); updateHeader();
    // Bug #19 fix: alerta de stock bajo al cargar o cambiar
    checkStockBajo();
  },err=>{ toast('Error stock: '+err.message,'error'); });

  unsubVentas = onSnapshot(query(collection(db,'ventas'),orderBy('fecha','desc'),limit(200)), snap=>{
    ventasData=snap.docs.map(d=>{ const r=d.data(); return{id:d.id,...r,pventa:r.pventa??r.precio??0,cant:r.cant??r.cantidad??1,pcosto:r.pcosto??r.costo??null}; });
    renderVentas(); renderComprasKPI(); renderDashboard();
    if(document.getElementById('tab-ganancias').classList.contains('active')) renderGanancias();
    updateHeader();
  },err=>{ toast('Error ventas: '+err.message,'error'); });

  unsubCuotas = onSnapshot(query(collection(db,'cuotas'),orderBy('createdAt','desc'),limit(100)), snap=>{
    cuotasData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderCobros(); renderCobrosKPI(); updateHeader(); renderDashboard(); updateCobrosTabBadge();
    if(document.getElementById('tab-ganancias').classList.contains('active')) renderGanancias();
  },err=>{ toast('Error cuotas: '+err.message,'error'); });

  if(unsubReservas) unsubReservas();
  unsubReservas = onSnapshot(query(collection(db,'reservas'),orderBy('createdAt','desc'),limit(100)), snap=>{
    reservasData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderReservasKPI(); updateReservasTabBadge();
    if(document.getElementById('tab-reservas').classList.contains('active')) renderReservas();
    // Actualizar stock con cantidades reservadas
    renderStock();
  },err=>{ toast('Error reservas: '+err.message,'error'); });

  // Bug #12 fix: compras y gastos se cargan una vez (no tiempo real — ahorra lecturas Firestore)
  loadCompras(); loadGastos();

  // Fix curva listeners
  document.getElementById('curva-precio-unit').addEventListener('input', renderCurvaItems);
  document.getElementById('curva-costo-unit').addEventListener('input', renderCurvaItems);

  document.getElementById('loader').style.display='none';
}

// Bug #12: funciones de carga única para compras y gastos
async function loadCompras(){
  try{
    const snap=await getDocs(query(collection(db,'compras'),orderBy('fecha','desc'),limit(100)));
    comprasData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderComprasKPI();
    if(document.getElementById('tab-compras').classList.contains('active')) renderCompras();
  }catch(e){ console.error('Error cargando compras:',e); }
}
async function loadGastos(){
  try{
    const snap=await getDocs(query(collection(db,'gastos'),orderBy('fecha','desc'),limit(200)));
    gastosData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderGastosKPI();
    if(document.getElementById('tab-gastos').classList.contains('active')) renderGastos();
  }catch(e){ console.error('Error cargando gastos:',e); }
}

// ── HEADER ──
window.updateHeader = function() {
  const unid = stockData.reduce((a,p)=>a+p.qty,0);
  // Bug #8 + #10 fix: incluir cuotas cobradas en ganancia y contador de ventas
  const ganVentas = ventasData.filter(v=>v.pcosto).reduce((a,v)=>a+(v.pventa-v.pcosto)*v.cant,0);
  const ganCuotas = cuotasData.filter(c=>c.pcosto&&c.estado==='cobrado').reduce((a,c)=>a+(c.totalVenta-c.pcosto),0);
  const gan = ganVentas + ganCuotas;
  const totalVentas = ventasData.length + cuotasData.length;
  document.getElementById('h-unidades').textContent = unid;
  document.getElementById('h-ventas').textContent   = totalVentas;
  document.getElementById('h-gan').textContent      = gan?'$'+fmt(Math.round(gan)):'—';
}

// ── CATEGORY FILTER ──
function populateCategoryFilter() {
  const cats = [...new Set(stockData.map(p=>p.cat))].sort();
  const key  = cats.join(',');
  if(key===lastCatList) return;
  lastCatList=key;
  const sel=document.getElementById('s-cat'), cur=sel.value;
  sel.innerHTML='<option value="">Todas las categorías</option>';
  cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; if(c===cur)o.selected=true; sel.appendChild(o); });
}

// ── STOCK ──
let lastStockRenderKey = '';
function updateStockKPIs(){
  const total=stockData.reduce((a,p)=>a+p.qty,0);
  const valorInv=stockData.filter(p=>p.pcosto&&p.qty>0).reduce((a,p)=>a+p.pcosto*p.qty,0);
  document.getElementById('k-total').textContent=total;
  document.getElementById('k-prods').textContent=stockData.length;
  document.getElementById('k-sinprecio').textContent=stockData.filter(p=>!p.pventa).length;
  document.getElementById('k-liq').textContent=stockData.filter(p=>p.modelo.toLowerCase().includes('liquidación')).reduce((a,p)=>a+p.qty,0);
  // F#1: valor del inventario
  const kVal=document.getElementById('k-valor');
  if(kVal) kVal.textContent=valorInv?'$'+fmt(Math.round(valorInv)):'—';
}
window.renderStock = function() {
  const q    = (document.getElementById('s-search')?.value||'').toLowerCase();
  const cat  = document.getElementById('s-cat')?.value||'';
  const sort = document.getElementById('s-sort')?.value||'cat';
  let filtered = stockData.filter(p=>{ const txt=[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase(); return(!q||txt.includes(q))&&(!cat||p.cat===cat); });
  filtered.sort((a,b)=>{
    if(sort==='cat') return a.cat.localeCompare(b.cat)||a.modelo.localeCompare(b.modelo);
    if(sort==='qty-asc') return a.qty-b.qty; if(sort==='qty-desc') return b.qty-a.qty;
    if(sort==='precio-asc') return(a.pventa||0)-(b.pventa||0); if(sort==='precio-desc') return(b.pventa||0)-(a.pventa||0);
    return 0;
  });
  updateStockKPIs();
  const renderKey = filtered.map(p=>`${p.id}:${p.qty}:${p.pventa}:${p.pcosto}`).join('|')+'|'+q+'|'+cat+'|'+sort;
  if(!inventarioMode && renderKey === lastStockRenderKey) return;
  lastStockRenderKey = renderKey;

  const tbody=document.getElementById('stock-tbody');
  tbody.innerHTML=filtered.length?filtered.map(p=>{
    const {badge,label}=getBadge(p);
    const qtyCell=inventarioMode
      ? `<td><input type="number" value="${inventarioCounts[p.id]??p.qty}" min="0" onchange="setInventarioCant('${p.id}',this.value)" style="width:70px;text-align:center;${(inventarioCounts[p.id]!==undefined&&inventarioCounts[p.id]!==p.qty)?'background:rgba(212,168,67,.15);border-color:var(--accent)':''}"></td>`
      : `<td><div class="qty-ctrl"><button class="qty-btn" onclick="adjustQty('${p.id}',-1)">−</button><span class="qty-val" style="color:${p.qty===0?'var(--danger)':p.qty<=1?'var(--warning)':'var(--text)'}">${p.qty}</span><button class="qty-btn" onclick="adjustQty('${p.id}',1)">+</button></div></td>`;
    return`<tr>
      <td><span style="font-size:.75rem;color:var(--muted)">${p.cat}</span></td>
      <td><strong style="font-size:.86rem">${p.modelo}</strong>${p.notas?`<div style="font-size:.68rem;color:var(--warning);margin-top:2px">📝 ${p.notas}</div>`:''}</td>
      <td>${p.color||'<span style="color:var(--muted)">—</span>'}</td>
      <td><strong>${p.talle}</strong></td>
      ${qtyCell}
      <td>${p.pventa?'$'+fmt(p.pventa):'<span style="color:var(--muted)">—</span>'}</td>
      <td>${p.pmayorista?'<span style="color:var(--blue)">$'+fmt(p.pmayorista)+'</span>':'<span style="color:var(--muted)">—</span>'}</td>
      <td>${p.pcosto?'$'+fmt(p.pcosto):'<span style="color:var(--muted)">—</span>'}</td>
      <td><span class="badge ${badge}">${label}</span></td>
      <td>${inventarioMode?`<span style="font-size:.72rem;color:${inventarioCounts[p.id]!==undefined&&inventarioCounts[p.id]!==p.qty?'var(--accent)':'var(--muted)'}">${inventarioCounts[p.id]!==undefined&&inventarioCounts[p.id]!==p.qty?`era ${p.qty}`:''}</span>`:`<button class="btn btn-outline btn-sm" onclick="openProductModal('${p.id}')">✏️ Editar</button>`}</td>
    </tr>`; }).join(''):`<tr><td colspan="10"><div class="empty"><div class="empty-icon">📦</div><p>No hay productos</p></div></td></tr>`;

  const cards=document.getElementById('stock-cards');
  cards.innerHTML=filtered.length?filtered.map(p=>{
    const {badge,label}=getBadge(p);
    const qtyMobile=inventarioMode
      ? `<input type="number" value="${inventarioCounts[p.id]??p.qty}" min="0" onchange="setInventarioCant('${p.id}',this.value)" style="width:60px;text-align:center">`
      : `<div class="qty-ctrl"><button class="qty-btn" onclick="adjustQty('${p.id}',-1)">−</button><span class="qty-val" style="color:${p.qty===0?'var(--danger)':p.qty<=1?'var(--warning)':'var(--text)'}">${p.qty}</span><button class="qty-btn" onclick="adjustQty('${p.id}',1)">+</button></div>`;
    return`<div class="stock-card">
      <div class="stock-card-head"><div><div class="stock-card-title">${p.modelo}</div><div class="stock-card-sub">${p.cat}${p.color?' · '+p.color:''} · T.${p.talle}${p.notas?' · 📝 '+p.notas:''}</div></div><span class="badge ${badge}">${label}</span></div>
      <div class="stock-card-row">
        <div style="display:flex;gap:14px;align-items:center">
          ${qtyMobile}
          ${p.pventa?`<span style="font-size:.78rem;color:var(--muted)">$<strong style="color:var(--accent)">${fmt(p.pventa)}</strong></span>`:''}
          ${p.pmayorista?`<span style="font-size:.78rem;color:var(--muted)">May <strong style="color:var(--blue)">$${fmt(p.pmayorista)}</strong></span>`:''}
        </div>
        ${inventarioMode?'':`<button class="btn btn-outline btn-sm" onclick="openProductModal('${p.id}')">✏️ Editar</button>`}
      </div>
    </div>`; }).join(''):`<div class="empty"><div class="empty-icon">📦</div><p>No hay productos</p></div>`;
}

// Bug #4 fix: no usar qty hardcodeado del HTML — leerlo desde stockData al ejecutar
window.adjustQty = async function(id, delta) {
  const prod = stockData.find(p=>p.id===id);
  if(!prod){ toast('Producto no encontrado.','error'); return; }
  const n = prod.qty + delta;
  if(n<0){ toast('El stock no puede ser negativo.','error'); return; }
  try{ await updateDoc(doc(db,'stock',id),{qty:n}); }catch(e){toast('Error al actualizar.','error');}
}
function getBadge(p){
  const isLiq=p.modelo.toLowerCase().includes('liquidación');
  // Calcular unidades reservadas para este producto
  const reservadas=reservasData.filter(r=>r.prodId===p.id&&r.estado!=='cancelada').reduce((a,r)=>a+(r.cant||1),0);
  if(p.qty===0) return{badge:'b-out',label:'Sin stock'};
  if(isLiq)     return{badge:'b-liq',label:'Liquidación'};
  if(reservadas>0) return{badge:'b-reservado',label:`🔖 ${reservadas} reservada${reservadas!==1?'s':''}`};
  if(p.qty<=1)  return{badge:'b-low',label:'Última unidad'};
  return{badge:'b-ok',label:'En stock'};
}
window.onSearchInput=function(){
  const v=document.getElementById('s-search').value;
  document.getElementById('search-clear-btn').classList.toggle('visible',v.length>0);
  renderStock();
}
window.clearSearch=function(){
  document.getElementById('s-search').value='';
  document.getElementById('search-clear-btn').classList.remove('visible');
  renderStock();
}

// ── MODAL PRODUCTO ──
window.openProductModal=function(id){
  const p=id?stockData.find(x=>x.id===id):null;
  currentEditId=id||null;
  document.getElementById('prod-modal-title').textContent=p?'Editar Producto':'Agregar Producto';
  document.getElementById('pm-id').value=id||'';
  document.getElementById('pm-cat').value=p?.cat||'';
  document.getElementById('pm-modelo').value=p?.modelo||'';
  document.getElementById('pm-color').value=p?.color||'';
  document.getElementById('pm-talle').value=p?.talle||'';
  document.getElementById('pm-qty').value=p?.qty??1;
  document.getElementById('pm-pventa').value=p?.pventa||'';
  document.getElementById('pm-pmayorista').value=p?.pmayorista||'';
  document.getElementById('pm-pcosto').value=p?.pcosto||'';
  document.getElementById('pm-notas').value=p?.notas||''; // F#3
  // F#4: mostrar historial de precio de costo
  const histEl=document.getElementById('pm-hist-costo');
  if(p?.historialCosto?.length){
    const entries=p.historialCosto.slice(-5).reverse();
    histEl.innerHTML='Historial: '+entries.map(h=>`$${fmt(h.precio)} (${new Date(h.fecha).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'})})`).join(' → ');
  } else { histEl.textContent=''; }
  document.getElementById('pm-del-btn').style.display=p?'inline-flex':'none';
  document.getElementById('prod-modal').classList.add('open');
}
window.closeProdModal=function(){
  document.getElementById('prod-modal').classList.remove('open');
  document.getElementById('ac-cat').classList.remove('open');
  currentEditId=null;
}
window.saveProduct=async function(){
  const cat=document.getElementById('pm-cat').value.trim();
  const modelo=document.getElementById('pm-modelo').value.trim();
  const talle=document.getElementById('pm-talle').value.trim();
  if(!cat||!modelo||!talle){toast('Completá categoría, modelo y talle.','error');return;}
  const pventa=parseFloat(document.getElementById('pm-pventa').value)||null;
  const pcosto=parseFloat(document.getElementById('pm-pcosto').value)||null;
  const pmayorista=parseFloat(document.getElementById('pm-pmayorista').value)||null;
  if(pventa&&pventa<0){toast('El precio no puede ser negativo.','error');return;}
  if(pcosto&&pventa&&pcosto>=pventa) toast('⚠️ El costo supera el precio de venta.','error');
  const data={cat,modelo,color:document.getElementById('pm-color').value.trim(),talle,
    qty:parseInt(document.getElementById('pm-qty').value)||0,
    pventa,pcosto,pmayorista,
    notas:document.getElementById('pm-notas').value.trim()||null // F#3
  };
  const btn=document.getElementById('pm-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    const id=document.getElementById('pm-id').value;
    if(id){await updateDoc(doc(db,'stock',id),data);toast('Producto actualizado ✓','success');}
    else{await addDoc(collection(db,'stock'),{...data,createdAt:Date.now()});toast('Producto agregado ✓','success');}
    closeProdModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}
window.delProductFromModal=async function(){
  const id=document.getElementById('pm-id').value; if(!id)return;
  const ok=await confirm2('¿Eliminar producto?','Esta acción no se puede deshacer.'); if(!ok)return;
  const btn=document.getElementById('pm-del-btn'); btn.disabled=true; btn.textContent='Eliminando...';
  try{await deleteDoc(doc(db,'stock',id));toast('Producto eliminado');closeProdModal();}
  catch(e){toast('Error: '+e.message,'error');btn.disabled=false;btn.textContent='🗑 Eliminar';}
}

// ── TIPO VENTA TOGGLE ──
window.setTipoVenta=function(tipo){
  tipoVenta=tipo;
  document.getElementById('tipo-min').className='tipo-btn'+(tipo==='minorista'?' active-min':'');
  document.getElementById('tipo-may').className='tipo-btn'+(tipo==='mayorista'?' active-may':'');
  document.getElementById('tipo-cur').className='tipo-btn'+(tipo==='curva'?' active-cur':'');
  document.getElementById('tipo-cuo').className='tipo-btn'+(tipo==='cuotas'?' active-cuo':'');
  document.getElementById('tipo-multi').className='tipo-btn'+(tipo==='multiple'?' active-min':'');
  document.getElementById('form-single').style.display=(tipo==='curva'||tipo==='cuotas'||tipo==='multiple')?'none':'grid';
  document.getElementById('form-curva').style.display=tipo==='curva'?'block':'none';
  document.getElementById('form-cuotas').style.display=tipo==='cuotas'?'block':'none';
  document.getElementById('form-multiple').style.display=tipo==='multiple'?'block':'none';
  const mayExtra=document.getElementById('mayorista-extra');
  mayExtra.classList.toggle('visible',tipo==='mayorista');
  if(tipo==='mayorista'){
    document.getElementById('lbl-precio-venta').textContent='Precio mayorista ($)';
    const id=document.getElementById('v-prod').value;
    if(id){ const p=stockData.find(x=>x.id===id); if(p?.pmayorista) document.getElementById('v-precio').value=p.pmayorista; }
  } else if(tipo!=='cuotas'&&tipo!=='curva'&&tipo!=='multiple') {
    document.getElementById('lbl-precio-venta').textContent='Precio venta ($)';
    const id=document.getElementById('v-prod').value;
    if(id){ const p=stockData.find(x=>x.id===id); if(p?.pventa) document.getElementById('v-precio').value=p.pventa; }
  }
}

// ── VENTAS ──
window.fillVentaCats=function(){
  const cats=[...new Set(stockData.filter(p=>p.qty>0).map(p=>p.cat))].sort();
  ['v-cat','cuo-cat'].forEach(selId=>{
    const sel=document.getElementById(selId); if(!sel)return;
    const cur=sel.value;
    sel.innerHTML='<option value="">Seleccionar categoría...</option>';
    cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;if(c===cur)o.selected=true;sel.appendChild(o);});
  });
}
window.fillProductosByCat=function(){
  const cat=document.getElementById('v-cat').value;
  const sel=document.getElementById('v-prod');
  sel.innerHTML='<option value="">Seleccionar producto...</option>';
  if(!cat)return;
  stockData.filter(p=>p.cat===cat&&p.qty>0).forEach(p=>{
    const o=document.createElement('option'); o.value=p.id;
    o.textContent=`${p.modelo}${p.color?' ('+p.color+')':''} — T.${p.talle} [x${p.qty}]`;
    sel.appendChild(o);
  });
  document.getElementById('v-precio').value='';
  document.getElementById('v-costo').value='';
  document.getElementById('prod-preview').classList.remove('visible');
}
window.fillVentaPrecio=function(){
  const id=document.getElementById('v-prod').value;
  if(!id){document.getElementById('prod-preview').classList.remove('visible');return;}
  const p=stockData.find(x=>x.id===id); if(!p)return;
  const precioInput=document.getElementById('v-precio');
  const costoInput=document.getElementById('v-costo');
  // Según tipo de venta, autocompletar precio correspondiente
  if(tipoVenta==='mayorista'&&p.pmayorista&&!precioInput.value) precioInput.value=p.pmayorista;
  else if(tipoVenta!=='mayorista'&&p.pventa&&!precioInput.value) precioInput.value=p.pventa;
  if(p.pcosto&&!costoInput.value) costoInput.value=p.pcosto;
  showProdPreview(p);
}
function showProdPreview(p){
  const preview=document.getElementById('prod-preview');
  const data=document.getElementById('prod-preview-data');
  const margen=p.pventa&&p.pcosto?Math.round((p.pventa-p.pcosto)/p.pventa*100):null;
  data.innerHTML=`
    <div class="prod-preview-item"><span>Cat:</span> ${p.cat}</div>
    <div class="prod-preview-item"><span>Talle:</span> ${p.talle}</div>
    <div class="prod-preview-item"><span>Stock:</span> <strong style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">${p.qty} ud.</strong></div>
    ${p.pventa?`<div class="prod-preview-item"><span>P.Venta:</span> <strong>$${fmt(p.pventa)}</strong></div>`:''}
    ${p.pmayorista?`<div class="prod-preview-item"><span>P.Mayor:</span> <strong style="color:var(--blue)">$${fmt(p.pmayorista)}</strong></div>`:''}
    ${p.pcosto?`<div class="prod-preview-item"><span>Costo:</span> $${fmt(p.pcosto)}</div>`:''}
    ${margen!==null?`<div class="prod-preview-item"><span>Margen:</span> <strong style="color:${margen>30?'var(--success)':margen>10?'var(--warning)':'var(--danger)'}">${margen}%</strong></div>`:''}`;
  preview.classList.add('visible');
}
window.ventaSearchFilter=function(){
  const q=document.getElementById('vs-search').value.toLowerCase().trim();
  const results=document.getElementById('vs-results');
  if(!q){results.classList.remove('open');return;}
  const matches=stockData.filter(p=>p.qty>0).filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){results.innerHTML=`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;results.classList.add('open');return;}
  results.innerHTML=matches.map(p=>`<div class="vs-item" onmousedown="selectVentaProduct('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty}</span>${p.pventa?`<span style="color:var(--accent)">$${fmt(p.pventa)}</span>`:''}${p.pmayorista?`<span style="color:var(--blue)">May $${fmt(p.pmayorista)}</span>`:''}</div>
  </div>`).join('');
  results.classList.add('open');
}
window.selectVentaProduct=function(id){
  const p=stockData.find(x=>x.id===id); if(!p)return;
  document.getElementById('v-cat').value=p.cat; fillProductosByCat();
  document.getElementById('v-prod').value=p.id;
  if(tipoVenta==='mayorista'&&p.pmayorista) document.getElementById('v-precio').value=p.pmayorista;
  else if(p.pventa) document.getElementById('v-precio').value=p.pventa;
  if(p.pcosto) document.getElementById('v-costo').value=p.pcosto;
  showProdPreview(p);
  document.getElementById('vs-search').value='';
  document.getElementById('vs-results').classList.remove('open');
  document.getElementById('v-precio').focus();
}

window.registrarVenta=async function(){
  const id=document.getElementById('v-prod').value;
  const pventa=parseFloat(document.getElementById('v-precio').value);
  const pcosto=parseFloat(document.getElementById('v-costo').value)||null;
  const cant=parseInt(document.getElementById('v-cant').value)||1;
  if(!id){toast('Seleccioná un producto.','error');return;}
  if(!pventa||pventa<=0){toast('El precio debe ser mayor a 0.','error');return;}
  if(cant<=0){toast('La cantidad debe ser mayor a 0.','error');return;}
  // Bug #5 fix: costo >= precio es advertencia, no bloqueo (puede ser liquidación/mayorista con pérdida)
  if(pcosto&&pcosto>=pventa) toast('⚠️ El costo supera el precio de venta. Registrando igual.','error');
  const prod=stockData.find(p=>p.id===id);
  if(!prod){toast('Producto no encontrado.','error');return;}
  if(prod.qty<cant){toast(`Solo hay ${prod.qty} unidades.`,'error');return;}
  const btn=document.getElementById('btn-registrar-venta'); btn.disabled=true; btn.textContent='Registrando...';
  try{
    const batch=writeBatch(db);
    batch.update(doc(db,'stock',id),{qty:prod.qty-cant});
    if(pcosto&&!prod.pcosto) batch.update(doc(db,'stock',id),{pcosto});
    batch.set(doc(collection(db,'ventas')),{prodId:id,cat:prod.cat,modelo:prod.modelo,color:prod.color||'',talle:prod.talle,pventa,pcosto,cant,tipo:tipoVenta,fecha:Date.now()});
    await batch.commit();
    document.getElementById('v-cat').value='';
    document.getElementById('v-prod').innerHTML='<option value="">Primero elegí categoría</option>';
    document.getElementById('v-precio').value='';
    document.getElementById('v-costo').value='';
    document.getElementById('v-cant').value=1;
    document.getElementById('vs-search').value='';
    document.getElementById('prod-preview').classList.remove('visible');
    toast(`Venta ${tipoVenta} registrada ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='✓ Registrar venta';}
}

// ── CURVA ──
window.curvaSearchFilter=function(){
  const q=document.getElementById('curva-search').value.toLowerCase().trim();
  const results=document.getElementById('curva-results');
  if(!q){results.classList.remove('open');return;}
  const matches=stockData.filter(p=>p.qty>0).filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="addToCurva('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty}</span>${p.pventa?`<span style="color:var(--accent)">$${fmt(p.pventa)}</span>`:''}</div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.addToCurva=function(id){
  const p=stockData.find(x=>x.id===id); if(!p)return;
  const existing=curvaItems.find(x=>x.prodId===id);
  if(existing){toast('Ya está en la curva. Editá la cantidad.','error');return;}
  curvaItems.push({prodId:id,cant:1,pcosto:p.pcosto||null});
  document.getElementById('curva-search').value='';
  document.getElementById('curva-results').classList.remove('open');
  renderCurvaItems();
}
window.updateCurvaCant=function(idx,val){
  const n=parseInt(val)||1;
  const item=curvaItems[idx];
  const prod=stockData.find(x=>x.id===item.prodId);
  if(prod&&n>prod.qty){toast(`Máximo disponible: ${prod.qty}`,'error');curvaItems[idx].cant=prod.qty;}
  else curvaItems[idx].cant=Math.max(1,n);
  renderCurvaItems();
}
window.removeCurvaItem=function(idx){
  curvaItems.splice(idx,1); renderCurvaItems();
}
function renderCurvaItems(){
  const cont=document.getElementById('curva-items');
  const precioUnit=parseFloat(document.getElementById('curva-precio-unit').value)||0;
  const costoUnit=parseFloat(document.getElementById('curva-costo-unit').value)||0;
  if(!curvaItems.length){
    cont.innerHTML=`<div class="empty" style="padding:20px"><div class="empty-icon">👕</div><p>Buscá y agregá productos a la curva</p></div>`;
    document.getElementById('curva-total').textContent='$0 — 0 prendas'; return;
  }
  let totalCant=0,totalMonto=0,totalCosto=0;
  cont.innerHTML=curvaItems.map((item,idx)=>{
    const p=stockData.find(x=>x.id===item.prodId);
    if(!p)return'';
    totalCant+=item.cant; totalMonto+=item.cant*precioUnit; totalCosto+=item.cant*costoUnit;
    const gan=precioUnit&&costoUnit?(precioUnit-costoUnit)*item.cant:null;
    return`<div class="curva-item">
      <div class="curva-item-info"><div class="curva-item-title">${p.modelo}${p.color?' ('+p.color+')':''}</div><div class="curva-item-sub">${p.cat} · T.${p.talle} · Disp: ${p.qty}</div></div>
      <input type="number" value="${item.cant}" min="1" max="${p.qty}" style="width:60px;text-align:center" onchange="updateCurvaCant(${idx},this.value)">
      <div style="font-size:.82rem;text-align:right">
        ${precioUnit?`<div style="color:var(--accent)">$${fmt(item.cant*precioUnit)}</div>`:'<div style="color:var(--muted)">—</div>'}
        ${gan!==null?`<div style="color:${gan>=0?'var(--success)':'var(--danger)'};font-size:.72rem">gan: $${fmt(Math.round(gan))}</div>`:''}
      </div>
      <button class="btn-ghost btn" onclick="removeCurvaItem(${idx})" style="padding:4px 8px">✕</button>
    </div>`;
  }).join('');
  const ganTotal=precioUnit&&costoUnit?totalMonto-totalCosto:null;
  document.getElementById('curva-total').innerHTML=
    `$${fmt(Math.round(totalMonto))} — ${totalCant} prenda${totalCant!==1?'s':''}` +
    (ganTotal!==null?` <span style="font-size:.85rem;color:${ganTotal>=0?'var(--success)':'var(--danger)'}">· gan: $${fmt(Math.round(ganTotal))}</span>`:'');
}
window.registrarCurva=async function(){
  if(!curvaItems.length){toast('Agregá al menos un producto a la curva.','error');return;}
  const precioUnit=parseFloat(document.getElementById('curva-precio-unit').value);
  const costoUnit=parseFloat(document.getElementById('curva-costo-unit').value)||null;
  if(!precioUnit||precioUnit<=0){toast('Ingresá el precio mayorista por unidad.','error');return;}
  // Bug #7-style check: avisar si no hay costo
  if(!costoUnit) toast('⚠️ Sin costo unitario — la ganancia no se podrá calcular.','error');
  // Verificar stock suficiente
  for(const item of curvaItems){
    const p=stockData.find(x=>x.id===item.prodId);
    if(!p||p.qty<item.cant){toast(`Stock insuficiente: ${p?.modelo||'?'} T.${p?.talle}`,'error');return;}
  }
  const btn=document.getElementById('btn-registrar-curva'); btn.disabled=true; btn.textContent='Registrando...';
  // Bug #2 fix: guardar cantidad antes de vaciar el array
  const totalItems=curvaItems.length;
  const totalPrendas=curvaItems.reduce((a,i)=>a+i.cant,0);
  // Bug #6 fix: ID compartido para identificar la curva completa en el historial
  const curvaId=Date.now().toString();
  try{
    const batch=writeBatch(db);
    for(const item of curvaItems){
      const p=stockData.find(x=>x.id===item.prodId);
      batch.update(doc(db,'stock',item.prodId),{qty:p.qty-item.cant});
      // Bug #1 fix: usar costoUnit del formulario, no el pcosto del producto
      const pcostoFinal=costoUnit!==null?costoUnit:(item.pcosto||null);
      batch.set(doc(collection(db,'ventas')),{
        prodId:item.prodId,cat:p.cat,modelo:p.modelo,color:p.color||'',talle:p.talle,
        pventa:precioUnit,pcosto:pcostoFinal,cant:item.cant,tipo:'curva',
        curvaId,fecha:Date.now()
      });
    }
    await batch.commit();
    curvaItems=[];
    renderCurvaItems();
    document.getElementById('curva-precio-unit').value='';
    document.getElementById('curva-costo-unit').value='';
    // Bug #2 fix: usar variables guardadas antes del vaciado
    toast(`Curva registrada — ${totalItems} productos, ${totalPrendas} prendas ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='✓ Confirmar pedido curva';}
}

window.setDateFilter=function(f,btn){
  dateFilter=f;
  document.querySelectorAll('#tab-ventas .date-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderVentas();
}

window.renderVentas=function(){
  fillVentaCats();
  const now=new Date();
  const filtered=ventasData.filter(v=>{
    const d=new Date(v.fecha);
    if(dateFilter==='today') return d.toDateString()===now.toDateString();
    if(dateFilter==='week'){const s=new Date(now);s.setDate(now.getDate()-now.getDay());return d>=s;}
    if(dateFilter==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    return true;
  });
  // Bug #7 fix: incluir cuotas en el historial de ventas
  const filteredCuotas=cuotasData.filter(c=>{
    const d=new Date(c.createdAt);
    if(dateFilter==='today') return d.toDateString()===now.toDateString();
    if(dateFilter==='week'){const s=new Date(now);s.setDate(now.getDate()-now.getDay());return d>=s;}
    if(dateFilter==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    return true;
  });
  const totalMonto=filtered.reduce((a,v)=>a+v.pventa*v.cant,0)
    +filteredCuotas.reduce((a,c)=>a+c.totalVenta,0);
  const mayoristas=filtered.filter(v=>v.tipo==='mayorista'||v.tipo==='curva').length;
  // Bug #7 fix: mostrar ventas de hoy correctamente
  const hoy=new Date().toDateString();
  const ventasHoy=ventasData.filter(v=>new Date(v.fecha).toDateString()===hoy).length
    +cuotasData.filter(c=>new Date(c.createdAt).toDateString()===hoy).length;
  const totalItems=filtered.length+filteredCuotas.length;
  // Bug #3 fix: ticket promedio solo sobre ventas individuales — las cuotas inflan el monto
  const ticketBase=filtered.length?filtered.reduce((a,v)=>a+v.pventa*v.cant,0)/filtered.length:0;
  document.getElementById('vk-total').textContent=totalItems;
  document.getElementById('vk-monto').textContent='$'+fmt(Math.round(totalMonto));
  document.getElementById('vk-may').textContent=ventasHoy;
  document.getElementById('vk-ticket').textContent='$'+fmt(Math.round(ticketBase));
  const list=document.getElementById('ventas-list');
  if(!filtered.length&&!filteredCuotas.length){list.innerHTML=`<div class="empty"><div class="empty-icon">🛒</div><p>No hay ventas en este período</p></div>`;return;}
  const busq=(document.getElementById('ventas-search')?.value||'').toLowerCase().trim();
  const clearBtn=document.getElementById('ventas-search-clear');
  if(clearBtn) clearBtn.classList.toggle('visible',busq.length>0);
  // Bug #18 fix: filtrar por texto libre en historial
  const todas=[
    ...filtered.map(v=>({...v,_tipo:'venta'})),
    ...filteredCuotas.map(c=>({...c,_tipo:'cuota',fecha:c.createdAt}))
  ].sort((a,b)=>b.fecha-a.fecha)
  .filter(item=>{
    if(!busq)return true;
    if(item._tipo==='cuota') return [item.cat,item.modelo,item.color||'',item.talle,item.cliente||''].join(' ').toLowerCase().includes(busq);
    return [item.cat,item.modelo,item.color||'',item.talle].join(' ').toLowerCase().includes(busq);
  });
  const curvasVistas=new Set();
  list.innerHTML=todas.map(item=>{
    if(item._tipo==='cuota'){
      const c=item;
      const pagadas=c.cuotas.filter(q=>q.pagada).length;
      const d=new Date(c.createdAt);
      const ds=d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
      const montoCobrado=c.cuotas.filter(q=>q.pagada).reduce((a,q)=>a+q.monto,0);
      const ganProyectada=c.pcosto?c.totalVenta-c.pcosto:null;
      return`<div class="venta-card">
        <div class="venta-info">
          <div class="venta-title">${c.cat} — ${c.modelo}${c.color?' ('+c.color+')':''} <span class="badge b-cuota" style="margin-left:6px">💳 Cuotas</span></div>
          <div class="venta-sub">👤 ${c.cliente} · T.${c.talle} · ${pagadas}/${c.cuotas.length} cuotas cobradas</div>
          <div class="venta-date">${ds}</div>
        </div>
        <div class="venta-right">
          <div class="venta-precio">$${fmt(c.totalVenta)}</div>
          ${ganProyectada!==null?`<div class="venta-gan" style="color:var(--muted)">gan proyec: $${fmt(Math.round(ganProyectada))}</div>`:''}
          <div style="font-size:.7rem;color:${montoCobrado>0?'var(--success)':'var(--muted)'}">cobrado $${fmt(Math.round(montoCobrado))}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="showTab('cobros',null)" style="flex-shrink:0">ver →</button>
      </div>`;
    }
    const v=item;
    const gan=v.pcosto?(v.pventa-v.pcosto)*v.cant:null;
    const d=new Date(v.fecha);
    const ds=d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    const tipoBadge=v.tipo==='mayorista'?'<span class="badge b-may" style="margin-left:6px">💼 May</span>':v.tipo==='curva'?'<span class="badge b-cur" style="margin-left:6px">🔄 Curva</span>':v.tipo==='multiple'?'<span class="badge b-ok" style="margin-left:6px">📦 Lote</span>':'';
    let btnCurva='';
    if(v.tipo==='curva'&&v.curvaId&&!curvasVistas.has(v.curvaId)){
      curvasVistas.add(v.curvaId);
      btnCurva=`<button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger-dim);font-size:.7rem;margin-bottom:4px" onclick="delCurvaCompleta('${v.curvaId}')">🗑 Toda la curva</button>`;
    }
    return`<div class="venta-card">
      <div class="venta-info">
        <div class="venta-title">${v.cat} — ${v.modelo}${v.color?' ('+v.color+')':''}${tipoBadge}</div>
        <div class="venta-sub">T.${v.talle} · Cant: ${v.cant}${v.pcosto?' · Costo: $'+fmt(v.pcosto):''}</div>
        <div class="venta-date">${ds}</div>
      </div>
      <div class="venta-right">
        <div class="venta-precio">$${fmt(v.pventa*v.cant)}</div>
        ${gan!==null?`<div class="venta-gan" style="color:${gan>=0?'var(--success)':'var(--danger)'}">gan: $${fmt(Math.round(gan))}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
        ${btnCurva}
        <button class="btn btn-outline btn-sm" onclick="openEditVentaModal('${v.id}')" style="font-size:.7rem">✏️</button>
        <button class="btn-ghost btn" onclick="delVenta('${v.id}','${v.prodId||''}',${v.cant})">🗑</button>
      </div>
    </div>`;
  }).join('');
}

window.delVenta=async function(id,prodId,cant){
  const ok=await confirm2('¿Eliminar venta?',`Se repondrán ${cant} unidad${cant>1?'es':''} al stock.`); if(!ok)return;
  try{
    const batch=writeBatch(db);
    batch.delete(doc(db,'ventas',id));
    if(prodId){const s=await getDoc(doc(db,'stock',prodId));if(s.exists())batch.update(doc(db,'stock',prodId),{qty:increment(cant)});}
    await batch.commit(); toast('Venta eliminada y stock repuesto ✓','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

// Bug #6 fix: eliminar toda una curva de una vez y reponer stock de cada prenda
window.delCurvaCompleta=async function(curvaId){
  const itemsCurva=ventasData.filter(v=>v.curvaId===curvaId);
  if(!itemsCurva.length){toast('No se encontraron items de esta curva.','error');return;}
  const totalPrendas=itemsCurva.reduce((a,v)=>a+v.cant,0);
  const ok=await confirm2(
    '¿Eliminar curva completa?',
    `Se eliminarán ${itemsCurva.length} registros y se repondrán ${totalPrendas} prendas al stock.`
  ); if(!ok)return;
  try{
    const batch=writeBatch(db);
    for(const v of itemsCurva){
      batch.delete(doc(db,'ventas',v.id));
      if(v.prodId){const s=await getDoc(doc(db,'stock',v.prodId));if(s.exists())batch.update(doc(db,'stock',v.prodId),{qty:increment(v.cant)});}
    }
    await batch.commit(); toast(`Curva eliminada — ${totalPrendas} prendas repuestas ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── CUOTAS ──
window.cuotaSearchFilter=function(){
  const q=document.getElementById('cuo-search').value.toLowerCase().trim();
  const results=document.getElementById('cuo-results');
  if(!q){results.classList.remove('open');return;}
  const matches=stockData.filter(p=>p.qty>0).filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="selectCuotaProduct('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty}</span>${p.pventa?`<span style="color:var(--accent)">$${fmt(p.pventa)}</span>`:''}</div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.fillCuotaProductos=function(){
  const cat=document.getElementById('cuo-cat').value;
  const sel=document.getElementById('cuo-prod');
  sel.innerHTML='<option value="">Seleccionar producto...</option>';
  if(!cat)return;
  stockData.filter(p=>p.cat===cat&&p.qty>0).forEach(p=>{
    const o=document.createElement('option'); o.value=p.id;
    o.textContent=`${p.modelo}${p.color?' ('+p.color+')':''} — T.${p.talle} [x${p.qty}]`;
    sel.appendChild(o);
  });
  document.getElementById('cuo-total').value='';
  document.getElementById('cuo-preview').classList.remove('visible');
}
window.fillCuotaPrecios=function(){
  const id=document.getElementById('cuo-prod').value;
  if(!id){document.getElementById('cuo-preview').classList.remove('visible');return;}
  const p=stockData.find(x=>x.id===id); if(!p)return;
  if(p.pventa&&!document.getElementById('cuo-total').value) document.getElementById('cuo-total').value=p.pventa;
  if(p.pcosto&&!document.getElementById('cuo-costo').value) document.getElementById('cuo-costo').value=p.pcosto;
  // Show preview in cuotas panel
  const data=document.getElementById('cuo-preview-data');
  data.innerHTML=`
    <div class="prod-preview-item"><span>Cat:</span> ${p.cat}</div>
    <div class="prod-preview-item"><span>Talle:</span> ${p.talle}</div>
    <div class="prod-preview-item"><span>Stock:</span> <strong style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">${p.qty} ud.</strong></div>
    ${p.pventa?`<div class="prod-preview-item"><span>P.Venta:</span> <strong>$${fmt(p.pventa)}</strong></div>`:''}
    ${p.pcosto?`<div class="prod-preview-item"><span>Costo:</span> $${fmt(p.pcosto)}</div>`:''}`;
  document.getElementById('cuo-preview').classList.add('visible');
  calcCuotas();
}
window.selectCuotaProduct=function(id){
  const p=stockData.find(x=>x.id===id); if(!p)return;
  document.getElementById('cuo-cat').value=p.cat; fillCuotaProductos();
  document.getElementById('cuo-prod').value=p.id; fillCuotaPrecios();
  document.getElementById('cuo-search').value='';
  document.getElementById('cuo-results').classList.remove('open');
  document.getElementById('cuo-cliente').focus();
}
window.calcCuotas=function(){
  const total=parseFloat(document.getElementById('cuo-total').value)||0;
  const n=parseInt(document.getElementById('cuo-ncuotas').value)||3;
  const costo=parseFloat(document.getElementById('cuo-costo').value)||0;
  const calc=document.getElementById('cuo-calc');
  if(!total){calc.style.display='none';return;}
  // Bug #1 fix: última cuota absorbe el redondeo para que el total sea exacto
  const montoCuota=Math.ceil(total/n);
  const ultimaCuota=total-(montoCuota*(n-1));
  const ganProyectada=costo?total-costo:null;
  calc.style.display='block';
  // Mostrar total real (no n*montoCuota que puede estar inflado)
  const desglose=ultimaCuota!==montoCuota
    ? `${n-1} × $${fmt(montoCuota)} + 1 × $${fmt(Math.max(0,ultimaCuota))}`
    : `${n} × $${fmt(montoCuota)}`;
  calc.innerHTML=`💳 <strong>${desglose}</strong> = $${fmt(total)} total`+
    (ganProyectada!==null?` · Ganancia proyectada: <strong style="color:${ganProyectada>=0?'var(--success)':'var(--danger)'}">$${fmt(Math.round(ganProyectada))}</strong>`:'');
}
window.registrarCuota=async function(){
  const prodId=document.getElementById('cuo-prod').value;
  const cliente=document.getElementById('cuo-cliente').value.trim();
  const total=parseFloat(document.getElementById('cuo-total').value);
  const costo=parseFloat(document.getElementById('cuo-costo').value)||null;
  const n=parseInt(document.getElementById('cuo-ncuotas').value)||3;
  const fecha1Str=document.getElementById('cuo-fecha1').value;
  if(!prodId){toast('Seleccioná un producto.','error');return;}
  if(!cliente){toast('Ingresá el nombre del cliente.','error');return;}
  if(!total||total<=0){toast('El precio total debe ser mayor a 0.','error');return;}
  // Bug #6 fix: evitar cuota negativa si el monto es menor que la cantidad de cuotas
  if(total < n){toast(`El monto $${fmt(total)} es menor que ${n} cuotas. Reducí las cuotas o aumentá el monto.`,'error');return;}
  if(!fecha1Str){toast('Ingresá la fecha de la primera cuota.','error');return;}
  const prod=stockData.find(p=>p.id===prodId);
  if(!prod||prod.qty<1){toast('Sin stock disponible.','error');return;}
  const btn=document.getElementById('btn-registrar-cuota'); btn.disabled=true; btn.textContent='Registrando...';
  try{
    // Generar array de cuotas con vencimientos mensuales
    const montoCuota=Math.ceil(total/n);
    const cuotas=[];
    const fecha1=new Date(fecha1Str+'T12:00:00');
    for(let i=0;i<n;i++){
      const venc=new Date(fecha1);
      venc.setMonth(venc.getMonth()+i);
      cuotas.push({nro:i+1,monto:i<n-1?montoCuota:total-(montoCuota*(n-1)),vencimiento:venc.getTime(),pagada:false,fechaPago:null});
    }
    const batch=writeBatch(db);
    // Descontar stock
    batch.update(doc(db,'stock',prodId),{qty:prod.qty-1});
    if(costo&&!prod.pcosto) batch.update(doc(db,'stock',prodId),{pcosto:costo});
    // Crear plan de cuotas
    batch.set(doc(collection(db,'cuotas')),{
      prodId,cat:prod.cat,modelo:prod.modelo,color:prod.color||'',talle:prod.talle,
      cliente,totalVenta:total,pcosto:costo,cuotas,
      estado:'pendiente', // pendiente | parcial | cobrado
      createdAt:Date.now()
    });
    await batch.commit();
    // Limpiar form
    document.getElementById('cuo-cat').value='';
    document.getElementById('cuo-prod').innerHTML='<option value="">Primero elegí categoría</option>';
    document.getElementById('cuo-total').value='';
    document.getElementById('cuo-costo').value='';
    document.getElementById('cuo-search').value='';
    document.getElementById('cuo-cliente').value='';
    document.getElementById('cuo-preview').classList.remove('visible');
    document.getElementById('cuo-calc').style.display='none';
    toast(`Venta en ${n} cuotas registrada para ${cliente} ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='💳 Registrar venta en cuotas';}
}

// ── COBROS ──
window.setCobrosFilter=function(f,btn){
  cobrosFilter=f;
  document.querySelectorAll('#tab-cobros .date-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderCobros();
}
function renderCobrosKPI(){
  const now=Date.now();
  let pendiente=0,cobrado=0,vencido=0,activos=0;
  cuotasData.forEach(c=>{
    if(!Array.isArray(c.cuotas)) return;
    const cobradas=c.cuotas.filter(q=>q.pagada);
    const pendientes=c.cuotas.filter(q=>!q.pagada);
    cobrado+=cobradas.reduce((a,q)=>a+q.monto,0);
    pendiente+=pendientes.reduce((a,q)=>a+q.monto,0);
    vencido+=pendientes.filter(q=>q.vencimiento<now).reduce((a,q)=>a+q.monto,0);
    if(c.estado!=='cobrado') activos++;
  });
  document.getElementById('co-pendiente').textContent='$'+fmt(Math.round(pendiente));
  document.getElementById('co-cobrado').textContent='$'+fmt(Math.round(cobrado));
  document.getElementById('co-vencido').textContent='$'+fmt(Math.round(vencido));
  document.getElementById('co-activos').textContent=activos;
}
window.renderCobros=function(){
  const now=Date.now();
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const en7dias=new Date(hoy); en7dias.setDate(en7dias.getDate()+7);
  let filtered=cuotasData;
  if(cobrosFilter==='activos') filtered=cuotasData.filter(c=>c.estado!=='cobrado');
  else if(cobrosFilter==='vencidos') filtered=cuotasData.filter(c=>Array.isArray(c.cuotas)&&c.cuotas.some(q=>!q.pagada&&q.vencimiento<now));
  const list=document.getElementById('cobros-list');
  if(!filtered.length){list.innerHTML=`<div class="empty"><div class="empty-icon">💳</div><p>${cobrosFilter==='activos'?'No hay planes de cuotas activos':'No hay resultados'}</p></div>`;return;}
  list.innerHTML=filtered.map(c=>{
    if(!Array.isArray(c.cuotas)||!c.cuotas.length) return ''; // protección contra datos corruptos
    const pendientes=c.cuotas.filter(q=>!q.pagada);
    const tieneVencidas=pendientes.some(q=>q.vencimiento<now);
    const tieneProximas=pendientes.some(q=>q.vencimiento>=now&&q.vencimiento<en7dias.getTime());
    const cardClass=c.estado==='cobrado'?'cobrada':tieneVencidas?'vencida':tieneProximas?'proxima':'al-dia';
    const estadoBadge=c.estado==='cobrado'?'<span class="badge b-cobrado">✓ Cobrado</span>':
      tieneVencidas?'<span class="badge b-vencido">⚠ Vencido</span>':
      tieneProximas?'<span class="badge b-proximo">⏰ Próximo</span>':
      '<span class="badge b-cuota">💳 Al día</span>';
    const pagadas=c.cuotas.filter(q=>q.pagada).length;
    const totalCuotas=c.cuotas.length;
    const montoPagado=c.cuotas.filter(q=>q.pagada).reduce((a,q)=>a+q.monto,0);
    // Bug #15 fix: dots más grandes (44px) para tap preciso en mobile
    // Bug #20 fix: no poner datos sensibles en title (no funciona en mobile táctil)
    const dots=c.cuotas.map((q,idx)=>{
      const cls=q.pagada?'pagada':q.vencimiento<now?'vencida-dot':'pendiente';
      const label=q.pagada?'✓':q.vencimiento<now?'!':q.nro;
      const onclick=q.pagada?`desmarcarCuota('${c.id}',${idx})`:`marcarCuota('${c.id}',${idx})`;
      return`<div class="cuota-dot ${cls}" onclick="${onclick}">${label}</div>`;
    }).join('');
    // Bug #16 fix: mostrar próxima cuota pendiente de forma visible
    const proxima=c.cuotas.find(q=>!q.pagada);
    const proximaHTML=proxima&&c.estado!=='cobrado'
      ? `<div style="font-size:.75rem;color:var(--text2);margin-bottom:8px">📅 Próxima: <strong>$${fmt(proxima.monto)}</strong> · ${new Date(proxima.vencimiento).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>`
      : '';
    return`<div class="cuota-card ${cardClass}">
      <div class="cuota-head">
        <div>
          <div class="cuota-cliente">👤 ${c.cliente} ${estadoBadge}</div>
          <div class="cuota-prod">${c.cat} — ${c.modelo}${c.color?' ('+c.color+')':''} · T.${c.talle}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:var(--orange)">$${fmt(Math.round(c.totalVenta))}</div>
          <div style="font-size:.72rem;color:var(--muted)">${pagadas}/${totalCuotas} cuotas · $${fmt(Math.round(montoPagado))} cobrado</div>
        </div>
      </div>
      <div class="cuota-progress">${dots}</div>
      ${proximaHTML}
      <div class="cuota-footer">
        <div style="font-size:.75rem;color:var(--muted)">Tocá un círculo para marcar cuota cobrada</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" onclick="openCuotaModal('${c.id}')" style="font-size:.7rem">✏️ Editar</button>
          <button class="btn-ghost btn" onclick="delCuota('${c.id}','${c.prodId}',${c.estado!=='cobrado'})" style="font-size:.72rem">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
window.marcarCuota=async function(cuotaId,idx){
  const c=cuotasData.find(x=>x.id===cuotaId); if(!c)return;
  const nuevasCuotas=[...c.cuotas];
  nuevasCuotas[idx]={...nuevasCuotas[idx],pagada:true,fechaPago:Date.now()};
  const todasPagadas=nuevasCuotas.every(q=>q.pagada);
  const algunaPagada=nuevasCuotas.some(q=>q.pagada);
  const nuevoEstado=todasPagadas?'cobrado':algunaPagada?'parcial':'pendiente';
  try{
    await updateDoc(doc(db,'cuotas',cuotaId),{cuotas:nuevasCuotas,estado:nuevoEstado});
    if(todasPagadas) toast(`✓ Plan de ${c.cliente} cobrado completamente!`,'success');
    else toast(`Cuota ${idx+1} marcada como cobrada ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
}
window.desmarcarCuota=async function(cuotaId,idx){
  const c=cuotasData.find(x=>x.id===cuotaId); if(!c)return;
  const ok=await confirm2('¿Desmarcar cuota?','Se marcará como no cobrada.','Desmarcar','var(--warning)'); if(!ok)return;
  const nuevasCuotas=[...c.cuotas];
  nuevasCuotas[idx]={...nuevasCuotas[idx],pagada:false,fechaPago:null};
  const algunaPagada=nuevasCuotas.some(q=>q.pagada);
  try{
    await updateDoc(doc(db,'cuotas',cuotaId),{cuotas:nuevasCuotas,estado:algunaPagada?'parcial':'pendiente'});
    toast('Cuota desmarcada','success');
  }catch(e){toast('Error: '+e.message,'error');}
}
window.openCuotaModal=function(id){
  const c=cuotasData.find(x=>x.id===id); if(!c)return;
  document.getElementById('cm-id').value=id;
  document.getElementById('cm-cliente').value=c.cliente||'';
  document.getElementById('cm-total').value=c.totalVenta||'';
  document.getElementById('cm-costo').value=c.pcosto||'';
  document.getElementById('cuota-modal').classList.add('open');
}
window.closeCuotaModal=function(){
  document.getElementById('cuota-modal').classList.remove('open');
}
window.saveCuotaEdit=async function(){
  const id=document.getElementById('cm-id').value;
  const cliente=document.getElementById('cm-cliente').value.trim();
  const total=parseFloat(document.getElementById('cm-total').value)||null;
  const costo=parseFloat(document.getElementById('cm-costo').value)||null;
  if(!cliente){toast('Ingresá el nombre del cliente.','error');return;}
  const btn=document.getElementById('cm-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    const updates={cliente};
    if(total) updates.totalVenta=total;
    if(costo!==null) updates.pcosto=costo;
    await updateDoc(doc(db,'cuotas',id),updates);
    toast('Plan actualizado ✓','success');
    closeCuotaModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}
document.getElementById('cuota-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeCuotaModal();});

window.delCuota=async function(id,prodId,reponerStock){
  const msg=reponerStock?'Se repone 1 unidad al stock.':'El plan ya estaba cobrado, no se repone stock.';
  const ok=await confirm2('¿Eliminar plan de cuotas?',msg); if(!ok)return;
  try{
    const batch=writeBatch(db);
    batch.delete(doc(db,'cuotas',id));
    // Bug #2 fix: validar que prodId sea un string válido, no "undefined"
    if(reponerStock && prodId && prodId !== 'undefined' && prodId !== ''){
      const s=await getDoc(doc(db,'stock',prodId));
      if(s.exists()) batch.update(doc(db,'stock',prodId),{qty:increment(1)});
    }
    await batch.commit(); toast('Plan eliminado y stock repuesto ✓','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

// ── COMPRAS ──
window.compraSearchFilter=function(){
  const q=document.getElementById('cp-search').value.toLowerCase().trim();
  const results=document.getElementById('cp-results');
  if(!q){results.classList.remove('open');return;}
  // Bug #8 fix: separar con stock vs sin stock visualmente
  const matches=stockData.filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="addToCompra('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''} ${p.qty===0?'<span style="color:var(--danger);font-size:.7rem">(sin stock)</span>':''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty===0?'var(--danger)':'var(--text2)'}">Stock: ${p.qty}</span>${p.pcosto?`<span>Último costo: $${fmt(p.pcosto)}</span>`:''}</div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.addToCompra=function(id){
  const p=stockData.find(x=>x.id===id); if(!p)return;
  if(cpItems.find(x=>x.prodId===id)){toast('Ya está en el pedido.','error');return;}
  cpItems.push({prodId:id,cant:1,pcosto_unit:p.pcosto||0});
  document.getElementById('cp-search').value='';
  document.getElementById('cp-results').classList.remove('open');
  renderCpItems();
}
window.updateCpItem=function(idx,field,val){
  cpItems[idx][field]=parseFloat(val)||0;
  if(field==='cant') cpItems[idx].cant=Math.max(1,parseInt(val)||1);
  renderCpItems();
}
window.removeCpItem=function(idx){cpItems.splice(idx,1);renderCpItems();}
function renderCpItems(){
  const cont=document.getElementById('cp-items');
  if(!cpItems.length){cont.innerHTML=`<div class="empty" style="padding:16px"><div class="empty-icon">📦</div><p>Buscá productos del stock para agregarlos</p></div>`;document.getElementById('cp-total').textContent='$0 — 0 unidades';return;}
  let totalU=0,totalM=0;
  cont.innerHTML=cpItems.map((item,idx)=>{
    const p=stockData.find(x=>x.id===item.prodId); if(!p)return'';
    totalU+=item.cant; totalM+=item.cant*item.pcosto_unit;
    return`<div class="compra-prod-row">
      <div style="font-size:.82rem"><strong>${p.modelo}${p.color?' ('+p.color+')':''}</strong><div style="color:var(--muted);font-size:.72rem">${p.cat} · T.${p.talle}</div></div>
      <input type="number" value="${item.cant}" min="1" placeholder="Cant" onchange="updateCpItem(${idx},'cant',this.value)" style="text-align:center">
      <input type="number" value="${item.pcosto_unit||''}" min="0" placeholder="Costo $" onchange="updateCpItem(${idx},'pcosto_unit',this.value)">
      <div style="font-size:.8rem;color:var(--blue);text-align:right;min-width:60px">$${fmt(Math.round(item.cant*item.pcosto_unit))}</div>
      <button class="btn-ghost btn" onclick="removeCpItem(${idx})" style="padding:4px 8px">✕</button>
    </div>`;
  }).join('');
  document.getElementById('cp-total').textContent=`$${fmt(Math.round(totalM))} — ${totalU} unidad${totalU!==1?'es':''}`;
}

window.setCpStockMode=function(actualizar){
  cpActualizaStock=actualizar;
  document.getElementById('cp-stock-si').className='tipo-btn'+(actualizar?' active-blue':'');
  document.getElementById('cp-stock-no').className='tipo-btn'+(!actualizar?' active-blue':'');
  const aviso=document.getElementById('cp-stock-aviso');
  if(actualizar){
    aviso.style.color='var(--success)';
    aviso.textContent='Las unidades se sumarán automáticamente al stock';
  } else {
    aviso.style.color='var(--warning)';
    aviso.textContent='⚠️ Solo se guarda el historial y el costo. El stock NO se modifica.';
  }
}

window.guardarCompra=async function(){
  if(!cpItems.length){toast('Agregá al menos un producto.','error');return;}
  const sinCosto=cpItems.filter(i=>!i.pcosto_unit||i.pcosto_unit<=0);
  // Bug #9 fix: usar tipo '' (neutro) no 'error' para no confundir al usuario
  if(sinCosto.length>0) toast(`⚠️ ${sinCosto.length} producto${sinCosto.length>1?'s':''} sin precio de costo — se guardará igual.`,'');
  const proveedor=document.getElementById('cp-proveedor').value.trim();
  const fechaStr=document.getElementById('cp-fecha').value;
  const notas=document.getElementById('cp-notas').value.trim();
  if(!fechaStr){toast('Ingresá la fecha de la compra.','error');return;}
  const fecha=new Date(fechaStr+'T12:00:00').getTime();
  const totalMonto=cpItems.reduce((a,i)=>a+i.cant*i.pcosto_unit,0);
  const btn=document.getElementById('btn-guardar-compra'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    const batch=writeBatch(db);
    for(const item of cpItems){
      const updates={};
      if(cpActualizaStock) updates.qty=increment(item.cant);
      if(item.pcosto_unit>0){
        updates.pcosto=item.pcosto_unit;
        // F#4: guardar historial de precios de costo
        const prod=stockData.find(x=>x.id===item.prodId);
        const histEntry={precio:item.pcosto_unit,fecha:fecha};
        if(prod?.historialCosto) updates.historialCosto=[...prod.historialCosto,histEntry].slice(-12); // máx 12 entradas
        else updates.historialCosto=[histEntry];
      }
      if(Object.keys(updates).length>0)
        batch.update(doc(db,'stock',item.prodId),updates);
    }
    // Guardar el pedido completo
    batch.set(doc(collection(db,'compras')),{
      proveedor:proveedor||'Sin especificar', fecha, notas,
      actualizaStock:cpActualizaStock,
      items:cpItems.map(i=>{const p=stockData.find(x=>x.id===i.prodId);return{prodId:i.prodId,cat:p?.cat||'',modelo:p?.modelo||'',color:p?.color||'',talle:p?.talle||'',cant:i.cant,pcosto_unit:i.pcosto_unit};}),
      total:totalMonto, createdAt:Date.now()
    });
    await batch.commit();
    // Limpiar formulario
    cpItems=[];
    renderCpItems();
    document.getElementById('cp-proveedor').value='';
    document.getElementById('cp-notas').value='';
    document.getElementById('cp-fecha').value=new Date().toISOString().slice(0,10);
    toast(cpActualizaStock
      ? `Compra registrada — stock actualizado ✓`
      : `Compra registrada — historial y costos guardados (stock sin cambios) ✓`
    ,'success');
    await loadCompras();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='📥 Registrar compra';}
}

window.setCompraFilter=function(f,btn){
  compraFilter=f;
  document.querySelectorAll('#tab-compras .date-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderCompras();
}

function renderComprasKPI(){
  // Capital invertido = suma de todos los pedidos
  const totalInv=comprasData.reduce((a,c)=>a+(c.total||0),0);
  // Capital recuperado = ventas con pcosto conocido, usando el costo registrado
  const recuperado=ventasData.filter(v=>v.pcosto).reduce((a,v)=>a+v.pcosto*v.cant,0);
  // Stock inmovilizado = stock actual * ultimo pcosto conocido
  const inmovilizado=stockData.filter(p=>p.pcosto&&p.qty>0).reduce((a,p)=>a+p.pcosto*p.qty,0);
  document.getElementById('ck-total').textContent='$'+fmt(Math.round(totalInv));
  document.getElementById('ck-recuperado').textContent='$'+fmt(Math.round(recuperado));
  document.getElementById('ck-inmovilizado').textContent='$'+fmt(Math.round(inmovilizado));
  document.getElementById('ck-pedidos').textContent=comprasData.length;
}

window.renderCompras=function(){
  const now=new Date();
  const filtered=comprasData.filter(c=>{
    const d=new Date(c.fecha);
    if(compraFilter==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(compraFilter==='3m'){const s=new Date(now);s.setMonth(s.getMonth()-3);return d>=s;}
    return true;
  });
  const list=document.getElementById('compras-list');
  if(!filtered.length){list.innerHTML=`<div class="empty"><div class="empty-icon">📥</div><p>No hay compras en este período</p></div>`;return;}
  list.innerHTML=filtered.map(c=>{
    const d=new Date(c.fecha);
    const ds=d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const items=(c.items||[]).map(i=>`<div class="compra-item-row"><span>${i.cat} — ${i.modelo}${i.color?' ('+i.color+')':''} T.${i.talle}</span><span>x${i.cant} · $${fmt(i.pcosto_unit)} c/u</span></div>`).join('');
    return`<div class="compra-card">
      <div class="compra-head">
        <div><div class="compra-title">📥 ${c.proveedor}</div><div class="compra-sub">${ds}${c.notas?' · '+c.notas:''} · <span style="color:${c.actualizaStock===false?'var(--warning)':'var(--success)'}">stock ${c.actualizaStock===false?'sin cambios':'actualizado'}</span></div></div>
        <div style="text-align:right">
          <div class="compra-monto">$${fmt(Math.round(c.total||0))}</div>
          <button class="btn btn-outline btn-sm" onclick="openEditCompraModal('${c.id}')" style="font-size:.7rem;margin-right:4px">✏️</button>
          <button class="btn-ghost btn" onclick="delCompra('${c.id}')" style="font-size:.7rem;margin-top:4px">🗑 Eliminar</button>
        </div>
      </div>
      <div class="compra-items-list">${items}</div>
    </div>`;
  }).join('');
}

window.delCompra=async function(id){
  const ok=await confirm2('¿Eliminar compra?','El stock NO se revierte automáticamente.'); if(!ok)return;
  try{await deleteDoc(doc(db,'compras',id));toast('Compra eliminada');await loadCompras();}catch(e){toast('Error: '+e.message,'error');}
}

// ── GASTOS ──
// Bug #9 fix: subcategorías dinámicas según categoría de gasto
window.updateGaSubcats=function(){
  const cat=document.getElementById('ga-cat').value;
  const sub=document.getElementById('ga-sub');
  const optsNegocio=[
    ['publicidad','Publicidad / Ads'],['envios','Envíos / Logística'],
    ['packaging','Packaging'],['plataformas','Plataformas / Apps'],
    ['impuestos','Impuestos / Tasas'],['otros','Otros']
  ];
  const optsPersonal=[
    ['retiro','Retiro de ganancias'],['comida','Comida / Salidas'],
    ['transporte','Transporte'],['otros','Otros']
  ];
  const opts=cat==='negocio'?optsNegocio:optsPersonal;
  sub.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
}

window.guardarGasto=async function(){
  const desc=document.getElementById('ga-desc').value.trim();
  const monto=parseFloat(document.getElementById('ga-monto').value);
  const cat=document.getElementById('ga-cat').value;
  const sub=document.getElementById('ga-sub').value;
  const fechaStr=document.getElementById('ga-fecha').value;
  if(!desc){toast('Ingresá una descripción.','error');return;}
  if(!monto||monto<=0){toast('El monto debe ser mayor a 0.','error');return;}
  if(!fechaStr){toast('Ingresá la fecha.','error');return;}
  const fecha=new Date(fechaStr+'T12:00:00').getTime();
  const btn=document.getElementById('btn-guardar-gasto'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await addDoc(collection(db,'gastos'),{desc,monto,cat,sub,fecha,createdAt:Date.now()});
    document.getElementById('ga-desc').value='';
    document.getElementById('ga-monto').value='';
    document.getElementById('ga-fecha').value=new Date().toISOString().slice(0,10);
    toast('Gasto registrado ✓','success');
    await loadGastos();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='+ Registrar gasto';}
}

window.setGastoFilter=function(f,btn){
  gastoFilter=f;
  document.querySelectorAll('#tab-gastos .date-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderGastos();
}

function renderGastosKPI(){
  const now=new Date();
  const totalTodos=gastosData.reduce((a,g)=>a+g.monto,0);
  const totalNeg=gastosData.filter(g=>g.cat==='negocio').reduce((a,g)=>a+g.monto,0);
  const totalPer=gastosData.filter(g=>g.cat==='personal').reduce((a,g)=>a+g.monto,0);
  const totalMes=gastosData.filter(g=>{const d=new Date(g.fecha);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce((a,g)=>a+g.monto,0);
  document.getElementById('gk-total').textContent='$'+fmt(Math.round(totalTodos));
  document.getElementById('gk-neg').textContent='$'+fmt(Math.round(totalNeg));
  document.getElementById('gk-per').textContent='$'+fmt(Math.round(totalPer));
  document.getElementById('gk-mes').textContent='$'+fmt(Math.round(totalMes));
}

window.renderGastos=function(){
  const now=new Date();
  const filtered=gastosData.filter(g=>{
    const d=new Date(g.fecha);
    if(gastoFilter==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(gastoFilter==='3m'){const s=new Date(now);s.setMonth(s.getMonth()-3);return d>=s;}
    return true;
  });
  const list=document.getElementById('gastos-list');
  if(!filtered.length){list.innerHTML=`<div class="empty"><div class="empty-icon">💸</div><p>No hay gastos en este período</p></div>`;return;}
  const subLabels={publicidad:'Publicidad',envios:'Envíos',packaging:'Packaging',plataformas:'Plataformas',impuestos:'Impuestos',retiro:'Retiro',otros:'Otros'};
  const catIcons={negocio:'🏢',personal:'👤'};
  list.innerHTML=filtered.map(g=>{
    const d=new Date(g.fecha);
    const ds=d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
    return`<div class="gasto-card">
      <div class="gasto-cat-icon">${catIcons[g.cat]||'💸'}</div>
      <div class="gasto-info">
        <div class="gasto-desc">${g.desc}</div>
        <div class="gasto-meta"><span class="badge ${g.cat==='negocio'?'cat-neg':'cat-per'}" style="padding:2px 6px;font-size:.65rem">${g.cat==='negocio'?'Negocio':'Personal'}</span> · ${subLabels[g.sub]||g.sub} · ${ds}</div>
      </div>
      <div class="gasto-monto">$${fmt(g.monto)}</div>
      <button class="btn btn-outline btn-sm" onclick="openEditGastoModal('${g.id}')" style="font-size:.7rem">✏️</button>
      <button class="btn-ghost btn" onclick="delGasto('${g.id}')">🗑</button>
    </div>`;
  }).join('');
}

window.delGasto=async function(id){
  const ok=await confirm2('¿Eliminar gasto?','Esta acción no se puede deshacer.'); if(!ok)return;
  try{await deleteDoc(doc(db,'gastos',id));toast('Gasto eliminado');await loadGastos();}catch(e){toast('Error: '+e.message,'error');}
}

// ── GANANCIAS ──
// Bug #17: Flujo de caja mensual
function buildMesOptions(){
  const sel=document.getElementById('g-mes-sel'); if(!sel)return;
  const meses=new Set();
  [...ventasData,...cuotasData,...comprasData,...gastosData].forEach(item=>{
    const d=new Date(item.fecha||item.createdAt||0);
    meses.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  });
  const sorted=[...meses].sort().reverse();
  // Bug #5 fix: preservar la selección actual del usuario
  const prevVal=sel.value;
  sel.innerHTML=sorted.map(m=>{
    const [y,mo]=m.split('-');
    const nombre=new Date(parseInt(y),parseInt(mo)-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    return`<option value="${m}">${nombre}</option>`;
  }).join('');
  // Restaurar valor anterior si sigue siendo válido, si no usar el más reciente
  if(prevVal&&sorted.includes(prevVal)) sel.value=prevVal;
  else if(sorted[0]) sel.value=sorted[0];
}
window.renderFlujoCaja=function(){
  const sel=document.getElementById('g-mes-sel');
  if(!sel||!sel.value){return;}
  const [y,mo]=sel.value.split('-').map(Number);
  const desde=new Date(y,mo-1,1).getTime();
  const hasta=new Date(y,mo,1).getTime();
  const enPeriodo=ts=>ts>=desde&&ts<hasta;
  const ingVentas=ventasData.filter(v=>enPeriodo(v.fecha)).reduce((a,v)=>a+v.pventa*v.cant,0);
  // Bug #1 fix: usar fechaPago de cada cuota individual, no createdAt del plan completo
  const ingCuotas=cuotasData.flatMap(c=>Array.isArray(c.cuotas)?c.cuotas:[])
    .filter(q=>q.pagada&&enPeriodo(q.fechaPago))
    .reduce((a,q)=>a+q.monto,0);
  const egrCompras=comprasData.filter(c=>enPeriodo(c.fecha)).reduce((a,c)=>a+(c.total||0),0);
  const egrGastos=gastosData.filter(g=>enPeriodo(g.fecha)).reduce((a,g)=>a+g.monto,0);
  const totalIng=ingVentas+ingCuotas;
  const totalEgr=egrCompras+egrGastos;
  const saldo=totalIng-totalEgr;
  const body=document.getElementById('flujo-caja-body');
  body.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <div style="background:var(--success-dim);border-radius:var(--radius);padding:16px">
        <div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Ingresos</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:var(--success)">$${fmt(Math.round(totalIng))}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:6px">
          Ventas: $${fmt(Math.round(ingVentas))} · Cuotas: $${fmt(Math.round(ingCuotas))}
        </div>
      </div>
      <div style="background:var(--danger-dim);border-radius:var(--radius);padding:16px">
        <div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Egresos</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:var(--danger)">$${fmt(Math.round(totalEgr))}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:6px">
          Compras: $${fmt(Math.round(egrCompras))} · Gastos: $${fmt(Math.round(egrGastos))}
        </div>
      </div>
    </div>
    <div style="background:var(--surface2);border-radius:var(--radius);padding:16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Saldo neto del mes</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:${saldo>=0?'var(--success)':'var(--danger)'}">
        ${saldo>=0?'+':''}$${fmt(Math.round(saldo))}
      </div>
    </div>`;
}
window.renderGanancias=function(){
  // Bug #11 fix: agrupar por producto (sin tipo) para no duplicar filas
  // El tipo se muestra como desglose dentro de cada fila
  const grupos={};
  let totalIng=0,totalCos=0,margenSum=0,margenCount=0;
  ventasData.forEach(v=>{
    totalIng+=v.pventa*v.cant;
    if(v.pcosto){totalCos+=v.pcosto*v.cant;margenSum+=(v.pventa-v.pcosto)/v.pventa*100;margenCount++;}
    const k=`${v.cat}||${v.modelo}||${v.color||''}||${v.talle}`;
    if(!grupos[k])grupos[k]={cat:v.cat,modelo:v.modelo,color:v.color||'',talle:v.talle,unid:0,ing:0,cos:0,tipos:{}};
    grupos[k].unid+=v.cant; grupos[k].ing+=v.pventa*v.cant;
    if(v.pcosto)grupos[k].cos+=v.pcosto*v.cant;
    const t=v.tipo||'minorista';
    if(!grupos[k].tipos[t])grupos[k].tipos[t]={unid:0,ing:0};
    grupos[k].tipos[t].unid+=v.cant; grupos[k].tipos[t].ing+=v.pventa*v.cant;
  });
  // Incluir cuotas cobradas en ingresos — Bug #3 fix: prorratear el costo según lo cobrado
  cuotasData.forEach(c=>{
    const ingCobrado=c.cuotas.filter(q=>q.pagada).reduce((a,q)=>a+q.monto,0);
    if(!ingCobrado)return;
    // Prorratear el costo según la proporción cobrada del total
    const proporcion = c.totalVenta > 0 ? ingCobrado / c.totalVenta : 0;
    const costoProporcionado = c.pcosto ? c.pcosto * proporcion : 0;
    if(costoProporcionado>0){
      totalCos+=costoProporcionado;
      // Solo contar margen si el plan está cobrado completamente (para evitar distorsión)
      if(c.estado==='cobrado'&&c.pcosto){margenSum+=(c.totalVenta-c.pcosto)/c.totalVenta*100;margenCount++;}
    }
    totalIng+=ingCobrado;
    const k=`${c.cat}||${c.modelo}||${c.color||''}||${c.talle}`;
    if(!grupos[k])grupos[k]={cat:c.cat,modelo:c.modelo,color:c.color||'',talle:c.talle,unid:0,ing:0,cos:0,tipos:{}};
    grupos[k].unid+=1; grupos[k].ing+=ingCobrado;
    if(costoProporcionado>0)grupos[k].cos+=costoProporcionado;
    if(!grupos[k].tipos['cuotas'])grupos[k].tipos['cuotas']={unid:0,ing:0};
    grupos[k].tipos['cuotas'].unid+=1; grupos[k].tipos['cuotas'].ing+=ingCobrado;
  });
  const totalGasNeg=gastosData.filter(g=>g.cat==='negocio').reduce((a,g)=>a+g.monto,0);
  const ganNeta=(totalIng-totalCos)-totalGasNeg;
  const margen=margenCount?margenSum/margenCount:0;
  document.getElementById('g-ing').textContent='$'+fmt(Math.round(totalIng));
  document.getElementById('g-cos').textContent='$'+fmt(Math.round(totalCos));
  document.getElementById('g-gas').textContent='$'+fmt(Math.round(totalGasNeg));
  document.getElementById('g-gan').textContent='$'+fmt(Math.round(ganNeta));
  document.getElementById('g-mar').textContent=Math.round(margen)+'%';
  const rows=Object.values(grupos).sort((a,b)=>b.ing-a.ing);
  const maxIng=rows[0]?.ing||1;
  const tbody=document.getElementById('gan-tbody');
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="7"><div class="empty"><div class="empty-icon">📊</div><p>Registrá ventas para ver ganancias</p></div></td></tr>`;return;}
  tbody.innerHTML=rows.map(r=>{
    const gan=r.ing-r.cos;
    const m=r.cos?Math.round((r.ing-r.cos)/r.ing*100):null;
    const pct=r.ing/maxIng*100;
    const mc=m>30?'var(--success)':m>10?'var(--warning)':'var(--danger)';
    // Desglose de tipos si hay más de uno
    const tiposKeys=Object.keys(r.tipos);
    const tiposHTML=tiposKeys.length>1?tiposKeys.map(t=>{
      const badge=t==='mayorista'?'b-may':t==='curva'?'b-cur':t==='cuotas'?'b-cuota':'b-ok';
      return`<span class="badge ${badge}" style="font-size:.6rem">${t}: ${r.tipos[t].unid}u</span>`;
    }).join(' '):(tiposKeys[0]==='mayorista'?'<span class="badge b-may" style="font-size:.6rem">Mayorista</span>':tiposKeys[0]==='curva'?'<span class="badge b-cur" style="font-size:.6rem">Curva</span>':tiposKeys[0]==='cuotas'?'<span class="badge b-cuota" style="font-size:.6rem">Cuotas</span>':'<span class="badge b-ok" style="font-size:.6rem">Minorista</span>');
    return`<tr>
      <td><strong style="font-size:.85rem">${r.cat}</strong><span style="color:var(--muted)"> — ${r.modelo}${r.color?' ('+r.color+')':''} T.${r.talle}</span><div class="g-bar"><div class="g-bar-fill" style="width:${pct}%"></div></div></td>
      <td>${tiposHTML}</td>
      <td>${r.unid}</td>
      <td>$${fmt(Math.round(r.ing))}</td>
      <td>${r.cos?'$'+fmt(Math.round(r.cos)):'<span style="color:var(--muted)">—</span>'}</td>
      <td style="color:${gan>=0?'var(--success)':'var(--danger)'}">$${fmt(Math.round(gan))}</td>
      <td>${m!==null?`<strong style="color:${mc}">${m}%</strong>`:'<span style="color:var(--muted)">—</span>'}</td>
    </tr>`;
  }).join('');
}

// ── CSV ──
window.exportCSV=function(){
  const rows=[['Categoría','Modelo','Color','Talle','Tipo','Unidades','Ingresos','Costos','Ganancia','Margen%']];
  const grupos={};
  // Ventas normales
  ventasData.forEach(v=>{
    const k=`${v.cat}||${v.modelo}||${v.color||''}||${v.talle}||${v.tipo||'minorista'}`;
    if(!grupos[k])grupos[k]={cat:v.cat,modelo:v.modelo,color:v.color||'',talle:v.talle,tipo:v.tipo||'minorista',unid:0,ing:0,cos:0};
    grupos[k].unid+=v.cant; grupos[k].ing+=v.pventa*v.cant;
    if(v.pcosto)grupos[k].cos+=v.pcosto*v.cant;
  });
  // Bug #2 fix: incluir cuotas en el CSV
  cuotasData.forEach(c=>{
    const ingCobrado=Array.isArray(c.cuotas)?c.cuotas.filter(q=>q.pagada).reduce((a,q)=>a+q.monto,0):0;
    const k=`${c.cat}||${c.modelo}||${c.color||''}||${c.talle}||cuotas`;
    if(!grupos[k])grupos[k]={cat:c.cat,modelo:c.modelo,color:c.color||'',talle:c.talle,tipo:'cuotas',unid:0,ing:0,cos:0};
    grupos[k].unid+=1; grupos[k].ing+=ingCobrado;
    if(c.pcosto)grupos[k].cos+=c.pcosto;
  });
  Object.values(grupos).sort((a,b)=>b.ing-a.ing).forEach(r=>{
    const gan=r.ing-r.cos; const m=r.cos?Math.round((r.ing-r.cos)/r.ing*100):'';
    rows.push([r.cat,r.modelo,r.color,r.talle,r.tipo,r.unid,Math.round(r.ing),Math.round(r.cos),Math.round(gan),m]);
  });
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`stockmgr-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url); toast('CSV exportado ✓','success');
}

// F#1: Dashboard diario — se actualiza cada vez que cambian ventas o stock
function renderDashboard(){
  const now=new Date();
  const hoy=now.toDateString();
  const ventasHoy=ventasData.filter(v=>new Date(v.fecha).toDateString()===hoy);
  const cuotasHoy=cuotasData.filter(c=>new Date(c.createdAt).toDateString()===hoy);
  const ingHoy=ventasHoy.reduce((a,v)=>a+v.pventa*v.cant,0)+cuotasHoy.reduce((a,c)=>a+c.totalVenta,0);
  const ganHoy=ventasHoy.filter(v=>v.pcosto).reduce((a,v)=>a+(v.pventa-v.pcosto)*v.cant,0);
  // Cuotas que vencen hoy o mañana
  const manana=new Date(now); manana.setDate(manana.getDate()+1);
  const vencenProx=cuotasData.filter(c=>Array.isArray(c.cuotas)&&c.cuotas.some(q=>!q.pagada&&(new Date(q.vencimiento).toDateString()===hoy||new Date(q.vencimiento).toDateString()===manana.toDateString()))).length;
  const vencidas=cuotasData.filter(c=>Array.isArray(c.cuotas)&&c.cuotas.some(q=>!q.pagada&&q.vencimiento<now.getTime())).length;
  const grid=document.getElementById('dashboard-grid');
  const dash=document.getElementById('dashboard-diario');
  if(!ventasHoy.length&&!cuotasHoy.length&&!vencidas&&!vencenProx){ dash.style.display='none'; return; }
  dash.style.display='block';
  grid.innerHTML=`
    ${ventasHoy.length||cuotasHoy.length?`<div style="background:var(--success-dim);border-radius:8px;padding:12px"><div style="font-size:1.3rem;font-family:'Cormorant Garamond',serif;color:var(--success)">$${fmt(Math.round(ingHoy))}</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">${ventasHoy.length+cuotasHoy.length} venta${ventasHoy.length+cuotasHoy.length!==1?'s':''} hoy</div></div>`:''}
    ${ganHoy?`<div style="background:var(--accent-dim);border-radius:8px;padding:12px"><div style="font-size:1.3rem;font-family:'Cormorant Garamond',serif;color:var(--accent)">$${fmt(Math.round(ganHoy))}</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">Ganancia hoy</div></div>`:''}
    ${vencidas?`<div style="background:var(--danger-dim);border-radius:8px;padding:12px;cursor:pointer" onclick="showTab('cobros',null)"><div style="font-size:1.3rem;font-family:'Cormorant Garamond',serif;color:var(--danger)">${vencidas}</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">Cuota${vencidas!==1?'s':''} vencida${vencidas!==1?'s':''} ⚠️</div></div>`:''}
    ${vencenProx&&!vencidas?`<div style="background:var(--warning-dim);border-radius:8px;padding:12px;cursor:pointer" onclick="showTab('cobros',null)"><div style="font-size:1.3rem;font-family:'Cormorant Garamond',serif;color:var(--warning)">${vencenProx}</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">Cuota${vencenProx!==1?'s':''} próxima${vencenProx!==1?'s':''}</div></div>`:''}
  `;
  // UX#2: actualizar badge en tab Cobros
  updateCobrosTabBadge();
}
function updateCobrosTabBadge(){
  const vencidas=cuotasData.filter(c=>Array.isArray(c.cuotas)&&c.cuotas.some(q=>!q.pagada&&q.vencimiento<Date.now())).length;
  const tabs=document.querySelectorAll('.tab');
  tabs.forEach(t=>{
    if(t.textContent.includes('Cobros')||t.getAttribute('onclick')?.includes('cobros')){
      t.innerHTML=vencidas?`💳 Cobros <span style="background:var(--danger);color:#fff;border-radius:10px;padding:1px 6px;font-size:.65rem;margin-left:2px">${vencidas}</span>`:'💳 Cobros';
    }
  });
}

// UX#3: limpiar búsqueda historial ventas
window.clearVentasSearch=function(){
  const inp=document.getElementById('ventas-search');
  if(inp){ inp.value=''; }
  const cl=document.getElementById('ventas-search-clear');
  if(cl) cl.classList.remove('visible');
  renderVentas();
}

// F#5: Modo toma de inventario
let inventarioMode=false;
let inventarioCounts={};
window.toggleInventarioMode=function(){
  inventarioMode=!inventarioMode;
  inventarioCounts={};
  const btn=document.getElementById('btn-inventario');
  if(inventarioMode){
    btn.textContent='✓ Confirmar conteo';
    btn.style.background='var(--success)';
    btn.style.color='#fff';
    toast('Modo inventario activado — ingresá la cantidad real de cada producto','');
  } else {
    btn.textContent='📋 Toma de inventario';
    btn.style.background='';
    btn.style.color='';
  }
  renderStock();
}
window.setInventarioCant=function(id,val){
  inventarioCounts[id]=parseInt(val)||0;
}
window.confirmarInventario=async function(){
  const diffs=Object.entries(inventarioCounts).filter(([id,cant])=>{
    const p=stockData.find(x=>x.id===id);
    return p&&p.qty!==cant;
  });
  if(!diffs.length){ toast('Sin diferencias — el conteo coincide con el sistema ✓','success'); toggleInventarioMode(); return; }
  const ok=await confirm2(`Aplicar ${diffs.length} correcciones`,`Se ajustarán ${diffs.length} producto${diffs.length!==1?'s':''} según el conteo físico.`,'Aplicar','var(--success)');
  if(!ok) return;
  try{
    const batch=writeBatch(db);
    diffs.forEach(([id,cant])=>batch.update(doc(db,'stock',id),{qty:cant}));
    await batch.commit();
    toast(`${diffs.length} producto${diffs.length!==1?'s':''} ajustado${diffs.length!==1?'s':''}  ✓`,'success');
    inventarioMode=false; inventarioCounts={};
    document.getElementById('btn-inventario').textContent='📋 Toma de inventario';
    document.getElementById('btn-inventario').style.background='';
  }catch(e){ toast('Error: '+e.message,'error'); }
}

// Bug #19: Alerta proactiva de stock bajo
let stockBajoAlertado = false;
function checkStockBajo(){
  if(stockBajoAlertado) return; // solo una vez por sesión
  const sinStock=stockData.filter(p=>p.qty===0).length;
  const ultimaUnidad=stockData.filter(p=>p.qty===1).length;
  if(sinStock>0||ultimaUnidad>0){
    stockBajoAlertado=true;
    const msgs=[];
    if(sinStock>0) msgs.push(`${sinStock} producto${sinStock>1?'s':''} sin stock`);
    if(ultimaUnidad>0) msgs.push(`${ultimaUnidad} con última unidad`);
    toast(`⚠️ Stock bajo: ${msgs.join(' · ')}. Revisá la tab Stock.`,'error');
  }
}

// ══════════════════════════════════════════
// RESERVAS
// ══════════════════════════════════════════
function renderReservasKPI(){
  const now=Date.now();
  const hoy=new Date().toDateString();
  const activas=reservasData.filter(r=>r.estado!=='cancelada');
  const vencidas=activas.filter(r=>r.vencimiento<now).length;
  const hoyCount=activas.filter(r=>new Date(r.vencimiento).toDateString()===hoy).length;
  const unidades=activas.reduce((a,r)=>a+(r.cant||1),0);
  document.getElementById('rk-activas').textContent=activas.length;
  document.getElementById('rk-vencidas').textContent=vencidas;
  document.getElementById('rk-hoy').textContent=hoyCount;
  document.getElementById('rk-unidades').textContent=unidades;
}
window.renderReservas=function(){
  const now=Date.now();
  const list=document.getElementById('reservas-list');
  const activas=reservasData.filter(r=>r.estado!=='cancelada')
    .sort((a,b)=>a.vencimiento-b.vencimiento);
  if(!activas.length){
    list.innerHTML=`<div class="empty"><div class="empty-icon">🔖</div><p>No hay reservas activas. Tocá "+ Nueva reserva" para crear una.</p></div>`;
    return;
  }
  const hoy=new Date().toDateString();
  const en3dias=Date.now()+3*24*60*60*1000;
  list.innerHTML=activas.map(r=>{
    const venc=new Date(r.vencimiento);
    const vencStr=venc.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isVencida=r.vencimiento<now;
    const isHoy=venc.toDateString()===hoy;
    const isProxima=!isVencida&&r.vencimiento<=en3dias;
    const cardClass=isVencida?'vencida':isHoy||isProxima?'proxima':'';
    const estadoBadge=isVencida
      ?'<span class="badge b-vencido">⚠ Vencida</span>'
      :isHoy?'<span class="badge b-proximo">⏰ Vence hoy</span>'
      :isProxima?'<span class="badge b-proximo">⏰ Próxima</span>'
      :'<span class="badge b-reservado">🔖 Activa</span>';
    return`<div class="reserva-card ${cardClass}">
      <div class="reserva-info">
        <div class="reserva-cliente">👤 ${r.cliente} ${estadoBadge}</div>
        <div class="reserva-prod">${r.cat} — ${r.modelo}${r.color?' ('+r.color+')':''} · T.${r.talle} · ${r.cant} unidad${r.cant!==1?'es':''}</div>
        <div class="reserva-fecha" style="color:${isVencida?'var(--danger)':isProxima?'var(--warning)':'var(--muted)'}">
          Vence: ${vencStr}${r.sena?` · Seña: $${fmt(r.sena)}`:''}${r.notas?' · '+r.notas:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <button class="btn btn-gold btn-sm" onclick="confirmarVentaReserva('${r.id}')" style="font-size:.72rem;white-space:nowrap">✓ Vender</button>
        <button class="btn btn-outline btn-sm" onclick="openReservaModal('${r.id}')" style="font-size:.72rem">✏️</button>
        <button class="btn-ghost btn" onclick="cancelarReserva('${r.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}
function updateReservasTabBadge(){
  const now=Date.now();
  const vencidas=reservasData.filter(r=>r.estado!=='cancelada'&&r.vencimiento<now).length;
  const proximas=reservasData.filter(r=>r.estado!=='cancelada'&&r.vencimiento>=now&&r.vencimiento<=now+3*24*60*60*1000).length;
  const count=vencidas+proximas;
  document.querySelectorAll('.tab').forEach(t=>{
    if(t.getAttribute('onclick')?.includes('reservas')){
      t.innerHTML=count
        ?`🔖 Reservas <span style="background:${vencidas?'var(--danger)':'var(--warning)'};color:#fff;border-radius:10px;padding:1px 6px;font-size:.65rem;margin-left:2px">${count}</span>`
        :'🔖 Reservas';
    }
  });
}
window.openReservaModal=function(id){
  const r=id?reservasData.find(x=>x.id===id):null;
  document.getElementById('reserva-modal-title').textContent=r?'✏️ Editar reserva':'🔖 Nueva reserva';
  document.getElementById('rm-id').value=id||'';
  document.getElementById('rm-prod-id').value=r?.prodId||'';
  document.getElementById('rm-cliente').value=r?.cliente||'';
  document.getElementById('rm-cant').value=r?.cant||1;
  document.getElementById('rm-sena').value=r?.sena||'';
  document.getElementById('rm-notas').value=r?.notas||'';
  document.getElementById('rm-del-btn').style.display=r?'inline-flex':'none';
  // Set vencimiento default: 7 días desde hoy
  const def=r?new Date(r.vencimiento):new Date(Date.now()+7*24*60*60*1000);
  document.getElementById('rm-vencimiento').value=def.toISOString().slice(0,10);
  // Si es edición, mostrar el producto
  const preview=document.getElementById('rm-preview');
  if(r){
    document.getElementById('rm-preview-data').innerHTML=`
      <div class="prod-preview-item"><span>Producto:</span> ${r.cat} — ${r.modelo}${r.color?' ('+r.color+')':''} T.${r.talle}</div>`;
    preview.classList.add('visible');
  } else {
    preview.classList.remove('visible');
    document.getElementById('rm-search').value='';
  }
  document.getElementById('reserva-modal').classList.add('open');
}
window.closeReservaModal=function(){
  document.getElementById('reserva-modal').classList.remove('open');
  document.getElementById('rm-results').classList.remove('open');
}
window.reservaSearchFilter=function(){
  const q=document.getElementById('rm-search').value.toLowerCase().trim();
  const results=document.getElementById('rm-results');
  if(!q){results.classList.remove('open');return;}
  const matches=stockData.filter(p=>p.qty>0)
    .filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q))
    .slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="selectReservaProd('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty} disp.</span></div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.selectReservaProd=function(id){
  const p=stockData.find(x=>x.id===id); if(!p)return;
  document.getElementById('rm-prod-id').value=id;
  document.getElementById('rm-search').value='';
  document.getElementById('rm-results').classList.remove('open');
  document.getElementById('rm-preview-data').innerHTML=`
    <div class="prod-preview-item"><span>Categoría:</span> ${p.cat}</div>
    <div class="prod-preview-item"><span>Talle:</span> ${p.talle}</div>
    <div class="prod-preview-item"><span>Stock disponible:</span> <strong style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">${p.qty} ud.</strong></div>
    ${p.pventa?`<div class="prod-preview-item"><span>Precio:</span> $${fmt(p.pventa)}</div>`:''}`;
  document.getElementById('rm-preview').classList.add('visible');
  document.getElementById('rm-cant').max=p.qty;
}
window.saveReserva=async function(){
  const id=document.getElementById('rm-id').value;
  const prodId=document.getElementById('rm-prod-id').value;
  const cliente=document.getElementById('rm-cliente').value.trim();
  const cant=parseInt(document.getElementById('rm-cant').value)||1;
  const vencStr=document.getElementById('rm-vencimiento').value;
  const sena=parseFloat(document.getElementById('rm-sena').value)||null;
  const notas=document.getElementById('rm-notas').value.trim();
  if(!prodId){toast('Seleccioná un producto.','error');return;}
  if(!cliente){toast('Ingresá el nombre del cliente.','error');return;}
  if(!vencStr){toast('Ingresá la fecha de vencimiento.','error');return;}
  const prod=stockData.find(p=>p.id===prodId);
  if(!prod){toast('Producto no encontrado.','error');return;}
  if(cant>prod.qty){toast(`Solo hay ${prod.qty} unidades disponibles.`,'error');return;}
  const btn=document.getElementById('rm-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    const data={
      prodId,cat:prod.cat,modelo:prod.modelo,color:prod.color||'',talle:prod.talle,
      cliente,cant,sena,notas,
      vencimiento:new Date(vencStr+'T23:59:59').getTime(),
      estado:'activa',createdAt:id?undefined:Date.now()
    };
    if(id) await updateDoc(doc(db,'reservas',id),data);
    else await addDoc(collection(db,'reservas'),{...data,createdAt:Date.now()});
    toast(id?'Reserva actualizada ✓':'Reserva creada ✓','success');
    closeReservaModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar reserva';}
}
window.delReservaFromModal=async function(){
  const id=document.getElementById('rm-id').value; if(!id)return;
  const ok=await confirm2('¿Eliminar reserva?','El stock no se modifica.'); if(!ok)return;
  try{
    await deleteDoc(doc(db,'reservas',id));
    toast('Reserva eliminada');
    closeReservaModal();
  }catch(e){toast('Error: '+e.message,'error');}
}
window.cancelarReserva=async function(id){
  const ok=await confirm2('¿Cancelar reserva?','Se liberarán las unidades reservadas.'); if(!ok)return;
  try{ await deleteDoc(doc(db,'reservas',id)); toast('Reserva cancelada'); }
  catch(e){ toast('Error: '+e.message,'error'); }
}
// Confirmar venta desde reserva: abre tab ventas con el producto pre-seleccionado
window.confirmarVentaReserva=async function(id){
  const r=reservasData.find(x=>x.id===id); if(!r)return;
  // Eliminar la reserva y llevar al usuario a registrar la venta
  await deleteDoc(doc(db,'reservas',id));
  showTab('ventas', document.querySelector('[onclick*="ventas"]'));
  setTipoVenta('minorista');
  // Pre-seleccionar el producto
  setTimeout(()=>{
    const catSel=document.getElementById('v-cat');
    if(catSel){ catSel.value=r.cat; fillProductosByCat(); }
    setTimeout(()=>{
      const prodSel=document.getElementById('v-prod');
      if(prodSel){ prodSel.value=r.prodId; fillVentaPrecio(); }
      document.getElementById('v-cant').value=r.cant;
    },100);
  },200);
  toast(`Reserva de ${r.cliente} liberada — completá la venta ✓`,'success');
}

// ══════════════════════════════════════════
// ══════════════════════════════════════════
let tallesSeleccionados = {}; // {talle: qty}

window.openCargaMasivaModal=function(){
  // Limpiar estado
  tallesSeleccionados={};
  document.getElementById('cm2-cat').value='';
  document.getElementById('cm2-modelo').value='';
  document.getElementById('cm2-color').value='';
  document.getElementById('cm2-pventa').value='';
  document.getElementById('cm2-pmayorista').value='';
  document.getElementById('cm2-pcosto').value='';
  document.querySelectorAll('.talle-chip').forEach(c=>c.classList.remove('selected'));
  document.getElementById('cm2-talles-config').style.display='none';
  document.getElementById('cm2-resumen').textContent='Seleccioná al menos un talle';
  document.getElementById('carga-masiva-modal').classList.add('open');
}
window.closeCargaMasivaModal=function(){
  document.getElementById('carga-masiva-modal').classList.remove('open');
}
window.toggleTalle=function(chip){
  const talle=chip.dataset.talle;
  if(chip.classList.contains('selected')){
    chip.classList.remove('selected');
    delete tallesSeleccionados[talle];
  } else {
    chip.classList.add('selected');
    tallesSeleccionados[talle]=1;
  }
  renderTallesRows();
}
function renderTallesRows(){
  const keys=Object.keys(tallesSeleccionados);
  const config=document.getElementById('cm2-talles-config');
  const rows=document.getElementById('cm2-talles-rows');
  if(!keys.length){ config.style.display='none'; document.getElementById('cm2-resumen').textContent='Seleccioná al menos un talle'; return; }
  config.style.display='block';
  const tallesOrder=['XS','S','M','L','XL','XXL','XXXL','36','38','40','42','44','46','48','50'];
  const sorted=keys.sort((a,b)=>tallesOrder.indexOf(a)-tallesOrder.indexOf(b));
  rows.innerHTML=sorted.map(t=>`
    <div class="talle-chip-row active">
      <span style="font-weight:600;font-size:.9rem">Talle ${t}</span>
      <input type="number" value="${tallesSeleccionados[t]||1}" min="1" style="width:60px;text-align:center" onchange="tallesSeleccionados['${t}']=parseInt(this.value)||1;updateCm2Resumen()">
      <span style="font-size:.78rem;color:var(--muted)">unid.</span>
    </div>`).join('');
  updateCm2Resumen();
}
function updateCm2Resumen(){
  const total=Object.values(tallesSeleccionados).reduce((a,b)=>a+b,0);
  const n=Object.keys(tallesSeleccionados).length;
  document.getElementById('cm2-resumen').textContent=`${n} talle${n!==1?'s':''} · ${total} unidad${total!==1?'es':''}`;
}
window.saveCargaMasiva=async function(){
  const cat=document.getElementById('cm2-cat').value.trim();
  const modelo=document.getElementById('cm2-modelo').value.trim();
  const color=document.getElementById('cm2-color').value.trim();
  const pventa=parseFloat(document.getElementById('cm2-pventa').value)||null;
  const pmayorista=parseFloat(document.getElementById('cm2-pmayorista').value)||null;
  const pcosto=parseFloat(document.getElementById('cm2-pcosto').value)||null;
  if(!cat||!modelo){ toast('Completá categoría y modelo.','error'); return; }
  const keys=Object.keys(tallesSeleccionados);
  if(!keys.length){ toast('Seleccioná al menos un talle.','error'); return; }
  const btn=document.getElementById('cm2-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    const batch=writeBatch(db);
    for(const talle of keys){
      const qty=tallesSeleccionados[talle]||1;
      // Verificar si ya existe ese talle en stock para sumar en lugar de duplicar
      const existe=stockData.find(p=>p.cat===cat&&p.modelo===modelo&&(p.color||'')===(color||'')&&p.talle===talle);
      if(existe){
        const upd={qty:existe.qty+qty};
        if(pventa) upd.pventa=pventa;
        if(pmayorista) upd.pmayorista=pmayorista;
        if(pcosto) upd.pcosto=pcosto;
        batch.update(doc(db,'stock',existe.id),upd);
      } else {
        const ref=doc(collection(db,'stock'));
        batch.set(ref,{cat,modelo,color,talle,qty,pventa,pmayorista,pcosto,notas:null,createdAt:Date.now()});
      }
    }
    await batch.commit();
    const total=Object.values(tallesSeleccionados).reduce((a,b)=>a+b,0);
    toast(`${keys.length} talles guardados — ${total} unidades ✓`,'success');
    closeCargaMasivaModal();
  }catch(e){ toast('Error: '+e.message,'error'); }
  finally{ btn.disabled=false; btn.textContent='Guardar todos'; }
}

// ══════════════════════════════════════════
// VENTA MÚLTIPLE
// ══════════════════════════════════════════
let multiItems=[]; // [{prodId, cant, pventa, pcosto}]

window.multiSearchFilter=function(){
  const q=document.getElementById('multi-search').value.toLowerCase().trim();
  const results=document.getElementById('multi-results');
  if(!q){results.classList.remove('open');return;}
  const matches=stockData.filter(p=>p.qty>0).filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="addToMulti('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty}</span>${p.pventa?`<span style="color:var(--accent)">$${fmt(p.pventa)}</span>`:''}</div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.addToMulti=function(id){
  const p=stockData.find(x=>x.id===id); if(!p)return;
  if(multiItems.find(x=>x.prodId===id)){toast('Ya está en la lista. Cambiá la cantidad.','error');return;}
  multiItems.push({prodId:id,cant:1,pventa:p.pventa||0,pcosto:p.pcosto||0});
  document.getElementById('multi-search').value='';
  document.getElementById('multi-results').classList.remove('open');
  renderMultiItems();
}
window.updateMultiItem=function(idx,field,val){
  multiItems[idx][field]=parseFloat(val)||0;
  if(field==='cant') multiItems[idx].cant=Math.max(1,parseInt(val)||1);
  renderMultiItems();
}
window.removeMultiItem=function(idx){ multiItems.splice(idx,1); renderMultiItems(); }
function renderMultiItems(){
  const cont=document.getElementById('multi-items');
  if(!multiItems.length){
    cont.innerHTML=`<div class="empty" style="padding:20px"><div class="empty-icon">🛒</div><p>Buscá productos para agregar a la venta</p></div>`;
    document.getElementById('multi-total').textContent='$0 — 0 productos'; return;
  }
  let totalMonto=0, totalItems=0;
  cont.innerHTML=multiItems.map((item,idx)=>{
    const p=stockData.find(x=>x.id===item.prodId); if(!p)return'';
    const subtotal=item.pventa*item.cant;
    totalMonto+=subtotal; totalItems+=item.cant;
    const gan=item.pcosto?(item.pventa-item.pcosto)*item.cant:null;
    return`<div class="mventa-item">
      <div><div style="font-size:.85rem;font-weight:500">${p.modelo}${p.color?' ('+p.color+')':''}</div><div style="font-size:.72rem;color:var(--muted)">${p.cat} · T.${p.talle} · Stock: ${p.qty}</div></div>
      <input type="number" value="${item.cant}" min="1" max="${p.qty}" onchange="updateMultiItem(${idx},'cant',this.value)" style="text-align:center">
      <input type="number" value="${item.pventa}" min="0" placeholder="Precio" onchange="updateMultiItem(${idx},'pventa',this.value)">
      <div style="text-align:right">
        <div style="font-size:.82rem;color:var(--accent)">$${fmt(Math.round(subtotal))}</div>
        ${gan!==null?`<div style="font-size:.7rem;color:${gan>=0?'var(--success)':'var(--danger)'}">$${fmt(Math.round(gan))}</div>`:''}
      </div>
      <button class="btn-ghost btn" onclick="removeMultiItem(${idx})" style="padding:4px 8px">✕</button>
    </div>`;
  }).join('');
  document.getElementById('multi-total').textContent=`$${fmt(Math.round(totalMonto))} — ${totalItems} producto${totalItems!==1?'s':''}`;
}
window.registrarMultiple=async function(){
  if(!multiItems.length){toast('Agregá al menos un producto.','error');return;}
  for(const item of multiItems){
    const p=stockData.find(x=>x.id===item.prodId);
    if(!p||p.qty<item.cant){toast(`Stock insuficiente: ${p?.modelo||'?'} T.${p?.talle}`,'error');return;}
    if(!item.pventa||item.pventa<=0){toast('Todos los productos deben tener precio.','error');return;}
  }
  const btn=document.getElementById('btn-registrar-multi'); btn.disabled=true; btn.textContent='Registrando...';
  const total=multiItems.length; const fecha=Date.now(); const loteId=fecha.toString();
  try{
    const batch=writeBatch(db);
    for(const item of multiItems){
      const p=stockData.find(x=>x.id===item.prodId);
      batch.update(doc(db,'stock',item.prodId),{qty:p.qty-item.cant});
      batch.set(doc(collection(db,'ventas')),{
        prodId:item.prodId,cat:p.cat,modelo:p.modelo,color:p.color||'',talle:p.talle,
        pventa:item.pventa,pcosto:item.pcosto||null,cant:item.cant,
        tipo:'multiple',loteId,fecha
      });
    }
    await batch.commit();
    multiItems=[];
    renderMultiItems();
    toast(`${total} producto${total!==1?'s':''} vendidos en lote ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='✓ Registrar todo';}
}

// ══════════════════════════════════════════
// EDITAR VENTA
// ══════════════════════════════════════════
window.openEditVentaModal=function(id){
  const v=ventasData.find(x=>x.id===id); if(!v)return;
  document.getElementById('ev-id').value=id;
  document.getElementById('ev-prod-info').textContent=`${v.cat} — ${v.modelo}${v.color?' ('+v.color+')':''} · T.${v.talle}`;
  document.getElementById('ev-precio').value=v.pventa||'';
  document.getElementById('ev-costo').value=v.pcosto||'';
  document.getElementById('ev-cant').value=v.cant||1;
  document.getElementById('edit-venta-modal').classList.add('open');
}
window.closeEditVentaModal=function(){ document.getElementById('edit-venta-modal').classList.remove('open'); }
window.saveEditVenta=async function(){
  const id=document.getElementById('ev-id').value;
  const pventa=parseFloat(document.getElementById('ev-precio').value);
  const pcosto=parseFloat(document.getElementById('ev-costo').value)||null;
  const cant=parseInt(document.getElementById('ev-cant').value)||1;
  if(!pventa||pventa<=0){toast('El precio debe ser mayor a 0.','error');return;}
  const btn=document.getElementById('ev-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await updateDoc(doc(db,'ventas',id),{pventa,pcosto,cant});
    toast('Venta actualizada ✓','success');
    closeEditVentaModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}

// ══════════════════════════════════════════
// EDITAR GASTO
// ══════════════════════════════════════════
window.updateEgSubcats=function(){
  const cat=document.getElementById('eg-cat').value;
  const sub=document.getElementById('eg-sub');
  const optsNegocio=[['publicidad','Publicidad / Ads'],['envios','Envíos / Logística'],['packaging','Packaging'],['plataformas','Plataformas / Apps'],['impuestos','Impuestos / Tasas'],['otros','Otros']];
  const optsPersonal=[['retiro','Retiro de ganancias'],['comida','Comida / Salidas'],['transporte','Transporte'],['otros','Otros']];
  sub.innerHTML=(cat==='negocio'?optsNegocio:optsPersonal).map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
}
window.openEditGastoModal=function(id){
  const g=gastosData.find(x=>x.id===id); if(!g)return;
  document.getElementById('eg-id').value=id;
  document.getElementById('eg-desc').value=g.desc||'';
  document.getElementById('eg-monto').value=g.monto||'';
  document.getElementById('eg-cat').value=g.cat||'negocio';
  updateEgSubcats();
  document.getElementById('eg-sub').value=g.sub||'otros';
  document.getElementById('eg-fecha').value=new Date(g.fecha).toISOString().slice(0,10);
  document.getElementById('edit-gasto-modal').classList.add('open');
}
window.closeEditGastoModal=function(){ document.getElementById('edit-gasto-modal').classList.remove('open'); }
window.saveEditGasto=async function(){
  const id=document.getElementById('eg-id').value;
  const desc=document.getElementById('eg-desc').value.trim();
  const monto=parseFloat(document.getElementById('eg-monto').value);
  const cat=document.getElementById('eg-cat').value;
  const sub=document.getElementById('eg-sub').value;
  const fechaStr=document.getElementById('eg-fecha').value;
  if(!desc||!monto||!fechaStr){toast('Completá todos los campos.','error');return;}
  const btn=document.getElementById('eg-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await updateDoc(doc(db,'gastos',id),{desc,monto,cat,sub,fecha:new Date(fechaStr+'T12:00:00').getTime()});
    toast('Gasto actualizado ✓','success');
    await loadGastos();
    closeEditGastoModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}

// ══════════════════════════════════════════
// EDITAR COMPRA
// ══════════════════════════════════════════
window.openEditCompraModal=function(id){
  const c=comprasData.find(x=>x.id===id); if(!c)return;
  document.getElementById('ec-id').value=id;
  document.getElementById('ec-proveedor').value=c.proveedor||'';
  document.getElementById('ec-notas').value=c.notas||'';
  document.getElementById('ec-fecha').value=new Date(c.fecha).toISOString().slice(0,10);
  document.getElementById('edit-compra-modal').classList.add('open');
}
window.closeEditCompraModal=function(){ document.getElementById('edit-compra-modal').classList.remove('open'); }
window.saveEditCompra=async function(){
  const id=document.getElementById('ec-id').value;
  const proveedor=document.getElementById('ec-proveedor').value.trim();
  const notas=document.getElementById('ec-notas').value.trim();
  const fechaStr=document.getElementById('ec-fecha').value;
  if(!fechaStr){toast('Ingresá la fecha.','error');return;}
  const btn=document.getElementById('ec-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await updateDoc(doc(db,'compras',id),{proveedor:proveedor||'Sin especificar',notas,fecha:new Date(fechaStr+'T12:00:00').getTime()});
    toast('Compra actualizada ✓','success');
    await loadCompras();
    closeEditCompraModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}


// ── AUTOCOMPLETE ──
window.acFilter=function(inputId,listId){
  const val=document.getElementById(inputId).value.toLowerCase();
  const cats=[...new Set(stockData.map(p=>p.cat))].sort();
  const matches=val?cats.filter(c=>c.toLowerCase().includes(val)):cats;
  const list=document.getElementById(listId);
  if(!matches.length){list.classList.remove('open');return;}
  list.innerHTML=matches.map(c=>`<div class="ac-item" data-val="${c.replace(/"/g,'&quot;')}" data-input="${inputId}" data-list="${listId}" onmousedown="acSelectFromEl(this)">${c}</div>`).join('');
  list.classList.add('open');
}
window.acSelectFromEl=function(el){
  document.getElementById(el.dataset.input).value=el.dataset.val;
  document.getElementById(el.dataset.list).classList.remove('open');
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.autocomplete-wrap')) document.querySelectorAll('.autocomplete-list').forEach(l=>l.classList.remove('open'));
  // Bug #5 fix: agregar #cuo-search a la lista de excepciones
  if(!e.target.closest('.venta-search-wrap')&&!e.target.closest('#curva-search')&&!e.target.closest('#cp-search')&&!e.target.closest('#vs-search')&&!e.target.closest('#cuo-search')&&!e.target.closest('#multi-search')&&!e.target.closest('#rm-search'))
    document.querySelectorAll('.venta-search-results').forEach(r=>r.classList.remove('open'));
});

// ── TABS ──
window.showTab=function(name,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if(btn)btn.classList.add('active');
  // Bug #4 fix: lazy render para todas las tabs, no solo ganancias
  if(name==='ganancias'){ buildMesOptions(); renderFlujoCaja(); renderGanancias(); }
  if(name==='compras'){ renderComprasKPI(); renderCompras(); setCpStockMode(cpActualizaStock); }
  if(name==='gastos'){ renderGastosKPI(); renderGastos(); }
  if(name==='cobros'){ renderCobrosKPI(); renderCobros(); }
  if(name==='reservas'){ renderReservasKPI(); renderReservas(); }
}

// ── TOAST ──
window.toast=function(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(type?' '+type:'');
  void t.offsetWidth; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}

// ── CONFIRM ──
window.confirm2=function(title,msg,okLabel='Eliminar',okColor='var(--danger)'){
  return new Promise(resolve=>{
    confirmCb=resolve;
    document.getElementById('confirm-title').textContent=title;
    document.getElementById('confirm-msg').textContent=msg;
    const btn=document.getElementById('confirm-ok-btn'); btn.textContent=okLabel; btn.style.background=okColor;
    document.getElementById('confirm-overlay').classList.add('open');
  });
}
window.confirmResolve=function(val){
  document.getElementById('confirm-overlay').classList.remove('open');
  if(confirmCb){confirmCb(val);confirmCb=null;}
}

function fmt(n){return Number(n).toLocaleString('es-AR');}
document.getElementById('prod-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeProdModal();});
document.getElementById('reserva-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeReservaModal();});
document.getElementById('carga-masiva-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeCargaMasivaModal();});
document.getElementById('edit-venta-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeEditVentaModal();});
document.getElementById('edit-gasto-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeEditGastoModal();});
document.getElementById('edit-compra-modal').addEventListener('click',e=>{if(e.target===e.currentTarg