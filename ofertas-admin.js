import { state } from './state.js';
import { db, doc, writeBatch } from './firebase-config.js';
import { claveModelo } from './matching.js';
import { configPrecioTarjeta } from './precio-tarjeta.js';
import { precioActual } from './precio-editar.js';
import { validarOferta, ofertaActual, planOferta, camposOferta, camposDeshacerOferta, vistaPreviaOferta, ofertaValida } from './ofertas.js';

// ══════════════════════════════════════════
// PRECIO EN OFERTA — sección "Precio en oferta" del modal de la ficha (Catálogo y sitio). Las cuentas están en ofertas.js.
// catalogo.js llama a ofAbrir/ofCerrar al abrir/cerrar el modal (igual que precio-editar-ui.js). Escribe SOLO `poferta` en las
// filas de stock del producto; después catalogoSync (ya existente) cambia solo esa ficha y el documento único de la tienda.
// ══════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const TIEMPO_DESHACER = 15000;

let producto = null; // { key, nombre }
let ocupado = false;
let undo = null; // { plan, timer }

const filasDelProducto = () => (producto ? state.stockData.filter((f) => claveModelo(f) === producto.key) : []);
const cfg = () => configPrecioTarjeta(state.configSitio);

window.ofAbrir = function (modelo, nombre) {
  producto = { key: modelo.key, nombre };
  const { valor } = ofertaActual(filasDelProducto());
  $('of-precio').value = valor ? String(valor) : '';
  $('of-error').textContent = '';
  ofVista();
};
window.ofCerrar = function () { producto = null; };

// Vista en vivo: porcentaje de descuento, tarjeta y cuotas según lo escrito.
window.ofVista = function () {
  if (!producto) return;
  const filas = filasDelProducto();
  const { precio } = precioActual(filas);
  const { valor: guardada, variasOfertas } = ofertaActual(filas);
  const v = validarOferta($('of-precio').value, precio);
  const c = cfg();
  let h = '';
  if (!(precio > 0)) h = `<span style="color:var(--muted)">Este producto todavía no tiene precio normal cargado.</span>`;
  else if (!v.ok) h = `<span style="color:var(--muted)">Escribí un precio en oferta válido para ver cómo queda.</span>`;
  else if (v.vacio) h = `<span style="color:var(--muted)">Sin oferta: la tienda muestra el precio normal ($${fmt(precio)}).</span>`;
  else {
    const p = vistaPreviaOferta(precio, v.valor, c);
    h = `<div><span style="display:inline-block;background:#e5252a;color:#fff;border-radius:999px;padding:1px 9px;font-weight:700;font-size:.78rem">-${p.pct}%</span> <s style="color:var(--muted)">$${fmt(precio)}</s> → <b>$${fmt(v.valor)}</b> en efectivo o transferencia</div>`;
    h += p.tarjeta
      ? `<div style="margin-top:2px">💳 Tarjeta: <b>$${fmt(p.tarjeta)}</b> <span style="color:var(--muted)">· 3 cuotas de $${fmt(p.cuota)} sin interés</span></div>`
      : `<div style="color:var(--muted);margin-top:2px">💳 Tarjeta: no corresponde (con este recargo no queda más caro que efectivo).</div>`;
    if (!c.mostrar) h += `<div style="color:var(--muted);font-size:.7rem;margin-top:2px">El interruptor "Mostrar precio de tarjeta" está apagado: la tienda todavía no lo muestra.</div>`;
  }
  $('of-vista').innerHTML = h;
  let a = '';
  if (variasOfertas) a += `<div style="color:var(--warning)">⚠ Los talles tienen ofertas distintas; al guardar todos pasan a la misma.</div>`;
  if (guardada && !ofertaValida(guardada, precio)) a += `<div style="color:var(--warning)">⚠ La oferta guardada ($${fmt(guardada)}) ya no es menor que el precio normal ($${fmt(precio)}): la tienda NO la muestra. Corregila o quitala.</div>`;
  $('of-aviso').innerHTML = a;
  $('of-actual').textContent = guardada ? `Oferta actual: $${fmt(guardada)}` : 'Este producto no está en oferta.';
  $('of-quitar').style.display = guardada ? '' : 'none';
};

async function escribir(plan, nuevo, mensaje) {
  if (!plan.length) { $('of-error').textContent = 'No hay nada que cambiar.'; return false; }
  ocupado = true;
  try {
    const batch = writeBatch(db);
    plan.forEach((c) => batch.update(doc(db, 'stock', c.id), camposOferta(nuevo)));
    await batch.commit();
  } catch (e) { ocupado = false; $('of-error').textContent = 'No se guardó: ' + e.message; return false; }
  ocupado = false;
  ofMostrarUndo(plan, mensaje);
  ofVista(); setTimeout(ofVista, 700); // "Oferta actual" se refresca cuando llega el stock actualizado
  return true;
}

// Guardar: valida (número > 0 y menor que el precio normal); si no, muestra el error y NO guarda. Vacío = quitar la oferta.
window.ofGuardar = async function () {
  if (!producto || ocupado) return;
  $('of-error').textContent = '';
  const filas = filasDelProducto();
  const { precio } = precioActual(filas);
  const v = validarOferta($('of-precio').value, precio);
  if (!v.ok) { $('of-error').textContent = v.error; return; }
  const estabaPublicado = window.catalogoPublicado ? catalogoPublicado(producto.key) : true;
  const nuevo = v.vacio ? null : v.valor;
  const ok = await escribir(planOferta(filas, nuevo), nuevo, nuevo == null ? 'Oferta quitada ✓' : (estabaPublicado ? 'Oferta publicada en la tienda ✓' : 'Oferta guardada. Este producto todavía no está publicado en la tienda.'));
  if (ok && nuevo == null) $('of-precio').value = '';
};
window.ofQuitar = async function () {
  if (!producto || ocupado) return;
  $('of-error').textContent = '';
  if (await escribir(planOferta(filasDelProducto(), null), null, 'Oferta quitada ✓')) $('of-precio').value = '';
};

// Deshacer visible unos segundos (misma barra fija que el precio: #pe-undo).
function ofMostrarUndo(plan, aviso) {
  ofOcultarUndo();
  const b = $('pe-undo'); if (!b) return;
  undo = { plan };
  b.innerHTML = `<span style="flex:1;min-width:0">${aviso}</span><button class="btn btn-ghost" onclick="ofDeshacer()">↩ Deshacer</button>`;
  b.style.display = 'flex';
  undo.timer = setTimeout(ofOcultarUndo, TIEMPO_DESHACER);
}
function ofOcultarUndo() { if (undo?.timer) clearTimeout(undo.timer); undo = null; const b = $('pe-undo'); if (b) b.style.display = 'none'; }
window.ofDeshacer = async function () {
  if (!undo || ocupado) return;
  const { plan } = undo; ocupado = true;
  try {
    const batch = writeBatch(db);
    plan.forEach((c) => batch.update(doc(db, 'stock', c.id), camposDeshacerOferta(c)));
    await batch.commit();
  } catch (e) { ocupado = false; toast('No se pudo deshacer: ' + e.message, 'error'); return; }
  ocupado = false; ofOcultarUndo();
  if (producto) { const c0 = plan.find((c) => c.pofertaAntes); $('of-precio').value = c0 ? String(c0.pofertaAntes) : ''; ofVista(); setTimeout(ofVista, 700); }
  toast('Oferta anterior restaurada', 'success');
};
