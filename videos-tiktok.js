// ══════════════════════════════════════════
// VIDEOS DE TIKTOK — lógica pura (sin DOM ni Firestore). Se prueba con `node test-tiktok.mjs`.
//
// Se guardan en `config_sitio/config` (el documento que la tienda ya lee: sin colecciones ni lecturas nuevas, sin tocar las reglas) en el campo
//   videosTiktok: [{ url, portada, titulo }, ...]    hasta 6, en el orden en que se ven en la tienda
//     url      → https://www.tiktok.com/@usuario/video/NÚMERO   (se guarda LIMPIA: sin nada de lo que va después de "?" ni "#")
//     portada  → URL https de la imagen (se sube a Cloudinary con el mismo uploader de las fotos)
//     titulo   → texto corto opcional (máx. 60 caracteres)
// La tienda (tienda-premium › videos-tiktok.js) vuelve a validar todo; este archivo es el que decide qué se puede guardar.
// ══════════════════════════════════════════

export const MAX_VIDEOS = 6;
export const MAX_TITULO = 60;

// Link de un video → { ok: true, url (limpia), id } o { ok: false, error }.
// Acepta tiktok.com, www.tiktok.com y m.tiktok.com (http o https). Los links cortos (vm.tiktok.com, /t/...) NO sirven: hay que abrir el video y copiar el link completo.
export function validarLinkTiktok(texto) {
  const crudo = String(texto ?? '').trim();
  if (!crudo) return { ok: false, error: 'Pegá el link del video de TikTok.' };
  if (/^https?:\/\/(vm|vt)\.tiktok\.com\//i.test(crudo) || /^https?:\/\/(www\.)?tiktok\.com\/t\//i.test(crudo)) return { ok: false, error: 'Ese es un link corto. Abrí el video en TikTok y copiá el link completo (tiene que decir /@usuario/video/número).' };
  const limpio = crudo.split(/[?#]/)[0].replace(/\/+$/, '');
  const m = limpio.match(/^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([A-Za-z0-9._]{1,40})\/video\/(\d{6,25})$/i);
  if (!m) return { ok: false, error: 'El link no es válido. Tiene que ser de tiktok.com y verse así: https://www.tiktok.com/@usuario/video/1234567890123456789' };
  return { ok: true, url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}`, id: m[2] };
}

export const limpiarTitulo = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TITULO);
export const portadaValida = (p) => typeof p === 'string' && /^https:\/\/[^\s"'<>]{4,600}$/.test(p.trim());

// Arma un video para agregar a la lista. lista = los que ya hay (para no repetir ni pasar de 6). → { ok, video } o { ok: false, error }.
export function armarVideo({ link, portada, titulo }, lista = []) {
  if ((lista || []).length >= MAX_VIDEOS) return { ok: false, error: `Ya hay ${MAX_VIDEOS} videos (el máximo). Borrá uno para agregar otro.` };
  const l = validarLinkTiktok(link); if (!l.ok) return l;
  if ((lista || []).some((v) => v.url === l.url)) return { ok: false, error: 'Ese video ya está en la lista.' };
  if (!portadaValida(portada)) return { ok: false, error: 'Subí la portada del video (una imagen).' };
  return { ok: true, video: { url: l.url, portada: portada.trim(), titulo: limpiarTitulo(titulo) } };
}

// Lo que se guarda en config_sitio/config › videosTiktok: valida y limpia todo (nunca guarda un link con parámetros de rastreo). → { ok, lista } o { ok: false, error }.
export function prepararParaGuardar(lista) {
  if (!Array.isArray(lista)) return { ok: false, error: 'La lista de videos no es válida.' };
  if (lista.length > MAX_VIDEOS) return { ok: false, error: `Máximo ${MAX_VIDEOS} videos.` };
  const salida = [], vistos = new Set();
  for (let i = 0; i < lista.length; i++) {
    const v = lista[i] || {}; const l = validarLinkTiktok(v.url);
    if (!l.ok) return { ok: false, error: `Video ${i + 1}: ${l.error}` };
    if (vistos.has(l.url)) return { ok: false, error: `Video ${i + 1}: está repetido.` };
    if (!portadaValida(v.portada)) return { ok: false, error: `Video ${i + 1}: falta la portada.` };
    vistos.add(l.url); salida.push({ url: l.url, portada: v.portada.trim(), titulo: limpiarTitulo(v.titulo) });
  }
  return { ok: true, lista: salida };
}

// Lo ya guardado (puede faltar o venir raro) → lista para editar.
export function leerGuardados(cfg) {
  const l = cfg && cfg.videosTiktok; if (!Array.isArray(l)) return [];
  return l.filter((v) => v && typeof v === 'object' && validarLinkTiktok(v.url).ok && portadaValida(v.portada)).slice(0, MAX_VIDEOS).map((v) => ({ url: validarLinkTiktok(v.url).url, portada: v.portada.trim(), titulo: limpiarTitulo(v.titulo) }));
}

// Reordenar y quitar (devuelven una lista nueva; fuera de rango = misma lista).
export function mover(lista, i, delta) {
  const j = i + delta; if (i < 0 || i >= lista.length || j < 0 || j >= lista.length) return lista.slice();
  const n = lista.slice(); [n[i], n[j]] = [n[j], n[i]]; return n;
}
export const quitar = (lista, i) => (i < 0 || i >= lista.length ? lista.slice() : lista.filter((_, k) => k !== i));

// ¿Hay cambios sin guardar? (compara con lo guardado, en orden)
export const hayCambios = (borrador, guardado) => JSON.stringify(borrador.map((v) => [v.url, v.portada, v.titulo])) !== JSON.stringify(guardado.map((v) => [v.url, v.portada, v.titulo]));

// Lo que escribe el panel: SOLO este campo (merge): nunca pisa el resto de la config.
export const camposVideos = (lista) => ({ videosTiktok: lista });
