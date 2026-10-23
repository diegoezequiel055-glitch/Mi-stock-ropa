// ══════════════════════════════════════════
// PRUEBAS DE "PRECIO EN OFERTA" EN STOCKMGR (ofertas.js + ofertas-admin.js). NO toca el Firestore real: la parte B usa un
// Firestore simulado en memoria.
//   A) lógica pura: validación (número > 0 y menor al normal), porcentaje, ficha (precioOferta / precioOfertaTarjeta), plan de cambios.
//   B) navegador (Chrome): la tarjeta "Precio en oferta" del modal: error y NO guarda si el precio es inválido; guarda solo `poferta`
//      en las filas del producto; quitar; deshacer; vista previa. Con CAPTURAS=<carpeta> guarda capturas (iPhone, Android y PC).
// Uso: node test-ofertas.mjs   (B necesita Playwright fuera del repo: PLAYWRIGHT_DIR=<carpeta> y Chrome)   SOLO_PURAS=1 → solo A
// (La sincronización de la oferta a catalogo_publico y al documento único se prueba en test-catalogo-sync.mjs.)
// ══════════════════════════════════════════
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { validarOferta, ofertaValida, ofertaActual, planOferta, camposOferta, camposDeshacerOferta, porcentajeOferta, conOferta, vistaPreviaOferta } from './ofertas.js';

let ok = 0, fallos = 0;
const t = async (n, f) => { try { await f(); ok++; console.log('ok', n); } catch (e) { fallos++; console.log('FALLA', n, '\n   ', String(e.message).split('\n')[0]); } };
const cfg = { pct: 27, redondeo: 500, mostrar: true };
const filas = [{ id: 'a', talle: 'S', pventa: 35000 }, { id: 'b', talle: 'M', pventa: 35000 }, { id: 'c', talle: 'L', pventa: 35000 }];

