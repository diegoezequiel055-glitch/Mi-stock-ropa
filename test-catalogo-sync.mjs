// ══════════════════════════════════════════
// PRUEBAS DE LA SINCRONIZACIÓN DIFERENCIAL del catálogo público y de los envíos públicos. NO toca Firestore real:
//   A) catalogo-sync.js (puro): qué se escribe y qué no, planificador (debounce) y lotes.
//   B) Simulación de costos: algoritmo VIEJO (reescribir todo con actualizado=Date.now()) contra el NUEVO, con 73 fichas y 40 visitantes en línea.
//   C) Navegador (Chrome): el catalogo.js y el envios.js REALES con un Firestore simulado en memoria que cuenta escrituras y lecturas:
//      primera publicación, sincronización sin cambios (debe dar 0 y 0), un cambio de stock (1 escritura), despublicar (1 borrado),
//      ráfaga de disparos al abrir StockMGR (1 sola corrida) y el `actualizado` de lo que no cambió (no se toca).
// Uso: node test-catalogo-sync.mjs   (C necesita Playwright fuera del repo: PLAYWRIGHT_DIR=<carpeta> y Google Chrome)
//      SOLO_PURAS=1 node test-catalogo-sync.mjs   (solo A y B)
// ══════════════════════════════════════════
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { textoEstable, fichasIguales, planSync, crearPlanificador, enLotes } from './catalogo-sync.js';

let ok = 0, fallos = 0;
const t = async (n, f) => { try { await f(); ok++; console.log('ok', n); } catch (e) { fallos++; console.log('FALLA', n, '\n   ', String(e.message).split('\n')[0]); } };

const ficha = (i, extra = {}) => ({ nombre: `Modelo ${i} (Negro)`, categoria: 'Camisetas', color: 'Negro', precio: 30000 + i, talles: [{ talle: 'M', stock: 3 }, { talle: 'L', stock: 2 }], fotos: [`https://x/${i}.jpg`], destacado: false, creadoEn: 1000 + i, actualizado: 111, ...extra });
const catalogo = (n = 73) => new Map(Array.from({ length: n }, (_, i) => [`camiseta|modelo ${i}|negro`, ficha(i)]));

