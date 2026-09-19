import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth, db, collection, doc, setDoc, getDoc, writeBatch, onSnapshot, query, orderBy, limit } from './firebase-config.js';
import { state } from './state.js';
import './ui-helpers.js';
import './stock.js';
import './ventas.js';
import './cuotas.js';
import './compras.js';
import './gastos.js';
import './reservas.js';
import './ganancias.js';
import './carga-rapida.js';

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
// ── LOGIN ──
window.doLogin = async function(ev) {
  ev.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Ingresando...';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged se encarga de mostrar la app
  } catch(err) {
    errEl.textContent = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
      ? 'Email o contraseña incorrectos.'
      : 'No se pudo iniciar sesión: ' + err.message;
    btn.disabled = false; btn.textContent = 'Ingresar';
  }
  return false;
};

window.doLogout = async function() {
  if(state.unsubStock)  state.unsubStock();
  if(state.unsubVentas) state.unsubVentas();
  if(state.unsubCuotas) state.unsubCuotas();
  if(state.unsubReservas) state.unsubReservas();
  await signOut(auth);
  // onAuthStateChanged se encarga de volver a mostrar el login
};

onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('loader').style.display = 'flex';
    init();
  } else {
    document.getElementById('loader').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    const errEl = document.getElementById('login-error');
    if (errEl) errEl.textContent = '';
    const btn = document.getElementById('login-btn');
    if (btn) { btn.disabled = false; btn.textContent = 'Ingresar'; }
  }
});
// ── INIT ──
async function init() {
  try {
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
    document.getElementById('uv-fecha1').value = hoy;
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
  if(state.unsubStock)  state.unsubStock();
  if(state.unsubVentas) state.unsubVentas();
  if(state.unsubCuotas) state.unsubCuotas();

  state.unsubStock = onSnapshot(collection(db,'stock'), snap=>{
    state.stockData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderStock(); populateCategoryFilter(); updateHeader();
    // Bug #19 fix: alerta de stock bajo al cargar o cambiar
    checkStockBajo();
  },err=>{ toast('Error stock: '+err.message,'error'); });

  state.unsubVentas = onSnapshot(query(collection(db,'ventas'),orderBy('fecha','desc')), snap=>{
    state.ventasData=snap.docs.map(d=>{ const r=d.data(); return{id:d.id,...r,pventa:r.pventa??r.precio??0,cant:r.cant??r.cantidad??1,pcosto:r.pcosto??r.costo??null}; });
    renderVentas(); renderComprasKPI(); renderDashboard();
    if(document.getElementById('tab-ganancias').classList.contains('active')) renderGanancias();
    updateHeader();
  },err=>{ toast('Error ventas: '+err.message,'error'); });

  state.unsubCuotas = onSnapshot(query(collection(db,'cuotas'),orderBy('createdAt','desc'),limit(100)), snap=>{
    state.cuotasData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderCobros(); renderCobrosKPI(); updateHeader(); renderDashboard(); updateCobrosTabBadge(); renderVentas();
    if(document.getElementById('tab-ganancias').classList.contains('active')) renderGanancias();
  },err=>{ toast('Error cuotas: '+err.message,'error'); });

  if(state.unsubReservas) state.unsubReservas();
  state.unsubReservas = onSnapshot(query(collection(db,'reservas'),orderBy('createdAt','desc'),limit(100)), snap=>{
    state.reservasData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderReservasKPI(); updateReservasTabBadge();
    if(document.getElementById('tab-reservas').classList.contains('active')) renderReservas();
    // Actualizar stock con cantidades reservadas
    renderStock();
  },err=>{ toast('Error reservas: '+err.message,'error'); });

  // Bug #12 fix: compras y gastos se cargan una vez (no tiempo real — ahorra lecturas Firestore)
  loadCompras(); loadGastos();

  document.getElementById('loader').style.display='none';
}
// ── HEADER ──
window.updateHeader = function() {
  const unid = state.stockData.reduce((a,p)=>a+p.qty,0);
  // Bug #8 + #10 fix: incluir cuotas cobradas en ganancia y contador de ventas
  const ganVentas = state.ventasData.filter(v=>v.pcosto).reduce((a,v)=>a+(v.pventa-v.pcosto)*v.cant,0);
  const ganCuotas = state.cuotasData.filter(c=>c.pcosto&&c.estado==='cobrado').reduce((a,c)=>a+(c.totalVenta-c.pcosto),0);
  const gan = ganVentas + ganCuotas;
  const totalVentas = state.ventasData.length + state.cuotasData.length;
  document.getElementById('h-unidades').textContent = unid;
  document.getElementById('h-ventas').textContent   = totalVentas;
  document.getElementById('h-gan').textContent      = gan?'$'+fmt(Math.round(gan)):'—';
}
// ── TABS ──
window.showTab=function(name,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  if(btn)btn.classList.add('active');
  // Bug #4 fix: lazy render para todas las tabs, no solo ganancias
  if(name==='ganancias'){ buildMesOptions(); renderFlujoCaja(); renderGanancias(); }
  if(name==='compras'){ renderComprasKPI(); renderCompras(); setCpStockMode(state.cpActualizaStock); }
  if(name==='gastos'){ renderGastosKPI(); renderGastos(); }
  if(name==='cobros'){ renderCobrosKPI(); renderCobros(); }
  if(name==='reservas'){ renderReservasKPI(); renderReservas(); }
}