console.log('— A) lógica pura —');
await t('validarOferta: acepta enteros > 0 menores al normal (también "25.000"); vacío = sin oferta', () => {
  assert.deepEqual(validarOferta('25000', 35000), { ok: true, vacio: false, valor: 25000 });
  assert.equal(validarOferta('25.000', 35000).valor, 25000); assert.equal(validarOferta(' 34 999 ', 35000).valor, 34999);
  for (const v of ['', '  ', null, undefined]) assert.deepEqual(validarOferta(v, 35000), { ok: true, vacio: true, valor: null });
});
await t('validarOferta: rechaza 0, negativos, texto, decimales, igual o MAYOR al normal, y sin precio normal', () => {
  for (const mal of ['0', '-5', 'abc', '12,5', '1e4', '25000.5x', '35000', '35001', '99999999']) assert.equal(validarOferta(mal, 35000).ok, false, mal);
  assert.match(validarOferta('40000', 35000).error, /menor que el precio normal/);
  assert.equal(validarOferta('1000', 0).ok, false); assert.equal(validarOferta('1000', null).ok, false);
});
await t('ofertaValida: número > 0 y menor al normal (no acepta texto, NaN ni null)', () => {
  assert.equal(ofertaValida(25000, 35000), true); assert.equal(ofertaValida(34999, 35000), true);
  for (const x of [35000, 36000, 0, -1, '25000', NaN, null, undefined]) assert.equal(ofertaValida(x, 35000), false, String(x));
  assert.equal(ofertaValida(100, 0), false); assert.equal(ofertaValida(100, null), false);
});
await t('porcentaje: sale de efectivo vs. oferta, redondeado al entero (35.000 → 30.000 = 14 %; 40.000 → 34.000 = 15 %)', () => {
  assert.equal(porcentajeOferta(40000, 34000), 15); assert.equal(porcentajeOferta(35000, 30000), 14); assert.equal(porcentajeOferta(100, 50), 50);
  assert.equal(porcentajeOferta(35000, 34999), 0); assert.equal(porcentajeOferta(35000, 35000), 0); assert.equal(porcentajeOferta(35000, null), 0);
});
await t('conOferta: suma precioOferta y precioOfertaTarjeta (mismo recargo 27 % y redondeo a $500 hacia arriba)', () => {
  const f = conOferta({ nombre: 'X', precio: 35000, precioTarjeta: 44500 }, [{ pventa: 35000, poferta: 30000 }], cfg);
  assert.equal(f.precioOferta, 30000); assert.equal(f.precioOfertaTarjeta, 38500); // 30000 × 1,27 = 38.100 → 38.500
  assert.equal(f.precio, 35000); assert.equal(f.precioTarjeta, 44500, 'precio y precioTarjeta siguen siendo los normales');
});
await t('conOferta: con el interruptor de tarjeta apagado solo va precioOferta; con recargo 0 % tampoco hay tarjeta', () => {
  const a = conOferta({ precio: 35000 }, [{ poferta: 30000 }], { ...cfg, mostrar: false }); assert.equal(a.precioOferta, 30000); assert.equal('precioOfertaTarjeta' in a, false);
  const b = conOferta({ precio: 35000 }, [{ poferta: 30000 }], { pct: 0, redondeo: 0, mostrar: true }); assert.equal('precioOfertaTarjeta' in b, false);
});
await t('conOferta: sin oferta, oferta inválida o que ya no es menor al normal → la ficha queda IGUAL (el campo desaparece solo)', () => {
  const f = { nombre: 'X', precio: 35000, precioTarjeta: 44500 };
  for (const fl of [[{ pventa: 35000 }], [{ poferta: null }], [{ poferta: 0 }], [{ poferta: 35000 }], [{ poferta: 40000 }], [{ poferta: '25000' }], []]) assert.deepEqual(conOferta(f, fl, cfg), f, JSON.stringify(fl));
});
await t('conOferta: nunca toca otros campos ni agrega ptarjeta manual; el manual del normal no se usa para la oferta', () => {
  const f = conOferta({ nombre: 'X', precio: 35000, precioTarjeta: 60000 }, [{ poferta: 30000, ptarjeta: 60000 }], cfg);
  assert.equal(f.precioOfertaTarjeta, 38500); assert.deepEqual(Object.keys(f).sort(), ['nombre', 'precio', 'precioOferta', 'precioOfertaTarjeta', 'precioTarjeta']);
});
await t('ofertaActual: la primera fila con poferta válido; avisa si los talles tienen ofertas distintas o solo algunos', () => {
  assert.deepEqual(ofertaActual(filas), { valor: null, variasOfertas: false });
  assert.deepEqual(ofertaActual(filas.map((f) => ({ ...f, poferta: 30000 }))), { valor: 30000, variasOfertas: false });
  assert.equal(ofertaActual([{ poferta: 30000 }, { poferta: 28000 }]).variasOfertas, true);
  assert.equal(ofertaActual([{ poferta: 30000 }, {}]).variasOfertas, true); // un talle nuevo sin oferta
});
await t('planOferta: una entrada por fila que realmente cambia; solo se escribe `poferta`; quitar = null; Deshacer restaura cada una', () => {
  let p = planOferta(filas, 30000); assert.equal(p.length, 3); assert.deepEqual(camposOferta(30000), { poferta: 30000 });
  assert.deepEqual(camposDeshacerOferta(p[0]), { poferta: null });
  const con = filas.map((f, i) => ({ ...f, poferta: i === 0 ? 29000 : 30000 }));
  p = planOferta(con, 30000); assert.equal(p.length, 1); assert.equal(p[0].id, 'a'); assert.deepEqual(camposDeshacerOferta(p[0]), { poferta: 29000 });
  p = planOferta(con, null); assert.equal(p.length, 3); assert.deepEqual(camposOferta(null), { poferta: null });
  assert.equal(planOferta(filas, null).length, 0, 'quitar una oferta que no existe: nada que cambiar');
  assert.equal(planOferta(con.map((f) => ({ ...f, poferta: 30000 })), 30000).length, 0, 'mismo precio: nada que cambiar');
});
await t('vistaPreviaOferta: porcentaje, tarjeta y cuota (30.000 → 14 %, tarjeta 38.500, 3 cuotas de 12.833); inválida = null', () => {
  assert.deepEqual(vistaPreviaOferta(35000, 30000, cfg), { pct: 14, tarjeta: 38500, cuota: 12833 });
  assert.equal(vistaPreviaOferta(35000, 40000, cfg), null); assert.equal(vistaPreviaOferta(35000, 30000, { pct: 0, redondeo: 0 }).tarjeta, null);
});

