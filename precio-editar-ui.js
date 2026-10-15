import { state } from './state.js';
import { db, doc, writeBatch } from './firebase-config.js';
import { claveModelo } from './matching.js';
import { configPrecioTarjeta } from './precio-tarjeta.js';
import { validarPrecio, esCambioGrande, precioActual, planDeCambio, camposNuevos, camposDeshacer, vistaPrevia, manualDelProducto } from './precio-editar.js';

// ══════════════════════════════════════════
// EDITAR PRECIO — sección "Precio" del modal de la ficha (Catálogo y sitio). Las cuentas están en precio-editar.js.
// catalogo.js llama a peAbrir/peCerrar al abrir/cerrar el modal. Después de guardar, catalogoSync (ya existente) actualiza
// la ficha y la tienda al detectar el cambio de stock.
// ══════════════════════════════════════════
const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('es-AR');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TIEMPO_DESHACER = 15000;

let producto = null; // { key, nombre }
let pendiente = null; // { nuevo, plan, borrarManual, segunda }
let ocupado = false;
let undo = null; // { plan, nombre, timer }

const filasDelProducto = () => (producto ? state.stockData.filter((f) => claveModelo(f) === producto.key) : []);
const cfg = () => configPrecioTarjeta(state.configSitio);

window.peAbrir = function (modelo, nombre) {
  producto = { key: modelo.key, nombre };
  pendiente = null;
  const { precio } = precioActual(filasDelProducto());
  $('pe-precio').value = precio ? String(precio) : '';
  $('pe-error').textContent = '';
  $('pe-confirm').style.display = 'none';
  peVista();
};
window.peCerrar = function () { producto = null; pendiente = null; };

// Vista en vivo: tarjeta y cuotas según lo escrito; aviso de ptarjeta manual.
window.peVista = function () {
  if (!producto) return;
  const filas = filasDelProducto();
  const v = validarPrecio($('pe-precio').value);
  const { precio, variosPrecios } = precioActual(filas);
  const manual = manualDelProducto(filas);
  const c = cfg();
  let h = '';
  if (!v.ok) h = `<span style="color:var(--muted)">Tarjeta: escribí un precio válido para verla.</span>`;
  else {
    const p = vistaPrevia(filas, v.valor, c);
    h = p.tarjeta
      ? `<div>💳 Tarjeta: <b>$${fmt(p.tarjeta)}</b>${p.manual ? ' <span style="color:var(--muted)">(manual)</span>' : ''}</div><div style="color:var(--muted)">3 cuotas de <b style="color:var(--text)">$${fmt(p.cuota)}</b> sin interés</div>`
      : `<div style="color:var(--muted)">💳 Tarjeta: no corresponde (con este recargo no queda más caro que efectivo).</div>`;
    if (!c.mostrar) h += `<div style="color:var(--muted);font-size:.7rem;margin-top:2px">El interruptor "Mostrar precio de tarjeta" está apagado: la tienda todavía no lo muestra.</div>`;
  }
  $('pe-vista').innerHTML = h;
  let m = '';
  if (variosPrecios) m += `<div style="color:var(--warning)">⚠ Los talles tienen precios distintos; al guardar todos pasan a un mismo precio.</div>`;
  if (manual != null) {
    m += `<div style="margin-top:4px">Este producto tiene un precio de tarjeta manual: <b>$${fmt(manual)}</b>. Se mantiene al cambiar el precio.${v.ok && vistaPrevia(filas, v.valor, c).manualIgnorado ? ' <span style="color:var(--warning)">Con el precio nuevo ya no es mayor que el de efectivo, así que se ignora y se calcula solo.</span>' : ''}
      <label style="display:flex;gap:6px;align-items:center;margin-top:4px;cursor:pointer;text-transform:none;letter-spacing:0;font-size:.76rem"><input type="checkbox" id="pe-borrar-manual"> Borrar el precio de tarjeta manual (vuelve a calcularse solo)</label></div>`;
  }
  const tieneChk = $('pe-borrar-manual')?.checked;
  $('pe-manual').innerHTML = m;
  if (tieneChk && $('pe-borrar-manual')) $('pe-borrar-manual').checked = true;
  $('pe-actual').textContent = precio ? `Precio actual: $${fmt(precio)}` : 'Este producto no tiene precio cargado.';
};

