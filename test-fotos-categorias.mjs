// ══════════════════════════════════════════
// PRUEBAS DE "FOTOS DE CATEGORÍAS" EN STOCKMGR (fotos-categorias.js + fotos-categorias-admin.js). NO toca el Firestore ni Cloudinary reales.
//   A) lógica pura: qué se lee/guarda (nombre en plural → url), categorías de las filas, última foto de una categoría, cargar/quitar, qué escribe.
//   B) navegador (Chrome): la tarjeta de Catálogo y sitio: una fila por categoría con miniatura, subir/cambiar foto, "Quitar (usar última foto)",
//      recomendación 1200×900 (4:3), guarda SOLO fotosCategorias (reemplazando ese campo), errores. Con CAPTURAS=<carpeta> guarda capturas.
// Uso: node test-fotos-categorias.mjs   (B necesita Playwright fuera del repo: PLAYWRIGHT_DIR=<carpeta> y Chrome)   SOLO_PURAS=1 → solo A
// ══════════════════════════════════════════
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { RECOMENDACION, urlValida, leerFotos, categoriasDeFilas, modelosEnCatalogo, ultimaFotoCategoria, conFoto, sinFoto, camposFotos, OPCIONES_GUARDAR, miniatura } from './fotos-categorias.js';
import { claveModelo } from './matching.js';

let ok = 0, fallos = 0;
const t = async (n, f) => { if (process.env.SOLO && !n.includes(process.env.SOLO)) return; try { await f(); ok++; console.log('ok', n); } catch (e) { fallos++; console.log('FALLA', n, '\n   ', String(e.message).split('\n').slice(0, 3).join('\n    ')); } };
const U = (n) => `https://res.cloudinary.com/d5fzjp10/image/upload/v1/${n}.jpg`;
const fila = (cat, modelo, createdAt, extra = {}) => ({ id: cat + modelo + (extra.talle || 'M'), cat, modelo, color: 'Negro', talle: 'M', qty: 3, pventa: 30000, catalogo: true, createdAt, ...extra });
const FILAS = [fila('Camisetas', 'Boca', 100), fila('Camisetas', 'Boca', 150, { talle: 'L' }), fila('Camisetas', 'River', 900), fila('Camiseta', 'Racing', 500), fila('Conjuntos', 'Inter', 300), fila('Chombas', 'Polo', 50, { catalogo: false }), fila('Gorras', 'G5', 10, { catalogo: false })];
const FP = { [claveModelo(FILAS[0])]: [U('boca')], [claveModelo(FILAS[2])]: [U('river')], [claveModelo(FILAS[3])]: [U('racing')], [claveModelo(FILAS[4])]: [U('inter')] };

