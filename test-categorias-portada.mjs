// ══════════════════════════════════════════
// PRUEBAS DE "CATEGORÍAS DE LA PORTADA" EN STOCKMGR (categorias-portada.js + categorias-portada-admin.js). NO toca el Firestore ni Cloudinary reales.
//   A) lógica pura: qué se lee/guarda ({ categoría: { foto, frase } }, nombre en plural), frase de hasta 30 caracteres, categorías de las filas, última foto de
//      una categoría, cargar/quitar foto y frase, qué se escribe.
//   B) navegador (Chrome): la tarjeta de Catálogo y sitio: una fila por categoría con miniatura, frase opcional, subir/cambiar foto, "Quitar (usar última foto)",
//      recomendación 1080×1350 (4:5), guarda SOLO categoriasPortada (reemplazando ese campo), errores. Con CAPTURAS=<carpeta> guarda capturas.
// Uso: node test-categorias-portada.mjs   (B necesita Playwright fuera del repo: PLAYWRIGHT_DIR=<carpeta> y Chrome)   SOLO_PURAS=1 → solo A
// ══════════════════════════════════════════
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { RECOMENDACION, MAX_FRASE, urlValida, limpiarFrase, leerCategorias, categoriasDeFilas, modelosEnCatalogo, ultimaFotoCategoria, conFoto, sinFoto, conFrase, camposPortada, OPCIONES_GUARDAR, miniatura } from './categorias-portada.js';
import { claveModelo } from './matching.js';

let ok = 0, fallos = 0;
const t = async (n, f) => { if (process.env.SOLO && !n.includes(process.env.SOLO)) return; try { await f(); ok++; console.log('ok', n); } catch (e) { fallos++; console.log('FALLA', n, '\n   ', String(e.message).split('\n').slice(0, 3).join('\n    ')); } };
const U = (n) => `https://res.cloudinary.com/d5fzjp10/image/upload/v1/${n}.jpg`;
const fila = (cat, modelo, createdAt, extra = {}) => ({ id: cat + modelo + (extra.talle || 'M'), cat, modelo, color: 'Negro', talle: 'M', qty: 3, pventa: 30000, catalogo: true, createdAt, ...extra });
const FILAS = [fila('Camisetas', 'Boca', 100), fila('Camisetas', 'Boca', 150, { talle: 'L' }), fila('Camisetas', 'River', 900), fila('Camiseta', 'Racing', 500), fila('Conjuntos', 'Inter', 300), fila('Chombas', 'Polo', 50, { catalogo: false }), fila('Gorras', 'G5', 10, { catalogo: false })];
const FP = { [claveModelo(FILAS[0])]: [U('boca')], [claveModelo(FILAS[2])]: [U('river')], [claveModelo(FILAS[3])]: [U('racing')], [claveModelo(FILAS[4])]: [U('inter')] };

