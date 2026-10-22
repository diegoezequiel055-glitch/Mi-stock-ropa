// ══════════════════════════════════════════
// PRUEBAS DE LA TARJETA "MODO MANTENIMIENTO" de StockMGR. NO toca Firestore real.
//   A) mantenimiento.js (lógica pura): claves, link, campos que se guardan.
//   B) Navegador (Chrome): la tarjeta real (mantenimiento-admin.js) en una página de prueba con un doble de firebase-config.js que
//      anota las escrituras en vez de hacerlas. Verifica interruptor con confirmación, mensaje, clave, "Copiar link de acceso" y
//      que solo se escriban los campos de mantenimiento en config_sitio/config (con merge).
// Uso: node test-mantenimiento-admin.mjs   (B necesita Playwright fuera del repo: PLAYWRIGHT_DIR=<carpeta> y Google Chrome)
//      SOLO_PURAS=1 node test-mantenimiento-admin.mjs
// ══════════════════════════════════════════
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { generarClave, armarLink, estadoDe, textoEstado, mensajeFinal, camposActivar, camposDesactivar, camposMensaje, camposClave, MENSAJE_DEFECTO, DOMINIO_TIENDA } from './mantenimiento.js';

let ok = 0, fallos = 0;
const ta = async (n, f) => { try { await f(); ok++; console.log('ok', n); } catch (e) { fallos++; console.log('FALLA', n, '\n   ', String(e.message).split('\n')[0]); } };
const t = (n, f) => ta(n, f);

console.log('— A) lógica pura —');
await t('generarClave: 20 caracteres, solo letras minúsculas y números sin ambiguos', () => { const c = generarClave(); assert.match(c, /^[abcdefghjkmnpqrstuvwxyz23456789]{20}$/); });
await t('generarClave: dos claves seguidas son distintas', () => assert.notEqual(generarClave(), generarClave()));
await t('generarClave con azar fijo es determinista (primer y último símbolo del alfabeto)', () => { assert.equal(generarClave(3, () => [0, 4294967295, 0]), 'a9a'); });
await t('armarLink arma https://tiendapremium.com.ar/?acceso=<clave>', () => { assert.equal(armarLink('abc123'), 'https://tiendapremium.com.ar/?acceso=abc123'); assert.equal(DOMINIO_TIENDA, 'https://tiendapremium.com.ar'); assert.equal(armarLink('a b&c', 'https://x.com/'), 'https://x.com/?acceso=a%20b%26c'); });
await t('estadoDe: solo el booleano true activa; sin config todo vacío', () => { assert.equal(estadoDe({ mantenimiento: true }).activo, true); assert.equal(estadoDe({ mantenimiento: 'true' }).activo, false); assert.deepEqual(estadoDe(null), { activo: false, mensaje: '', clave: '' }); assert.equal(textoEstado(true), 'ACTIVO'); assert.equal(textoEstado(false), 'DESACTIVADO'); });
await t('mensaje por defecto cuando está vacío y tope de 200 caracteres', () => { assert.equal(MENSAJE_DEFECTO, 'Estamos actualizando la tienda. Volvemos en breve.'); assert.equal(mensajeFinal('  '), MENSAJE_DEFECTO); assert.equal(mensajeFinal(' Hola '), 'Hola'); assert.equal(mensajeFinal('x'.repeat(500)).length, 200); });
await t('activar: guarda mantenimiento, mensaje y clave (conserva la clave existente o genera una)', () => {
  assert.deepEqual(camposActivar({ mensaje: 'Vuelvo', clave: 'k1' }), { mantenimiento: true, mantenimientoMensaje: 'Vuelvo', mantenimientoClave: 'k1' });
  const g = camposActivar({ mensaje: '', clave: '' }, () => 'nueva'); assert.deepEqual(g, { mantenimiento: true, mantenimientoMensaje: MENSAJE_DEFECTO, mantenimientoClave: 'nueva' });
});
await t('desactivar solo apaga (no toca mensaje ni clave); mensaje y clave se guardan solos', () => { assert.deepEqual(camposDesactivar(), { mantenimiento: false }); assert.deepEqual(camposMensaje('Hola'), { mantenimientoMensaje: 'Hola' }); assert.deepEqual(camposClave('zz'), { mantenimientoClave: 'zz' }); });
await t('los campos que se escriben son SOLO los tres de mantenimiento', () => { const permitidos = new Set(['mantenimiento', 'mantenimientoMensaje', 'mantenimientoClave']); for (const d of [camposActivar({ mensaje: 'a', clave: 'b' }), camposDesactivar(), camposMensaje('a'), camposClave('b')]) for (const k of Object.keys(d)) assert.ok(permitidos.has(k), k); });