console.log('— A) lógica pura —');
await t('recomendación y url válida: 1200×900 (4:3), solo https', () => { assert.match(RECOMENDACION, /1200×900 px \(4:3\)/); assert.match(RECOMENDACION, /Lo importante al centro/); assert.equal(urlValida(U('a')), true); for (const m of ['', null, 'http://x.com/a.jpg', 'javascript:alert(1)', 'https://x.com/a b']) assert.equal(urlValida(m), false); });
await t('leerFotos: nombres en PLURAL (Camiseta → Camisetas), solo https, tolera el campo inexistente o con basura; una sola por categoría', () => {
  assert.deepEqual(leerFotos({ fotosCategorias: { Camisetas: U('a'), Conjuntos: U('b') } }), { Camisetas: U('a'), Conjuntos: U('b') });
  assert.deepEqual(leerFotos({ fotosCategorias: { Camiseta: U('a'), camisetas: U('z'), 'Gorra G5': U('g') } }), { Camisetas: U('a'), Gorras: U('g') });
  for (const x of [undefined, null, {}, { fotosCategorias: null }, { fotosCategorias: 'x' }, { fotosCategorias: [U('a')] }, { fotosCategorias: { Camisetas: 'http://x/a.jpg' } }, { fotosCategorias: { Camisetas: null } }]) assert.deepEqual(leerFotos(x), {}, JSON.stringify(x));
});
await t('categoriasDeFilas: una por categoría (singular y plural juntos), en plural y en el orden de la tabla; suma las que ya tienen foto aunque no haya stock', () => {
  assert.deepEqual(categoriasDeFilas(FILAS, {}).map((c) => c.nombre), ['Camisetas', 'Conjuntos', 'Gorras', 'Chombas']);
  assert.deepEqual(categoriasDeFilas(FILAS, { Remeras: U('r') }).map((c) => c.nombre), ['Camisetas', 'Conjuntos', 'Gorras', 'Chombas', 'Remeras']);
  assert.deepEqual(categoriasDeFilas([], {}), []); assert.deepEqual(categoriasDeFilas([{ cat: '  ' }, { cat: 'Zapatillas' }, { cat: 'zapatillas' }], {}).map((c) => c.nombre), ['Zapatillas']);
});
await t('modelosEnCatalogo: cuenta los modelos marcados para el catálogo de la categoría', () => { assert.equal(modelosEnCatalogo(FILAS, 'camiseta'), 3); assert.equal(modelosEnCatalogo(FILAS, 'conjunto'), 1); assert.equal(modelosEnCatalogo(FILAS, 'chombas'), 0, 'Chombas no está en el catálogo'); assert.equal(modelosEnCatalogo(FILAS, 'gorra g5'), 0); });
await t('ultimaFotoCategoria: la foto principal del modelo más nuevo (por fecha de alta) de la categoría, entre los del catálogo y con foto', () => {
  assert.equal(ultimaFotoCategoria(FILAS, FP, 'camiseta'), U('river')); assert.equal(ultimaFotoCategoria(FILAS, FP, 'conjunto'), U('inter')); assert.equal(ultimaFotoCategoria(FILAS, FP, 'chombas'), null, 'fuera del catálogo'); assert.equal(ultimaFotoCategoria(FILAS, {}, 'camiseta'), null);
  assert.equal(ultimaFotoCategoria(FILAS, { [claveModelo(FILAS[3])]: [U('racing')] }, 'camiseta'), U('racing'), 'si el más nuevo no tiene foto, el siguiente'); assert.equal(ultimaFotoCategoria(null, null, 'camiseta'), null);
});
await t('conFoto / sinFoto: devuelven un mapa nuevo (no tocan el original), reemplazan la foto de la misma categoría (aunque estuviera con otro nombre) y quitar solo saca esa', () => {
  const m = { Camisetas: U('a'), Conjuntos: U('b') }; const n = conFoto(m, 'Camiseta', U('nueva')); assert.deepEqual(n, { Conjuntos: U('b'), Camisetas: U('nueva') }); assert.deepEqual(m, { Camisetas: U('a'), Conjuntos: U('b') }, 'el original queda igual');
  assert.deepEqual(sinFoto(m, 'Camisetas'), { Conjuntos: U('b') }); assert.deepEqual(sinFoto(m, 'camiseta'), { Conjuntos: U('b') }); assert.deepEqual(sinFoto(m, 'Remeras'), m); assert.deepEqual(sinFoto({}, 'Camisetas'), {}); assert.deepEqual(sinFoto(undefined, 'Camisetas'), {});
  assert.throws(() => conFoto(m, 'Camisetas', 'http://x.com/a.jpg'), /no es válida/); assert.throws(() => conFoto(m, 'Camisetas', ''), /no es válida/);
});
await t('qué se escribe: SOLO el campo fotosCategorias y REEMPLAZÁNDOLO entero (mergeFields), así "Quitar" de verdad borra la clave', () => { assert.deepEqual(Object.keys(camposFotos({ Camisetas: U('a') })), ['fotosCategorias']); assert.deepEqual(OPCIONES_GUARDAR, { mergeFields: ['fotosCategorias'] }); });
await t('miniatura: Cloudinary se achica (240 px), otras urls o ya transformadas quedan iguales', () => { assert.equal(miniatura(U('a')), 'https://res.cloudinary.com/d5fzjp10/image/upload/f_auto,q_auto:eco,c_limit,w_240/v1/a.jpg'); assert.equal(miniatura('https://x.com/a.jpg'), 'https://x.com/a.jpg'); const ya = 'https://res.cloudinary.com/d5fzjp10/image/upload/w_100/v1/a.jpg'; assert.equal(miniatura(ya), ya); });

