import { state } from './state.js';
import { db, doc, setDoc } from './firebase-config.js';
import { MENSAJE_DEFECTO, MAX_MENSAJE, armarLink, estadoDe, textoEstado, camposActivar, camposDesactivar, camposMensaje, camposClave, generarClave } from './mantenimiento.js';

// ══════════════════════════════════════════
// TARJETA "MODO MANTENIMIENTO" en Catálogo y sitio (debajo de la configuración del sitio).
// Interruptor (con confirmación), mensaje para los clientes, clave de acceso ("Generar nueva") y "Copiar link de acceso".
// Escribe SOLO en config_sitio/config, con merge, los campos mantenimiento, mantenimientoMensaje y mantenimientoClave.
// La lógica pura (claves, link, campos a guardar) está en mantenimiento.js. La tienda lee estos campos en vivo.
// ══════════════════════════════════════════

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Dependencias (se pueden reemplazar en las pruebas del navegador sin tocar Firestore real).
export const deps = {
  leer: () => state.configSitio || {},
  guardar: (data) => setDoc(doc(db, 'config_sitio', 'config'), data, { merge: true }),
  confirmar: (titulo, msg, ok, color) => window.confirm2(titulo, msg, ok, color),
  avisar: (msg, tipo) => window.toast && window.toast(msg, tipo),
  copiar: async (texto) => {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return; }
    const t = document.createElement('textarea'); t.value = texto; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, texto.length);
    const ok = document.execCommand && document.execCommand('copy'); t.remove();
    if (!ok) throw new Error('No se pudo copiar');
  },
};

let raiz = null;
const $ = (id) => document.getElementById(id);

export function montarMantenimiento(cont) {
  raiz = cont;
  cont.innerHTML = `
  <div class="panel mant-adm" id="mant-panel" style="margin-top:18px">
    <div class="panel-head">
      <h2>🛠️ Modo mantenimiento</h2>
      <span class="mant-adm-estado apagado" id="mant-estado" role="status" aria-live="polite">DESACTIVADO</span>
    </div>
    <div class="panel-body">
      <p class="mant-adm-ayuda">Cuando lo activás, la tienda pública muestra una pantalla de «En mantenimiento»: nadie puede ver el catálogo ni usar el carrito. Vos entrás igual con el link de acceso. Si Firestore no responde, la tienda queda abierta.</p>
      <div class="mant-adm-aviso" id="mant-aviso">⚠️ La tienda está en mantenimiento ahora mismo: los clientes ven la pantalla de aviso.</div>
      <div class="mant-adm-fila"><button type="button" class="btn mant-adm-toggle" id="mant-toggle">Activar mantenimiento</button></div>
      <div class="field">
        <label for="mant-mensaje">Mensaje que ven los clientes</label>
        <textarea id="mant-mensaje" maxlength="${MAX_MENSAJE}" placeholder="${esc(MENSAJE_DEFECTO)}"></textarea>
        <div class="mant-adm-pie"><button type="button" class="btn" id="mant-guardar-msg">Guardar mensaje</button><span style="font-size:.7rem;color:var(--muted)">Si lo dejás vacío se usa: «${esc(MENSAJE_DEFECTO)}»</span></div>
      </div>
      <div class="field">
        <label for="mant-clave">Clave de acceso (para entrar vos)</label>
        <div class="mant-adm-clave"><input type="text" id="mant-clave" readonly placeholder="Se genera al activar o con «Generar nueva»" autocomplete="off"><button type="button" class="btn" id="mant-generar">Generar nueva</button></div>
        <div class="mant-adm-pie"><button type="button" class="btn btn-gold" id="mant-copiar">📋 Copiar link de acceso</button></div>
        <span class="mant-adm-link" id="mant-link"></span>
      </div>
      <span id="mant-estado-msg" style="font-size:.78rem;color:var(--muted)"></span>
    </div>
  </div>`;
  $('mant-toggle').addEventListener('click', alternar);
  $('mant-guardar-msg').addEventListener('click', guardarMensaje);
  $('mant-generar').addEventListener('click', generarNueva);
  $('mant-copiar').addEventListener('click', copiarLink);
  render();
}

