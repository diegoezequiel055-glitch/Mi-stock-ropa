// ══════════════════════════════════════════
// PRUEBAS DE "VIDEOS DE TIKTOK" EN STOCKMGR (videos-tiktok.js + videos-admin.js). NO toca el Firestore ni Cloudinary reales.
//   A) lógica pura: validación y limpieza de links (con los 3 links de ejemplo), máximo 6, repetidos, reordenar, qué se guarda.
//   B) navegador (Chrome): la tarjeta "Videos de TikTok" del modal... de Catálogo y sitio: agregar (link + portada subida + título), errores, reordenar,
//      borrar, guardar SOLO el campo `videosTiktok` (merge) con los links limpios, previsualización. Con CAPTURAS=<carpeta> guarda capturas.
// Uso: node test-tiktok.mjs   (B necesita Playwright fuera del repo: PLAYWRIGHT_DIR=<carpeta> y Chrome)   SOLO_PURAS=1 → solo A
// ══════════════════════════════════════════
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { validarLinkTiktok, armarVideo, prepararParaGuardar, leerGuardados, mover, quitar, hayCambios, camposVideos, limpiarTitulo, portadaValida, MAX_VIDEOS } from './videos-tiktok.js';

let ok = 0, fallos = 0;
const t = async (n, f) => { if (process.env.SOLO && !n.includes(process.env.SOLO)) return; try { await f(); ok++; console.log('ok', n); } catch (e) { fallos++; console.log('FALLA', n, '\n   ', String(e.message).split('\n').slice(0, 3).join('\n    ')); } };

const L1 = 'https://www.tiktok.com/@tiendapremium.ok/video/7701101006259571989';
const L2 = 'https://www.tiktok.com/@tiendapremium.ok/video/7699253846605892885';
const L3 = 'https://www.tiktok.com/@tiendapremium.ok/video/7698876670391979284';
const P = (i) => `https://res.cloudinary.com/d5fzjp10/image/upload/v1/portada${i}.jpg`;