if (!process.env.SOLO_PURAS) {
  console.log('— B) navegador (Firestore y Cloudinary simulados) —');
  const RAIZ = path.dirname(fileURLToPath(import.meta.url));
  async function cargarPlaywright() {
    try { return await import('playwright'); } catch {}
    if (process.env.PLAYWRIGHT_DIR) { try { return createRequire(path.join(path.resolve(process.env.PLAYWRIGHT_DIR), 'x.js'))('playwright'); } catch {} }
    console.error('No se pudo cargar Playwright. Instalalo fuera del repo y corré con PLAYWRIGHT_DIR=<carpeta> (o SOLO_PURAS=1).'); process.exit(1);
  }
  const { chromium, devices } = await cargarPlaywright();
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(html.includes('<div id="cf-root"></div>'), 'falta #cf-root en index.html'); assert.ok(html.includes('fotos-categorias-admin.css'), 'falta el CSS en index.html');
  const STUB = `
window.__ESCRITURAS = [];
export const db = {};
export const doc = (_d, name, id) => ({ name, id });
export const setDoc = async (ref, data, opts) => { if (window.__FALLAR) throw new Error('mock: sin red'); window.__ESCRITURAS.push({ doc: ref.name + '/' + ref.id, data: JSON.parse(JSON.stringify(data)), opts }); window.__aplicar(data, opts); };
`;
  const PAGINA = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/fotos-categorias-admin.css"></head><body style="padding-bottom:90px">
  <div id="cf-root" style="padding:0 12px"></div>
  <script>window.toast = (m) => { (window.__toasts ||= []).push(m); }; window.__SUBIDAS = 0; window.subirFotoGenerica = async (f) => { window.__SUBIDAS++; if (window.__FALLAR_SUBIDA) throw new Error('No se pudo subir la foto.'); await new Promise((r) => setTimeout(r, 60)); return 'https://res.cloudinary.com/d5fzjp10/image/upload/v1/categoria' + window.__SUBIDAS + '.png'; };</script>
  <script type="module">
  import { state } from '/state.js'; window.__state = state;
  const { claveModelo } = await import('/matching.js');
  state.configSitio = window.__CFG || {}; state.stockData = window.__FILAS || []; state.productoFotos = {};
  for (const [i, u] of Object.entries(window.__FOTOS_MODELOS || {})) { const f = state.stockData.find((x) => x.id === i); if (f) state.productoFotos[claveModelo(f)] = [u]; }
  // como Firestore con mergeFields: el campo se REEMPLAZA entero; lo demás de la config queda
  window.__aplicar = (data, opts) => { for (const c of (opts && opts.mergeFields) || Object.keys(data)) state.configSitio = { ...state.configSitio, [c]: data[c] }; window.cfRender && window.cfRender(); };
  await import('/fotos-categorias-admin.js');
  window.__listo = true;
  </script></body></html>`;
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const servidor = await new Promise((r) => { const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
    const s = http.createServer((q, res) => { let u = decodeURIComponent(q.url.split('?')[0]);
      if (u === '/__prueba.html') { res.writeHead(200, { 'Content-Type': T['.html'] }); return res.end(PAGINA); }
      if (u === '/firebase-config.js') { res.writeHead(200, { 'Content-Type': T['.js'] }); return res.end(STUB); }
      const f = path.join(RAIZ, u); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
      res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f)); }).listen(0, '127.0.0.1', () => r(s)); });
  const BASE = `http://127.0.0.1:${servidor.address().port}`;
  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const esp = (ms) => new Promise((r) => setTimeout(r, ms));
  const PERFILES = { iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, android: { ...devices['Pixel 7'] }, pc: { viewport: { width: 1280, height: 900 } } };
  const FOTOS_MODELOS = { [FILAS[0].id]: U('boca'), [FILAS[2].id]: U('river'), [FILAS[3].id]: U('racing'), [FILAS[4].id]: U('inter') };
  async function abrir(perfil = 'iphone', cfg = {}) {
    const ctx = await browser.newContext(PERFILES[perfil]);
    await ctx.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE)) return r.continue(); if (/res\.cloudinary\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); return r.abort(); });
    const page = await ctx.newPage(); const errores = []; page.on('pageerror', (e) => errores.push(e.message));
    await page.addInitScript(({ c, f, fm }) => { window.__CFG = c; window.__FILAS = f; window.__FOTOS_MODELOS = fm; }, { c: cfg, f: FILAS, fm: FOTOS_MODELOS });
    await page.goto(BASE + '/__prueba.html'); await page.waitForFunction(() => window.__listo === true);
    return { page, ctx, errores };
  }
  const PNG_ARCHIVO = { name: 'foto.png', mimeType: 'image/png', buffer: PNG };
  const fila$ = (n) => `.cf-adm-fila[data-cat="${n}"]`;
  const txt = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
  const escrituras = (page) => page.evaluate(() => window.__ESCRITURAS);

  await t('la tarjeta muestra la recomendación visible "Foto horizontal 1200×900 px (4:3). Lo importante al centro." y una fila por categoría, con su miniatura y de dónde sale la foto', async () => {
    const { page, ctx, errores } = await abrir('iphone');
    assert.equal((await txt(page, '#cf-reco')).replace(/^📐\s*/, ''), 'Foto horizontal 1200×900 px (4:3). Lo importante al centro.');
    const nombres = await page.evaluate(() => [...document.querySelectorAll('.cf-adm-fila')].map((f) => f.dataset.cat)); assert.deepEqual(nombres, ['Camisetas', 'Conjuntos', 'Gorras', 'Chombas']);
    assert.match(await txt(page, fila$('Camisetas') + ' .cf-adm-origen'), /Usa la foto del último producto ingresado/); assert.match(await page.evaluate(() => document.querySelector('.cf-adm-fila[data-cat="Camisetas"] img').getAttribute('src')), /w_240\/v1\/river\.jpg$/, 'la miniatura es la del modelo más nuevo');
    assert.match(await txt(page, fila$('Chombas') + ' .cf-adm-origen'), /Sin productos en el catálogo/); assert.equal(await page.evaluate(() => document.querySelectorAll('.cf-adm-quitar').length), 0, 'sin foto cargada no hay "Quitar"');
    assert.equal(errores.length, 0, errores.join(' | ')); await ctx.close();
  });
  await t('SUBIR FOTO: se sube con el mismo uploader, se guarda SOLO fotosCategorias (reemplazando el campo), aparece "Foto cargada por vos", "Cambiar foto" y "Quitar (usar última foto)"', async () => {
    const { page, ctx } = await abrir('iphone', { heroTitulo: 'x', mantenimiento: false });
    await page.setInputFiles(fila$('Camisetas') + ' input[type="file"]', PNG_ARCHIVO); await page.waitForFunction(() => document.querySelector('#cf-estado').textContent.includes('guardada'), null, { timeout: 4000 });
    const w = await escrituras(page); assert.equal(w.length, 1); assert.equal(w[0].doc, 'config_sitio/config'); assert.deepEqual(Object.keys(w[0].data), ['fotosCategorias']); assert.deepEqual(w[0].opts, { mergeFields: ['fotosCategorias'] });
    assert.deepEqual(w[0].data.fotosCategorias, { Camisetas: 'https://res.cloudinary.com/d5fzjp10/image/upload/v1/categoria1.png' }); assert.equal(await page.evaluate(() => window.__SUBIDAS), 1);
    assert.match(await txt(page, fila$('Camisetas') + ' .cf-adm-origen'), /Foto cargada por vos/); assert.match(await txt(page, fila$('Camisetas') + ' .cf-adm-subir'), /cambiar foto/i); assert.match(await txt(page, fila$('Camisetas') + ' .cf-adm-quitar'), /quitar \(usar última foto\)/i);
    assert.match(await page.evaluate(() => document.querySelector('.cf-adm-fila[data-cat="Camisetas"] img').getAttribute('src')), /categoria1\.png$/); assert.equal(await page.evaluate(() => window.__state.configSitio.heroTitulo), 'x', 'el resto de la config queda'); await ctx.close();
  });
  await t('varias categorías: cada subida conserva las anteriores; "Cambiar foto" reemplaza solo esa', async () => {
    const { page, ctx } = await abrir('iphone');
    for (const c of ['Camisetas', 'Conjuntos', 'Gorras']) { await page.setInputFiles(fila$(c) + ' input[type="file"]', PNG_ARCHIVO); await page.waitForFunction((n) => document.querySelector('#cf-estado').textContent.includes('Foto de ' + n + ' guardada'), c, { timeout: 4000 }); }
    let w = await escrituras(page); assert.deepEqual(Object.keys(w[2].data.fotosCategorias).sort(), ['Camisetas', 'Conjuntos', 'Gorras']);
    await page.setInputFiles(fila$('Conjuntos') + ' input[type="file"]', PNG_ARCHIVO); await page.waitForFunction(() => window.__ESCRITURAS.length === 4, null, { timeout: 4000 }); w = await escrituras(page);
    assert.equal(w[3].data.fotosCategorias.Conjuntos.endsWith('categoria4.png'), true); assert.equal(w[3].data.fotosCategorias.Camisetas.endsWith('categoria1.png'), true); assert.equal(Object.keys(w[3].data.fotosCategorias).length, 3); await ctx.close();
  });
  await t('QUITAR (usar última foto): borra SOLO esa categoría (se reemplaza el campo sin esa clave), vuelve a usar la foto del último producto y desaparece el botón', async () => {
    const { page, ctx } = await abrir('iphone', { fotosCategorias: { Camisetas: U('mia'), Conjuntos: U('conj') } });
    assert.match(await txt(page, fila$('Camisetas') + ' .cf-adm-origen'), /Foto cargada por vos/);
    await page.click(fila$('Camisetas') + ' .cf-adm-quitar'); await page.waitForFunction(() => document.querySelector('#cf-estado').textContent.includes('Se quitó'), null, { timeout: 4000 });
    const w = await escrituras(page); assert.deepEqual(w[0].data, { fotosCategorias: { Conjuntos: U('conj') } }); assert.deepEqual(w[0].opts, { mergeFields: ['fotosCategorias'] });
    assert.match(await txt(page, fila$('Camisetas') + ' .cf-adm-origen'), /Usa la foto del último producto ingresado/); assert.equal(await page.evaluate(() => document.querySelectorAll('.cf-adm-fila[data-cat="Camisetas"] .cf-adm-quitar').length), 0); assert.equal(await page.evaluate(() => document.querySelectorAll('.cf-adm-quitar').length), 1, 'Conjuntos sigue con su foto');
    await page.click(fila$('Conjuntos') + ' .cf-adm-quitar'); await page.waitForFunction(() => window.__ESCRITURAS.length === 2, null, { timeout: 4000 }); assert.deepEqual((await escrituras(page))[1].data, { fotosCategorias: {} }, 'al quitar la última queda el campo vacío'); await ctx.close();
  });
  await t('ERRORES: si falla la subida no se escribe nada y avisa; si falla guardar muestra el error y la foto no queda como cargada', async () => {
    const { page, ctx } = await abrir('iphone'); await page.evaluate(() => { window.__FALLAR_SUBIDA = true; });
    await page.setInputFiles(fila$('Camisetas') + ' input[type="file"]', PNG_ARCHIVO); await page.waitForFunction(() => document.querySelector('#cf-estado').textContent.includes('No se pudo subir'), null, { timeout: 4000 }); assert.equal((await escrituras(page)).length, 0);
    await page.evaluate(() => { window.__FALLAR_SUBIDA = false; window.__FALLAR = true; }); await page.setInputFiles(fila$('Camisetas') + ' input[type="file"]', PNG_ARCHIVO); await page.waitForFunction(() => document.querySelector('#cf-estado').textContent.includes('No se guardó'), null, { timeout: 4000 });
    assert.match(await txt(page, fila$('Camisetas') + ' .cf-adm-origen'), /Usa la foto del último producto/); assert.equal(await page.evaluate(() => document.querySelectorAll('.cf-adm-fila input:disabled').length), 0, 'los botones se vuelven a habilitar'); await ctx.close();
  });
  await t('una categoría con foto cargada pero sin stock sigue en la lista (se puede quitar); sin categorías la tarjeta lo dice', async () => {
    const { page, ctx } = await abrir('iphone', { fotosCategorias: { Remeras: U('r') } }); assert.ok((await page.evaluate(() => [...document.querySelectorAll('.cf-adm-fila')].map((f) => f.dataset.cat))).includes('Remeras')); await ctx.close();
    const v = await abrir('iphone'); await v.page.evaluate(() => { window.__state.stockData = []; window.cfRender(); }); assert.match(await txt(v.page, '#cf-lista'), /Todavía no hay productos con categoría/); await v.ctx.close();
  });
  await t('MOBILE: sin desborde horizontal, botones de 44 px o más y nada encimado (iPhone, Android, PC)', async () => {
    for (const perfil of ['iphone', 'android', 'pc']) {
      const { page, ctx, errores } = await abrir(perfil, { fotosCategorias: { Camisetas: U('mia') } });
      const m = await page.evaluate(() => ({ d: document.documentElement.scrollWidth - document.documentElement.clientWidth, bh: [...document.querySelectorAll('#cf-root .btn')].filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().height)), fuera: [...document.querySelectorAll('.cf-adm-fila')].filter((f) => f.getBoundingClientRect().right > innerWidth + 1).length, prop: (() => { const r = document.querySelector('.cf-adm-mini').getBoundingClientRect(); return r.width / r.height; })() }));
      assert.ok(m.d <= 1, perfil + ' desborde ' + m.d); assert.ok(m.bh.every((h) => h >= 44), perfil + ' botón bajo: ' + m.bh); assert.equal(m.fuera, 0); assert.ok(Math.abs(m.prop - 4 / 3) < 0.02, 'miniatura 4:3'); assert.equal(errores.length, 0, errores.join(' | '));
      if (process.env.CAPTURAS) { fs.mkdirSync(process.env.CAPTURAS, { recursive: true }); await page.evaluate(() => document.getElementById('cf-panel').scrollIntoView({ block: 'start' })); await esp(300); await page.screenshot({ path: path.join(process.env.CAPTURAS, `stockmgr-fotos-categorias-${perfil}.png`) }); }
      await ctx.close();
    }
  });
  await browser.close(); servidor.close();
}
console.log(fallos ? `\n${fallos} prueba(s) FALLARON, ${ok} bien` : `\nTodo OK: ${ok} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