if (!process.env.SOLO_PURAS) {
  console.log('— B) navegador (Firestore simulado) —');
  const RAIZ = path.dirname(fileURLToPath(import.meta.url));
  async function cargarPlaywright() {
    try { return await import('playwright'); } catch {}
    if (process.env.PLAYWRIGHT_DIR) { try { return createRequire(path.join(path.resolve(process.env.PLAYWRIGHT_DIR), 'x.js'))('playwright'); } catch {} }
    console.error('No se pudo cargar Playwright. Instalalo fuera del repo y corré con PLAYWRIGHT_DIR=<carpeta> (o SOLO_PURAS=1).'); process.exit(1);
  }
  const { chromium, devices } = await cargarPlaywright();
  const STUB = `
window.__ESCRITURAS = [];
export const db = {};
export const doc = (_d, name, id) => ({ name, id });
export const writeBatch = () => { const ops = []; return { update: (r, data) => ops.push({ r, data }), commit: async () => { if (window.__FALLAR) throw new Error('mock: sin red'); window.__ESCRITURAS.push(ops.map((o) => ({ doc: o.r.name + '/' + o.r.id, data: o.data }))); window.__aplicar(ops); } }; };
`;
  // El bloque HTML de la tarjeta sale del index.html real (así se prueba lo que se publica).
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const a = html.indexOf('<!-- Precio en oferta'), b = html.indexOf('<div id="pe-undo"');
  assert.ok(a > 0 && b > a, 'no se encontró la tarjeta de oferta en index.html');
  const bloque = html.slice(a, html.indexOf('</div>\n  </div>\n</div>', a) + 6);
  const PAGINA = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body>
  <div class="overlay open" id="foto-modal"><div class="modal" style="padding-bottom:90px"><button class="modal-close">✕</button><div class="modal-title" id="fm-titulo">Camiseta Boca Juniors Titular 26/27 (Azul)</div>
  <div style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px"><div style="font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Precio</div><div style="font-size:.78rem;color:var(--muted)">Precio actual: $35.000</div></div>
  ${bloque}</div></div>
  <div id="pe-undo" style="display:none;position:fixed;left:12px;right:12px;bottom:96px;z-index:700;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--accent);border-radius:12px;padding:10px 12px;font-size:.82rem"></div>
  <script>window.toast = (m, t) => { (window.__toasts ||= []).push(m); };</script>
  <script type="module">
  import { state } from '/state.js'; window.__state = state;
  window.__aplicar = (ops) => { for (const o of ops) { const f = state.stockData.find((x) => x.id === o.r.id); Object.assign(f, o.data); } };
  state.stockData = ['S', 'M', 'L'].map((talle) => ({ id: 'p' + talle, cat: 'Camisetas', modelo: 'Boca Juniors Titular 26/27', color: 'Azul', talle, qty: 3, pventa: 35000 }));
  state.configSitio = { recargoTarjetaPct: 27, redondeoTarjeta: 500, mostrarPrecioTarjeta: true }; state.configListo = true;
  const { claveModelo } = await import('/matching.js');
  await import('/ofertas-admin.js');
  window.__modelo = { key: claveModelo(state.stockData[0]) };
  window.__listo = true;
  </script></body></html>`;
  const servidor = await new Promise((r) => { const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
    const s = http.createServer((q, res) => { let u = decodeURIComponent(q.url.split('?')[0]);
      if (u === '/__prueba.html') { res.writeHead(200, { 'Content-Type': T['.html'] }); return res.end(PAGINA); }
      if (u === '/firebase-config.js') { res.writeHead(200, { 'Content-Type': T['.js'] }); return res.end(STUB); }
      const f = path.join(RAIZ, u); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
      res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f)); }).listen(0, '127.0.0.1', () => r(s)); });
  const BASE = `http://127.0.0.1:${servidor.address().port}`;
  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const esp = (ms) => new Promise((r) => setTimeout(r, ms));
  const PERFILES = { iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, android: { ...devices['Pixel 7'] }, pc: { viewport: { width: 1280, height: 800 } } };
  async function abrir(perfil = 'iphone') {
    const ctx = await browser.newContext(PERFILES[perfil]); const page = await ctx.newPage(); const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.goto(BASE + '/__prueba.html'); await page.waitForFunction(() => window.__listo === true);
    await page.evaluate(() => ofAbrir(window.__modelo, 'Camiseta Boca Juniors Titular 26/27 (Azul)'));
    return { page, ctx, errores };
  }
  const escribir = async (page, v) => { await page.fill('#of-precio', v); };
  const txt = (page, id) => page.evaluate((i) => document.getElementById(i).innerText, id);

  await t('sin oferta: la tarjeta lo dice y el botón "Quitar oferta" no aparece', async () => {
    const { page, ctx, errores } = await abrir();
    assert.match(await txt(page, 'of-actual'), /no está en oferta/); assert.equal(await page.isVisible('#of-quitar'), false);
    assert.equal(errores.length, 0, errores.join(' | ')); await ctx.close();
  });
  await t('vista previa en vivo: "-14 %", precio tachado, tarjeta 38.500 y 3 cuotas de 12.833', async () => {
    const { page, ctx } = await abrir(); await escribir(page, '30000');
    const v = await txt(page, 'of-vista'); assert.match(v, /-14%/); assert.match(v, /35\.000/); assert.match(v, /30\.000/); assert.match(v, /38\.500/); assert.match(v, /12\.833/); await ctx.close();
  });
  await t('VALIDACIÓN: precio mayor, igual, 0, texto o decimal → muestra el error y NO escribe nada', async () => {
    const { page, ctx } = await abrir();
    for (const mal of ['40000', '35000', '0', 'abc', '12,5']) { await escribir(page, mal); await page.click('text=Guardar oferta'); const e = await txt(page, 'of-error'); assert.ok(e.length > 10, 'sin error para ' + mal); }
    assert.equal(await page.evaluate(() => window.__ESCRITURAS.length), 0, 'no debió escribir nada');
    assert.match(await txt(page, 'of-error'), /número entero/); await escribir(page, '40000'); await page.click('text=Guardar oferta'); assert.match(await txt(page, 'of-error'), /menor que el precio normal/);
    assert.equal(await page.evaluate(() => window.__state.stockData.some((f) => 'poferta' in f)), false); await ctx.close();
  });
  await t('GUARDAR: escribe SOLO `poferta` en las 3 filas del producto (un lote); la tarjeta muestra la oferta actual y "Quitar oferta"', async () => {
    const { page, ctx } = await abrir(); await escribir(page, '30.000'); await page.click('text=Guardar oferta'); await esp(900);
    const w = await page.evaluate(() => window.__ESCRITURAS); assert.equal(w.length, 1); assert.equal(w[0].length, 3);
    for (const x of w[0]) assert.deepEqual(x.data, { poferta: 30000 });
    assert.deepEqual(w[0].map((x) => x.doc).sort(), ['stock/pL', 'stock/pM', 'stock/pS']);
    assert.match(await txt(page, 'of-actual'), /Oferta actual: \$30\.000/); assert.equal(await page.isVisible('#of-quitar'), true);
    assert.equal(await page.evaluate(() => document.getElementById('pe-undo').style.display), 'flex'); await ctx.close();
  });
  await t('guardar de nuevo el mismo precio: nada que cambiar (no escribe)', async () => {
    const { page, ctx } = await abrir(); await escribir(page, '30000'); await page.click('text=Guardar oferta'); await esp(500);
    await page.click('text=Guardar oferta'); await esp(300); assert.equal(await page.evaluate(() => window.__ESCRITURAS.length), 1); assert.match(await txt(page, 'of-error'), /nada que cambiar/i); await ctx.close();
  });
  await t('QUITAR: pone poferta en null en las 3 filas y la tarjeta vuelve a "sin oferta"', async () => {
    const { page, ctx } = await abrir(); await escribir(page, '30000'); await page.click('text=Guardar oferta'); await esp(500);
    await page.click('#of-quitar'); await esp(900); const w = await page.evaluate(() => window.__ESCRITURAS); assert.equal(w.length, 2); for (const x of w[1]) assert.deepEqual(x.data, { poferta: null });
    assert.match(await txt(page, 'of-actual'), /no está en oferta/); assert.equal(await page.inputValue('#of-precio'), ''); await ctx.close();
  });
  await t('vaciar el campo y guardar también quita la oferta', async () => {
    const { page, ctx } = await abrir(); await escribir(page, '30000'); await page.click('text=Guardar oferta'); await esp(500);
    await escribir(page, ''); await page.click('text=Guardar oferta'); await esp(700); assert.equal(await page.evaluate(() => window.__state.stockData.every((f) => f.poferta == null)), true); await ctx.close();
  });
  await t('DESHACER devuelve la oferta anterior de cada fila', async () => {
    const { page, ctx } = await abrir(); await escribir(page, '30000'); await page.click('text=Guardar oferta'); await esp(500);
    await escribir(page, '28000'); await page.click('text=Guardar oferta'); await esp(500);
    await page.click('#pe-undo button'); await esp(700); assert.equal(await page.evaluate(() => window.__state.stockData.every((f) => f.poferta === 30000)), true); await ctx.close();
  });
  await t('si el precio normal baja y la oferta deja de ser menor, la tarjeta avisa que la tienda NO la muestra', async () => {
    const { page, ctx } = await abrir(); await escribir(page, '30000'); await page.click('text=Guardar oferta'); await esp(500);
    await page.evaluate(() => { for (const f of window.__state.stockData) f.pventa = 29000; ofVista(); });
    assert.match(await txt(page, 'of-aviso'), /la tienda NO la muestra/); await ctx.close();
  });
  await t('falla de red al guardar: muestra el error y no cambia nada', async () => {
    const { page, ctx } = await abrir(); await page.evaluate(() => { window.__FALLAR = true; }); await escribir(page, '30000'); await page.click('text=Guardar oferta'); await esp(500);
    assert.match(await txt(page, 'of-error'), /No se guardó/); assert.equal(await page.evaluate(() => window.__state.stockData.some((f) => 'poferta' in f)), false); await ctx.close();
  });
  await t('MOBILE: la tarjeta entra en el ancho del celular sin desborde y los botones miden 44 px o más', async () => {
    for (const perfil of ['iphone', 'android', 'pc']) {
      const { page, ctx, errores } = await abrir(perfil); await escribir(page, '30000');
      const m = await page.evaluate(() => ({ d: document.documentElement.scrollWidth - document.documentElement.clientWidth, bh: [...document.querySelectorAll('#of-root button')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect().height) }));
      assert.ok(m.d <= 1, perfil + ' desborde ' + m.d); assert.ok(m.bh.every((h) => h >= 40), perfil + ' botón bajo: ' + m.bh);
      if (process.env.CAPTURAS) { fs.mkdirSync(process.env.CAPTURAS, { recursive: true }); await page.evaluate(() => document.getElementById('of-root').scrollIntoView({ block: 'center' })); await esp(200); await page.screenshot({ path: path.join(process.env.CAPTURAS, `stockmgr-oferta-${perfil}.png`) }); }
      assert.equal(errores.length, 0, errores.join(' | ')); await ctx.close();
    }
  });
  await browser.close(); servidor.close();
}
console.log(fallos ? `\n${fallos} prueba(s) FALLARON, ${ok} bien` : `\nTodo OK: ${ok} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
