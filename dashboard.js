import { state } from './state.js';

// ══════════════════════════════════════════
// DASHBOARD — cálculos por período y dibujo
// Base de caja: una venta cuenta el día que se registra; una cuota, el día que se cobra.
// ══════════════════════════════════════════
const MS_DIA = 86400000;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ini = (y, m, d = 1) => new Date(y, m, d).getTime();
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const nombreMes = (y, m, largo = true) => new Date(y, m, 1).toLocaleDateString('es-AR', { month: largo ? 'long' : 'short' }).replace('.', '');
const dinero = (n) => (n < 0 ? '−$' : '$') + fmt(Math.abs(Math.round(n)));
const entero = (n) => fmt(Math.round(n));
const compacto = (n) => {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',')} M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)} mil`;
  return `${s}$${Math.round(a)}`;
};
const claveMes = (d) => d.getFullYear() * 12 + d.getMonth();

// ── períodos ──
window.dbPeriodo = function (kind, ahora = new Date()) {
  const y = ahora.getFullYear(), m = ahora.getMonth(), t = ahora.getTime();
  let desde, hasta, etiqueta, prevDesde = null, prevEtiqueta = '';
  if (kind === 'mes_ant') {
    desde = ini(y, m - 1); hasta = ini(y, m);
    etiqueta = cap(nombreMes(y, m - 1)) + ' ' + new Date(y, m - 1, 1).getFullYear();
    prevDesde = ini(y, m - 2); prevEtiqueta = nombreMes(y, m - 2);
  } else if (kind === '3m') {
    desde = ini(y, m - 2); hasta = ini(y, m + 1); etiqueta = 'Últimos 3 meses';
    prevDesde = ini(y, m - 5); prevEtiqueta = 'los 3 meses anteriores';
  } else if (kind === 'anio') {
    desde = ini(y, 0); hasta = ini(y + 1, 0); etiqueta = String(y);
    prevDesde = ini(y - 1, 0); prevEtiqueta = String(y - 1);
  } else if (kind === 'todo') {
    desde = primeraFecha(ini(y, m)); hasta = ini(y, m + 1); etiqueta = 'Todo el historial';
  } else {
    kind = 'mes';
    desde = ini(y, m); hasta = ini(y, m + 1); etiqueta = cap(nombreMes(y, m)) + ' ' + y;
    prevDesde = ini(y, m - 1); prevEtiqueta = nombreMes(y, m - 1);
  }
  // Comparación justa: el mismo tramo del período anterior (p. ej. días 1 al 19 vs días 1 al 19).
  const transcurrido = Math.min(ini(y, m, ahora.getDate() + 1), hasta) - desde;
  const prev = prevDesde == null ? null : { desde: prevDesde, hasta: Math.min(prevDesde + transcurrido, desde), etiqueta: prevEtiqueta };
  return { kind, desde, hasta, etiqueta, prev, tope: Math.min(ini(y, m, ahora.getDate() + 1), hasta) };
};

function primeraFecha(porDefecto) {
  const f = [...state.ventasData.map((v) => v.fecha), ...state.cuotasData.map((c) => c.createdAt), ...state.comprasData.map((c) => c.fecha), ...state.gastosData.map((g) => g.fecha)].filter((x) => Number.isFinite(x) && x > 0);
  return f.length ? Math.min(...f) : porDefecto;
}

// ── cálculos ──
const enRango = (desde, hasta) => (t) => t >= desde && t < hasta;
const cuotasCobradas = (desde, hasta) => {
  const en = enRango(desde, hasta), r = [];
  for (const c of state.cuotasData) for (const q of (Array.isArray(c.cuotas) ? c.cuotas : [])) {
    if (!q.pagada) continue;
    const t = q.fechaPago || c.createdAt;
    if (en(t)) r.push({ c, q, t, gan: c.pcosto && c.totalVenta > 0 ? q.monto * (1 - c.pcosto / c.totalVenta) : null });
  }
  return r;
};

window.dbResumen = function (desde, hasta) {
  const en = enRango(desde, hasta);
  let ingV = 0, ganV = 0, base = 0, unid = 0, n = 0;
  for (const v of state.ventasData) {
    if (!en(v.fecha)) continue;
    const s = v.pventa * v.cant;
    ingV += s; unid += v.cant; n++;
    if (v.pcosto) { ganV += (v.pventa - v.pcosto) * v.cant; base += s; }
  }
  let ingC = 0, ganC = 0;
  for (const p of cuotasCobradas(desde, hasta)) { ingC += p.q.monto; if (p.gan != null) { ganC += p.gan; base += p.q.monto; } }
  for (const c of state.cuotasData) if (en(c.createdAt)) { n++; unid += c.cant || 1; }
  const ingresos = ingV + ingC, ganancia = ganV + ganC;
  return { ingV, ingC, ingresos, ganV, ganC, ganancia, margen: base > 0 ? ganancia / base * 100 : 0, nVentas: n, unidades: unid, ticket: n ? ingresos / n : 0 };
};

function serie(per) {
  const dias = (per.hasta - per.desde) / MS_DIA;
  const gran = dias <= 62 ? 'dia' : dias <= 200 ? 'semana' : 'mes';
  const b = [];
  if (gran === 'dia') {
    for (let t = per.desde; t < per.tope;) {
      const d = new Date(t), next = ini(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      b.push({ desde: t, hasta: next, label: String(d.getDate()), full: cap(d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })) });
      t = next;
    }
  } else if (gran === 'semana') {
    const d0 = new Date(per.desde);
    for (let t = ini(d0.getFullYear(), d0.getMonth(), d0.getDate() - ((d0.getDay() + 6) % 7)); t < per.tope;) {
      const d = new Date(t), next = ini(d.getFullYear(), d.getMonth(), d.getDate() + 7);
      const desde = Math.max(t, per.desde), hasta = Math.min(next, per.hasta);
      const fin = new Date(hasta - 1);
      b.push({ desde, hasta, label: `${new Date(desde).getDate()}/${new Date(desde).getMonth() + 1}`, full: `Semana del ${new Date(desde).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} al ${fin.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}` });
      t = next;
    }
  } else {
    const d0 = new Date(per.desde);
    for (let y = d0.getFullYear(), m = d0.getMonth(); ini(y, m) < per.tope; m++) {
      if (m > 11) { y++; m = 0; }
      b.push({ desde: Math.max(ini(y, m), per.desde), hasta: Math.min(ini(y, m + 1), per.hasta), label: nombreMes(y, m, false) + (m === 0 ? ' ' + String(y).slice(2) : ''), full: cap(nombreMes(y, m)) + ' ' + y });
    }
  }
  b.forEach((x) => Object.assign(x, { ing: 0, gan: 0, n: 0 }));
  const donde = (t) => b.find((x) => t >= x.desde && t < x.hasta);
  for (const v of state.ventasData) {
    const x = v.fecha >= per.desde && v.fecha < per.hasta && donde(v.fecha);
    if (!x) continue;
    x.ing += v.pventa * v.cant; x.n++;
    if (v.pcosto) x.gan += (v.pventa - v.pcosto) * v.cant;
  }
  for (const p of cuotasCobradas(per.desde, per.hasta)) { const x = donde(p.t); if (x) { x.ing += p.q.monto; if (p.gan != null) x.gan += p.gan; } }
  for (const c of state.cuotasData) { const x = c.createdAt >= per.desde && c.createdAt < per.hasta && donde(c.createdAt); if (x) x.n++; }
  return { gran, buckets: b };
}

const ETIQ_TIPO = { minorista: 'Menor', mayorista: 'Mayorista', curva: 'Curva', multiple: 'Lote (antiguo)' };
const ORDEN_TIPO = ['Menor', 'Mayorista', 'Curva', 'Lote (antiguo)', 'Cuotas'];
function porTipo(desde, hasta) {
  const en = enRango(desde, hasta), m = new Map();
  const add = (k, ing, u) => { const o = m.get(k) || { k, ing: 0, unid: 0 }; o.ing += ing; o.unid += u; m.set(k, o); };
  for (const v of state.ventasData) if (en(v.fecha)) add(ETIQ_TIPO[v.tipo] || 'Menor', v.pventa * v.cant, v.cant);
  for (const p of cuotasCobradas(desde, hasta)) add('Cuotas', p.q.monto, 0);
  for (const c of state.cuotasData) if (en(c.createdAt)) add('Cuotas', 0, c.cant || 1);
  return ORDEN_TIPO.map((k) => m.get(k)).filter(Boolean);
}

function agrupar(desde, hasta, clave) {
  const en = enRango(desde, hasta), g = new Map();
  const get = (o) => { const k = clave(o); if (!g.has(k)) g.set(k, { k, cat: o.cat, modelo: o.modelo, color: o.color || '', unid: 0, ing: 0, gan: 0 }); return g.get(k); };
  for (const v of state.ventasData) if (en(v.fecha)) { const x = get(v); x.unid += v.cant; x.ing += v.pventa * v.cant; if (v.pcosto) x.gan += (v.pventa - v.pcosto) * v.cant; }
  for (const c of state.cuotasData) if (en(c.createdAt)) get(c).unid += c.cant || 1;
  for (const p of cuotasCobradas(desde, hasta)) { const x = get(p.c); x.ing += p.q.monto; if (p.gan != null) x.gan += p.gan; }
  return [...g.values()];
}

function clientes(desde, hasta) {
  const en = enRango(desde, hasta), m = new Map();
  const add = (nombre, monto) => { const k = String(nombre || '').trim(); if (!k) return; const key = k.toLowerCase(); const o = m.get(key) || { nombre: k, monto: 0, veces: 0 }; o.monto += monto; o.veces++; m.set(key, o); };
  for (const v of state.ventasData) if (en(v.fecha)) add(v.cliente, v.pventa * v.cant);
  for (const p of cuotasCobradas(desde, hasta)) add(p.c.cliente, p.q.monto);
  return [...m.values()].sort((a, b) => b.monto - a.monto);
}

function resumenStock() {
  const s = state.stockData;
  const porCat = new Map();
  s.forEach((p) => porCat.set(p.cat, (porCat.get(p.cat) || 0) + p.qty));
  return {
    unidades: s.reduce((a, p) => a + p.qty, 0), referencias: s.length,
    valorCosto: s.filter((p) => p.pcosto && p.qty > 0).reduce((a, p) => a + p.pcosto * p.qty, 0),
    valorVenta: s.filter((p) => p.pventa && p.qty > 0).reduce((a, p) => a + p.pventa * p.qty, 0),
    sinCosto: s.filter((p) => !p.pcosto).length, sinPrecio: s.filter((p) => !p.pventa).length,
    agotados: s.filter((p) => p.qty === 0).length, ultima: s.filter((p) => p.qty === 1).length,
    porCat: [...porCat.entries()].map(([k, v]) => ({ k, v })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v),
  };
}

function cobros(ahora) {
  const t = ahora.getTime(), en7 = t + 7 * MS_DIA;
  let porCobrar = 0, vencido = 0, prox = 0, planes = 0, nVenc = 0;
  for (const c of state.cuotasData) {
    const pend = (Array.isArray(c.cuotas) ? c.cuotas : []).filter((q) => !q.pagada);
    if (!pend.length) continue;
    planes++;
    let tieneVenc = false;
    for (const q of pend) {
      porCobrar += q.monto;
      if (q.vencimiento < t) { vencido += q.monto; tieneVenc = true; }
      else if (q.vencimiento < en7) prox += q.monto;
    }
    if (tieneVenc) nVenc++;
  }
  return { porCobrar, vencido, prox, planes, nVenc };
}

// ── piezas de HTML ──
function delta(cur, prev, etiq, puntos) {
  if (!prev) return '';
  if (puntos) { const d = cur - prev.v; if (Math.abs(d) < 0.05) return `<span class="db-delta">= <em>vs ${esc(etiq)}</em></span>`; return `<span class="db-delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1).replace('.', ',')} pts <em>vs ${esc(etiq)}</em></span>`; }
  if (prev.v === 0) return cur === 0 ? '' : `<span class="db-delta"><em>sin datos en ${esc(etiq)}</em></span>`;
  const p = (cur - prev.v) / Math.abs(prev.v) * 100;
  if (Math.abs(p) < 0.5) return `<span class="db-delta">= <em>vs ${esc(etiq)}</em></span>`;
  return `<span class="db-delta ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${entero(Math.abs(p))} % <em>vs ${esc(etiq)}</em></span>`;
}

