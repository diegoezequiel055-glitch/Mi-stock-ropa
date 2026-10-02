import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from './firebase-config.js';
import { norm } from './matching.js';
import { MOTOMENSAJERIA_INICIAL } from './envios-data.js';

// ══════════════════════════════════════════
// ENVÍOS — tabla editable de motomensajería (Gran Buenos Aires) + tabla editable
// de Correo Argentino (resto del país). Todo se edita a mano desde esta pantalla.
// ══════════════════════════════════════════

const slug = (s) => norm(s).replace(/\s+/g, '-');
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

state.enviosMoto = [];
state.enviosCorreo = [];
state.enviosConfig = { umbralMoto: 20000 };
state.enviosBusqueda = '';

// ── carga inicial (una sola vez) ──
window.enviosCargarLista = async function () {
  const ok = await confirm2('¿Cargar la lista de 152 localidades?', 'Se crean una sola vez, después las editás libremente desde acá.', 'Cargar', 'var(--blue)');
  if (!ok) return;
  try {
    const batch = writeBatch(db);
    MOTOMENSAJERIA_INICIAL.forEach((m) => {
      batch.set(doc(db, 'envios_motomensajeria', slug(m.localidad)), {
        localidad: m.localidad, costo: m.costo, precio: m.costo,
        estimado: !!m.estimado, notas: m.notas || null,
      });
    });
    await batch.commit();
    toast('Lista de motomensajería cargada ✓', 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ── edición motomensajería ──
window.enviosEditarMoto = async function (id, campo, valor) {
  const data = campo === 'notas' ? (valor.trim() || null) : (parseFloat(valor) || 0);
  try { await updateDoc(doc(db, 'envios_motomensajeria', id), { [campo]: data }); }
  catch (e) { toast('Error: ' + e.message, 'error'); }
};
window.enviosAgregarLocalidad = async function () {
  const nombre = prompt('Nombre de la localidad:'); if (!nombre?.trim()) return;
  const id = slug(nombre);
  if (state.enviosMoto.find((m) => m.id === id)) { toast('Esa localidad ya está en la lista.', 'error'); return; }
  try {
    await setDoc(doc(db, 'envios_motomensajeria', id), { localidad: nombre.trim(), costo: 0, precio: 0, estimado: false, notas: null });
    toast('Localidad agregada — completá el costo ✓', 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};
window.enviosBorrarLocalidad = async function (id, nombre) {
  const ok = await confirm2('¿Eliminar localidad?', `Se quita "${nombre}" de la lista de envíos.`); if (!ok) return;
  try { await deleteDoc(doc(db, 'envios_motomensajeria', id)); toast('Localidad eliminada'); }
  catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ── umbral configurable ──
window.enviosSetUmbral = async function (valor) {
  const umbral = parseFloat(valor) || 0;
  try { await setDoc(doc(db, 'envios_config', 'config'), { umbralMoto: umbral }, { merge: true }); }
  catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ── Correo Argentino (tabla propia, la completa Diego a mano) ──
window.enviosAgregarCorreo = async function () {
  try {
    await addDoc(collection(db, 'envios_correo_argentino'), { zona: 'Nueva zona', pesoDesde: 0, pesoHasta: 1, precio: 0, notas: null, orden: Date.now() });
    toast('Fila agregada — completala ✓', 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};
window.enviosEditarCorreo = async function (id, campo, valor) {
  const data = (campo === 'zona' || campo === 'notas') ? (valor.trim() || (campo === 'zona' ? 'Sin nombre' : null)) : (parseFloat(valor) || 0);
  try { await updateDoc(doc(db, 'envios_correo_argentino', id), { [campo]: data }); }
  catch (e) { toast('Error: ' + e.message, 'error'); }
};
window.enviosBorrarCorreo = async function (id) {
  const ok = await confirm2('¿Eliminar fila?', 'Se quita esta zona/peso de la tabla de Correo Argentino.'); if (!ok) return;
  try { await deleteDoc(doc(db, 'envios_correo_argentino', id)); toast('Fila eliminada'); }
  catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ── buscador ──
window.enviosBuscar = function (v) { state.enviosBusqueda = v; renderEnvios(); };

// ── sincroniza "envios_publico" (localidad + precio al cliente, NUNCA el costo) ──
// Es lo único que puede leer el sitio de ventas. Corre sola cada vez que cambia la tabla.
let enviosPublicadosIds = new Set();
let enviosSyncTimer = null;
async function enviosPublicoSync() {
  const deseados = new Map(state.enviosMoto.map((m) => [m.id, { localidad: m.localidad, precio: m.precio || 0, estimado: !!m.estimado }]));
  const batch = writeBatch(db);
  let cambios = 0;
  for (const [id, datos] of deseados) { batch.set(doc(db, 'envios_publico', id), datos); cambios++; }
  for (const idViejo of enviosPublicadosIds) if (!deseados.has(idViejo)) { batch.delete(doc(db, 'envios_publico', idViejo)); cambios++; }
  if (cambios) await batch.commit();
}
function enviosPublicoRefresh() {
  clearTimeout(enviosSyncTimer);
  enviosSyncTimer = setTimeout(() => { enviosPublicoSync().catch((e) => console.error('Error sincronizando envíos públicos:', e)); }, 500);
}

// ── dibujo ──
const inp = (v, extra = '') => `style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);padding:6px 8px;border-radius:6px;font-size:.8rem;font-family:inherit;${extra}"`;

window.renderEnvios = function () {
  const cont = $('envios-moto-body'); if (!cont) return;
  const q = state.enviosBusqueda.toLowerCase().trim();

  if (!state.enviosMoto.length) {
    cont.innerHTML = `<div class="empty" style="padding:24px"><div class="empty-icon">🚚</div><p>Todavía no cargaste la lista de localidades.</p><button class="btn btn-gold" onclick="enviosCargarLista()" style="margin-top:10px">📥 Cargar lista de 152 localidades</button></div>`;
  } else {
    const umbral = state.enviosConfig.umbralMoto || 0;
    const filas = state.enviosMoto.filter((m) => !q || m.localidad.toLowerCase().includes(q)).sort((a, b) => a.localidad.localeCompare(b.localidad, 'es'));
    cont.innerHTML = filas.length ? `<div class="table-scroll"><table>
      <thead><tr><th>Localidad</th><th>Costo mensajería</th><th>Precio al cliente</th><th>Notas</th><th></th></tr></thead>
      <tbody>${filas.map((m) => `<tr>
        <td>${esc(m.localidad)}${m.estimado ? ' <span class="badge b-may" style="font-size:.62rem">≈ Estimado</span>' : ''}${m.costo > umbral && umbral > 0 ? '<div style="font-size:.66rem;color:var(--warning);margin-top:3px">💡 Conviene mirar Correo Argentino</div>' : ''}</td>
        <td><input type="number" min="0" value="${m.costo || ''}" onchange="enviosEditarMoto('${m.id}','costo',this.value)" ${inp('', 'width:90px')}></td>
        <td><input type="number" min="0" value="${m.precio || ''}" onchange="enviosEditarMoto('${m.id}','precio',this.value)" ${inp('', 'width:90px')}></td>
        <td><input type="text" value="${esc(m.notas || '')}" placeholder="—" onchange="enviosEditarMoto('${m.id}','notas',this.value)" ${inp('', 'width:100%;min-width:140px')}></td>
        <td><button class="btn-ghost btn" onclick="enviosBorrarLocalidad('${m.id}','${esc(m.localidad)}')" title="Eliminar">🗑</button></td>
      </tr>`).join('')}</tbody>
    </table></div>` : `<div class="empty" style="padding:20px"><p>Ninguna localidad coincide con "${esc(state.enviosBusqueda)}".</p></div>`;
  }

  const contC = $('envios-correo-body'); if (!contC) return;
  const filasC = [...state.enviosCorreo].sort((a, b) => (a.orden || 0) - (b.orden || 0));
  contC.innerHTML = `<div class="table-scroll"><table>
    <thead><tr><th>Zona / provincia</th><th>Peso desde (kg)</th><th>Peso hasta (kg)</th><th>Precio</th><th>Notas</th><th></th></tr></thead>
    <tbody>${filasC.length ? filasC.map((c) => `<tr>
      <td><input type="text" value="${esc(c.zona)}" onchange="enviosEditarCorreo('${c.id}','zona',this.value)" ${inp('', 'width:100%;min-width:120px')}></td>
      <td><input type="number" min="0" step="0.1" value="${c.pesoDesde ?? ''}" onchange="enviosEditarCorreo('${c.id}','pesoDesde',this.value)" ${inp('', 'width:80px')}></td>
      <td><input type="number" min="0" step="0.1" value="${c.pesoHasta ?? ''}" onchange="enviosEditarCorreo('${c.id}','pesoHasta',this.value)" ${inp('', 'width:80px')}></td>
      <td><input type="number" min="0" value="${c.precio || ''}" onchange="enviosEditarCorreo('${c.id}','precio',this.value)" ${inp('', 'width:90px')}></td>
      <td><input type="text" value="${esc(c.notas || '')}" placeholder="—" onchange="enviosEditarCorreo('${c.id}','notas',this.value)" ${inp('', 'width:100%;min-width:120px')}></td>
      <td><button class="btn-ghost btn" onclick="enviosBorrarCorreo('${c.id}')" title="Eliminar">🗑</button></td>
    </tr>`).join('') : `<tr><td colspan="6"><div class="empty" style="padding:16px"><p>Todavía no cargaste zonas. Mirá los precios en el cotizador público de <strong>correoargentino.com.ar</strong> (no hace falta cuenta) y cargalos acá.</p></div></td></tr>`}</tbody>
  </table></div>`;

  const umbralInput = $('envios-umbral');
  if (umbralInput && document.activeElement !== umbralInput) umbralInput.value = state.enviosConfig.umbralMoto || '';
};

// ── listeners ──
window.enviosIniciar = function () {
  onSnapshot(collection(db, 'envios_motomensajeria'), (snap) => {
    state.enviosMoto = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderEnvios();
    enviosPublicoRefresh();
  }, () => {});
  onSnapshot(collection(db, 'envios_publico'), (snap) => {
    enviosPublicadosIds = new Set(snap.docs.map((d) => d.id));
  }, () => {});
  onSnapshot(collection(db, 'envios_correo_argentino'), (snap) => {
    state.enviosCorreo = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderEnvios();
  }, () => {});
  onSnapshot(doc(db, 'envios_config', 'config'), (snap) => {
    if (snap.exists()) state.enviosConfig = snap.data();
    renderEnvios();
  }, () => {});
};