console.log('— A) lógica pura —');
await t('recomendación vertical 1080×1350 (4:5), frase de hasta 30 caracteres y url https', () => { assert.equal(RECOMENDACION, 'Foto vertical 1080×1350 px (4:5). Lo importante al centro.'); assert.equal(MAX_FRASE, 30); assert.equal(urlValida(U('a')), true); for (const m of ['', null, 'http://x.com/a.jpg', 'javascript:alert(1)', 'https://x.com/a b']) assert.equal(urlValida(m), false); assert.equal(limpiarFrase('  Hola    mundo  '), 'Hola mundo'); assert.equal(limpiarFrase('x'.repeat(80)).length, 30); assert.equal(limpiarFrase(null), ''); });
await t('leerCategorias: { categoría: { foto, frase } } con nombres en PLURAL (Camiseta → Camisetas), solo fotos https, frase ≤ 30, sin entradas vacías; tolera el campo inexistente o con basura; una por categoría', () => {
  assert.deepEqual(leerCategorias({ categoriasPortada: { Camisetas: { foto: U('a'), frase: 'Nuevas' }, Conjuntos: { frase: 'Para entrenar' } } }), { Camisetas: { foto: U('a'), frase: 'Nuevas' }, Conjuntos: { frase: 'Para entrenar' } });
  assert.deepEqual(leerCategorias({ categoriasPortada: { Camiseta: { foto: U('a') }, camisetas: { foto: U('z') }, 'Gorra G5': { foto: U('g') } } }), { Camisetas: { foto: U('a') }, Gorras: { foto: U('g') } });
  assert.deepEqual(leerCategorias({ categoriasPortada: { Camisetas: { foto: 'http://x/a.jpg', frase: 'ok' } } }), { Camisetas: { frase: 'ok' } }); assert.equal(leerCategorias({ categoriasPortada: { Camisetas: { frase: 'x'.repeat(50) } } }).Camisetas.frase.length, 30);
  for (const x of [undefined, null, {}, { categoriasPortada: null }, { categoriasPortada: 'x' }, { categoriasPortada: [{ foto: U('a') }] }, { categoriasPortada: { Camisetas: 'https://x/a.jpg' } }, { categoriasPortada: { Camisetas: {} } }, { categoriasPortada: { Camisetas: { foto: null, frase: '  ' } } }, { categoriasPortada: { '': { foto: U('a') } } }]) assert.deepEqual(leerCategorias(x), {}, JSON.stringify(x));
});
await t('categoriasDeFilas: una por categoría (singular y plural juntos), en plural y en el orden de la tabla; suma las que ya tienen foto o frase aunque no haya stock', () => {
  assert.deepEqual(categoriasDeFilas(FILAS, {}).map((c) => c.nombre), ['Camisetas', 'Conjuntos', 'Gorras', 'Chombas']);
  assert.deepEqual(categoriasDeFilas(FILAS, { Remeras: { frase: 'x' } }).map((c) => c.nombre), ['Camisetas', 'Conjuntos', 'Gorras', 'Chombas', 'Remeras']);
  assert.deepEqual(categoriasDeFilas([], {}), []); assert.deepEqual(categoriasDeFilas([{ cat: '  ' }, { cat: 'Zapatillas' }, { cat: 'zapatillas' }], {}).map((c) => c.nombre), ['Zapatillas']);
});
await t('modelosEnCatalogo y ultimaFotoCategoria: la foto principal del modelo más nuevo (por fecha de alta) de la categoría, entre los del catálogo y con foto', () => {
  assert.equal(modelosEnCatalogo(FILAS, 'camiseta'), 3); assert.equal(modelosEnCatalogo(FILAS, 'conjunto'), 1); assert.equal(modelosEnCatalogo(FILAS, 'chombas'), 0);
  assert.equal(ultimaFotoCategoria(FILAS, FP, 'camiseta'), U('river')); assert.equal(ultimaFotoCategoria(FILAS, FP, 'conjunto'), U('inter')); assert.equal(ultimaFotoCategoria(FILAS, FP, 'chombas'), null, 'fuera del catálogo'); assert.equal(ultimaFotoCategoria(FILAS, {}, 'camiseta'), null);
  assert.equal(ultimaFotoCategoria(FILAS, { [claveModelo(FILAS[3])]: [U('racing')] }, 'camiseta'), U('racing'), 'si el más nuevo no tiene foto, el siguiente'); assert.equal(ultimaFotoCategoria(null, null, 'camiseta'), null);
});
await t('conFoto / sinFoto / conFrase: mapas nuevos (no tocan el original); la foto y la frase se conservan una a la otra; una entrada sin foto ni frase se borra; no quedan dos entradas de la misma categoría', () => {
  const m = { Camisetas: { foto: U('a'), frase: 'Nuevas' }, Conjuntos: { foto: U('b') } };
  assert.deepEqual(conFoto(m, 'Camiseta', U('nueva')), { Conjuntos: { foto: U('b') }, Camisetas: { foto: U('nueva'), frase: 'Nuevas' } }); assert.deepEqual(m.Camisetas, { foto: U('a'), frase: 'Nuevas' }, 'el original queda igual');
  assert.deepEqual(sinFoto(m, 'Camisetas'), { Conjuntos: { foto: U('b') }, Camisetas: { frase: 'Nuevas' } }, 'quitar la foto deja la frase'); assert.deepEqual(sinFoto(m, 'Conjuntos'), { Camisetas: { foto: U('a'), frase: 'Nuevas' } }, 'sin foto ni frase: se borra la entrada'); assert.deepEqual(sinFoto(m, 'Remeras'), m);
  assert.deepEqual(conFrase(m, 'Conjuntos', '  Para   entrenar '), { Camisetas: { foto: U('a'), frase: 'Nuevas' }, Conjuntos: { foto: U('b'), frase: 'Para entrenar' } }); assert.deepEqual(conFrase(m, 'Camisetas', ''), { Conjuntos: { foto: U('b') }, Camisetas: { foto: U('a') } }, 'frase vacía: solo se saca la frase');
  assert.deepEqual(conFrase({}, 'Remeras', 'Hola'), { Remeras: { frase: 'Hola' } }); assert.equal(conFrase({}, 'Remeras', 'x'.repeat(60)).Remeras.frase.length, 30); assert.deepEqual(conFrase({ Camisetas: { frase: 'a' } }, 'Camisetas', ''), {}, 'sin nada, se borra');
  assert.throws(() => conFoto(m, 'Camisetas', 'http://x.com/a.jpg'), /no es válida/); assert.throws(() => conFoto(m, 'Camisetas', ''), /no es válida/);
});
await t('qué se escribe: SOLO el campo categoriasPortada y REEMPLAZÁNDOLO entero (mergeFields), así "Quitar" de verdad borra', () => { assert.deepEqual(Object.keys(camposPortada({ Camisetas: { foto: U('a') } })), ['categoriasPortada']); assert.deepEqual(OPCIONES_GUARDAR, { mergeFields: ['categoriasPortada'] }); });
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
  assert.ok(html.includes('<div id="cp-root"></div>'), 'falta #cp-root en index.html'); assert.ok(html.includes('categorias-portada-admin.css'), 'falta el CSS en index.html');
  const STUB = `
window.__ESCRITURAS = [];
export const db = {};
export const doc = (_d, name, id) => ({ name, id });
export const setDoc = async (ref, data, opts) => { if (window.__FALLAR) throw new Error('mock: sin red'); window.__ESCRITURAS.push({ doc: ref.name + '/' + ref.id, data: JSON.parse(JSON.stringify(data)), opts }); window.__aplicar(data, opts); };
`;
  const PAGINA = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/categorias-portada-admin.css"></head><body style="padding-bottom:90px">
  <div id="cp-root" style="padding:0 12px"></div>
  <script>window.toast = (m) => { (window.__toasts ||= []).push(m); }; window.__SUBIDAS = 0; window.subirFotoGenerica = async (f) => { window.__SUBIDAS++; if (window.__FALLAR_SUBIDA) throw new Error('No se pudo subir la foto.'); await new Promise((r) => setTimeout(r, 60)); return 'https://res.cloudinary.com/d5fzjp10/image/upload/v1/categoria' + window.__SUBIDAS + '.png'; };</script>
  <script type="module">
  import { state } from '/state.js'; window.__state = state;
  const { claveModelo } = await import('/matching.js');
  state.configSitio = window.__CFG || {}; state.stockData = window.__FILAS || []; state.productoFotos = {};
  for (const [i, u] of Object.entries(window.__FOTOS_MODELOS || {})) { const f = state.stockData.find((x) => x.id === i); if (f) state.productoFotos[claveModelo(f)] = [u]; }
  // como Firestore con mergeFields: el campo se REEMPLAZA entero; lo demás de la config queda
  window.__aplicar = (data, opts) => { for (const c of (opts && opts.mergeFields) || Object.keys(data)) state.configSitio = { ...state.configSitio, [c]: data[c] }; window.cpRender && window.cpRender(); };
  await import('/categorias-portada-admin.js');
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
  const fila$ = (n) => `.cp-adm-fila[data-cat="${n}"]`;
  const txt = (page, sel) => page.evaluate((s) => document.querySelector(s).innerText, sel);
  const escrituras = (page) => page.evaluate(() => window.__ESCRITURAS);
  const esperarEstado = (page, texto) => page.waitForFunction((x) => document.querySelector('#cp-estado').textContent.includes(x), texto, { timeout: 4000 });

  await t('la tarjeta muestra la recomendación visible "Foto vertical 1080×1350 px (4:5). Lo importante al centro." y una fila por categoría, con miniatura vertical, frase y de dónde sale la foto', async () => {
    const { page, ctx, errores } = await abrir('iphone', { categoriasPortada: { Conjuntos: { frase: 'Para entrenar' } } });
    assert.equal((await txt(page, '#cp-reco')).replace(/^📐\s*/, ''), 'Foto vertical 1080×1350 px (4:5). Lo importante al centro.');
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.cp-adm-fila')].map((f) => f.dataset.cat)), ['Camisetas', 'Conjuntos', 'Gorras', 'Chombas']);
    assert.match(await txt(page, fila$('Camisetas') + ' .cp-adm-origen'), /Usa la foto del último producto ingresado/); assert.match(await page.evaluate(() => document.querySelector('.cp-adm-fila[data-cat="Camisetas"] img').getAttribute('src')), /w_240\/v1\/river\.jpg$/, 'miniatura = modelo más nuevo');
    assert.equal(await page.evaluate(() => document.querySelector('.cp-adm-fila[data-cat="Conjuntos"] input[data-frase]').value), 'Para entrenar'); assert.equal(await page.evaluate(() => document.querySelector('.cp-adm-fila[data-cat="Conjuntos"] input[data-frase]').maxLength), 30);
    assert.match(await txt(page, fila$('Chombas') + ' .cp-adm-origen'), /Sin productos en el catálogo/); assert.equal(await page.evaluate(() => document.querySelectorAll('.cp-adm-quitar').length), 0, 'sin foto cargada no hay "Quitar"');
    assert.ok(Math.abs((await page.evaluate(() => { const r = document.querySelector('.cp-adm-mini').getBoundingClientRect(); return r.width / r.height; })) - 0.8) < 0.02, 'miniatura 4:5'); assert.equal(errores.length, 0, errores.join(' | ')); await ctx.close();
  });
  await t('SUBIR FOTO: se sube con el mismo uploader y se guarda SOLO categoriasPortada (reemplazando el campo) conservando la frase; aparecen "Cambiar foto" y "Quitar (usar última foto)"', async () => {
    const { page, ctx } = await abrir('iphone', { heroTitulo: 'x', categoriasPortada: { Camisetas: { frase: 'Nuevas' } } });
    await page.setInputFiles(fila$('Camisetas') + ' input[type="file"]', PNG_ARCHIVO); await esperarEstado(page, 'guardada');
    const w = await escrituras(page); assert.equal(w.length, 1); assert.equal(w[0].doc, 'config_sitio/config'); assert.deepEqual(Object.keys(w[0].data), ['categoriasPortada']); assert.deepEqual(w[0].opts, { mergeFields: ['categoriasPortada'] });
    assert.deepEqual(w[0].data.categoriasPortada, { Camisetas: { foto: 'https://res.cloudinary.com/d5fzjp10/image/upload/v1/categoria1.png', frase: 'Nuevas' } }); assert.equal(await page.evaluate(() => window.__SUBIDAS), 1);
    assert.match(await txt(page, fila$('Camisetas') + ' .cp-adm-origen'), /Foto cargada por vos/); assert.match(await txt(page, fila$('Camisetas') + ' .cp-adm-subir'), /cambiar foto/i); assert.match(await txt(page, fila$('Camisetas') + ' .cp-adm-quitar'), /quitar \(usar última foto\)/i);
    assert.match(await page.evaluate(() => document.querySelector('.cp-adm-fila[data-cat="Camisetas"] img').getAttribute('src')), /categoria1\.png$/); assert.equal(await page.evaluate(() => window.__state.configSitio.heroTitulo), 'x', 'el resto de la config queda'); await ctx.close();
  });
  await t('FRASE: se escribe (máx. 30, contador), se guarda con el botón o con Enter en categoriasPortada conservando la foto; vaciarla la quita; sin cambios no escribe', async () => {
    const { page, ctx } = await abrir('iphone', { categoriasPortada: { Camisetas: { foto: U('mia') } } });
    const inp = fila$('Camisetas') + ' input[data-frase]'; await page.fill(inp, 'x'.repeat(40)); assert.equal(await page.evaluate((s) => document.querySelector(s).value.length, inp), 30, 'tope de 30'); assert.equal(await txt(page, fila$('Camisetas') + ' .cp-adm-contador'), '30/30');
    await page.fill(inp, '  Las   de la temporada '); await page.click(fila$('Camisetas') + ' [data-acc="frase"]'); await esperarEstado(page, 'Frase de Camisetas guardada');
    let w = await escrituras(page); assert.deepEqual(w[0].data, { categoriasPortada: { Camisetas: { foto: U('mia'), frase: 'Las de la temporada' } } }); assert.deepEqual(w[0].opts, { mergeFields: ['categoriasPortada'] });
    await page.click(fila$('Camisetas') + ' [data-acc="frase"]'); await esp(300); assert.equal((await escrituras(page)).length, 1, 'sin cambios no escribe'); assert.match(await txt(page, '#cp-estado'), /No hay cambios/);
    await page.fill(fila$('Conjuntos') + ' input[data-frase]', 'Para entrenar'); await page.press(fila$('Conjuntos') + ' input[data-frase]', 'Enter'); await page.waitForFunction(() => window.__ESCRITURAS.length === 2, null, { timeout: 4000 }); w = await escrituras(page);
    assert.deepEqual(w[1].data.categoriasPortada, { Camisetas: { foto: U('mia'), frase: 'Las de la temporada' }, Conjuntos: { frase: 'Para entrenar' } }, 'una frase sin foto es válida (la tienda usa la foto del último producto)');
    await page.fill(inp, ''); await page.click(fila$('Camisetas') + ' [data-acc="frase"]'); await page.waitForFunction(() => window.__ESCRITURAS.length === 3, null, { timeout: 4000 }); w = await escrituras(page); assert.deepEqual(w[2].data.categoriasPortada.Camisetas, { foto: U('mia') }, 'frase vacía: se saca solo la frase'); await ctx.close();
  });
  await t('varias categorías: cada subida conserva las anteriores; "Cambiar foto" reemplaza solo esa', async () => {
    const { page, ctx } = await abrir('iphone');
    for (const c of ['Camisetas', 'Conjuntos', 'Gorras']) { await page.setInputFiles(fila$(c) + ' input[type="file"]', PNG_ARCHIVO); await esperarEstado(page, 'Foto de ' + c + ' guardada'); }
    let w = await escrituras(page); assert.deepEqual(Object.keys(w[2].data.categoriasPortada).sort(), ['Camisetas', 'Conjuntos', 'Gorras']);
    await page.setInputFiles(fila$('Conjuntos') + ' input[type="file"]', PNG_ARCHIVO); await page.waitForFunction(() => window.__ESCRITURAS.length === 4, null, { timeout: 4000 }); w = await escrituras(page);
    assert.equal(w[3].data.categoriasPortada.Conjuntos.foto.endsWith('categoria4.png'), true); assert.equal(w[3].data.categoriasPortada.Camisetas.foto.endsWith('categoria1.png'), true); assert.equal(Object.keys(w[3].data.categoriasPortada).length, 3); await ctx.close();
  });
  await t('QUITAR (usar última foto): borra SOLO la foto de esa categoría (se reemplaza el campo sin esa foto), conserva la frase, vuelve a usar la foto del último producto y desaparece el botón', async () => {
    const { page, ctx } = await abrir('iphone', { categoriasPortada: { Camisetas: { foto: U('mia'), frase: 'Nuevas' }, Conjuntos: { foto: U('conj') } } });
    assert.match(await txt(page, fila$('Camisetas') + ' .cp-adm-origen'), /Foto cargada por vos/);
    await page.click(fila$('Camisetas') + ' .cp-adm-quitar'); await esperarEstado(page, 'Se quitó');
    const w = await escrituras(page); assert.deepEqual(w[0].data, { categoriasPortada: { Conjuntos: { foto: U('conj') }, Camisetas: { frase: 'Nuevas' } } }); assert.deepEqual(w[0].opts, { mergeFields: ['categoriasPortada'] });
    assert.match(await txt(page, fila$('Camisetas') + ' .cp-adm-origen'), /Usa la foto del último producto ingresado/); assert.equal(await page.evaluate(() => document.querySelectorAll('.cp-adm-fila[data-cat="Camisetas"] .cp-adm-quitar').length), 0); assert.equal(await page.evaluate(() => document.querySelector('.cp-adm-fila[data-cat="Camisetas"] input[data-frase]').value), 'Nuevas', 'la frase sigue');
    await page.click(fila$('Conjuntos') + ' .cp-adm-quitar'); await page.waitForFunction(() => window.__ESCRITURAS.length === 2, null, { timeout: 4000 }); assert.deepEqual((await escrituras(page))[1].data, { categoriasPortada: { Camisetas: { frase: 'Nuevas' } } }, 'sin foto ni frase, se borra la entrada'); await ctx.close();
  });
  await t('ERRORES: si falla la subida no se escribe nada y avisa; si falla guardar muestra el error y la foto no queda como cargada', async () => {
    const { page, ctx } = await abrir('iphone'); await page.evaluate(() => { window.__FALLAR_SUBIDA = true; });
    await page.setInputFiles(fila$('Camisetas') + ' input[type="file"]', PNG_ARCHIVO); await esperarEstado(page, 'No se pudo subir'); assert.equal((await escrituras(page)).length, 0);
    await page.evaluate(() => { window.__FALLAR_SUBIDA = false; window.__FALLAR = true; }); await page.setInputFiles(fila$('Camisetas') + ' input[type="file"]', PNG_ARCHIVO); await esperarEstado(page, 'No se guardó');
    assert.match(await txt(page, fila$('Camisetas') + ' .cp-adm-origen'), /Usa la foto del último producto/); assert.equal(await page.evaluate(() => document.querySelectorAll('.cp-adm-fila input:disabled').length), 0, 'los botones se vuelven a habilitar');
    await page.fill(fila$('Conjuntos') + ' input[data-frase]', 'Hola'); await page.click(fila$('Conjuntos') + ' [data-acc="frase"]'); await esperarEstado(page, 'No se guardó'); assert.equal((await escrituras(page)).length, 0); await ctx.close();
  });
  await t('una categoría con foto o frase cargada pero sin stock sigue en la lista (se puede quitar); no se pisa la frase que se está escribiendo; sin categorías la tarjeta lo dice', async () => {
    const { page, ctx } = await abrir('iphone', { categoriasPortada: { Remeras: { frase: 'r' } } }); assert.ok((await page.evaluate(() => [...document.querySelectorAll('.cp-adm-fila')].map((f) => f.dataset.cat))).includes('Remeras'));
    await page.fill(fila$('Camisetas') + ' input[data-frase]', 'Escribiendo'); await page.evaluate(() => { window.__state.configSitio = { ...window.__state.configSitio, otro: 1 }; window.cpRender(); }); assert.equal(await page.evaluate(() => document.querySelector('.cp-adm-fila[data-cat="Camisetas"] input[data-frase]').value), 'Escribiendo', 'no se pisa lo que se está escribiendo'); await ctx.close();
    const v = await abrir('iphone'); await v.page.evaluate(() => { window.__state.stockData = []; window.cpRender(); }); assert.match(await txt(v.page, '#cp-lista'), /Todavía no hay productos con categoría/); await v.ctx.close();
  });
  await t('MOBILE: sin desborde horizontal, botones de 44 px o más y nada encimado (iPhone, Android, PC)', async () => {
    for (const perfil of ['iphone', 'android', 'pc']) {
      const { page, ctx, errores } = await abrir(perfil, { categoriasPortada: { Camisetas: { foto: U('mia'), frase: 'Las de la temporada' } } });
      const m = await page.evaluate(() => ({ d: document.documentElement.scrollWidth - document.documentElement.clientWidth, bh: [...document.querySelectorAll('#cp-root .btn, #cp-root input[data-frase]')].filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().height)), fuera: [...document.querySelectorAll('.cp-adm-fila')].filter((f) => f.getBoundingClientRect().right > innerWidth + 1).length }));
      assert.ok(m.d <= 1, perfil + ' desborde ' + m.d); assert.ok(m.bh.every((h) => h >= 44), perfil + ' botón bajo: ' + m.bh); assert.equal(m.fuera, 0); assert.equal(errores.length, 0, errores.join(' | '));
      if (process.env.CAPTURAS) { fs.mkdirSync(process.env.CAPTURAS, { recursive: true }); await page.evaluate(() => document.getElementById('cp-panel').scrollIntoView({ block: 'start' })); await esp(300); await page.screenshot({ path: path.join(process.env.CAPTURAS, `stockmgr-categorias-portada-${perfil}.png`) }); }
      await ctx.close();
    }
  });
  await browser.close(); servidor.close();
}
console.log(fallos ? `\n${fallos} prueba(s) FALLARON, ${ok} bien` : `\nTodo OK: ${ok} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
