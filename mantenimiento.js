// ══════════════════════════════════════════
// MODO MANTENIMIENTO — lógica pura (sin DOM ni Firebase; se prueba con `node test-mantenimiento-admin.mjs`).
// La pantalla de StockMGR está en mantenimiento-admin.js. Los campos viven en config_sitio/config (el documento público de la tienda):
//   mantenimiento (boolean), mantenimientoMensaje (texto), mantenimientoClave (texto del link de acceso).
// La tienda (tienda-premium › mantenimiento.js) los lee. ATENCIÓN: config_sitio es de lectura pública, así que la clave no es secreta:
// sirve para que entres vos con un link, no como seguridad.
// ══════════════════════════════════════════

export const MENSAJE_DEFECTO = 'Estamos actualizando la tienda. Volvemos en breve.';
export const DOMINIO_TIENDA = 'https://tiendapremium.com.ar';
export const MAX_MENSAJE = 200;
const ALFABETO = 'abcdefghjkmnpqrstuvwxyz23456789'; // sin letras/números que se confunden (0 O 1 l i)

// Clave al azar de 20 caracteres (≈100 bits). `aleatorio(n)` devuelve n números de 32 bits (en las pruebas se inyecta uno fijo).
export function generarClave(largo = 20, aleatorio = (n) => globalThis.crypto.getRandomValues(new Uint32Array(n))) {
  const r = aleatorio(largo);
  let s = '';
  for (let i = 0; i < largo; i++) s += ALFABETO[Math.floor((r[i] / 4294967296) * ALFABETO.length)];
  return s;
}

// Link que abre la tienda aunque esté en mantenimiento.
export const armarLink = (clave, dominio = DOMINIO_TIENDA) => `${String(dominio).replace(/\/+$/, '')}/?acceso=${encodeURIComponent(String(clave ?? ''))}`;

// Estado a mostrar a partir de config_sitio/config.
export function estadoDe(cfg) {
  const c = cfg || {};
  return {
    activo: c.mantenimiento === true,
    mensaje: typeof c.mantenimientoMensaje === 'string' ? c.mantenimientoMensaje : '',
    clave: typeof c.mantenimientoClave === 'string' ? c.mantenimientoClave : '',
  };
}
export const textoEstado = (activo) => (activo ? 'ACTIVO' : 'DESACTIVADO');

export const mensajeFinal = (txt) => String(txt ?? '').trim().slice(0, MAX_MENSAJE) || MENSAJE_DEFECTO;

// Lo que se escribe en Firestore (merge: no toca ningún otro campo de config_sitio).
// Activar guarda también el mensaje y la clave (la genera si no había). Desactivar solo apaga: conserva mensaje y clave.
export function camposActivar({ mensaje, clave }, nuevaClave = generarClave) {
  return { mantenimiento: true, mantenimientoMensaje: mensajeFinal(mensaje), mantenimientoClave: (clave && clave.trim()) || nuevaClave() };
}
export const camposDesactivar = () => ({ mantenimiento: false });
export const camposMensaje = (mensaje) => ({ mantenimientoMensaje: mensajeFinal(mensaje) });
export const camposClave = (clave) => ({ mantenimientoClave: clave });
