// Pruebas puras de fotos.js. Correr: node test-fotos.mjs
import assert from 'node:assert/strict';
import { MAX_FOTOS, tamanoFinal, limitarSeleccion, mover, quitarEn, listaFinal, contador, correrCola } from './fotos.js';
let n = 0; const ok = (t) => { n++; console.log('  ✔ ' + t); };
assert.deepEqual(tamanoFinal(4000, 3000), { ancho: 1600, alto: 1200, escala: 0.4 });
assert.deepEqual(tamanoFinal(3000, 4000).alto, 1600); assert.equal(tamanoFinal(3000, 4000).ancho, 1200);
assert.equal(tamanoFinal(800, 600).ancho, 800); assert.equal(tamanoFinal(800, 600).escala, 1); assert.equal(tamanoFinal(1600, 1600).ancho, 1600);
ok('4000x3000 → 1600x1200; vertical 3000x4000 → 1200x1600; las más chicas no se agrandan');
assert.equal(limitarSeleccion(0, 6).tomar, 6); assert.equal(limitarSeleccion(0, 6).aviso, null);
let l = limitarSeleccion(0, 10); assert.equal(l.tomar, 8); assert.equal(l.descartadas, 2); assert.ok(l.aviso.includes('8'));
l = limitarSeleccion(5, 6); assert.equal(l.tomar, 3); l = limitarSeleccion(8, 2); assert.equal(l.tomar, 0); assert.ok(l.aviso);
ok('6 entran; 10 → toma 8 y avisa; con 5 ya cargadas y 6 elegidas toma 3; con 8 ya no entra ninguna');
assert.deepEqual(mover(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']); assert.deepEqual(mover(['a', 'b', 'c'], 2, 1), ['a', 'c', 'b']);
assert.deepEqual(mover(['a', 'b'], 0, -1), ['a', 'b']); assert.deepEqual(mover(['a', 'b'], 1, 5), ['a', 'b']); assert.deepEqual(quitarEn(['a', 'b', 'c'], 1), ['a', 'c']);
ok('mover y quitar (los bordes no rompen nada)');
assert.deepEqual(listaFinal({ guardadas: ['a', 'b'], nuevas: ['c', 'd'], remoto: ['a', 'b'], conocidas: ['a', 'b'] }), ['a', 'b', 'c', 'd']);
assert.deepEqual(listaFinal({ guardadas: ['b', 'a'], nuevas: ['c'], remoto: ['a', 'b', 'z'], conocidas: ['a', 'b'] }), ['b', 'a', 'c', 'z']);
assert.deepEqual(listaFinal({ guardadas: ['a'], nuevas: ['a', 'c'], remoto: ['a', 'x'], conocidas: ['a', 'x'] }), ['a', 'c']);
assert.equal(listaFinal({ guardadas: Array.from({ length: 7 }, (_, i) => 'g' + i), nuevas: ['n1', 'n2', 'n3'], remoto: [], conocidas: [] }).length, MAX_FOTOS);
ok('lista final: las que había + nuevas, respeta el orden, suma lo que otro dispositivo agregó, no repite y topea en 8; lo quitado no vuelve');
assert.equal(contador(['lista', 'lista', 'lista', 'subiendo', 'cola', 'error']).texto, '3 de 6');
ok('contador "3 de 6"');
// Cola: máximo 3 a la vez, 1 reintento automático, una que falla no frena ni pierde a las demás
let activos = 0, pico = 0; const intentos = {}; const estados = {};
const r = await correrCola([0, 1, 2, 3, 4, 5, 6, 7], async (x) => {
  activos++; pico = Math.max(pico, activos); await new Promise((s) => setTimeout(s, 10)); activos--;
  intentos[x] = (intentos[x] || 0) + 1;
  if (x === 2 && intentos[x] === 1) throw new Error('falla 1');
  if (x === 5) throw new Error('falla siempre');
  return 'url' + x;
}, { onEstado: (i, e) => { estados[i] = e; } });
assert.equal(pico, 3); assert.equal(intentos[2], 2); assert.equal(r[2].ok, true); assert.equal(intentos[5], 2); assert.equal(r[5].ok, false);
assert.equal(r.filter((x) => x.ok).length, 7); assert.equal(estados[5], 'error'); assert.equal(estados[7], 'lista'); assert.equal(r[7].valor, 'url7');
ok('cola: nunca más de 3 a la vez; la que falla una vez se reintenta sola y sale bien; la que falla dos queda en error y las otras 7 siguen');
let cancel = false; let corridas = 0;
await correrCola([1, 2, 3, 4, 5, 6], async () => { corridas++; cancel = true; await new Promise((s) => setTimeout(s, 5)); return 1; }, { cancelado: () => cancel });
assert.ok(corridas <= 3); ok('cancelar corta la cola: no arranca más subidas');
console.log(`\nTodo OK: ${n} grupos de pruebas pasaron.`);