console.log('— A) lógica pura —');
await t('textoEstable ignora el orden de las claves y distingue valores', () => { assert.equal(textoEstable({ a: 1, b: [1, { y: 2, x: 1 }] }), textoEstable({ b: [1, { x: 1, y: 2 }], a: 1 })); assert.notEqual(textoEstable({ a: 1 }), textoEstable({ a: 2 })); assert.notEqual(textoEstable({ a: [1, 2] }), textoEstable({ a: [2, 1] })); });
await t('fichasIguales ignora `actualizado` (y solo ese campo)', () => { assert.ok(fichasIguales(ficha(1, { actualizado: 1 }), ficha(1, { actualizado: 999 }))); assert.ok(!fichasIguales(ficha(1), ficha(1, { precio: 1 }))); });
await t('un campo que desaparece (ej. stockBajo) cuenta como cambio', () => { assert.ok(!fichasIguales(ficha(1, { stockBajo: 2 }), ficha(1))); assert.ok(!fichasIguales(ficha(1), ficha(1, { color: null }))); });
await t('SIN CAMBIOS: 0 escrituras y 0 borrados con las 73 fichas', () => { const d = catalogo(), e = catalogo(); const p = planSync(d, e, { sello: 5555 }); assert.equal(p.escribir.length, 0); assert.equal(p.borrar.length, 0); assert.equal(p.sinCambios, 73); });
await t('SIN CAMBIOS aunque lo publicado tenga otro `actualizado` y otro orden de claves', () => { const d = catalogo(); const e = new Map([...catalogo()].map(([k, f]) => [k, { actualizado: 42, ...Object.fromEntries(Object.entries(f).reverse()) }])); assert.equal(planSync(d, e, { sello: 9 }).escribir.length, 0); });
await t('un cambio de precio escribe SOLO esa ficha, con el `actualizado` nuevo', () => { const d = catalogo(), e = catalogo(); const k = 'camiseta|modelo 7|negro'; d.set(k, ficha(7, { precio: 99999 })); const p = planSync(d, e, { sello: 5555 }); assert.equal(p.escribir.length, 1); assert.equal(p.escribir[0][0], k); assert.equal(p.escribir[0][1].precio, 99999); assert.equal(p.escribir[0][1].actualizado, 5555); assert.equal(p.sinCambios, 72); });
await t('ficha nueva: se escribe; ficha que ya no corresponde: se borra', () => { const d = catalogo(), e = catalogo(); d.set('nuevo', ficha(500)); d.delete('camiseta|modelo 3|negro'); const p = planSync(d, e, { sello: 1 }); assert.deepEqual(p.escribir.map((x) => x[0]), ['nuevo']); assert.deepEqual(p.borrar, ['camiseta|modelo 3|negro']); });
await t('sin sello (envíos): se escribe tal cual, sin inventar `actualizado`', () => { const d = new Map([['a', { localidad: 'X', precio: 1, estimado: false }]]); const p = planSync(d, new Map([['a', { localidad: 'X', precio: 2, estimado: false }]])); assert.deepEqual(p.escribir[0][1], { localidad: 'X', precio: 1, estimado: false }); });
await t('enLotes parte en tandas de 400 (límite de Firestore: 500)', () => { const l = enLotes(Array.from({ length: 950 }, (_, i) => i)); assert.deepEqual(l.map((x) => x.length), [400, 400, 150]); assert.deepEqual(enLotes([]), []); });
await t('planificador: 5 pedidos seguidos = UNA sola corrida (debounce de cola)', async () => {
  let corridas = 0; const cola = []; let ahora = 0;
  const pl = crearPlanificador({ ejecutar: async () => { corridas++; }, espera: 2500, programar: (f, ms) => { const x = { f, en: ahora + ms }; cola.push(x); return x; }, cancelar: (x) => { x.cancelado = true; } });
  const avanzar = async (ms) => { ahora += ms; for (const x of cola) if (!x.cancelado && !x.hecho && x.en <= ahora) { x.hecho = true; await x.f(); } };
  pl.pedir(); await avanzar(300); pl.pedir(); await avanzar(600); pl.pedir(); await avanzar(900); pl.pedir(); await avanzar(900); pl.pedir();
  assert.equal(corridas, 0, 'no debía correr antes de tiempo'); await avanzar(2600); assert.equal(corridas, 1); await avanzar(5000); assert.equal(corridas, 1);
});
await t('planificador: un pedido durante una corrida provoca UNA corrida más y nunca dos a la vez', async () => {
  let activas = 0, maxActivas = 0, corridas = 0; let liberar; const cola = [];
  const pl = crearPlanificador({ ejecutar: async () => { corridas++; activas++; maxActivas = Math.max(maxActivas, activas); await new Promise((r) => { liberar = r; }); activas--; }, espera: 10, programar: (f) => { cola.push(f); return cola.length; }, cancelar: () => {} });
  pl.pedir(); const f1 = cola.shift(); const p1 = f1();
  pl.pedir(); pl.pedir(); const f2 = cola.pop(); await f2(); // llega mientras corre: no debe arrancar otra en paralelo
  assert.equal(maxActivas, 1); liberar(); await p1; await new Promise((r) => setTimeout(r, 0));
  assert.equal(cola.length >= 1, true, 'debía quedar una corrida pendiente'); const f3 = cola.shift(); const p3 = f3(); liberar(); await p3;
  assert.equal(corridas, 2); assert.equal(maxActivas, 1);
});

console.log('— B) costo de una sincronización: VIEJO contra NUEVO (73 fichas, 40 visitantes en línea) —');
const VISITANTES = 40;
function simular(modo, cambios) { // cambios: ids de fichas que cambian en esta sincronización
  const publicado = catalogo(); const deseados = catalogo(); for (const k of cambios) deseados.set(k, ficha(Number(k.split(' ')[1].split('|')[0]), { precio: 77777 }));
  let escrituras = 0, cambiadas = 0;
  if (modo === 'viejo') { for (const [k, f] of deseados) { escrituras++; const nuevo = { ...f, actualizado: Date.now() + Math.random() }; if (textoEstable(nuevo) !== textoEstable(publicado.get(k))) cambiadas++; } } // siempre cambia: actualizado distinto
  else { const p = planSync(deseados, publicado, { sello: Date.now() }); escrituras = p.escribir.length + p.borrar.length; cambiadas = p.escribir.length + p.borrar.length; }
  return { escrituras, lecturas: cambiadas * (1 + VISITANTES) };
}
const filas = [['sin cambios', []], ['1 producto cambió', ['camiseta|modelo 7|negro']], ['5 productos cambiaron', Array.from({ length: 5 }, (_, i) => `camiseta|modelo ${i}|negro`)]];
const tabla = filas.map(([n, c]) => ({ n, v: simular('viejo', c), nu: simular('nuevo', c) }));
for (const x of tabla) console.log(`   ${x.n.padEnd(22)} VIEJO: ${String(x.v.escrituras).padStart(3)} escrituras, ${String(x.v.lecturas).padStart(5)} lecturas | NUEVO: ${String(x.nu.escrituras).padStart(3)} escrituras, ${String(x.nu.lecturas).padStart(5)} lecturas`);
await t('sin cambios: el NUEVO hace 0 escrituras y 0 lecturas (el VIEJO hacía 73 y 2.993)', () => { assert.deepEqual(tabla[0].nu, { escrituras: 0, lecturas: 0 }); assert.equal(tabla[0].v.escrituras, 73); assert.equal(tabla[0].v.lecturas, 73 * (1 + VISITANTES)); });
await t('1 producto cambió: el NUEVO hace 1 escritura y 41 lecturas', () => { assert.deepEqual(tabla[1].nu, { escrituras: 1, lecturas: 1 + VISITANTES }); });

