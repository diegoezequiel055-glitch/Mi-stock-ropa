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
    if (document.getElementById('tab-catalogo')?.classList.contains('active')) renderConfigSitio();
  }, () => {});
};

window.renderConfigSitio = function () {
  const cfg = state.configSitio || {};
  Object.entries(CAMPOS).forEach(([campo, elId]) => {
    const el = document.getElementById(elId);
    if (el && document.activeElement !== el) el.value = cfg[campo] || '';
  });
  renderHeroFotos();
};

// ── fotos del inicio (tríptico): 3 fotos sueltas, elegidas a mano, no ligadas a ningún producto ──
function renderHeroFotos() {
  const cont = document.getElementById('cfg-hero-fotos'); if (!cont) return;
  const fotos = state.configSitio?.heroFotos || [null, null, null];
  cont.innerHTML = [0, 1, 2].map((i) => {
    const url = fotos[i];
    return `<div style="display:flex;flex-direction:column;gap:6px;align-items:center;width:100px">
      <div style="width:100px;height:125px;border-radius:8px;overflow:hidden;background:var(--surface3);border:1px solid var(--border2);display:flex;align-items:center;justify-content:center">
        ${url ? `<img src="${url}" style="width:100%;height:100%;object-fit:cover">` : `<span style="font-size:.65rem;color:var(--muted);text-align:center;padding:4px">Foto ${i + 1}</span>`}
      </div>
      <input type="file" accept="image/*" id="cfg-hero-foto-input-${i}" onchange="heroFotoSeleccionada(${i},this.files[0])" style="width:100px;font-size:.6rem">
      ${url ? `<button class="btn btn-ghost btn-sm" onclick="heroFotoQuitar(${i})" style="font-size:.65rem;padding:3px 8px">Quitar</button>` : ''}
      <span id="cfg-hero-foto-estado-${i}" style="font-size:.6rem;color:var(--muted);text-align:center"></span>
    </div>`;
  }).join('');
}

window.heroFotoSeleccionada = async function (idx, file) {
  if (!file) return;
  const input = document.getElementById(`cfg-hero-foto-input-${idx}`);
  const estado = document.getElementById(`cfg-hero-foto-estado-${idx}`);
  estado.style.color = 'var(--muted)'; estado.textContent = 'Subiendo...';
  try {
    const url = await subirFotoGenerica(file);
    const actuales = [...(state.configSitio?.heroFotos || [null, null, null])];
    actuales[idx] = url;
    await setDoc(doc(db, 'config_sitio', 'config'), { heroFotos: actuales }, { merge: true });
    estado.style.color = 'var(--success)'; estado.textContent = 'Guardada ✓';
    setTimeout(() => { if (estado) estado.textContent = ''; }, 3000);
  } catch (e) {
    estado.style.color = 'var(--danger)'; estado.textContent = e.message;
  } finally {
    if (input) input.value = '';
  }
};
window.heroFotoQuitar = async function (idx) {
  const actuales = [...(state.configSitio?.heroFotos || [null, null, null])];
  actuales[idx] = null;
  try { await setDoc(doc(db, 'config_sitio', 'config'), { heroFotos: actuales }, { merge: true }); }
  catch (e) { toast('Error: ' + e.message, 'error'); }
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
