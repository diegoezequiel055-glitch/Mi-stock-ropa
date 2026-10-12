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
- Hoy NO hay backup automático configurado en el repo (ver informe de la tarea `menu-mas-backups`).
