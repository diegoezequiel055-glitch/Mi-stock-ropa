// ══════════════════════════════════════════
// SINCRONIZACIÓN DIFERENCIAL — lógica pura (sin DOM ni Firebase; se prueba con `node test-catalogo-sync.mjs`).
// La usan catalogo.js (catalogo_publico) y envios.js (envios_publico).
//
// Por qué existe: antes, cada sincronización reescribía TODAS las fichas (~73) con `actualizado: Date.now()`. Como el documento
// cambiaba de verdad, cada oyente (StockMGR y cada visitante con la tienda abierta) volvía a leer las 73 fichas: lecturas ≈ 73 × (1 + visitantes)
// por sincronización, y la sincronización corre varias veces cada vez que se abre StockMGR y con cada venta o cambio de stock.
// Ahora solo se escribe lo que REALMENTE cambió, comparando sin el campo `actualizado`; si no cambió nada, no se escribe nada
// (0 escrituras y 0 lecturas para los demás) y el `actualizado` de las fichas sin cambios no se toca.
// ══════════════════════════════════════════

// JSON con las claves ordenadas: dos objetos con el mismo contenido dan el mismo texto aunque las claves vengan en otro orden.
export function textoEstable(v) {
  if (v === undefined) return 'null'; // Firestore no guarda undefined
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(textoEstable).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + textoEstable(v[k])).join(',') + '}';
}

export const sinCampos = (obj, campos) => { const r = {}; for (const k of Object.keys(obj || {})) if (!campos.includes(k)) r[k] = obj[k]; return r; };

// ¿Dos fichas son iguales ignorando los campos de `ignorar` (por defecto `actualizado`)?
export const fichasIguales = (a, b, ignorar = ['actualizado']) => textoEstable(sinCampos(a, ignorar)) === textoEstable(sinCampos(b, ignorar));

// deseados: Map(id → ficha que debería estar publicada). existentes: Map(id → documento que está publicado hoy).
// opciones.sello: si se pasa, se agrega a cada ficha que se escribe como `actualizado` (solo a las que cambiaron).
// Devuelve { escribir: [[id, ficha]], borrar: [id], sinCambios: n }.
export function planSync(deseados, existentes, { sello = null, ignorar = ['actualizado'] } = {}) {
  const escribir = [], borrar = [];
  let sinCambios = 0;
  for (const [id, ficha] of deseados) {
    const ya = existentes.get(id);
    if (ya && fichasIguales(ya, ficha, ignorar)) { sinCambios++; continue; }
    const nueva = sello == null ? { ...ficha } : { ...sinCampos(ficha, ignorar), actualizado: sello };
    escribir.push([id, nueva]);
  }
  for (const id of existentes.keys()) if (!deseados.has(id)) borrar.push(id);
  return { escribir, borrar, sinCambios };
}

// Planificador: junta muchos disparos seguidos en UNA sola corrida (debounce de cola) y nunca corre dos a la vez.
// - pedir(): reinicia la espera. Cuando pasan `espera` ms sin nuevos pedidos, corre `ejecutar()`.
// - si llegan pedidos mientras corre, hace una sola corrida más al terminar.
export function crearPlanificador({ ejecutar, espera = 2500, programar = setTimeout, cancelar = clearTimeout, alError = () => {} }) {
  let timer = null, corriendo = false, repetir = false;
  async function correr() {
    timer = null;
    if (corriendo) { repetir = true; return; }
    corriendo = true;
    try { await ejecutar(); } catch (e) { alError(e); }
    corriendo = false;
    if (repetir) { repetir = false; pedir(); }
  }
  function pedir() { if (timer) cancelar(timer); timer = programar(correr, espera); }
  return { pedir, estado: () => ({ pendiente: !!timer, corriendo }) };
}

// Lotes de Firestore: máximo 500 operaciones por batch (se usa 400 de margen).
export function enLotes(operaciones, tamano = 400) {
  const lotes = [];
  for (let i = 0; i < operaciones.length; i += tamano) lotes.push(operaciones.slice(i, i + tamano));
  return lotes;
}
