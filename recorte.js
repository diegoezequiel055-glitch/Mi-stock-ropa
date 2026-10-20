// ══════════════════════════════════════════
// RECORTE DE FOTOS — cálculos puros (sin DOM, sin canvas, sin red). La pantalla está en recorte-ui.js.
//
// La tienda muestra las fotos en 4:5 (tarjetas de la portada, hero rotativo, relacionados) y la ficha usa la proporción
// real de la foto (si la foto es 4:5 se ve completa, sin franjas). Por eso la proporción base del recorte es 4:5 (ancho/alto = 0,8).
// El recorte se describe con: zoom (1 = todo lo que entra en 4:5, 4 = una cuarta parte) y centro (cx, cy) en píxeles de la foto.
// ══════════════════════════════════════════
import { LADO_MAX } from './fotos.js';

export const RATIO_BASE = 4 / 5; // ancho / alto
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
export const LADO_SALIDA = LADO_MAX; // lado mayor máximo del archivo recortado (1600 px)
export const CALIDAD_RECORTE = 0.92; // JPEG de calidad alta

const entre = (v, a, b) => Math.min(b, Math.max(a, v));
export const clampZoom = (z) => (Number.isFinite(z) ? entre(z, ZOOM_MIN, ZOOM_MAX) : ZOOM_MIN);

// Recorte más grande con esa proporción que entra en una foto de w×h (zoom 1).
export function rectBase(w, h, ratio = RATIO_BASE) {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  return w / h > ratio ? { w: h * ratio, h } : { w, h: w / ratio };
}

// Mantiene el recorte dentro de la foto: devuelve el centro corregido.
export function clampCentro({ w, h, ratio = RATIO_BASE, zoom = 1, cx, cy }) {
  const b = rectBase(w, h, ratio), z = clampZoom(zoom);
  const rw = b.w / z, rh = b.h / z;
  return { cx: entre(Number.isFinite(cx) ? cx : w / 2, rw / 2, w - rw / 2), cy: entre(Number.isFinite(cy) ? cy : h / 2, rh / 2, h - rh / 2) };
}

// Rectángulo a recortar {x, y, w, h} (en píxeles de la foto) para un zoom y un centro dados.
export function rectDeVista({ w, h, ratio = RATIO_BASE, zoom = 1, cx, cy }) {
  const b = rectBase(w, h, ratio), z = clampZoom(zoom);
  const rw = b.w / z, rh = b.h / z;
  const c = clampCentro({ w, h, ratio, zoom: z, cx, cy });
  return { x: c.cx - rw / 2, y: c.cy - rh / 2, w: rw, h: rh };
}

// Encuadre automático: centrado y lo más grande posible.
export const rectCentrado = (w, h, ratio = RATIO_BASE) => rectDeVista({ w, h, ratio, zoom: 1, cx: w / 2, cy: h / 2 });

// Arrastre: la foto se mueve junto con el dedo/mouse. `ancho` = ancho en pantalla del recuadro de recorte.
// Si el dedo va a la derecha, el centro del recorte va a la izquierda (se ve más de lo que estaba a la izquierda).
export function arrastrar({ w, h, ratio = RATIO_BASE, zoom = 1, cx, cy }, dx, dy, ancho) {
  const r = rectDeVista({ w, h, ratio, zoom, cx, cy });
  const escala = ancho > 0 ? r.w / ancho : 0; // píxeles de foto por píxel de pantalla
  return clampCentro({ w, h, ratio, zoom, cx: (cx ?? w / 2) - dx * escala, cy: (cy ?? h / 2) - dy * escala });
}

// Cambia el zoom manteniendo el mismo punto bajo el dedo (fx, fy en 0–1 dentro del recuadro; 0,5 = centro).
export function zoomEn({ w, h, ratio = RATIO_BASE, zoom = 1, cx, cy }, nuevoZoom, fx = 0.5, fy = 0.5) {
  const z0 = clampZoom(zoom), z1 = clampZoom(nuevoZoom);
  const r = rectDeVista({ w, h, ratio, zoom: z0, cx, cy });
  const px = r.x + fx * r.w, py = r.y + fy * r.h; // punto de la foto bajo el dedo
  const b = rectBase(w, h, ratio), rw = b.w / z1, rh = b.h / z1;
  const c = clampCentro({ w, h, ratio, zoom: z1, cx: px - (fx - 0.5) * rw, cy: py - (fy - 0.5) * rh });
  return { zoom: z1, cx: c.cx, cy: c.cy };
}

// Tamaño del archivo recortado: conserva la proporción, el lado mayor no pasa de ladoMax y NUNCA se agranda.
export function tamanoSalida(rect, ladoMax = LADO_SALIDA) {
  const mayor = Math.max(rect.w, rect.h);
  if (!(mayor > 0)) return { ancho: 0, alto: 0 };
  const escala = Math.min(1, ladoMax / mayor);
  return { ancho: Math.max(1, Math.round(rect.w * escala)), alto: Math.max(1, Math.round(rect.h * escala)) };
}
