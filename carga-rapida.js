import { state } from './state.js';
import { auth, db, collection, doc, writeBatch } from './firebase-config.js';
import { armarModelos, buscarModelos, eleccionAutomatica, filaPorTalle, etiquetaModelo, normTalle, norm, tokens } from './matching.js';

const WORKER_URL = 'https://stockmgr-ia.diegoezequiel055.workers.dev/interpretar';
const TIPOS = { menor: 'Menor', mayorista: 'Mayorista', curva: 'Curva' };
const OPS = { compra: 'Compra', venta: 'Venta', producto_nuevo: 'Producto nuevo' };
const MAX_OPCIONES = 60;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const precioTipo = (p, t) => (t === 'mayorista' ? p.pmayorista : t === 'curva' ? p.pcurva : p.pventa) || 0;
const hoy = () => new Date().toISOString().slice(0, 10);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; };
const el = (id) => document.getElementById(id);
let opForzada = 'auto';

const cr = () => state.cr;
const vacio = () => ({ op: null, items: [], tipoPrecio: 'menor', cliente: '', proveedor: '', fecha: hoy(), notas: '', totalPack: null, avisoPack: '', noEntendido: [], hayResultado: false, busy: false });

// ── pantalla de entrada ──
window.crSetOpForzada = function (op) {
  opForzada = op;
  ['auto', 'compra', 'venta', 'producto_nuevo'].forEach((o) => el('cr-op-' + o).classList.toggle('active', o === op));
};

function mensajeError(status, code, detalle) {
  if (status === 429 || code === 'cuota_agotada') return 'Se acabó el límite gratuito de IA de hoy (se renueva a las 21:00). Mientras tanto podés cargar a mano desde Stock, Ventas o Compras.';
  if (status === 401) return 'Tu sesión venció. Recargá la página e iniciá sesión de nuevo.';
  if (status === 403) return 'Esta cuenta no está autorizada para usar la IA.';
  if (code === 'texto_muy_largo') return 'El texto es demasiado largo. Pegalo en partes.';
  return `La IA no pudo procesar el texto${detalle ? ' (' + detalle + ')' : ''}. Probá de nuevo.`;
}

window.crInterpretar = async function () {
  const texto = el('cr-texto').value.trim();
  if (!texto) { toast('Pegá primero el texto.', 'error'); return; }
  const btn = el('cr-btn-interpretar'), est = el('cr-estado');
  btn.disabled = true; btn.textContent = '🤖 Interpretando… (unos segundos)';
  est.style.color = 'var(--muted)'; est.textContent = '';
  try {
    const token = await auth.currentUser.getIdToken();
    const categorias = [...new Set(state.stockData.map((p) => p.cat).filter(Boolean))];
    const r = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ texto, categorias, ...(opForzada !== 'auto' ? { operacion: opForzada } : {}) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(mensajeError(r.status, j.error, j.detalle));
    cargarResultado(j.resultado);
  } catch (e) {
    est.style.color = 'var(--danger)';
    est.textContent = e instanceof TypeError ? 'No pude conectar con la función de IA. Revisá tu conexión.' : e.message;
  } finally {
    btn.disabled = false; btn.textContent = '🤖 Interpretar';
  }
};