console.log('— A) lógica pura —');
await t('los 3 links de ejemplo son válidos y quedan exactamente iguales', () => { for (const l of [L1, L2, L3]) assert.deepEqual(validarLinkTiktok(l), { ok: true, url: l, id: l.split('/').pop() }); });
await t('LIMPIEZA: todo lo que va después de "?" (y "#") se saca: utm, is_from_webapp, sender_device, _r, _t, web_id…', () => {
  for (const [sucio, limpio] of [[L1 + '?is_from_webapp=1&sender_device=pc&web_id=7433212', L1], [L2 + '?_r=1&_t=ZM-8xQ9abc', L2], [L3 + '?utm_source=copy&utm_campaign=client_share&utm_medium=android&share_iid=123', L3], [L1 + '#comentarios', L1], [L1 + '?a=1#b', L1], [L1 + '/', L1], [L1 + '/?x=1', L1], ['  ' + L2 + '  ', L2], ['http://tiktok.com/@tiendapremium.ok/video/7699253846605892885?x=1', L2], ['https://m.tiktok.com/@tiendapremium.ok/video/7698876670391979284?x=1', L3]]) {
    const r = validarLinkTiktok(sucio); assert.equal(r.ok, true, sucio); assert.equal(r.url, limpio, sucio); assert.equal(r.url.includes('?'), false);
  }
});
await t('VALIDACIÓN: rechaza lo que no es de tiktok.com con forma /@usuario/video/NÚMERO (con mensaje de error)', () => {
  for (const mal of ['', '   ', null, undefined, 'hola', 'tiktok', 'https://www.tiktok.com/@tiendapremium.ok', 'https://www.tiktok.com/@tiendapremium.ok/video/', 'https://www.tiktok.com/@tiendapremium.ok/video/abc', 'https://www.tiktok.com/@tiendapremium.ok/video/123', 'https://www.tiktok.com/tiendapremium.ok/video/7701101006259571989', 'https://www.tiktok.com/@/video/7701101006259571989', 'https://evil.com/@tiendapremium.ok/video/7701101006259571989', 'https://www.tiktok.com.evil.com/@a/video/7701101006259571989', 'https://evil.com/?u=https://www.tiktok.com/@a/video/7701101006259571989', 'javascript:alert(1)', 'https://www.youtube.com/watch?v=abc', 'https://www.instagram.com/reel/abc/', 'https://www.tiktok.com/@a/video/7701101006259571989/extra', 'https://www.tiktok.com/@a b/video/7701101006259571989']) {
    const r = validarLinkTiktok(mal); assert.equal(r.ok, false, String(mal)); assert.ok(r.error && r.error.length > 10, 'mensaje de error para ' + mal);
  }
  assert.match(validarLinkTiktok('').error, /Pegá el link/); assert.match(validarLinkTiktok('https://vm.tiktok.com/ZMabc123/').error, /link corto/); assert.match(validarLinkTiktok('https://www.tiktok.com/t/ZTabc/').error, /link corto/); assert.match(validarLinkTiktok('https://www.tiktok.com/@a').error, /tiktok\.com\/@usuario\/video/);
});
await t('portada y título: portada solo https; título sin espacios de más y de hasta 60 caracteres', () => {
  assert.equal(portadaValida(P(1)), true); for (const mal of ['', null, 'http://x.com/a.jpg', 'javascript:alert(1)', 'https://x.com/a b', 'https://x.com/"x']) assert.equal(portadaValida(mal), false);
  assert.equal(limpiarTitulo('  Hola    mundo  '), 'Hola mundo'); assert.equal(limpiarTitulo('x'.repeat(90)).length, 60); assert.equal(limpiarTitulo(undefined), '');
});
await t('armarVideo: agrega con el link limpio; pide portada; no repite; máximo 6', () => {
  const r = armarVideo({ link: L1 + '?is_from_webapp=1', portada: P(1), titulo: '  Nuevos   ingresos ' }, []); assert.deepEqual(r, { ok: true, video: { url: L1, portada: P(1), titulo: 'Nuevos ingresos' } });
  assert.equal(armarVideo({ link: L1, portada: '', titulo: '' }, []).ok, false); assert.match(armarVideo({ link: L1, portada: '' }, []).error, /portada/i);
  assert.match(armarVideo({ link: L1 + '?x=1', portada: P(1) }, [{ url: L1, portada: P(1), titulo: '' }]).error, /ya está/);
  assert.equal(armarVideo({ link: 'https://vm.tiktok.com/abc', portada: P(1) }, []).ok, false);
  const seis = Array.from({ length: 6 }, (_, i) => ({ url: `https://www.tiktok.com/@a/video/77011010062595719${10 + i}`, portada: P(i), titulo: '' })); assert.equal(MAX_VIDEOS, 6); const m = armarVideo({ link: L1, portada: P(1) }, seis); assert.equal(m.ok, false); assert.match(m.error, /máximo/);
});
await t('prepararParaGuardar: limpia TODOS los links, valida cada video y el máximo; con lista vacía guarda [] (sin videos)', () => {
  const r = prepararParaGuardar([{ url: L1 + '?is_from_webapp=1&sender_device=pc', portada: P(1), titulo: 'Uno ' }, { url: L2 + '?_r=1', portada: P(2) }, { url: L3, portada: P(3), titulo: '' }]);
  assert.equal(r.ok, true); assert.deepEqual(r.lista.map((v) => v.url), [L1, L2, L3]); assert.equal(r.lista.some((v) => v.url.includes('?')), false); assert.equal(r.lista[0].titulo, 'Uno'); assert.equal(r.lista[1].titulo, '');
  assert.deepEqual(prepararParaGuardar([]), { ok: true, lista: [] });
  for (const mal of [[{ url: 'https://vm.tiktok.com/x', portada: P(1) }], [{ url: L1 }], [{ url: L1, portada: P(1) }, { url: L1 + '?x=1', portada: P(2) }], [{ url: L1, portada: 'http://x/a.jpg' }], 'x', null, Array.from({ length: 7 }, (_, i) => ({ url: `https://www.tiktok.com/@a/video/77011010062595719${10 + i}`, portada: P(i) }))]) assert.equal(prepararParaGuardar(mal).ok, false, JSON.stringify(mal).slice(0, 80));
  assert.match(prepararParaGuardar([{ url: L1, portada: P(1) }, { url: 'hola', portada: P(2) }]).error, /^Video 2:/);
});
await t('leerGuardados: tolera el campo inexistente o con basura; mover, quitar y hayCambios', () => {
  for (const x of [undefined, null, {}, { videosTiktok: 'x' }, { videosTiktok: [null, 5, { url: 'x' }] }]) assert.deepEqual(leerGuardados(x), []);
  const lista = [{ url: L1, portada: P(1), titulo: 'a' }, { url: L2, portada: P(2), titulo: '' }, { url: L3, portada: P(3), titulo: 'c' }];
  assert.deepEqual(leerGuardados({ videosTiktok: lista.map((v) => ({ ...v, url: v.url + '?x=1' })) }), lista, 'al leer también se limpian');
  assert.deepEqual(mover(lista, 0, 1).map((v) => v.url), [L2, L1, L3]); assert.deepEqual(mover(lista, 2, -1).map((v) => v.url), [L1, L3, L2]); assert.deepEqual(mover(lista, 0, -1), lista); assert.deepEqual(mover(lista, 2, 1), lista); assert.deepEqual(quitar(lista, 1).map((v) => v.url), [L1, L3]); assert.deepEqual(quitar(lista, 9), lista);
  assert.equal(hayCambios(lista, lista.slice()), false); assert.equal(hayCambios(mover(lista, 0, 1), lista), true); assert.equal(hayCambios([], lista), true);
});
await t('camposVideos: se escribe SOLO el campo videosTiktok (no pisa el resto de la configuración)', () => assert.deepEqual(Object.keys(camposVideos([])), ['videosTiktok']));

