import { state } from './state.js';
import { db, doc, writeBatch, deleteField } from './firebase-config.js';

// Herramienta para ventas que se cargaron días después: mueve la fecha de todas las ventas de los
// días elegidos. Cada venta conserva su hora y guarda su fecha original (fechaOriginal), así que se puede deshacer.
const $ = (id) => document.getElementById(id);
const MS_DIA = 86400000;
const TANDA = 400; // Firestore admite hasta 500 operaciones por lote
let elegidos = new Set();

const dinero = (n) => '$' + fmt(Math.round(n));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nombreDia = (k) => { const [y, m, d] = k.split('-').map(Number); const t = new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };

function diasConVentas() {
  const desde = Date.now() - 90 * MS_DIA, m = new Map();
  for (const v of state.ventasData) {
    if (v.fecha < desde) continue;
    const k = fechaAInput(v.fecha), o = m.get(k) || { k, n: 0, monto: 0, ventas: [] };
    o.n++; o.monto += v.pventa * v.cant; o.ventas.push(v); m.set(k, o);
  }
  return [...m.values()].sort((a, b) => b.k.localeCompare(a.k));
}

// Misma hora del día, en el día de destino.
function conNuevoDia(ms, destino) {
  const [y, m, d] = destino.split('-').map(Number), o = new Date(ms);
  return new Date(y, m - 1, d, o.getHours(), o.getMinutes(), o.getSeconds(), o.getMilliseconds()).getTime();
}

window.openFechasModal = function () {
  elegidos = new Set();
  const hoy = new Date();
  $('fechas-destino').value = fechaAInput(new Date(hoy.getFullYear(), hoy.getMonth(), 0).getTime()); // último día del mes anterior
  $('fechas-destino').max = hoyISO();
  $('fechas-destino').onchange = fechasResumen;
  fechasRender();
  $('fechas-modal').classList.add('open');
};
window.closeFechasModal = function () { $('fechas-modal').classList.remove('open'); };

window.fechasToggle = function (k, on) { if (on) elegidos.add(k); else elegidos.delete(k); fechasResumen(); };

function fechasRender() {
  const dias = diasConVentas();
  $('fechas-lista').innerHTML = dias.length
    ? dias.map((d) => `<label class="fechas-fila"><input type="checkbox" ${elegidos.has(d.k) ? 'checked' : ''} onchange="fechasToggle('${d.k}',this.checked)"><span class="fechas-dia">${esc(nombreDia(d.k))}</span><span class="fechas-num">${d.n} venta${d.n !== 1 ? 's' : ''} · ${dinero(d.monto)}</span></label>`).join('')
    : '<p style="padding:14px;font-size:.8rem;color:var(--muted)">No hay ventas en los últimos 90 días.</p>';
  const movidas = state.ventasData.filter((v) => v.fechaOriginal);
  $('fechas-deshacer').innerHTML = movidas.length
    ? `<button class="btn btn-outline btn-sm" onclick="deshacerFechasVentas()">↩ Restaurar la fecha original de ${movidas.length} venta${movidas.length !== 1 ? 's' : ''} ya movida${movidas.length !== 1 ? 's' : ''}</button>`
    : '';
  fechasResumen();
}

function seleccion() {
  const ventas = diasConVentas().filter((d) => elegidos.has(d.k)).flatMap((d) => d.ventas);
  return { ventas, monto: ventas.reduce((a, v) => a + v.pventa * v.cant, 0) };
}

function fechasResumen() {
  const s = seleccion(), destino = $('fechas-destino').value, btn = $('fechas-btn'), res = $('fechas-resumen');
  let error = '';
  if (!destino) error = 'Elegí el día de destino.';
  else if (destino > hoyISO()) error = 'El día de destino no puede ser futuro.';
  else if (elegidos.has(destino)) error = 'El día de destino es uno de los días elegidos: elegí otro.';
  if (!s.ventas.length) { res.style.color = 'var(--muted)'; res.textContent = 'Marcá los días que querés mover.'; btn.disabled = true; return; }
  res.style.color = error ? 'var(--danger)' : 'var(--text2)';
  res.textContent = error || `${s.ventas.length} venta${s.ventas.length !== 1 ? 's' : ''} por ${dinero(s.monto)} pasarán al ${nombreDia(destino)} (con su hora original).`;
  btn.disabled = !!error;
}

async function porTandas(operaciones) {
  for (let i = 0; i < operaciones.length; i += TANDA) {
    const batch = writeBatch(db);
    operaciones.slice(i, i + TANDA).forEach(([ref, datos]) => batch.update(ref, datos));
    await batch.commit();
  }
}

window.moverFechasVentas = async function () {
  const s = seleccion(), destino = $('fechas-destino').value;
  if (!s.ventas.length || !destino || destino > hoyISO() || elegidos.has(destino)) return;
  const ok = await confirm2(`¿Mover ${s.ventas.length} ventas?`, `Pasan al ${nombreDia(destino)}. Se puede deshacer desde esta misma ventana.`, 'Mover', 'var(--blue)');
  if (!ok) return;
  const btn = $('fechas-btn'); btn.disabled = true; btn.textContent = 'Moviendo…';
  try {
    await porTandas(s.ventas.map((v) => [doc(db, 'ventas', v.id), { fecha: conNuevoDia(v.fecha, destino), fechaOriginal: v.fechaOriginal || v.fecha }]));
    toast(`${s.ventas.length} ventas movidas al ${nombreDia(destino)} ✓`, 'success');
    elegidos = new Set();
    setTimeout(fechasRender, 900);
  } catch (e) { toast('Error: ' + e.message, 'error'); }
  finally { btn.textContent = 'Mover ventas'; fechasResumen(); }
};

window.deshacerFechasVentas = async function () {
  const movidas = state.ventasData.filter((v) => v.fechaOriginal);
  if (!movidas.length) return;
  const ok = await confirm2(`¿Restaurar ${movidas.length} ventas?`, 'Vuelven a la fecha en que se cargaron originalmente.', 'Restaurar', 'var(--blue)');
  if (!ok) return;
  try {
    await porTandas(movidas.map((v) => [doc(db, 'ventas', v.id), { fecha: v.fechaOriginal, fechaOriginal: deleteField() }]));
    toast(`${movidas.length} ventas restauradas ✓`, 'success');
    setTimeout(fechasRender, 900);
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

$('fechas-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeFechasModal(); });