function cargarResultado(res) {
  const c = (state.cr = vacio());
  c.hayResultado = true;
  c.op = opForzada !== 'auto' ? opForzada : (res.operacion !== 'desconocida' ? res.operacion : null);
  c.tipoPrecio = res.tipo_precio || 'menor';
  c.cliente = res.cliente || '';
  c.proveedor = res.proveedor || '';
  c.totalPack = res.total_pack;
  c.noEntendido = res.no_entendido || [];
  c.items = res.items.map((it) => ({
    categoria: it.categoria, producto: it.producto, color: it.color, talle: it.talle, cantidad: it.cantidad,
    precios: { ...it.precios }, costo: it.precios.costo || null,
    selKey: null, nuevo: null, tipoPrecio: null, precioManual: null, busqueda: '', candKeys: [], aviso: null,
  }));
  aplicarPack();
  prepararItems();
  crRender();
  el('cr-revision').style.display = 'block';
  el('cr-revision').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Si el texto trae el total de un pack y ningún costo por ítem, se reparte en partes iguales por unidad.
function aplicarPack() {
  const c = cr();
  if (!c.totalPack || !c.items.length) return;
  const unidades = c.items.reduce((a, i) => a + i.cantidad, 0);
  if (c.items.some((i) => i.costo > 0)) { c.avisoPack = `El texto trae un total de $${fmt(c.totalPack)}, pero también costos por ítem: usé los costos por ítem.`; return; }
  const porUnidad = Math.round(c.totalPack / unidades);
  c.items.forEach((i) => { i.costo = porUnidad; });
  c.avisoPack = `Total del pack $${fmt(c.totalPack)} ÷ ${unidades} unidades = $${fmt(porUnidad)} por unidad (repartido en partes iguales). Corregilo si hace falta.`;
}

function nuevoDesde(it) {
  // En tu stock el nombre del modelo no lleva la categoría al principio ("River Plate 2026", no "Camiseta River Plate 2026").
  const palabras = String(it.producto || '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length > 1 && it.categoria && tokens(palabras[0])[0] === tokens(it.categoria)[0]) palabras.shift();
  const nombre = palabras.join(' ');
  return {
    cat: it.categoria || '', modelo: nombre ? nombre.charAt(0).toUpperCase() + nombre.slice(1) : '', color: it.color || '',
    pventa: it.precios.menor || null, pmayorista: it.precios.mayorista || null, pcurva: it.precios.curva || null,
  };
}

// Empareja cada ítem con el stock. Solo elige solo cuando hay UNA única opción.
function prepararItems() {
  const c = cr();
  const modelos = armarModelos(state.stockData);
  for (const it of c.items) {
    it.selKey = null; it.busqueda = '';
    if (c.op === 'producto_nuevo') { it.nuevo = it.nuevo || nuevoDesde(it); it.candKeys = buscarModelos(it, modelos).modelos.slice(0, 5).map((m) => m.key); continue; }
    it.nuevo = null;
    const res = buscarModelos(it, modelos);
    it.candKeys = res.modelos.map((m) => m.key);
    it.aviso = res.aviso;
    const auto = eleccionAutomatica(res);
    if (auto) it.selKey = auto.key;
  }
}

window.crSetOp = function (op) { cr().op = op; prepararItems(); crRender(); };
window.crSetTipoPrecio = function (t) { cr().tipoPrecio = t; cr().items.forEach((i) => { i.tipoPrecio = null; i.precioManual = null; }); crRender(); };
window.crCampo = function (campo, v) { cr()[campo] = v; };

window.crElegir = function (i, val) {
  const it = cr().items[i];
  if (val === '__nuevo__') { it.selKey = null; it.nuevo = it.nuevo || nuevoDesde(it); }
  else { it.selKey = val || null; it.nuevo = null; }
  it.precioManual = null;
  crRender();
};
window.crBuscar = function (i, texto) {
  const it = cr().items[i];
  it.busqueda = texto;
  const sel = el('cr-sel-' + i);
  if (sel) sel.innerHTML = opcionesSelect(i, armarModelos(state.stockData));
};
window.crTalle = function (i, v) { cr().items[i].talle = normTalle(v) || null; crRender(); };
window.crCantidad = function (i, v) { cr().items[i].cantidad = Math.max(1, parseInt(v, 10) || 1); crRender(); };
window.crCosto = function (i, v) { cr().items[i].costo = num(v); crRender(); };
window.crTipoItem = function (i, v) { const it = cr().items[i]; it.tipoPrecio = v; it.precioManual = null; crRender(); };
window.crPrecioManual = function (i, v) { cr().items[i].precioManual = num(v); crRender(); };
window.crPrecioNuevo = function (i, campo, v) { const it = cr().items[i]; if (campo === 'costo') it.costo = num(v); else it.nuevo[campo] = num(v); crRender(); };
window.crTextoNuevo = function (i, campo, v) { cr().items[i].nuevo[campo] = String(v).trim(); crRender(); };
window.crQuitar = function (i) { cr().items.splice(i, 1); crRender(); };
window.crDescartar = function () { state.cr = vacio(); el('cr-revision').style.display = 'none'; el('cr-revision-body').innerHTML = ''; };

// ── evaluación de cada ítem ──
const ok = (extra = {}) => ({ kind: 'ok', msg: '', ...extra });
const pend = (msg) => ({ kind: 'pend', msg });
const bad = (msg) => ({ kind: 'error', msg });
const aviso = (msg, extra = {}) => ({ kind: 'warn', msg, ...extra });

function siblingPrecios(m) {
  const primero = (k) => (m.filas.find((f) => f[k]) || {})[k] || null;
  return { pventa: primero('pventa'), pmayorista: primero('pmayorista'), pcurva: primero('pcurva') };
}

function evaluarItem(it, idx, filasUsadas) {
  const c = cr();
  if (c.op === 'producto_nuevo') {
    const n = it.nuevo;
    if (!n.cat || !n.modelo) return pend('Completá categoría y modelo');
    if (!it.talle) return pend('Falta el talle');
    if (!(it.costo > 0)) return bad('El precio de costo es obligatorio');
    const existe = state.stockData.find((p) => norm(p.cat) === norm(n.cat) && norm(p.modelo) === norm(n.modelo) && norm(p.color || '') === norm(n.color || '') && normTalle(p.talle) === normTalle(it.talle));
    if (existe) return bad('Ya existe en tu stock: para sumar unidades usá "Compra"');
    const faltan = [['Mayorista', n.pmayorista], ['Curva', n.pcurva], ['Menor', n.pventa]].filter(([, v]) => !v).map(([k]) => k);
    return faltan.length ? aviso('Faltan precios (recomendado): ' + faltan.join(', ')) : ok();
  }

  if (c.op === 'compra' && it.nuevo) {
    const n = it.nuevo;
    if (!n.cat || !n.modelo) return pend('Completá categoría y modelo del producto nuevo');
    if (!it.talle) return pend('Falta el talle');
    if (!(it.costo > 0)) return bad('Un producto nuevo necesita costo');
    const existe = state.stockData.find((p) => norm(p.cat) === norm(n.cat) && norm(p.modelo) === norm(n.modelo) && norm(p.color || '') === norm(n.color || '') && normTalle(p.talle) === normTalle(it.talle));
    if (existe) return bad('Ya existe en tu stock: elegilo de la lista');
    return aviso('Se creará como producto nuevo', { crear: 'nuevo' });
  }

  if (!it.selKey) return pend('Elegí el producto');
  const m = idx.get(it.selKey);
  if (!m) return bad('Ese producto ya no está en el stock');
  if (!it.talle) return pend('Falta el talle');
  const fila = filaPorTalle(m, it.talle);

  if (c.op === 'compra') {
    if (fila) return it.costo > 0 ? ok({ fila }) : aviso('Sin costo: el costo del producto no cambia', { fila });
    if (!(it.costo > 0)) return bad(`Es un talle nuevo (${it.talle}) de este modelo: necesita costo`);
    return aviso(`Talle nuevo (${it.talle}): se crea junto a los otros talles del modelo`, { crear: 'talle_nuevo', modelo: m });
  }

  // venta
  if (!fila) return bad(`Este modelo no tiene talle ${it.talle}`);
  const tipo = it.tipoPrecio || c.tipoPrecio;
  const precio = it.precioManual > 0 ? it.precioManual : precioTipo(fila, tipo);
  if (!precio) return bad(`Falta el precio ${TIPOS[tipo].toLowerCase()} de este producto: cargalo en Stock o escribilo acá`);
  const pedido = filasUsadas.get(fila.id) || 0;
  if (fila.qty < pedido) return bad(`Solo hay ${fila.qty} en stock${pedido > it.cantidad ? ' (contando otra línea igual)' : ''}`);
  return ok({ fila, precio, tipo });
}

function evaluarTodo() {
  const c = cr();
  const idx = new Map(armarModelos(state.stockData).map((m) => [m.key, m]));
  const usadas = new Map();
  for (const it of c.items) {
    const m = it.selKey && idx.get(it.selKey);
    const f = m && it.talle ? filaPorTalle(m, it.talle) : null;
    if (f) usadas.set(f.id, (usadas.get(f.id) || 0) + it.cantidad);
  }
  const ev = c.items.map((it) => evaluarItem(it, idx, usadas));
  return { idx, ev, todoOk: c.items.length > 0 && ev.every((e) => e.kind === 'ok' || e.kind === 'warn'), pendientes: ev.filter((e) => e.kind === 'pend' || e.kind === 'error').length };
}

// ── dibujo ──
function opcionesSelect(i, modelos) {
  const c = cr(), it = c.items[i];
  const porKey = new Map(modelos.map((m) => [m.key, m]));
  let lista;
  if (it.busqueda.trim()) lista = buscarModelos({ categoria: '', producto: it.busqueda, color: '' }, modelos).modelos;
  else lista = it.candKeys.map((k) => porKey.get(k)).filter(Boolean);
  // En una venta, primero las opciones que sí tienen ese talle en stock.
  if (c.op === 'venta' && it.talle) lista = [...lista].sort((a, b) => (filaPorTalle(b, it.talle)?.qty > 0) - (filaPorTalle(a, it.talle)?.qty > 0));
  const sel = it.selKey && porKey.get(it.selKey);
  if (sel && !lista.includes(sel)) lista = [sel, ...lista];
  const total = lista.length;
  lista = lista.slice(0, MAX_OPCIONES);
  const opt = lista.map((m) => {
    let info = '';
    if (it.talle) {
      const f = filaPorTalle(m, it.talle);
      info = f ? ` — T.${it.talle}: ${f.qty > 0 ? f.qty + ' en stock' : 'sin stock'}` : ` — sin talle ${it.talle}`;
    }
    const malo = c.op === 'venta' && it.talle && !(filaPorTalle(m, it.talle)?.qty > 0);
    return `<option value="${esc(m.key)}"${it.selKey === m.key ? ' selected' : ''}>${malo ? '✗ ' : ''}${esc(etiquetaModelo(m))}${esc(info)}</option>`;
  }).join('');
  const cab = `<option value=""${it.selKey || it.nuevo ? '' : ' selected'}>— Elegí el producto (${total} ${total !== 1 ? 'opciones' : 'opción'}${total > MAX_OPCIONES ? ', mostrando ' + MAX_OPCIONES : ''}) —</option>`;
  const nuevo = c.op === 'compra' ? `<option value="__nuevo__"${it.nuevo ? ' selected' : ''}>➕ Es un producto nuevo (no está en mi stock)</option>` : '';
  return cab + opt + nuevo;
}

const inp = (extra) => `style="background:var(--surface2);border:1px solid var(--border2);color:var(--text);padding:7px 10px;border-radius:8px;font-size:.85rem;font-family:inherit;${extra}"`;

function filaHTML(it, i, e, modelos) {
  const c = cr();
  const color = e.kind === 'error' ? 'var(--danger)' : e.kind === 'pend' ? 'var(--warning)' : e.kind === 'warn' ? 'var(--warning)' : 'var(--success)';
  const leido = `${it.cantidad}× ${[it.categoria, it.producto, it.color].filter(Boolean).map(esc).join(' · ') || '?'} · talle ${esc(it.talle || '?')}`;
  const msg = e.msg ? `<div style="font-size:.74rem;color:${color};margin-top:6px">${e.kind === 'ok' ? '✓' : e.kind === 'warn' ? '⚠' : '✗'} ${esc(e.msg)}</div>` : (e.kind === 'ok' ? `<div style="font-size:.74rem;color:var(--success);margin-top:6px">✓ Listo</div>` : '');
  const cab = `<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="font-size:.72rem;color:var(--muted)">Entendí: ${leido}</div><button class="btn-ghost btn" onclick="crQuitar(${i})" style="padding:2px 8px" title="Quitar">✕</button></div>`;
  const talleBox = `<label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Talle</label><input type="text" value="${esc(it.talle || '')}" onchange="crTalle(${i},this.value)" ${inp('width:70px;text-align:center')}>`;
  const cantBox = `<label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Cant.</label><input type="number" min="1" value="${it.cantidad}" onchange="crCantidad(${i},this.value)" ${inp('width:64px;text-align:center')}>`;
  const caja = (html) => `<div style="display:flex;flex-direction:column;gap:3px">${html}</div>`;
  const fila = (html) => `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:8px">${html}</div>`;
  const wrapper = (inner) => `<div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid ${color};border-radius:8px;padding:10px 12px;margin-bottom:8px">${inner}</div>`;

  if (c.op === 'producto_nuevo') {
    const n = it.nuevo;
    const t = (campo, lab, val, ancho) => caja(`<label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">${lab}</label><input type="text" ${campo === 'cat' ? 'list="cr-cats"' : ''} value="${esc(val)}" onchange="crTextoNuevo(${i},'${campo}',this.value)" ${inp('width:' + ancho)}>`);
    const p = (campo, lab, val) => caja(`<label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">${lab}</label><input type="number" min="0" value="${val || ''}" placeholder="0" onchange="crPrecioNuevo(${i},'${campo}',this.value)" ${inp('width:96px')}>`);
    const parecidos = it.candKeys.map((k) => modelos.find((m) => m.key === k)).filter(Boolean);
    return wrapper(cab
      + fila(t('cat', 'Categoría', n.cat, '120px') + t('modelo', 'Modelo', n.modelo, '200px') + t('color', 'Color', n.color, '110px') + caja(talleBox) + caja(cantBox))
      + fila(p('costo', 'Costo *', it.costo) + p('pmayorista', 'Mayorista', n.pmayorista) + p('pcurva', 'Curva', n.pcurva) + p('pventa', 'Menor', n.pventa))
      + (parecidos.length ? `<div style="font-size:.72rem;color:var(--muted);margin-top:8px">Parecidos que ya tenés: ${parecidos.map((m) => esc(etiquetaModelo(m))).join(' · ')}</div>` : '')
      + msg);
  }

  const picker = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><select id="cr-sel-${i}" onchange="crElegir(${i},this.value)" ${inp('flex:1 1 240px;min-width:0')}>${opcionesSelect(i, modelos)}</select><input type="text" placeholder="🔍 buscar otro producto…" oninput="crBuscar(${i},this.value)" value="${esc(it.busqueda)}" ${inp('flex:1 1 150px;min-width:0')}></div>`;
  let extra = '';
  if (it.nuevo) {
    const n = it.nuevo;
    const t = (campo, lab, val, ancho) => caja(`<label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">${lab}</label><input type="text" ${campo === 'cat' ? 'list="cr-cats"' : ''} value="${esc(val)}" onchange="crTextoNuevo(${i},'${campo}',this.value)" ${inp('width:' + ancho)}>`);
    const p = (campo, lab, val) => caja(`<label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">${lab}</label><input type="number" min="0" value="${val || ''}" placeholder="0" onchange="crPrecioNuevo(${i},'${campo}',this.value)" ${inp('width:96px')}>`);
    extra = fila(t('cat', 'Categoría', n.cat, '120px') + t('modelo', 'Modelo', n.modelo, '200px') + t('color', 'Color', n.color, '110px') + p('pmayorista', 'Mayorista', n.pmayorista) + p('pcurva', 'Curva', n.pcurva) + p('pventa', 'Menor', n.pventa));
  }
  const m = it.selKey && modelos.find((x) => x.key === it.selKey);
  const chips = m ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center"><span style="font-size:.7rem;color:var(--muted)">Talles:</span>${m.filas.slice().sort((a, b) => String(a.talle).localeCompare(String(b.talle), undefined, { numeric: true })).map((f) => `<button class="date-btn${normTalle(f.talle) === normTalle(it.talle) ? ' active' : ''}" style="padding:3px 10px" onclick="crTalle(${i},'${esc(f.talle)}')">${esc(f.talle)} (${f.qty})</button>`).join('')}</div>` : '';
  let ctrl = caja(talleBox) + caja(cantBox);
  if (c.op === 'compra') {
    ctrl += caja(`<label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Costo unidad</label><input type="number" min="0" value="${it.costo || ''}" placeholder="0" onchange="crCosto(${i},this.value)" ${inp('width:100px')}>`);
  } else {
    const tipo = it.tipoPrecio || c.tipoPrecio;
    const precio = it.precioManual > 0 ? it.precioManual : (e.fila ? precioTipo(e.fila, tipo) : 0);
    ctrl += caja(`<label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Precio</label><div style="display:flex;gap:6px"><select onchange="crTipoItem(${i},this.value)" ${inp('padding:7px 6px')}>${Object.entries(TIPOS).map(([k, n]) => `<option value="${k}"${k === tipo ? ' selected' : ''}>${n}</option>`).join('')}</select><input type="number" min="0" value="${precio || ''}" placeholder="0" onchange="crPrecioManual(${i},this.value)" ${inp('width:96px')}></div>`);
    if (e.precio) ctrl += `<div style="font-size:.78rem;color:var(--accent);align-self:flex-end;padding-bottom:8px">= $${fmt(e.precio * it.cantidad)}</div>`;
  }
  return wrapper(cab + picker + extra + chips + fila(ctrl) + msg);
}

window.crRender = crRender;
function crRender() {
  const c = cr();
  const body = el('cr-revision-body');
  const modelos = armarModelos(state.stockData);
  el('cr-cats').innerHTML = [...new Set(state.stockData.map((p) => p.cat).filter(Boolean))].sort().map((k) => `<option value="${esc(k)}">`).join('');
  let h = `<div style="font-size:.78rem;color:var(--success);margin-bottom:12px">🔒 Nada se guardó todavía. Revisá y corregí lo que haga falta.</div>`;
  h += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px"><span style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Es una:</span>${Object.entries(OPS).map(([k, n]) => `<button class="date-btn${c.op === k ? ' active' : ''}" onclick="crSetOp('${k}')">${n}</button>`).join('')}</div>`;
  if (!c.op) h += `<div style="font-size:.82rem;color:var(--warning);margin-bottom:12px">⚠ No pude saber si es compra, venta o producto nuevo. Elegí una arriba.</div>`;
  if (c.noEntendido.length) h += `<div style="background:var(--danger-dim);border:1px solid var(--danger);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:.78rem;color:var(--danger)">No entendí: ${c.noEntendido.map((s) => '«' + esc(s) + '»').join(' · ')}</div>`;
  if (!c.op) { body.innerHTML = h; return; }
  if (c.avisoPack && c.op === 'compra') h += `<div style="font-size:.78rem;color:var(--warning);margin-bottom:12px">📦 ${esc(c.avisoPack)}</div>`;

  if (c.op === 'venta') {
    h += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px"><span style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Precio a usar:</span>${Object.entries(TIPOS).map(([k, n]) => `<button class="date-btn${c.tipoPrecio === k ? ' active' : ''}" onclick="crSetTipoPrecio('${k}')">${n}</button>`).join('')}</div>`;
    h += `<div style="margin-bottom:12px"><label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Cliente (opcional)</label><input type="text" value="${esc(c.cliente)}" onchange="crCampo('cliente',this.value)" placeholder="Ej: Juan García" ${inp('width:100%;margin-top:3px')}></div>`;
  } else if (c.op === 'compra') {
    h += `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px"><div style="flex:1 1 160px"><label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Proveedor</label><input type="text" value="${esc(c.proveedor)}" onchange="crCampo('proveedor',this.value)" placeholder="Opcional" ${inp('width:100%;margin-top:3px')}></div><div style="flex:0 1 150px"><label style="font-size:.66rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Fecha</label><input type="date" value="${esc(c.fecha)}" onchange="crCampo('fecha',this.value)" ${inp('width:100%;margin-top:3px')}></div></div>`;
  }

  const t = evaluarTodo();
  h += c.items.length ? c.items.map((it, i) => filaHTML(it, i, t.ev[i], modelos)).join('') : `<div class="empty" style="padding:20px"><p>No quedó ningún ítem. Descartá y pegá el texto de nuevo.</p></div>`;

  const unidades = c.items.reduce((a, i) => a + i.cantidad, 0);
  let total = '';
  if (c.op === 'venta') total = '$' + fmt(Math.round(t.ev.reduce((a, e, k) => a + (e.precio || 0) * c.items[k].cantidad, 0)));
  else if (c.op === 'compra') total = '$' + fmt(Math.round(c.items.reduce((a, i) => a + (i.costo || 0) * i.cantidad, 0)));
  const etiqueta = { venta: 'Registrar venta', compra: 'Registrar compra', producto_nuevo: 'Crear producto(s)' }[c.op];
  h += `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)"><div><div style="font-size:.72rem;color:var(--muted)">${c.items.length} línea${c.items.length !== 1 ? 's' : ''} · ${unidades} unidad${unidades !== 1 ? 'es' : ''}</div>${total ? `<div style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;color:var(--success)">${c.op === 'venta' ? 'Total' : 'Costo total'} ${total}</div>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-outline" onclick="crDescartar()">Descartar</button><button class="btn btn-gold" id="cr-btn-confirmar" onclick="crConfirmar()" ${t.todoOk && !c.busy ? '' : 'disabled'}>✓ ${etiqueta}</button></div></div>`;
  if (!t.todoOk && c.items.length) h += `<div style="font-size:.74rem;color:var(--warning);margin-top:8px;text-align:right">Falta resolver ${t.pendientes} línea${t.pendientes !== 1 ? 's' : ''} para poder confirmar.</div>`;
  body.innerHTML = h;
}

// ── guardar (solo al confirmar) ──
window.crConfirmar = async function () {
  const c = cr();
  const t = evaluarTodo();
  if (!t.todoOk || c.busy) return;
  c.busy = true; crRender();
  try {
    if (c.op === 'venta') {
      const porFila = new Map();
      c.items.forEach((it, k) => {
        const e = t.ev[k];
        const previo = porFila.get(e.fila.id);
        if (previo) previo.cant += it.cantidad;
        else porFila.set(e.fila.id, { prodId: e.fila.id, cant: it.cantidad, tipoPrecio: e.tipo, pventa: e.precio, pcosto: e.fila.pcosto || 0 });
      });
      const n = await guardarVentaItems([...porFila.values()], c.cliente.trim() || null);
      toast(`Venta registrada — ${n} producto${n !== 1 ? 's' : ''} ✓`, 'success');
    } else if (c.op === 'compra') {
      const existentes = new Map(), nuevos = new Map();
      c.items.forEach((it, k) => {
        const e = t.ev[k];
        if (e.fila) {
          const p = existentes.get(e.fila.id);
          if (p) { p.cant += it.cantidad; p.pcosto_unit = p.pcosto_unit || it.costo || 0; }
          else existentes.set(e.fila.id, { prodId: e.fila.id, cant: it.cantidad, pcosto_unit: it.costo || 0 });
        } else {
          const base = it.nuevo ? { ...it.nuevo } : { cat: e.modelo.cat, modelo: e.modelo.modelo, color: e.modelo.color, ...siblingPrecios(e.modelo) };
          const clave = [norm(base.cat), norm(base.modelo), norm(base.color), normTalle(it.talle)].join('|');
          const p = nuevos.get(clave);
          if (p) p.cant += it.cantidad;
          else nuevos.set(clave, { nuevo: { ...base, talle: normTalle(it.talle) }, cant: it.cantidad, pcosto_unit: it.costo || 0 });
        }
      });
      const fecha = new Date((c.fecha || hoy()) + 'T12:00:00').getTime();
      await guardarCompraItems({ items: [...existentes.values(), ...nuevos.values()], proveedor: c.proveedor.trim(), fecha, notas: 'Cargada por texto (Carga rápida)', actualizaStock: true });
      toast('Compra registrada — stock actualizado ✓', 'success');
    } else {
      const batch = writeBatch(db);
      c.items.forEach((it) => {
        const n = it.nuevo;
        batch.set(doc(collection(db, 'stock')), {
          cat: n.cat.trim(), modelo: n.modelo.trim(), color: (n.color || '').trim(), talle: normTalle(it.talle), qty: it.cantidad,
          pventa: n.pventa || null, pmayorista: n.pmayorista || null, pcurva: n.pcurva || null, pcosto: it.costo,
          notas: null, createdAt: Date.now(),
        });
      });
      await batch.commit();
      toast(`${c.items.length} producto${c.items.length !== 1 ? 's' : ''} creado${c.items.length !== 1 ? 's' : ''} ✓`, 'success');
    }
    el('cr-texto').value = '';
    window.crDescartar();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    c.busy = false; crRender();
  }
};