if (!process.env.SOLO_PURAS) {
  console.log('— B) navegador (Firestore y Cloudinary simulados) —');
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
export const setDoc = async (ref, data, opts) => { if (window.__FALLAR) throw new Error('mock: sin red'); window.__ESCRITURAS.push({ doc: ref.name + '/' + ref.id, data: JSON.parse(JSON.stringify(data)), opts }); };
`;
  // El HTML de la tarjeta sale del index.html real (así se prueba lo que se publica).
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(html.includes('<div id="vid-root"></div>'), 'falta #vid-root en index.html'); assert.ok(html.includes('videos-admin.css'), 'falta el CSS de videos en index.html');
  const PAGINA = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/videos-admin.css"></head><body style="padding-bottom:90px">
  <div class="panel" style="margin:12px"><div class="panel-head"><h2>Configuración del sitio</h2></div></div>
  <div id="vid-root" style="padding:0 12px"></div>
  <script>window.toast = (m, t) => { (window.__toasts ||= []).push(m); }; window.__SUBIDAS = 0; window.subirFotoGenerica = async (f) => { window.__SUBIDAS++; if (window.__FALLAR_SUBIDA) throw new Error('No se pudo subir la foto.'); await new Promise((r) => setTimeout(r, 80)); return 'https://res.cloudinary.com/d5fzjp10/image/upload/v1/portada' + window.__SUBIDAS + '.png'; };</script>
  <script type="module">
  import { state } from '/state.js'; window.__state = state;
  state.configSitio = window.__CFG || {};
  await import('/videos-admin.js');
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
  async function abrir(perfil = 'iphone', cfg = {}) {
    const ctx = await browser.newContext(PERFILES[perfil]);
    await ctx.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(BASE)) return r.continue(); if (/res\.cloudinary\.com/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: PNG }); return r.abort(); });
    const page = await ctx.newPage(); const errores = []; page.on('pageerror', (e) => errores.push(e.message));
    await page.addInitScript((c) => { window.__CFG = c; }, cfg);
    await page.goto(BASE + '/__prueba.html'); await page.waitForFunction(() => window.__listo === true);
    return { page, ctx, errores };
  }
  const PNG_ARCHIVO = { name: 'portada.png', mimeType: 'image/png', buffer: PNG };
  async function agregarVideo(page, link, titulo = '') {
    await page.fill('#vid-link', link); if (titulo) await page.fill('#vid-titulo', titulo);
    await page.setInputFiles('#vid-file', PNG_ARCHIVO); await page.waitForFunction(() => document.getElementById('vid-file-nota').textContent.includes('Portada subida'), null, { timeout: 4000 });
    await page.click('#vid-agregar');
  }
  const txt = (page, id) => page.evaluate((i) => document.getElementById(i).innerText, id);
  const items = (page) => page.evaluate(() => [...document.querySelectorAll('.vid-adm-item')].map((i) => i.querySelector('.vid-adm-link').textContent));

  await t('sin videos guardados: la tarjeta lo dice, el contador marca 0 / 6 y no hay nada que guardar', async () => {
    const { page, ctx, errores } = await abrir('iphone');
    assert.equal(await txt(page, 'vid-contador'), '0 / 6'); assert.match(await txt(page, 'vid-lista'), /no se muestra en la tienda/);
    await page.click('#vid-guardar'); await esp(200); assert.match(await txt(page, 'vid-estado'), /No hay cambios/); assert.equal(await page.evaluate(() => window.__ESCRITURAS.length), 0);
    assert.equal(errores.length, 0, errores.join(' | ')); await ctx.close();
  });
  await t('AGREGAR los 3 links de ejemplo (con parámetros de rastreo): se suben las portadas, se muestran con link limpio, y GUARDAR escribe SOLO videosTiktok (merge) con los links limpios y en orden', async () => {
    const { page, ctx } = await abrir('iphone');
    await agregarVideo(page, L1 + '?is_from_webapp=1&sender_device=pc', 'Nuevos ingresos'); await agregarVideo(page, L2 + '?_r=1&_t=ZM-abc'); await agregarVideo(page, L3 + '?utm_source=copy&share_iid=99', 'Así llega tu pedido');
    assert.deepEqual(await items(page), ['@tiendapremium.ok/video/7701101006259571989', '@tiendapremium.ok/video/7699253846605892885', '@tiendapremium.ok/video/7698876670391979284']); assert.equal(await txt(page, 'vid-contador'), '3 / 6');
    assert.equal(await page.evaluate(() => window.__SUBIDAS), 3, 'una subida por portada'); assert.match(await txt(page, 'vid-estado'), /Falta guardar/);
    await page.click('#vid-guardar'); await esp(400);
    const w = await page.evaluate(() => window.__ESCRITURAS); assert.equal(w.length, 1); assert.equal(w[0].doc, 'config_sitio/config'); assert.deepEqual(w[0].opts, { merge: true }); assert.deepEqual(Object.keys(w[0].data), ['videosTiktok']);
    assert.deepEqual(w[0].data.videosTiktok.map((v) => v.url), [L1, L2, L3]); assert.equal(JSON.stringify(w[0].data).includes('?'), false, 'ningún parámetro de rastreo');
    assert.deepEqual(w[0].data.videosTiktok.map((v) => v.titulo), ['Nuevos ingresos', '', 'Así llega tu pedido']); assert.ok(w[0].data.videosTiktok.every((v) => /^https:\/\/res\.cloudinary\.com\//.test(v.portada)));
    assert.match(await txt(page, 'vid-estado'), /Guardado ✓/); await ctx.close();
  });
  await t('ERRORES: link inválido (corto, de otro sitio, sin número, vacío), sin portada, repetido: se muestra el error y NO se agrega ni se guarda nada', async () => {
    const { page, ctx } = await abrir('iphone', { videosTiktok: [{ url: L1, portada: P(1), titulo: '' }] });
    for (const [link, re] of [['', /Pegá el link/], ['hola', /no es válido/], ['https://www.youtube.com/watch?v=abc', /no es válido/], ['https://vm.tiktok.com/ZMabc123/', /link corto/], ['https://www.tiktok.com/@tiendapremium.ok/video/abc', /no es válido/]]) {
      await page.fill('#vid-link', link); await page.setInputFiles('#vid-file', PNG_ARCHIVO); await page.waitForFunction(() => document.getElementById('vid-file-nota').textContent.includes('Portada subida'), null, { timeout: 4000 }); await page.click('#vid-agregar'); assert.match(await txt(page, 'vid-error'), re, link);
    }
    await page.fill('#vid-link', L2); await page.evaluate(() => { document.getElementById('vid-file').value = ''; }); await page.reload(); await page.waitForFunction(() => window.__listo === true);
    await page.fill('#vid-link', L2); await page.click('#vid-agregar'); assert.match(await txt(page, 'vid-error'), /Subí la portada/);
    await page.fill('#vid-link', L1 + '?x=1'); await page.setInputFiles('#vid-file', PNG_ARCHIVO); await page.waitForFunction(() => document.getElementById('vid-file-nota').textContent.includes('Portada subida'), null, { timeout: 4000 }); await page.click('#vid-agregar'); assert.match(await txt(page, 'vid-error'), /ya está en la lista/);
    assert.equal((await items(page)).length, 1); assert.equal(await page.evaluate(() => window.__ESCRITURAS.length), 0); await ctx.close();
  });
  await t('nota en vivo del link: válido muestra cómo se guarda (limpio); inválido muestra el motivo', async () => {
    const { page, ctx } = await abrir('iphone'); await page.fill('#vid-link', L1 + '?is_from_webapp=1&sender_device=pc'); assert.match(await txt(page, 'vid-link-nota'), new RegExp('Link válido.*' + L1.replace(/[.]/g, '\\.') + '$'));
    await page.fill('#vid-link', 'https://vm.tiktok.com/x'); assert.match(await txt(page, 'vid-link-nota'), /link corto/); await page.fill('#vid-link', ''); assert.equal(await txt(page, 'vid-link-nota'), ''); await ctx.close();
  });
  await t('MÁXIMO 6: con 6 videos el botón Agregar se bloquea y avisa; al borrar uno se habilita', async () => {
    const seis = Array.from({ length: 6 }, (_, i) => ({ url: `https://www.tiktok.com/@a/video/77011010062595719${10 + i}`, portada: P(i), titulo: '' }));
    const { page, ctx } = await abrir('iphone', { videosTiktok: seis }); assert.equal(await txt(page, 'vid-contador'), '6 / 6'); assert.equal(await page.isDisabled('#vid-agregar'), true); assert.match(await txt(page, 'vid-error'), /máximo/);
    await page.click('.vid-adm-item:nth-child(3) .vid-adm-borrar'); assert.equal(await txt(page, 'vid-contador'), '5 / 6'); assert.equal(await page.isDisabled('#vid-agregar'), false); assert.equal(await txt(page, 'vid-error'), ''); await ctx.close();
  });
  await t('REORDENAR y BORRAR: ↑ ↓ cambian el orden (los de los extremos no se pueden mover hacia afuera) y 🗑 borra; guardar escribe el orden final', async () => {
    const { page, ctx } = await abrir('iphone', { videosTiktok: [{ url: L1, portada: P(1), titulo: '' }, { url: L2, portada: P(2), titulo: '' }, { url: L3, portada: P(3), titulo: '' }] });
    const ids = async () => (await items(page)).map((x) => x.slice(-4));
    assert.deepEqual(await ids(), ['1989', '2885', '9284']); assert.equal(await page.isDisabled('.vid-adm-item:nth-child(1) [data-acc="sube"]'), true); assert.equal(await page.isDisabled('.vid-adm-item:nth-child(3) [data-acc="baja"]'), true);
    await page.click('.vid-adm-item:nth-child(1) [data-acc="baja"]'); assert.deepEqual(await ids(), ['2885', '1989', '9284']); await page.click('.vid-adm-item:nth-child(3) [data-acc="sube"]'); assert.deepEqual(await ids(), ['2885', '9284', '1989']);
    await page.click('.vid-adm-item:nth-child(2) .vid-adm-borrar'); assert.deepEqual(await ids(), ['2885', '1989']);
    await page.click('#vid-guardar'); await esp(300); const w = await page.evaluate(() => window.__ESCRITURAS); assert.deepEqual(w[0].data.videosTiktok.map((v) => v.url), [L2, L1]); await ctx.close();
  });
  await t('BORRAR todos y guardar: escribe videosTiktok: [] (la tienda deja de mostrar la sección)', async () => {
    const { page, ctx } = await abrir('iphone', { videosTiktok: [{ url: L1, portada: P(1), titulo: '' }] });
    await page.click('.vid-adm-borrar'); assert.match(await txt(page, 'vid-lista'), /no se muestra en la tienda/); await page.click('#vid-guardar'); await esp(300); const w = await page.evaluate(() => window.__ESCRITURAS); assert.deepEqual(w[0].data, { videosTiktok: [] }); await ctx.close();
  });
  await t('los videos ya guardados se muestran al abrir (con el link limpio aunque en Firestore haya quedado uno con parámetros); si la config llega después, la tarjeta se actualiza sola', async () => {
    const { page, ctx } = await abrir('iphone', { videosTiktok: [{ url: L1 + '?is_from_webapp=1', portada: P(1), titulo: 'Uno' }] });
    assert.deepEqual(await items(page), ['@tiendapremium.ok/video/7701101006259571989']);
    await page.evaluate((v) => { window.__state.configSitio = { videosTiktok: v }; window.vidRender(); }, [{ url: L2, portada: P(2), titulo: 'Dos' }, { url: L3, portada: P(3), titulo: '' }]); assert.deepEqual(await items(page), ['@tiendapremium.ok/video/7699253846605892885', '@tiendapremium.ok/video/7698876670391979284']);
    await ctx.close();
  });
  await t('si llega una config nueva con cambios SIN guardar en pantalla, no se pisan', async () => {
    const { page, ctx } = await abrir('iphone', { videosTiktok: [{ url: L1, portada: P(1), titulo: '' }] });
    await agregarVideo(page, L2); await page.evaluate(() => { window.__state.configSitio = { videosTiktok: [{ url: window.__state.configSitio.videosTiktok[0].url, portada: 'https://res.cloudinary.com/d5fzjp10/image/upload/v1/otra.jpg', titulo: 'x' }], heroTitulo: 'otro' }; window.vidRender(); });
    assert.equal((await items(page)).length, 2, 'el borrador (2 videos) se conserva'); await ctx.close();
  });
  await t('PREVISUALIZACIÓN: la tarjeta (9:16, play centrado, título y "Ver en TikTok") se ve con la portada subida y el título que se escribe, antes de agregar', async () => {
    const { page, ctx } = await abrir('iphone'); assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('vid-vista-caja')).display), 'none', 'sin portada ni título no hay vista previa');
    await page.fill('#vid-titulo', 'Nuevos ingresos de la semana'); await page.setInputFiles('#vid-file', PNG_ARCHIVO); await page.waitForFunction(() => document.getElementById('vid-file-nota').textContent.includes('Portada subida'), null, { timeout: 4000 });
    const v = await page.evaluate(() => { const c = document.querySelector('#vid-vista .vid-prev-card'); const p = c.querySelector('.vid-prev-portada').getBoundingClientRect(); const pl = c.querySelector('.vid-prev-play').getBoundingClientRect(); return { prop: p.width / p.height, img: c.querySelector('img').getAttribute('src'), titulo: c.querySelector('.vid-prev-titulo').textContent, ver: c.querySelector('.vid-prev-ver').textContent, cx: Math.abs(pl.left + pl.width / 2 - (p.left + p.width / 2)), cy: Math.abs(pl.top + pl.height / 2 - (p.top + p.height / 2)), caja: getComputedStyle(document.getElementById('vid-vista-caja')).display }; });
    assert.ok(Math.abs(v.prop - 9 / 16) < 0.01); assert.match(v.img, /^https:\/\/res\.cloudinary\.com\//); assert.equal(v.titulo, 'Nuevos ingresos de la semana'); assert.equal(v.ver, 'Ver en TikTok'); assert.ok(v.cx < 1.5 && v.cy < 1.5); assert.notEqual(v.caja, 'none'); await ctx.close();
  });
  await t('si falla la subida de la portada: avisa y no se puede agregar sin portada; si falla guardar: muestra el error y conserva el borrador', async () => {
    const { page, ctx } = await abrir('iphone'); await page.evaluate(() => { window.__FALLAR_SUBIDA = true; }); await page.fill('#vid-link', L1); await page.setInputFiles('#vid-file', PNG_ARCHIVO); await page.waitForFunction(() => document.getElementById('vid-file-nota').textContent.includes('No se pudo subir'), null, { timeout: 4000 });
    await page.click('#vid-agregar'); assert.match(await txt(page, 'vid-error'), /Subí la portada/);
    await page.evaluate(() => { window.__FALLAR_SUBIDA = false; }); await page.setInputFiles('#vid-file', PNG_ARCHIVO); await page.waitForFunction(() => document.getElementById('vid-file-nota').textContent.includes('Portada subida'), null, { timeout: 4000 }); await page.click('#vid-agregar');
    await page.evaluate(() => { window.__FALLAR = true; }); await page.click('#vid-guardar'); await esp(300); assert.match(await txt(page, 'vid-estado'), /No se guardó/); assert.equal((await items(page)).length, 1); assert.equal(await page.evaluate(() => window.__ESCRITURAS.length), 0); await ctx.close();
  });
  await t('MOBILE: sin desborde horizontal, botones de 44 px o más y nada encimado (iPhone, Android, PC)', async () => {
    for (const perfil of ['iphone', 'android', 'pc']) {
      const { page, ctx, errores } = await abrir(perfil, { videosTiktok: [{ url: L1, portada: P(1), titulo: 'Un título bastante largo para ver que no se encima con nada de la tarjeta' }, { url: L2, portada: P(2), titulo: '' }, { url: L3, portada: P(3), titulo: 'Tres' }] });
      await page.fill('#vid-link', L1 + '?is_from_webapp=1'); await page.fill('#vid-titulo', 'Nuevo video'); await page.setInputFiles('#vid-file', PNG_ARCHIVO); await page.waitForFunction(() => document.getElementById('vid-file-nota').textContent.includes('Portada subida'), null, { timeout: 4000 });
      const m = await page.evaluate(() => ({ d: document.documentElement.scrollWidth - document.documentElement.clientWidth, bh: [...document.querySelectorAll('#vid-root button')].filter((b) => b.offsetParent).map((b) => Math.round(b.getBoundingClientRect().height)), fuera: [...document.querySelectorAll('.vid-adm-item')].filter((i) => i.getBoundingClientRect().right > innerWidth + 1).length }));
      assert.ok(m.d <= 1, perfil + ' desborde ' + m.d); assert.ok(m.bh.every((h) => h >= 44), perfil + ' botón bajo: ' + m.bh); assert.equal(m.fuera, 0); assert.equal(errores.length, 0, errores.join(' | '));
      if (process.env.CAPTURAS) { fs.mkdirSync(process.env.CAPTURAS, { recursive: true }); await page.evaluate(() => document.getElementById('vid-panel').scrollIntoView({ block: 'start' })); await esp(300); await page.screenshot({ path: path.join(process.env.CAPTURAS, `stockmgr-videos-${perfil}.png`), fullPage: perfil === 'pc' ? false : false }); }
      await ctx.close();
    }
  });
  await browser.close(); servidor.close();
}
console.log(fallos ? `\n${fallos} prueba(s) FALLARON, ${ok} bien` : `\nTodo OK: ${ok} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
