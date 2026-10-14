# StockMGR (Mi-stock-ropa)

App de stock/ventas en HTML + JS modular (ES modules, sin build), Firestore proyecto `mi-stock-ropa`, publicada en GitHub Pages desde `main`.

## Reglas
- Un módulo por archivo (`stock.js`, `ventas.js`, `cuotas.js`, `reservas.js`, `menu-mas.js`, etc.), importados desde `app.js`.
- Estética dorado/negro con variables CSS de `style.css`. Mobile first (se usa en celular, ~375 px).
- No tocar datos ni reglas de Firestore sin aprobación expresa.
- Trabajar en ramas; no mergear a `main` sin aprobación.

## Barra de pestañas
- Visibles: Dashboard, Stock, Ventas, Carga rápida, Compras, Gastos, **⋯ Más**.
- Dentro de "Más" (`#mas-menu`): Cobros, Reservas, Envíos, Catálogo y sitio. Ninguna pestaña se eliminó: solo cambió dónde se abre.
- Todo botón de pestaña/menú lleva `data-tab="<nombre>"`; `showTab(name)` (app.js) marca activo por ese atributo (ya no depende del botón que se pasa) y marca "Más" activo si la pestaña es de las del menú.
- `menu-mas.js`: abrir/cerrar el menú (cierra al elegir, tocar afuera, Esc, scroll del nav o resize), `syncMasMenu(name)` y `updateMasBadge()` (contador = planes de cuotas no cobrados + reservas no canceladas; rojo si hay algo vencido, dorado si no).
- `updateCobrosTabBadge` (cuotas.js) y `updateReservasTabBadge` (reservas.js) buscan su botón por `data-tab` y llaman a `updateMasBadge()`.
- El panel del menú es `position:fixed` (el `nav` tiene scroll horizontal y recortaría un menú absoluto). El botón "Más" es `sticky` a la derecha para que siempre se vea.

## Backups
- El backup diario vive en otro repo privado: `mi-stock-ropa-backups` (GitHub Action a las 03:00 hora Argentina). Su rama `backup-completo` (todas las colecciones + `restaurar.mjs`) está pendiente de aprobación y merge.

## Carpetas (Desktop de Windows)
- **Carpeta canónica de este proyecto:** `C:\Users\Nicol\Desktop\Stock Ropa` (repo `Mi-stock-ropa`). Trabajar solo acá.
- La rama `menu-mas-backups` está solo local (no subida a GitHub) hasta que se apruebe.
- `Desktop\stock-ropa-backup-pre-menu`: copia previa al menú "Más". No borrar hasta confirmar que el menú anda en `main`.
- Backups: `Desktop\Mi-stock-ropa-backups` (repo `mi-stock-ropa-backups`). Las copias viejas de la tienda están en `Documents\Archivo-proyectos\tienda-premium-backups`.

## Dashboard en sub-pestañas
- Debajo de los filtros de período hay 4 sub-pestañas: **Resumen** (ganancia, ingresos/ventas/unidades/ticket, alertas, Reservas), **Ventas** (evolución + tabla, Ventas por tipo, Categorías, Mejores clientes), **Productos** (más y menos vendidos, Stock, A reponer, Sin movimiento) y **Finanzas** (Dinero del período con Margen, Cobros en cuotas).
- `dashboard.js` arma los 4 paneles (`.db-pane[data-pane]`) dentro de `#db-body`; `dashboard-tabs.js` solo elige cuál se ve (`display` block/none), recuerda la pestaña en localStorage (`stockmgr_db_pestana`, con try/catch) y achica la letra de los montos que no entren (nunca se parten en 2 líneas).
- El período vive en `state.dbPeriodo`: no cambia al cambiar de pestaña. El gráfico de evolución solo se dibuja con la pestaña Ventas visible (oculto mide 0 de ancho).
- No existen datos de "medio de pago" ni "canal" en las ventas (se guarda `tipo`: minorista/mayorista/curva): por eso no hay esos bloques.
- Nombres en rankings: hasta 2 líneas, y en celular el nombre ocupa todo el ancho sobre la barra.