// Paso 1: validar y pedir confirmación (sin escribir nada).
window.peGuardar = function () {
  if (!producto || ocupado) return;
  const v = validarPrecio($('pe-precio').value);
  $('pe-error').textContent = '';
  if (!v.ok) { $('pe-error').textContent = v.error; return; }
  const filas = filasDelProducto();
  const borrarManual = !!$('pe-borrar-manual')?.checked;
  const plan = planDeCambio(filas, v.valor, { borrarManual });
  if (!plan.length) { $('pe-error').textContent = 'No hay nada que cambiar: ya tiene ese precio.'; return; }
  const { precio } = precioActual(filas);
  pendiente = { nuevo: v.valor, plan, borrarManual, antes: precio, segunda: false };
  peMostrarConfirm();
};
function peMostrarConfirm() {
  const p = pendiente; const n = filasDelProducto().length;
  const caja = $('pe-confirm');
  const cambiaPrecio = p.plan.some((c) => c.cambiaPrecio);
  let t = cambiaPrecio
    ? `Vas a cambiar el precio de <b>${esc(producto.nombre)}</b> de <b>$${fmt(p.antes)}</b> a <b>$${fmt(p.nuevo)}</b> (afecta ${n} ${n === 1 ? 'fila/talle' : 'filas/talles'}).`
    : `Vas a borrar el precio de tarjeta manual de <b>${esc(producto.nombre)}</b> (afecta ${p.plan.length} ${p.plan.length === 1 ? 'fila/talle' : 'filas/talles'}).`;
  if (p.borrarManual && cambiaPrecio) t += ' También se borra el precio de tarjeta manual.';
  if (p.segunda) t = `<b style="color:var(--warning)">¿Seguro?</b> El cambio es de más del 50 % (de $${fmt(p.antes)} a $${fmt(p.nuevo)}). Revisá que no falte o sobre un cero.`;
  caja.innerHTML = `<div style="margin-bottom:10px">${t}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-gold" onclick="peConfirmar()">${p.segunda ? 'Sí, estoy seguro' : 'Confirmar'}</button><button class="btn btn-ghost" onclick="peCancelar()">Cancelar</button></div>`;
  caja.style.display = 'block';
}
window.peCancelar = function () { pendiente = null; $('pe-confirm').style.display = 'none'; };

// Paso 2: si el cambio es grande pide el "¿Seguro?"; si no, escribe.
window.peConfirmar = async function () {
  if (!pendiente || ocupado) return;
  if (!pendiente.segunda && pendiente.plan.some((c) => c.cambiaPrecio) && esCambioGrande(pendiente.antes, pendiente.nuevo)) {
    pendiente.segunda = true; peMostrarConfirm(); return;
  }
  const { nuevo, plan } = pendiente; const nombre = producto.nombre; const key = producto.key;
  const estabaPublicado = window.catalogoPublicado ? catalogoPublicado(key) : true;
  ocupado = true;
  try {
    const batch = writeBatch(db);
    plan.forEach((c) => batch.update(doc(db, 'stock', c.id), camposNuevos(c, nuevo)));
    await batch.commit();
  } catch (e) { ocupado = false; $('pe-error').textContent = 'No se guardó: ' + e.message; return; }
  ocupado = false;
  pendiente = null; $('pe-confirm').style.display = 'none';
  $('pe-precio').value = String(nuevo);
  peMostrarUndo(plan, nombre, estabaPublicado ? 'Precio actualizado en la tienda ✓' : 'Precio guardado. Este producto todavía no está publicado en la tienda.');
  peVista(); setTimeout(peVista, 700); // la etiqueta "Precio actual" se refresca cuando llega el stock actualizado
};

// Deshacer visible unos segundos (barra fija, queda aunque se cierre el modal).
function peMostrarUndo(plan, nombre, aviso) {
  peOcultarUndo();
  const b = $('pe-undo'); if (!b) return;
  undo = { plan, nombre };
  b.innerHTML = `<span style="flex:1;min-width:0">${esc(aviso)}</span><button class="btn btn-ghost" onclick="peDeshacer()">↩ Deshacer</button>`;
  b.style.display = 'flex';
  undo.timer = setTimeout(peOcultarUndo, TIEMPO_DESHACER);
}
function peOcultarUndo() { if (undo?.timer) clearTimeout(undo.timer); undo = null; const b = $('pe-undo'); if (b) b.style.display = 'none'; }
window.peDeshacer = async function () {
  if (!undo || ocupado) return;
  const { plan } = undo; ocupado = true;
  try {
    const batch = writeBatch(db);
    plan.forEach((c) => batch.update(doc(db, 'stock', c.id), camposDeshacer(c)));
    await batch.commit();
  } catch (e) { ocupado = false; toast('No se pudo deshacer: ' + e.message, 'error'); return; }
  ocupado = false; peOcultarUndo();
  if (producto) { const c0 = plan.find((c) => c.cambiaPrecio); if (c0) $('pe-precio').value = String(c0.pventaAntes); peVista(); setTimeout(peVista, 700); }
  toast('Precio anterior restaurado', 'success');
};