// Dibuja el estado actual (no pisa el mensaje mientras se está escribiendo).
export function render() {
  if (!raiz || !$('mant-panel')) return;
  const e = estadoDe(deps.leer());
  $('mant-panel').classList.toggle('on', e.activo);
  const est = $('mant-estado'); est.textContent = textoEstado(e.activo); est.className = 'mant-adm-estado ' + (e.activo ? 'activo' : 'apagado');
  const t = $('mant-toggle'); t.textContent = e.activo ? 'Desactivar mantenimiento' : 'Activar mantenimiento'; t.className = 'btn mant-adm-toggle ' + (e.activo ? 'apagar' : 'encender');
  const m = $('mant-mensaje'); if (document.activeElement !== m) m.value = e.mensaje || MENSAJE_DEFECTO;
  $('mant-clave').value = e.clave;
  $('mant-link').textContent = e.clave ? armarLink(e.clave) : '';
}

function resultado(ok, texto) {
  const s = $('mant-estado-msg'); if (!s) return;
  s.style.color = ok ? 'var(--success)' : 'var(--danger)'; s.textContent = texto;
  setTimeout(() => { if (s.textContent === texto) s.textContent = ''; }, 6000);
}
async function escribir(data, okTexto) {
  try { await deps.guardar(data); resultado(true, okTexto); return true; }
  catch (e) { resultado(false, 'Error: ' + (e && e.message ? e.message : e)); deps.avisar('No se pudo guardar: ' + (e && e.message ? e.message : e), 'error'); return false; }
}

async function alternar() {
  const e = estadoDe(deps.leer());
  const btn = $('mant-toggle');
  if (!e.activo) {
    const ok = await deps.confirmar('Activar modo mantenimiento', 'La tienda pública va a mostrar «En mantenimiento»: nadie podrá ver el catálogo ni usar el carrito. Vos podés entrar con el link de acceso.', 'Activar', 'var(--danger)');
    if (!ok) return;
    btn.disabled = true;
    await escribir(camposActivar({ mensaje: $('mant-mensaje').value, clave: e.clave }), 'Mantenimiento ACTIVADO ✓ — la tienda ya muestra la pantalla de aviso.');
  } else {
    const ok = await deps.confirmar('Desactivar modo mantenimiento', 'La tienda vuelve a abrirse a todos los clientes.', 'Desactivar', 'var(--success)');
    if (!ok) return;
    btn.disabled = true;
    await escribir(camposDesactivar(), 'Mantenimiento DESACTIVADO ✓ — la tienda está abierta.');
  }
  btn.disabled = false; render();
}
async function guardarMensaje() {
  await escribir(camposMensaje($('mant-mensaje').value), 'Mensaje guardado ✓');
  render();
}
async function generarNueva() {
  const e = estadoDe(deps.leer());
  if (e.clave) {
    const ok = await deps.confirmar('Generar nueva clave', e.activo ? 'Los links de acceso anteriores dejan de funcionar. Vas a necesitar el link nuevo para entrar a la tienda en mantenimiento.' : 'Los links de acceso anteriores dejan de funcionar.', 'Generar', 'var(--accent)');
    if (!ok) return;
  }
  await escribir(camposClave(generarClave()), 'Clave nueva guardada ✓ — copiá el link de acceso.');
  render();
}
async function copiarLink() {
  const clave = estadoDe(deps.leer()).clave;
  if (!clave) { resultado(false, 'Primero generá una clave (botón «Generar nueva»).'); deps.avisar('Primero generá una clave', 'error'); return; }
  try { await deps.copiar(armarLink(clave)); resultado(true, 'Link de acceso copiado ✓'); deps.avisar('Link de acceso copiado'); }
  catch (e) { resultado(false, 'No se pudo copiar. Seleccioná el link de abajo y copialo a mano.'); }
}

// Se monta sola en #mant-root (index.html) y la redibuja config.js cuando llega config_sitio/config.
const root = typeof document !== 'undefined' ? document.getElementById('mant-root') : null;
if (root) montarMantenimiento(root);
if (typeof window !== 'undefined') window.mantRender = render;
