import { state } from './state.js';

// Menú "⋯ Más": agrupa las pestañas de uso ocasional (Cobros, Reservas, Envíos, Catálogo y sitio).
// Las pestañas siguen siendo las mismas: el menú solo llama a showTab().
const MAS_TABS = ['cobros', 'reservas', 'envios', 'catalogo'];

function masMenu(){ return document.getElementById('mas-menu'); }
function masBtn(){ return document.getElementById('tab-mas-btn'); }

window.closeMasMenu = function(){
  const m = masMenu(); if (!m) return;
  m.style.display = 'none';
  masBtn()?.setAttribute('aria-expanded', 'false');
};

window.toggleMasMenu = function(ev){
  if (ev) ev.stopPropagation();
  const m = masMenu(), b = masBtn(); if (!m || !b) return;
  if (m.style.display === 'flex') { closeMasMenu(); return; }
  m.style.display = 'flex';
  b.setAttribute('aria-expanded', 'true');
  // El nav tiene scroll horizontal (recortaría un menú absoluto): el panel va fijo, pegado al botón
  const r = b.getBoundingClientRect();
  const w = m.offsetWidth;
  m.style.top = Math.round(r.bottom) + 'px';
  m.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
};

// "Más" queda marcada si la pestaña abierta es una del menú
window.syncMasMenu = function(name){
  masBtn()?.classList.toggle('active', MAS_TABS.includes(name));
  closeMasMenu();
};

// Puntito/contador: planes de cuotas activos + reservas activas
window.updateMasBadge = function(){
  const el = document.getElementById('mas-badge'); if (!el) return;
  const now = Date.now();
  const cuotas = (state.cuotasData || []).filter(c => c.estado !== 'cobrado');
  const reservas = (state.reservasData || []).filter(r => r.estado !== 'cancelada');
  const total = cuotas.length + reservas.length;
  const urgente = reservas.some(r => r.vencimiento < now) ||
    cuotas.some(c => Array.isArray(c.cuotas) && c.cuotas.some(q => !q.pagada && q.vencimiento < now));
  el.style.display = total ? 'inline-block' : 'none';
  el.textContent = total || '';
  el.style.background = urgente ? 'var(--danger)' : 'var(--accent)';
  el.style.color = urgente ? '#fff' : '#080808';
  el.title = cuotas.length + ' plan(es) de cuotas y ' + reservas.length + ' reserva(s) activas';
};

document.addEventListener('click', (e) => {
  const m = masMenu();
  if (m && m.style.display === 'flex' && !m.contains(e.target) && !masBtn().contains(e.target)) closeMasMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMasMenu(); });
window.addEventListener('resize', closeMasMenu);
document.querySelector('nav')?.addEventListener('scroll', closeMasMenu);
