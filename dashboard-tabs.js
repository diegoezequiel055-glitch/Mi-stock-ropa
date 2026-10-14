// Sub-pestañas del Dashboard (Resumen / Ventas / Productos / Finanzas).
// dashboard.js arma los 4 paneles (.db-pane) dentro de #db-body; acá solo se elige cuál se ve.
// El período (Este mes, etc.) vive en state.dbPeriodo y no se toca al cambiar de pestaña.
const PESTANAS = [
  { k: 'resumen', t: 'Resumen' },
  { k: 'ventas', t: 'Ventas' },
  { k: 'productos', t: 'Productos' },
  { k: 'finanzas', t: 'Finanzas' },
];
const CLAVE = 'stockmgr_db_pestana';
let actual = 'resumen';

try {
  const g = localStorage.getItem(CLAVE);
  if (PESTANAS.some((p) => p.k === g)) actual = g;
} catch (e) { /* sin almacenamiento: arranca en Resumen */ }

// Los montos no se parten en dos líneas: si no entran, se achica la letra hasta que entren.
function ajustarNumeros() {
  document.querySelectorAll('#db-body .db-pane .db-tile-v, #db-body .db-pane .db-hero-v').forEach((el) => {
    if (!el.offsetParent) return; // panel oculto: no se puede medir
    el.style.fontSize = '';
    let px = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && px > 11) { px -= 1; el.style.fontSize = px + 'px'; }
  });
}

window.dbAplicarPestana = function () {
  document.querySelectorAll('#db-body .db-pane').forEach((p) => {
    p.style.display = p.dataset.pane === actual ? 'block' : 'none';
  });
  document.querySelectorAll('#db-tabs .db-subtab').forEach((b) => {
    const on = b.dataset.pane === actual;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  if (actual === 'ventas' && window.dbPintarEvolucion) dbPintarEvolucion();
  ajustarNumeros();
};

window.dbSetPestana = function (k) {
  if (!PESTANAS.some((p) => p.k === k)) return;
  actual = k;
  try { localStorage.setItem(CLAVE, k); } catch (e) { /* no pasa nada si no se puede recordar */ }
  dbAplicarPestana();
  const btn = document.querySelector(`#db-tabs .db-subtab[data-pane="${k}"]`);
  if (btn && btn.scrollIntoView) btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};

const cont = document.getElementById('db-tabs');
if (cont) {
  cont.innerHTML = PESTANAS.map((p) => `<button class="db-subtab" role="tab" data-pane="${p.k}" onclick="dbSetPestana('${p.k}')">${p.t}</button>`).join('');
  dbAplicarPestana();
}
window.addEventListener('resize', () => { clearTimeout(window._dbTabsT); window._dbTabsT = setTimeout(ajustarNumeros, 200); });