const tile = (label, valor, extra = '') => `<div class="db-tile"><div class="db-tile-l">${label}</div><div class="db-tile-v">${valor}</div>${extra ? `<div class="db-tile-x">${extra}</div>` : ''}</div>`;
const card = (titulo, cuerpo, nota = '') => `<section class="db-card"><h3>${titulo}</h3>${nota ? `<p class="db-nota">${nota}</p>` : ''}${cuerpo}</section>`;

function barras(filas, { formato = dinero, vacio = 'Sin datos en este período.', sub } = {}) {
  if (!filas.length) return `<p class="db-vacio">${vacio}</p>`;
  const max = Math.max(...filas.map((f) => f.v), 1);
  return `<div class="db-bars">${filas.map((f) => `<div class="db-row"><div class="db-row-l" title="${esc(f.k)}">${esc(f.k)}${f.sub ? `<span>${esc(f.sub)}</span>` : ''}</div><div class="db-track"><div class="db-fill" style="width:${Math.max(2, f.v / max * 100)}%"></div></div><div class="db-row-v">${formato(f.v)}</div></div>`).join('')}</div>`;
}

// ── gráfico de evolución (SVG) ──
const nice = (x) => { const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
function escala(min, max) {
  const paso = nice(((max - min) || 1) / 4);
  const lo = Math.floor(min / paso) * paso, hi = Math.ceil(max / paso) * paso, ticks = [];
  for (let v = lo; v <= hi + paso / 1000; v += paso) ticks.push(Math.round(v));
  return { lo, hi: hi === lo ? lo + paso : hi, ticks };
}

function svgEvolucion(b, W) {
  const H = 240, ml = 54, mr = 10, mt = 12, mb = 30, iw = Math.max(120, W - ml - mr), ih = H - mt - mb;
  const maxV = Math.max(0, ...b.map((x) => Math.max(x.ing, x.gan))), minV = Math.min(0, ...b.map((x) => x.gan));
  const sc = escala(minV, maxV === 0 && minV === 0 ? 1000 : maxV);
  const Y = (v) => mt + ih - (v - sc.lo) / (sc.hi - sc.lo) * ih;
  const bw = iw / b.length, barW = Math.min(24, Math.max(3, bw * 0.62)), r0 = Y(0);
  const cx = (i) => ml + i * bw + bw / 2;
  let s = `<svg class="db-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos y ganancia por ${b.length} períodos">`;
  sc.ticks.forEach((t) => { s += `<line class="db-grid" x1="${ml}" x2="${W - mr}" y1="${Y(t)}" y2="${Y(t)}"/><text class="db-tick" x="${ml - 8}" y="${Y(t) + 4}" text-anchor="end">${compacto(t)}</text>`; });
  s += `<line class="db-base" x1="${ml}" x2="${W - mr}" y1="${r0}" y2="${r0}"/>`;
  b.forEach((x, i) => {
    if (x.ing <= 0) return;
    const y1 = Y(x.ing), h = r0 - y1, r = Math.min(4, h, barW / 2), x0 = cx(i) - barW / 2;
    s += `<path class="db-bar" d="M${x0},${r0} V${y1 + r} Q${x0},${y1} ${x0 + r},${y1} H${x0 + barW - r} Q${x0 + barW},${y1} ${x0 + barW},${y1 + r} V${r0} Z"/>`;
  });
  const pts = b.map((x, i) => `${cx(i)},${Y(x.gan)}`);
  if (b.length > 1) s += `<polyline class="db-line" points="${pts.join(' ')}"/>`;
  const ult = b.length - 1;
  s += `<circle class="db-dot" cx="${cx(ult)}" cy="${Y(b[ult].gan)}" r="4"/>`;
  const paso = Math.max(1, Math.ceil(b.length / Math.max(2, Math.floor(iw / 44))));
  b.forEach((x, i) => { if (i % paso === 0) s += `<text class="db-tick" x="${cx(i)}" y="${H - 8}" text-anchor="middle">${esc(x.label)}</text>`; });
  b.forEach((x, i) => { s += `<rect class="db-hit" data-i="${i}" x="${ml + i * bw}" y="${mt}" width="${bw}" height="${ih}"/>`; });
  s += `<rect id="db-hov" class="db-hov" y="${mt}" height="${ih}" width="${bw}" x="0" style="display:none"/></svg>`;
  return s;
}

function tablaEvolucion(b) {
  return `<div class="db-tabla"><table><thead><tr><th>Período</th><th>Ingresos</th><th>Ganancia</th><th>Ventas</th></tr></thead><tbody>${b.map((x) => `<tr><td>${esc(x.full)}</td><td>${dinero(x.ing)}</td><td>${dinero(x.gan)}</td><td>${x.n}</td></tr>`).join('')}</tbody></table></div>`;
}

let evo = { b: [] };
function pintarEvolucion() {
  const cont = $('db-evo');
  if (!cont) return;
  if (state.dbTabla) { cont.innerHTML = tablaEvolucion(evo.b); return; }
  const W = Math.max(280, cont.clientWidth || 600);
  cont.innerHTML = svgEvolucion(evo.b, W) + '<div id="db-tip" class="db-tip" style="display:none"></div>';
  const svg = cont.querySelector('svg'), tip = $('db-tip'), hov = $('db-hov');
  const mostrar = (i, ev) => {
    const x = evo.b[i], r = svg.getBoundingClientRect(), hit = svg.querySelector(`.db-hit[data-i="${i}"]`);
    hov.setAttribute('x', hit.getAttribute('x')); hov.style.display = 'block';
    tip.innerHTML = `<strong>${esc(x.full)}</strong><div><i class="k1"></i>Ingresos <b>${dinero(x.ing)}</b></div><div><i class="k3"></i>Ganancia <b>${dinero(x.gan)}</b></div><div class="mut">${x.n} venta${x.n !== 1 ? 's' : ''}</div>`;
    tip.style.display = 'block';
    const bx = parseFloat(hit.getAttribute('x')) + parseFloat(hit.getAttribute('width')) / 2;
    const w = tip.offsetWidth;
    tip.style.left = Math.max(4, Math.min(r.width - w - 4, bx - w / 2)) + 'px';
    tip.style.top = '8px';
  };
  svg.querySelectorAll('.db-hit').forEach((h) => {
    const i = +h.dataset.i;
    h.addEventListener('mouseenter', (e) => mostrar(i, e));
    h.addEventListener('click', (e) => mostrar(i, e));
  });
  svg.addEventListener('mouseleave', () => { tip.style.display = 'none'; hov.style.display = 'none'; });
}
window.dbToggleTabla = function () { state.dbTabla = !state.dbTabla; $('db-btn-tabla').textContent = state.dbTabla ? '📊 Ver gráfico' : '📋 Ver como tabla'; pintarEvolucion(); };

// ── armado de la pantalla ──
window.dbSetPeriodo = function (k) {
  state.dbPeriodo = k;
  document.querySelectorAll('#db-filtros .date-btn').forEach((b) => b.classList.toggle('active', b.dataset.k === k));
  dbRender();
};
window.dbSetTop = function (m) { state.dbTop = m; dbRender(); };

window.dbRender = function (ahora = new Date()) {
  const body = $('db-body');
  if (!body) return;
  const per = dbPeriodo(state.dbPeriodo, ahora);
  const cur = dbResumen(per.desde, per.hasta);
  const prev = per.prev ? dbResumen(per.prev.desde, per.prev.hasta) : null;
  const pe = per.prev && per.prev.etiqueta;
  const dl = (k) => (prev ? delta(cur[k], { v: prev[k] }, pe) : '');
  const st = resumenStock(), co = cobros(ahora);
  const en = enRango(per.desde, per.hasta);

  const compras = state.comprasData.filter((c) => en(c.fecha)).reduce((a, c) => a + (c.total || 0), 0);
  const gastosP = state.gastosData.filter((g) => en(g.fecha));
  const gNeg = gastosP.filter((g) => g.cat === 'negocio').reduce((a, g) => a + g.monto, 0);
  const gPer = gastosP.filter((g) => g.cat !== 'negocio').reduce((a, g) => a + g.monto, 0);

  // alertas (estado + ícono + texto, nunca solo color)
  const chips = [];
  if (co.nVenc) chips.push(`<button class="db-chip mal" onclick="dbIr('cobros')">⚠ ${co.nVenc} plan${co.nVenc !== 1 ? 'es' : ''} con cuotas vencidas · ${dinero(co.vencido)}</button>`);
  if (co.prox) chips.push(`<button class="db-chip aviso" onclick="dbIr('cobros')">⏰ ${dinero(co.prox)} por cobrar en los próximos 7 días</button>`);
  if (st.sinCosto) chips.push(`<button class="db-chip aviso" onclick="dbVerSinCosto()">💲 ${st.sinCosto} producto${st.sinCosto !== 1 ? 's' : ''} sin costo</button>`);
  const vencRes = state.reservasData.filter((r) => r.estado !== 'cancelada' && r.vencimiento < ahora.getTime()).length;
  if (vencRes) chips.push(`<button class="db-chip aviso" onclick="dbIr('reservas')">🔖 ${vencRes} reserva${vencRes !== 1 ? 's' : ''} vencida${vencRes !== 1 ? 's' : ''}</button>`);

  // reponer: se vendió en el período y quedan 0 o 1
  const vendidosPorProd = new Map();
  state.ventasData.filter((v) => en(v.fecha)).forEach((v) => vendidosPorProd.set(v.prodId, (vendidosPorProd.get(v.prodId) || 0) + v.cant));
  const reponer = state.stockData.filter((p) => p.qty <= 1 && vendidosPorProd.get(p.id)).map((p) => ({ p, vend: vendidosPorProd.get(p.id) })).sort((a, b) => b.vend - a.vend);
  if (reponer.some((x) => x.p.qty === 0)) chips.push(`<button class="db-chip aviso" onclick="dbIr('stock')">📦 ${reponer.filter((x) => x.p.qty === 0).length} producto${reponer.filter((x) => x.p.qty === 0).length !== 1 ? 's' : ''} agotado${reponer.filter((x) => x.p.qty === 0).length !== 1 ? 's' : ''} que se vendieron en este período</button>`);

  const s = serie(per);
  evo = { b: s.buckets };
  const gran = { dia: 'por día', semana: 'por semana', mes: 'por mes' }[s.gran];

  const top = agrupar(per.desde, per.hasta, (o) => [o.cat, o.modelo, o.color || ''].join('|'));
  const modoTop = state.dbTop === 'ganancia' ? 'gan' : 'unid';
  const topP = top.sort((a, b) => b[modoTop] - a[modoTop]).filter((x) => x[modoTop] > 0).slice(0, 10)
    .map((x) => ({ k: `${x.modelo}${x.color ? ' · ' + x.color : ''}`, sub: x.cat, v: x[modoTop] }));
  const cats = agrupar(per.desde, per.hasta, (o) => o.cat).sort((a, b) => b.ing - a.ing).filter((x) => x.ing > 0).slice(0, 8).map((x) => ({ k: x.cat, v: x.ing }));
  const tipos = porTipo(per.desde, per.hasta).map((t) => ({ k: t.k, sub: t.unid ? `${entero(t.unid)} u.` : '', v: t.ing }));
  const clis = clientes(per.desde, per.hasta).slice(0, 6).map((c) => ({ k: c.nombre, sub: `${c.veces} compra${c.veces !== 1 ? 's' : ''}`, v: c.monto }));
  const gastosSub = new Map();
  gastosP.forEach((g) => { const k = `${g.cat === 'negocio' ? 'Negocio' : 'Personal'} · ${g.sub || 'otros'}`; gastosSub.set(k, (gastosSub.get(k) || 0) + g.monto); });
  const gastosTop = [...gastosSub.entries()].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v).slice(0, 6);
  const resAct = state.reservasData.filter((r) => r.estado !== 'cancelada');

  const hoyStr = ahora.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  const notaComp = per.prev ? (per.kind === 'mes' || per.kind === 'anio' || per.kind === '3m' ? `Comparado con el mismo tramo de ${esc(pe)}.` : `Comparado con ${esc(pe)}.`) : '';
  const notaHasta = per.hasta > ahora.getTime() ? `Datos hasta hoy, ${esc(hoyStr)}. ` : '';
  let h = `<div class="db-titulo"><div><h2>${esc(per.etiqueta)}</h2><p class="db-nota">${notaHasta}${notaComp}</p></div></div>`;

  h += `<div class="db-hero"><div class="db-hero-l">Ganancia</div><div class="db-hero-v ${cur.ganancia < 0 ? 'neg' : ''}">${dinero(cur.ganancia)}</div><div class="db-hero-x">${delta(cur.ganancia, prev && { v: prev.ganancia }, pe) || ''} <span class="db-mut">Margen ${cur.margen.toFixed(0)} %</span> ${prev ? delta(cur.margen, { v: prev.margen }, pe, true) : ''}</div></div>`;
  h += `<div class="db-tiles">${tile('Ingresos', dinero(cur.ingresos), dl('ingresos') + `<span class="db-mut">Ventas ${dinero(cur.ingV)} · Cuotas ${dinero(cur.ingC)}</span>`)}${tile('Ventas', entero(cur.nVentas), dl('nVentas'))}${tile('Unidades vendidas', entero(cur.unidades), dl('unidades'))}${tile('Ticket promedio', dinero(cur.ticket), dl('ticket'))}</div>`;
  if (chips.length) h += `<div class="db-chips">${chips.join('')}</div>`;

  h += `<section class="db-card"><div class="db-card-h"><h3>Evolución ${gran}</h3><button class="date-btn" id="db-btn-tabla" onclick="dbToggleTabla()">${state.dbTabla ? '📊 Ver gráfico' : '📋 Ver como tabla'}</button></div><div class="db-leyenda"><span><i class="k1"></i>Ingresos</span><span><i class="k3l"></i>Ganancia</span></div><div id="db-evo" class="db-evo"></div></section>`;

  h += `<div class="db-grid2">`;
  h += card('Ventas por tipo', barras(tipos), 'Ingresos del período según el tipo de precio usado.');
  h += card('Categorías', barras(cats), 'Ingresos por categoría de producto.');
  h += `</div>`;

  h += card(`Lo que más se vende <span class="db-tog"><button class="date-btn${modoTop === 'unid' ? ' active' : ''}" onclick="dbSetTop('unidades')">Por unidades</button><button class="date-btn${modoTop === 'gan' ? ' active' : ''}" onclick="dbSetTop('ganancia')">Por ganancia</button></span>`, barras(topP, { formato: modoTop === 'unid' ? (n) => entero(n) + ' u.' : dinero, vacio: 'Todavía no hay ventas en este período.' }), 'Top 10 modelos (todos los talles juntos).');

  h += `<div class="db-grid2">`;
  h += card('Stock', `<div class="db-mini">${tile('Unidades', entero(st.unidades))}${tile('Referencias', entero(st.referencias))}${tile('Valor a costo', dinero(st.valorCosto))}${tile('Valor a precio menor', dinero(st.valorVenta))}${tile('Última unidad', entero(st.ultima))}${tile('Agotados', entero(st.agotados))}${tile('Sin costo', entero(st.sinCosto))}${tile('Sin precio menor', entero(st.sinPrecio))}</div><h4>Unidades por categoría</h4>${barras(st.porCat.slice(0, 8).map((x) => ({ k: x.k, v: x.v })), { formato: (n) => entero(n) + ' u.' })}`);
  h += card('A reponer', reponer.length ? `<div class="db-lista">${reponer.slice(0, 8).map((x) => `<div><span>${esc(x.p.modelo)}${x.p.color ? ' · ' + esc(x.p.color) : ''} <em>T.${esc(x.p.talle)}</em></span><b>${x.p.qty === 0 ? '<span class="db-tag mal">Agotado</span>' : '<span class="db-tag aviso">Queda 1</span>'} <span class="db-mut">${x.vend} vendido${x.vend !== 1 ? 's' : ''}</span></b></div>`).join('')}</div>` : '<p class="db-vacio">Nada urgente: ningún producto vendido en este período está por agotarse.</p>', 'Productos que se vendieron en este período y quedan 0 o 1 unidad.');
  h += `</div>`;

  h += `<div class="db-grid2">`;
  h += card('Cobros en cuotas', `<div class="db-mini">${tile('Por cobrar', dinero(co.porCobrar))}${tile('Vencido', dinero(co.vencido), co.nVenc ? `<span class="db-tag mal">${co.nVenc} plan${co.nVenc !== 1 ? 'es' : ''}</span>` : '')}${tile('Próx. 7 días', dinero(co.prox))}${tile('Planes activos', entero(co.planes))}</div>`, 'Estado actual, no depende del período elegido.');
  h += card('Reservas', `<div class="db-mini">${tile('Activas', entero(resAct.length))}${tile('Vencidas', entero(vencRes), vencRes ? '<span class="db-tag aviso">Revisar</span>' : '')}${tile('Unidades reservadas', entero(resAct.reduce((a, r) => a + (r.cant || 1), 0)))}</div>`, 'Estado actual.');
  h += `</div>`;

  h += card('Dinero del período', `<div class="db-mini">${tile('Ingresos', dinero(cur.ingresos))}${tile('Compras', dinero(compras))}${tile('Gastos del negocio', dinero(gNeg))}${tile('Gastos personales', dinero(gPer))}${tile('Ganancia neta', dinero(cur.ganancia - gNeg), '<span class="db-mut">ganancia − gastos del negocio</span>')}${tile('Saldo de caja', dinero(cur.ingresos - compras - gNeg - gPer), '<span class="db-mut">ingresos − compras − gastos</span>')}</div><h4>Gastos por rubro</h4>${barras(gastosTop, { vacio: 'No hay gastos en este período.' })}`);
  h += card('Mejores clientes', barras(clis, { vacio: 'Todavía no hay clientes cargados en este período. Las ventas nuevas guardan el cliente si lo completás.' }), 'Ventas con cliente y cuotas cobradas.');

  body.innerHTML = h;
  pintarEvolucion();
};

window.dbIr = function (tab) { showTab(tab, document.querySelector(`nav .tab[onclick*="'${tab}'"]`)); };
window.dbVerSinCosto = function () { dbIr('stock'); state.filtroSinCosto = true; renderStock(); };

// ── refresco automático ──
let timer = null, timerResize = null, mesVisto = claveMes(new Date());
window.dbRefresh = function () {
  if (!$('tab-dashboard')?.classList.contains('active')) return;
  clearTimeout(timer); timer = setTimeout(dbRender, 150);
};
// Si cambia el mes con la app abierta: el encabezado vuelve a 0 y el dashboard se redibuja.
window.dbTick = function (ahora = new Date()) {
  const k = claveMes(ahora);
  if (k === mesVisto) return false;
  mesVisto = k; updateHeader(); dbRefresh(); return true;
};
setInterval(() => dbTick(), 60000);
window.addEventListener('resize', () => { clearTimeout(timerResize); timerResize = setTimeout(() => { if ($('tab-dashboard')?.classList.contains('active')) pintarEvolucion(); }, 200); });