if (!process.env.SOLO_PURAS) {
  console.log('— B) la tarjeta en el navegador (Firestore simulado) —');
  const RAIZ = path.dirname(fileURLToPath(import.meta.url));
  async function cargarPlaywright() {
    try { return await import('playwright'); } catch {}
    if (process.env.PLAYWRIGHT_DIR) { try { return createRequire(path.join(path.resolve(process.env.PLAYWRIGHT_DIR), 'x.js'))('playwright'); } catch {} }
    console.error('No se pudo cargar Playwright. Instalalo fuera del repo y corré con PLAYWRIGHT_DIR=<carpeta> (o SOLO_PURAS=1).'); process.exit(1);
  }
  const { chromium } = await cargarPlaywright();
  const PAGINA = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/mantenimiento-admin.css"></head><body><main style="padding:12px"><div id="tab-catalogo" class="section active" style="display:block"><div id="mant-root"></div></div></main><div id="toast" class="toast"></div>
<script type="module">
  import { state } from '/state.js';
  window.__estado = state; state.configSitio = window.__CFG_INICIAL || {};
  window.__confirmaciones = []; window.__toasts = [];
  window.confirm2 = (titulo, msg, ok) => { window.__confirmaciones.push({ titulo, msg, ok }); return Promise.resolve(window.__RESPUESTA !== false); };
  window.toast = (m, tipo) => window.__toasts.push(m);
  await import('/mantenimiento-admin.js');
</script></body></html>`;
  const STUB = `export const db = {};
export const doc = (_d, coleccion, id) => ({ coleccion, id });
export const setDoc = async (ref, data, opciones) => {
  window.__escrituras.push({ coleccion: ref.coleccion, id: ref.id, data, opciones });
  if (window.__FALLAR) throw new Error('mock: sin permiso');
  const { state } = await import('/state.js'); state.configSitio = { ...state.configSitio, ...data }; // como haría el snapshot en vivo
  if (window.mantRender) window.mantRender();
};`;
  const servidor = await new Promise((r) => { const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
    const s = http.createServer((q, res) => { let u = decodeURIComponent(q.url.split('?')[0]);
      if (u === '/__prueba.html') { res.writeHead(200, { 'Content-Type': T['.html'] }); return res.end(PAGINA); }
      if (u === '/firebase-config.js') { res.writeHead(200, { 'Content-Type': T['.js'] }); return res.end(STUB); }
      const f = path.join(RAIZ, u); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
      res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f)); }).listen(0, '127.0.0.1', () => r(s)); });
  const BASE = `http://127.0.0.1:${servidor.address().port}`;
  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const esp = (ms) => new Promise((r) => setTimeout(r, ms));
  async function abrir(cfg, extra = {}) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 2, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage(); const errores = []; page.on('pageerror', (e) => errores.push(e.message));
    await page.addInitScript(({ c, e }) => { window.__CFG_INICIAL = c; window.__escrituras = []; Object.assign(window, e); }, { c: cfg, e: extra });
    await page.goto(BASE + '/__prueba.html'); await page.waitForSelector('#mant-panel');
    return { page, ctx, errores };
  }
  const txt = (p, sel) => p.evaluate((s) => document.querySelector(s).textContent.trim(), sel);

  await t('desactivado por defecto: estado DESACTIVADO, botón "Activar mantenimiento", mensaje por defecto, sin clave', async () => {
    const { page, ctx, errores } = await abrir({});
    assert.equal(await txt(page, '#mant-estado'), 'DESACTIVADO'); assert.equal(await txt(page, '#mant-toggle'), 'Activar mantenimiento');
    assert.equal(await page.inputValue('#mant-mensaje'), 'Estamos actualizando la tienda. Volvemos en breve.'); assert.equal(await page.inputValue('#mant-clave'), '');
    assert.equal(errores.length, 0, errores.join(' | ')); await ctx.close();
  });
  await t('activar: pide CONFIRMACIÓN y, si se acepta, escribe solo los 3 campos (merge) con una clave generada', async () => {
    const { page, ctx } = await abrir({});
    await page.click('#mant-toggle'); await page.waitForFunction(() => window.__escrituras.length === 1);
    const c = await page.evaluate(() => window.__confirmaciones); assert.equal(c.length, 1); assert.match(c[0].titulo, /Activar/);
    const e = await page.evaluate(() => window.__escrituras[0]);
    assert.equal(e.coleccion, 'config_sitio'); assert.equal(e.id, 'config'); assert.deepEqual(e.opciones, { merge: true });
    assert.deepEqual(Object.keys(e.data).sort(), ['mantenimiento', 'mantenimientoClave', 'mantenimientoMensaje']);
    assert.equal(e.data.mantenimiento, true); assert.match(e.data.mantenimientoClave, /^[a-z2-9]{20}$/); assert.equal(e.data.mantenimientoMensaje, 'Estamos actualizando la tienda. Volvemos en breve.');
    assert.equal(await txt(page, '#mant-estado'), 'ACTIVO'); assert.equal(await txt(page, '#mant-toggle'), 'Desactivar mantenimiento'); assert.equal(await page.inputValue('#mant-clave'), e.data.mantenimientoClave); await ctx.close();
  });
  await t('activar y CANCELAR la confirmación: no se escribe nada', async () => {
    const { page, ctx } = await abrir({}, { __RESPUESTA: false });
    await page.click('#mant-toggle'); await esp(300);
    assert.equal(await page.evaluate(() => window.__escrituras.length), 0); assert.equal(await txt(page, '#mant-estado'), 'DESACTIVADO'); await ctx.close();
  });
  await t('el mensaje escrito se guarda al activar; la clave existente se conserva', async () => {
    const { page, ctx } = await abrir({ mantenimientoClave: 'claveexistente123' });
    await page.fill('#mant-mensaje', 'Volvemos el lunes'); await page.click('#mant-toggle'); await page.waitForFunction(() => window.__escrituras.length === 1);
    const e = await page.evaluate(() => window.__escrituras[0].data); assert.equal(e.mantenimientoMensaje, 'Volvemos el lunes'); assert.equal(e.mantenimientoClave, 'claveexistente123'); await ctx.close();
  });
  await t('desactivar: pide confirmación y escribe SOLO { mantenimiento: false }', async () => {
    const { page, ctx } = await abrir({ mantenimiento: true, mantenimientoClave: 'k', mantenimientoMensaje: 'Hola' });
    assert.equal(await txt(page, '#mant-estado'), 'ACTIVO');
    await page.click('#mant-toggle'); await page.waitForFunction(() => window.__escrituras.length === 1);
    assert.deepEqual(await page.evaluate(() => window.__escrituras[0].data), { mantenimiento: false });
    assert.match((await page.evaluate(() => window.__confirmaciones))[0].titulo, /Desactivar/); assert.equal(await txt(page, '#mant-estado'), 'DESACTIVADO'); await ctx.close();
  });
  await t('Guardar mensaje: escribe solo mantenimientoMensaje (vacío = mensaje por defecto)', async () => {
    const { page, ctx } = await abrir({});
    await page.fill('#mant-mensaje', '   '); await page.click('#mant-guardar-msg'); await page.waitForFunction(() => window.__escrituras.length === 1);
    assert.deepEqual(await page.evaluate(() => window.__escrituras[0].data), { mantenimientoMensaje: 'Estamos actualizando la tienda. Volvemos en breve.' }); await ctx.close();
  });
  await t('Generar nueva: sin clave no pregunta; con clave pide confirmación; solo escribe mantenimientoClave', async () => {
    const { page, ctx } = await abrir({});
    await page.click('#mant-generar'); await page.waitForFunction(() => window.__escrituras.length === 1);
    assert.equal((await page.evaluate(() => window.__confirmaciones)).length, 0); const k1 = await page.inputValue('#mant-clave'); assert.match(k1, /^[a-z2-9]{20}$/);
    await page.click('#mant-generar'); await page.waitForFunction(() => window.__escrituras.length === 2);
    assert.equal((await page.evaluate(() => window.__confirmaciones)).length, 1); const k2 = await page.inputValue('#mant-clave'); assert.notEqual(k1, k2);
    assert.deepEqual(Object.keys(await page.evaluate(() => window.__escrituras[1].data)), ['mantenimientoClave']); await ctx.close();
  });
  await t('Copiar link de acceso: copia https://tiendapremium.com.ar/?acceso=<clave>; sin clave avisa y no copia', async () => {
    const a = await abrir({ mantenimientoClave: 'abcd1234efgh' });
    await a.page.click('#mant-copiar'); await esp(300);
    assert.equal(await a.page.evaluate(() => navigator.clipboard.readText()), 'https://tiendapremium.com.ar/?acceso=abcd1234efgh');
    assert.equal(await txt(a.page, '#mant-link'), 'https://tiendapremium.com.ar/?acceso=abcd1234efgh'); await a.ctx.close();
    const b = await abrir({}); await b.page.click('#mant-copiar'); await esp(200);
    assert.ok((await b.page.evaluate(() => window.__toasts)).some((m) => /Primero gener/.test(m))); await b.ctx.close();
  });
  await t('error al guardar: se muestra el error y el estado no cambia', async () => {
    const { page, ctx } = await abrir({}, { __FALLAR: true });
    await page.click('#mant-toggle'); await page.waitForFunction(() => window.__escrituras.length === 1); await esp(200);
    assert.match(await txt(page, '#mant-estado-msg'), /Error/); assert.equal(await txt(page, '#mant-estado'), 'DESACTIVADO'); await ctx.close();
  });
  await t('se ve bien en celular: sin desborde horizontal y botones táctiles de 42 px o más', async () => {
    const { page, ctx } = await abrir({ mantenimiento: true, mantenimientoClave: 'abcd1234efgh5678ijkm', mantenimientoMensaje: 'Hola' });
    const g = await page.evaluate(() => ({ desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth, botones: ['mant-toggle', 'mant-guardar-msg', 'mant-generar', 'mant-copiar'].map((id) => Math.round(document.getElementById(id).getBoundingClientRect().height)) }));
    assert.ok(g.desborde <= 0, 'desborde ' + g.desborde); assert.ok(g.botones.every((h) => h >= 42), 'botones ' + g.botones); await ctx.close();
  });
  await browser.close(); servidor.close();
}
console.log(fallos ? `\n${fallos} prueba(s) FALLARON, ${ok} bien` : `\nTodo OK: ${ok} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
