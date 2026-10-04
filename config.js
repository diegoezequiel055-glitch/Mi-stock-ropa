import { state } from './state.js';
import { db, doc, setDoc, onSnapshot } from './firebase-config.js';

// ══════════════════════════════════════════
// CONFIGURACIÓN DEL SITIO PÚBLICO — un solo documento (config_sitio/config)
// con los textos editables de tiendapremium (título, subtítulo, etc.).
// Es público de lectura (son solo textos de marketing, nada sensible);
// la escritura queda restringida al dueño, igual que el resto de la app.
// ══════════════════════════════════════════

const CAMPOS = {
  heroTitulo: 'cfg-hero-titulo',
  heroSubtitulo: 'cfg-hero-subtitulo',
  promoBarra: 'cfg-promo-barra',
  bandaNegra: 'cfg-banda-negra',
  whatsappMensaje: 'cfg-whatsapp-mensaje',
};

window.configIniciar = function () {
  onSnapshot(doc(db, 'config_sitio', 'config'), (snap) => {
    state.configSitio = snap.exists() ? snap.data() : {};
    if (document.getElementById('tab-config')?.classList.contains('active')) renderConfigSitio();
  }, () => {});
};

window.renderConfigSitio = function () {
  const cfg = state.configSitio || {};
  Object.entries(CAMPOS).forEach(([campo, elId]) => {
    const el = document.getElementById(elId);
    if (el && document.activeElement !== el) el.value = cfg[campo] || '';
  });
};

window.guardarConfigSitio = async function () {
  const btn = document.getElementById('cfg-guardar-btn');
  const estado = document.getElementById('cfg-estado');
  const data = {};
  Object.entries(CAMPOS).forEach(([campo, elId]) => {
    data[campo] = document.getElementById(elId).value.trim() || null;
  });
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    await setDoc(doc(db, 'config_sitio', 'config'), data, { merge: true });
    estado.style.color = 'var(--success)';
    estado.textContent = 'Guardado ✓ — ya se está actualizando en la tienda pública.';
  } catch (e) {
    estado.style.color = 'var(--danger)';
    estado.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = '💾 Guardar cambios';
    setTimeout(() => { if (estado) estado.textContent = ''; }, 5000);
  }
};