if (!process.env.SOLO_PURAS) {
  console.log('— C) catalogo.js y envios.js reales con un Firestore simulado (en el navegador) —');
  const RAIZ = path.dirname(fileURLToPath(import.meta.url));
  async function cargarPlaywright() {
    try { return await import('playwright'); } catch {}
    if (process.env.PLAYWRIGHT_DIR) { try { return createRequire(path.join(path.resolve(process.env.PLAYWRIGHT_DIR), 'x.js'))('playwright'); } catch {} }
    console.error('No se pudo cargar Playwright. Instalalo fuera del repo y corré con PLAYWRIGHT_DIR=<carpeta> (o SOLO_PURAS=1).'); process.exit(1);
  }
  const { chromium } = await cargarPlaywright();
  const STUB = `
const FS = window.__FS = { col: {}, oyentes: [], escrituras: 0, lecturas: 0, lotes: 0 };
const col = (n) => (FS.col[n] ||= new Map());
const copia = (x) => JSON.parse(JSON.stringify(x));
const snap = (n) => ({ size: col(n).size, docs: [...col(n)].map(([id, d]) => ({ id, data: () => copia(d) })) });
export const db = {};
export const collection = (_d, name) => ({ tipo: 'col', name });
export const doc = (a, b, c) => (a && a.tipo === 'col' ? { tipo: 'doc', name: a.name, id: b } : { tipo: 'doc', name: b, id: c });
export const setDoc = async () => {};
export const addDoc = async () => {}; export const updateDoc = async () => {}; export const deleteDoc = async () => {};
export const onSnapshot = (ref, okf) => {
  if (ref.tipo !== 'col') { setTimeout(() => okf({ exists: () => false, data: () => ({}) }), 5); return () => {}; }
  const o = { name: ref.name, okf, visitante: !!window.__ES_VISITANTE, lecturas: 0 }; FS.oyentes.push(o);
  setTimeout(() => { o.lecturas += col(ref.name).size; FS.lecturas += col(ref.name).size; okf(snap(ref.name)); }, 5);
  return () => { FS.oyentes = FS.oyentes.filter((x) => x !== o); };
};
export const writeBatch = () => { const ops = []; return {
  set: (r, data) => ops.push(['set', r, copia(data)]), delete: (r) => ops.push(['del', r]),
  commit: async () => { FS.lotes++; const tocadas = new Set();
    for (const [tipo, r, data] of ops) { FS.escrituras++; const m = col(r.name); const antes = m.get(r.id);
      if (tipo === 'set') { if (JSON.stringify(antes) !== JSON.stringify(data)) FS.cambios = (FS.cambios || 0) + 1; m.set(r.id, data); if (JSON.stringify(antes) !== JSON.stringify(data)) tocadas.add(r.name + '|' + r.id); }
      else if (m.has(r.id)) { m.delete(r.id); tocadas.add(r.name + '|' + r.id); } }
    // cada oyente se factura por cada documento que cambió de verdad en su colección
    for (const o of FS.oyentes) { const n = [...tocadas].filter((x) => x.startsWith(o.name + '|')).length; if (n) { o.lecturas += n; FS.lecturas += n; o.okf(snap(o.name)); } } } }; };
`;
  const PAGINA = `<!doctype html><html><body><div id="tab-catalogo" class="section"></div><script type="module">
  import { state } from '/state.js'; window.__state = state;
  const crear = (n) => { const s = []; for (let i = 0; i < n; i++) for (const talle of ['S', 'M', 'L']) s.push({ id: 'p' + i + talle, cat: 'Camisetas', modelo: 'Modelo ' + i, color: 'Negro', talle, qty: 5, pventa: 30000 + i, catalogo: true, createdAt: 1000 + i }); return s; };
  state.stockData = crear(73); state.reservasData = []; state.configSitio = {}; state.configListo = true;
  const { claveModelo } = await import('/matching.js');
  window.__llamadasSync = 0;
  await import('/catalogo.js'); await import('/envios.js');
  const fotos = (window.__FS.col.producto_fotos ||= new Map());
  for (const p of state.stockData) fotos.set(claveModelo(p), { fotos: ['https://x/f.jpg'] });
  const orig = window.catalogoSync; window.catalogoSync = async function () { window.__llamadasSync++; return orig.apply(this, arguments); };
  window.__listo = true;
  </script></body></html>`;
  const servidor = await new Promise((r) => { const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
    const s = http.createServer((q, res) => { let u = decodeURIComponent(q.url.split('?')[0]);
      if (u === '/__prueba.html') { res.writeHead(200, { 'Content-Type': T['.html'] }); return res.end(PAGINA); }
      if (u === '/firebase-config.js') { res.writeHead(200, { 'Content-Type': T['.js'] }); return res.end(STUB); }
      const f = path.join(RAIZ, u); if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
      res.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(f)); }).listen(0, '127.0.0.1', () => r(s)); });
  const BASE = `http://127.0.0.1:${servidor.address().port}`;
  const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || 'chrome', headless: true }).catch(() => chromium.launch({ headless: true }));
  const page = await (await browser.newContext()).newPage(); const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(BASE + '/__prueba.html'); await page.waitForFunction(() => window.__listo === true);
  const esp = (ms) => new Promise((r) => setTimeout(r, ms));
  const c = () => page.evaluate(() => ({ e: window.__FS.escrituras, l: window.__FS.lecturas, lotes: window.__FS.lotes, syncs: window.__llamadasSync, docs: window.__FS.col.catalogo_publico ? window.__FS.col.catalogo_publico.size : 0 }));
  const dif = (a, b) => ({ escrituras: b.e - a.e, lecturas: b.l - a.l, corridas: b.syncs - a.syncs });

  await t('primera publicación: StockMGR abre con el catálogo vacío y publica las 73 fichas (en una sola corrida)', async () => {
    await page.evaluate(() => { catalogoIniciar(); }); await esp(3800);
    const x = await c(); assert.equal(x.docs, 73); assert.equal(x.e, 73); assert.equal(x.syncs, 1, 'corridas de sincronización: ' + x.syncs); assert.equal(x.lotes, 1);
  });
  // se suman 40 visitantes con la tienda abierta (cada uno lee las 73 fichas al entrar)
  await page.evaluate(() => { window.__ES_VISITANTE = true; for (let i = 0; i < 40; i++) window.__FS.oyentes.push({ name: 'catalogo_publico', visitante: true, lecturas: 73, okf: () => {} }); window.__FS.lecturas += 40 * 73; window.__ES_VISITANTE = false; });
  let base = await c();
  await t('SIN CAMBIOS: 5 disparos seguidos no escriben nada ni hacen leer a nadie (0 escrituras, 0 lecturas)', async () => {
    const antesAct = await page.evaluate(() => JSON.stringify([...window.__FS.col.catalogo_publico].map(([k, d]) => [k, d.actualizado])));
    await page.evaluate(() => { for (let i = 0; i < 5; i++) catalogoRefresh(); }); await esp(3500);
    const x = await c(); const d = dif(base, x); console.log('   sincronización sin cambios →', JSON.stringify(d));
    assert.deepEqual({ e: d.escrituras, l: d.lecturas }, { e: 0, l: 0 }); assert.equal(d.corridas, 1, 'los 5 disparos deben ser 1 corrida');
    assert.equal(await page.evaluate(() => JSON.stringify([...window.__FS.col.catalogo_publico].map(([k, d]) => [k, d.actualizado]))), antesAct, 'el `actualizado` de lo que no cambió no se toca'); base = x;
  });
  await t('ráfaga al abrir StockMGR (stock, reservas, fotos y config con 0,3–1,5 s de diferencia): UNA corrida y 0 escrituras', async () => {
    await page.evaluate(() => { catalogoRefresh(); setTimeout(catalogoRefresh, 300); setTimeout(catalogoRefresh, 900); setTimeout(catalogoRefresh, 1500); }); await esp(5200);
    const d = dif(base, await c()); assert.equal(d.corridas, 1, 'corridas: ' + d.corridas); assert.equal(d.escrituras, 0); assert.equal(d.lecturas, 0); base = await c();
  });
  await t('un cambio de stock en UN producto: 1 escritura y 41 lecturas (StockMGR + 40 visitantes), no 73 y 2.993', async () => {
    await page.evaluate(() => { const s = window.__state.stockData.find((p) => p.id === 'p7M'); s.qty = 4; catalogoRefresh(); }); await esp(3500);
    const d = dif(base, await c()); console.log('   un cambio de stock →', JSON.stringify(d)); assert.equal(d.escrituras, 1); assert.equal(d.lecturas, 41); base = await c();
  });
  await t('despublicar un producto (desmarcar "Mostrar en catálogo"): 1 borrado', async () => {
    await page.evaluate(() => { for (const p of window.__state.stockData) if (p.modelo === 'Modelo 9') p.catalogo = false; catalogoRefresh(); }); await esp(3500);
    const x = await c(); const d = dif(base, x); assert.equal(d.escrituras, 1); assert.equal(x.docs, 72); base = x;
  });
  await t('stock bajo: al quedar pocas unidades se publica `stockBajo`, y al reponer desaparece (1 escritura cada vez)', async () => {
    await page.evaluate(() => { for (const p of window.__state.stockData) if (p.modelo === 'Modelo 11') p.qty = p.talle === 'S' ? 1 : 0; catalogoRefresh(); }); await esp(3500);
    const bajo = await page.evaluate(() => window.__FS.col.catalogo_publico.get('camiseta|modelo 11|negro').stockBajo); assert.equal(bajo, 1);
    let x = await c(); let d = dif(base, x); assert.equal(d.escrituras, 1); base = x;
    await page.evaluate(() => { for (const p of window.__state.stockData) if (p.modelo === 'Modelo 11') p.qty = 5; catalogoRefresh(); }); await esp(3500);
    assert.equal(await page.evaluate(() => 'stockBajo' in window.__FS.col.catalogo_publico.get('camiseta|modelo 11|negro')), false); x = await c(); d = dif(base, x); assert.equal(d.escrituras, 1); base = x;
  });
  await t('envíos públicos: 152 localidades ya publicadas y sin cambios = 0 escrituras; un cambio de precio = 1', async () => {
    await page.evaluate(() => {
      const moto = (window.__FS.col.envios_motomensajeria ||= new Map()), pub = (window.__FS.col.envios_publico ||= new Map());
      for (let i = 0; i < 152; i++) { moto.set('loc' + i, { localidad: 'Localidad ' + i, precio: 10000 + i, estimado: false, costo: 7000 }); pub.set('loc' + i, { localidad: 'Localidad ' + i, precio: 10000 + i, estimado: false }); }
    });
    const a = await c(); await page.evaluate(() => { enviosIniciar(); }); await esp(3800);
    let d = dif(a, await c()); console.log('   envíos sin cambios →', JSON.stringify({ escrituras: d.escrituras, lecturas: d.lecturas })); assert.equal(d.escrituras, 0);
    const b = await c();
    await page.evaluate(() => { const moto = window.__FS.col.envios_motomensajeria; moto.get('loc5').precio = 12345; const o = window.__FS.oyentes.find((x) => x.name === 'envios_motomensajeria'); o.okf({ docs: [...moto].map(([id, x]) => ({ id, data: () => JSON.parse(JSON.stringify(x)) })) }); });
    await esp(3500); d = dif(b, await c()); assert.equal(d.escrituras, 1);
    assert.equal(await page.evaluate(() => window.__FS.col.envios_publico.get('loc5').precio), 12345);
    assert.equal(await page.evaluate(() => 'costo' in window.__FS.col.envios_publico.get('loc5')), false, 'el costo NUNCA va a envios_publico');
  });
  await t('sin errores de JavaScript en el navegador', () => assert.equal(errores.length, 0, errores.join(' | ')));
  await browser.close(); servidor.close();
}
console.log(fallos ? `\n${fallos} prueba(s) FALLARON, ${ok} bien` : `\nTodo OK: ${ok} pruebas pasaron.`);
process.exit(fallos ? 1 : 0);
