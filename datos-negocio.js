// ══════════════════════════════════════════
// DATOS DEL NEGOCIO (StockMGR) — valores que se usan al sincronizar el
// catálogo público. Es un archivo propio de este panel: el sitio público
// (tienda-premium) vive en otro repositorio/dominio y tiene su propio
// datos-negocio.js, no pueden compartir uno solo entre los dos.
// ══════════════════════════════════════════

// Si el total de unidades disponibles de un producto (sumando todos los
// talles) es menor o igual a este número, se publica el aviso de poco stock.
export const UMBRAL_STOCK_BAJO = 3;
