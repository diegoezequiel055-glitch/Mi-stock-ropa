// ══════════════════════════════════════════
// FOTOS DE PRODUCTO (carga múltiple) — lógica pura (sin DOM, sin Firestore, sin red).
// La pantalla y la subida están en fotos-ui.js.
//
// Reglas: hasta 8 fotos por producto; compresión en el navegador (lado mayor 1600 px, JPEG 0,85, sin agrandar);
// subida en paralelo (máx. 3) con 1 reintento automático; UNA sola escritura en producto_fotos al terminar.
// La primera foto de la lista es la principal (la que ve la tienda en el listado).
// ══════════════════════════════════════════
export const MAX_FOTOS = 8;
export const LADO_MAX = 1600;
export const CALIDAD_JPEG = 0.85;
export const PARALELO = 3;
export const REINTENTOS_AUTO = 1;

// Tamaño final de una foto: el lado mayor no pasa de LADO_MAX y nunca se agranda.
export function tamanoFinal(ancho, alto, ladoMax = LADO_MAX) {
  const mayor = Math.max(ancho, alto);
  if (!(mayor > 0)) return { ancho: 0, alto: 0, escala: 1 };
  const escala = mayor > ladoMax ? ladoMax / mayor : 1;
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)), escala };
}

// Si se eligen más fotos de las que entran, toma solo las que caben. `ocupadas` = fotos ya guardadas + ya elegidas.
export function limitarSeleccion(ocupadas, elegidas, max = MAX_FOTOS) {
  const lugar = Math.max(0, max - ocupadas);
  const tomar = Math.min(lugar, elegidas);
  const descartadas = elegidas - tomar;
  let aviso = null;
  if (descartadas > 0) {
    aviso = lugar === 0
      ? `Ya tiene ${max} fotos, el máximo por producto. Quitá alguna para agregar otras.`
      : `Elegiste ${elegidas} fotos y solo entran ${tomar} (máximo ${max} por producto). Tomé las primeras ${tomar}.`;
  }
  return { tomar, descartadas, aviso };
}

// Reordenar: mueve el elemento de `i` a `j` (devuelve una lista nueva; si no hay cambio, la misma posición).
export function mover(lista, i, j) {
  if (i === j || i < 0 || j < 0 || i >= lista.length || j >= lista.length) return lista.slice();
  const r = lista.slice(); const [x] = r.splice(i, 1); r.splice(j, 0, x); return r;
}
export const quitarEn = (lista, i) => lista.filter((_, k) => k !== i);

// Lista final a guardar al terminar las subidas: las que ya estaban (en el orden actual) + las nuevas, sin repetir,
// + las que otra persona/dispositivo haya agregado mientras tanto (están en `remoto` y no en `conocidas`). Tope MAX_FOTOS.
export function listaFinal({ guardadas, nuevas, remoto, conocidas }) {
  const r = [];
  const sumar = (u) => { if (typeof u === 'string' && u && !r.includes(u)) r.push(u); };
  guardadas.forEach(sumar); nuevas.forEach(sumar);
  (remoto || []).filter((u) => !(conocidas || []).includes(u)).forEach(sumar);
  return r.slice(0, MAX_FOTOS);
}

// Contador general: "3 de 6" (listas sobre el total que se está subiendo).
export function contador(estados) {
  const total = estados.length; const listas = estados.filter((e) => e === 'lista').length;
  const errores = estados.filter((e) => e === 'error').length;
  return { total, listas, errores, texto: `${listas} de ${total}` };
}

// Corre `tarea(item, i)` para todos los items, máximo `paralelo` a la vez. Cada tarea que falla se reintenta sola
// `reintentos` veces; si sigue fallando queda en error y las demás NO se frenan ni se pierden.
// onEstado(i, 'subiendo' | 'lista' | 'error', dato) avisa cada cambio. `cancelado()` corta la cola (no arranca más).
// Devuelve un arreglo [{ok, valor|error}] en el mismo orden.
export async function correrCola(items, tarea, { paralelo = PARALELO, reintentos = REINTENTOS_AUTO, onEstado = () => {}, cancelado = () => false } = {}) {
  const res = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    for (;;) {
      if (cancelado()) return;
      const i = siguiente++; if (i >= items.length) return;
      let ultimo;
      for (let intento = 0; intento <= reintentos; intento++) {
        if (cancelado()) return;
        onEstado(i, 'subiendo', intento);
        try { const valor = await tarea(items[i], i, intento); res[i] = { ok: true, valor }; onEstado(i, 'lista', valor); ultimo = null; break; }
        catch (e) { ultimo = e; }
      }
      if (ultimo) { res[i] = { ok: false, error: ultimo }; onEstado(i, 'error', ultimo); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(paralelo, items.length) }, trabajador));
  return res;
}
