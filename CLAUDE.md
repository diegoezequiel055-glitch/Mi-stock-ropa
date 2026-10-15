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

## Precio de tarjeta (etapa 3) — `precio-tarjeta.js` y `precio-tarjeta-ui.js`
- El precio que se carga en Stock (`pventa`) es el de efectivo/transferencia y NO se toca. Ventas, compras, dashboard y Carga rápida siguen a ese precio.
- Configuración en `config_sitio/config` (campos nuevos, merge): `recargoTarjetaPct` (0–100, defecto 27), `redondeoTarjeta` (0/100/500/1000, siempre hacia ARRIBA, defecto 500), `mostrarPrecioTarjeta` (defecto **false**). Pantalla: "Catálogo y sitio" → "Precio de tarjeta" (guarda con confirmación; porcentaje inválido = no guarda).
- Por producto: campo opcional `ptarjeta` en cada fila de stock (modal de edición, "Tarjeta ($)"). Si es MAYOR que `pventa` se usa tal cual (sin recargo ni redondeo); vacío o menor/igual → se ignora y se calcula `pventa × (1 + pct/100)` redondeado hacia arriba. Vacío = `null` = automático.
- Varias filas (talles) con `ptarjeta` distinto: se usa el de la fila de MENOR `pventa` entre las que tienen un manual válido (empate: la primera).
- `catalogoSync` (catalogo.js): con el interruptor apagado las fichas salen idénticas a antes (sin `precioTarjeta`); encendido, cada ficha suma `precioTarjeta` solo si es mayor que `precio`. Mayorista/curva/costo nunca viajan. `catalogoSync` espera a que llegue `config_sitio/config` (`state.configListo`); si la config no se puede leer, sincroniza igual sin precio de tarjeta. Solo se vuelve a sincronizar si cambian esos 3 campos de la config.
- Antes de ENCENDER el interruptor la tienda tiene que tener publicadas las etapas 1 y 2 (ya publicadas el 2026-10-15).
- Pruebas: `node test-precio-tarjeta.mjs`. Para probar en el navegador sin tocar Firestore real: copiar el repo a una carpeta aparte con un `firebase-config.js` en memoria (con datos de un backup) que anote las escrituras.

## Medio de pago de las ventas (etapa 7) — `medio-pago.js` y `medio-pago-ui.js`
- Cada venta NUEVA guarda `medioPago` ("Efectivo" | "Transferencia" | "Tarjeta"; defecto Transferencia). Las ventas históricas NO se tocan: sin campo = "Sin dato". Campos opcionales: backup y `restaurar.mjs` siguen funcionando.
- Con Tarjeta se guarda además `cobradoTarjeta` (por línea de venta): lo que paga el cliente con el precio de tarjeta (`precio-tarjeta.js`: `ptarjeta` manual si es válido, si no el recargo/redondeo de la config). Solo el precio por MENOR lleva recargo (mayorista/curva = su precio); si el precio por menor se escribió a mano distinto del de stock, recargo automático sobre ese precio. Es INFORMATIVO: ingresos y ganancia siguen con `pventa` (efectivo/transferencia).
- Venta manual: selector "Medio de pago" (se oculta en "En cuotas"; los planes en cuotas no llevan medio de pago). Editar venta: selector con "Sin dato"; `cobradoTarjeta` se recalcula solo al pasar a Tarjeta o si cambia el precio/cantidad de una venta con Tarjeta; al salir de Tarjeta se borra.
- Carga rápida: lee la línea "Forma de pago:" del texto pegado (Efectivo / Transferencia / Tarjeta (hasta 3 cuotas sin interés)); sin línea = Transferencia; se puede cambiar antes de confirmar. Los precios del mensaje se IGNORAN (la venta va al precio de stock). Con Tarjeta compara su `cobradoTarjeta` calculado con el "Subtotal" del mensaje y avisa si difieren.
- Dashboard (pestaña Ventas): "Ventas por medio de pago" (cantidad y monto a precio de venta, con "Sin dato") y "Total para facturar" = Transferencia (a precio de venta) + Tarjeta (`cobradoTarjeta`); efectivo y "Sin dato" no entran. No incluye planes en cuotas.
- Pruebas: `node test-medio-pago.mjs`.
