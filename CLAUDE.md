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

## Editar precio desde Catálogo y sitio (etapa 6) — `precio-editar.js` y `precio-editar-ui.js`
- Al tocar una ficha (modal de fotos) hay una sección "Precio": campo "Efectivo o transferencia ($)", vista en vivo de "Tarjeta: $X" y "3 cuotas de $Y" (`precio-tarjeta.js`, respeta `ptarjeta` manual y la config; cuota = tarjeta/3 redondeada, igual que la tienda) y botón "Guardar precio".
- Cambia SOLO `pventa` (precio por menor) de TODAS las filas de stock del mismo producto (`claveModelo`), estén o no marcadas para el catálogo. Mayorista, curva, costo y ventas ya registradas no se tocan.
- Validación: entero > 0 (acepta "35.000"). Confirmación en pantalla ("de $A a $B, afecta N filas/talles"); si el cambio supera 50 % (arriba o abajo) pide un segundo "¿Seguro?". Cancelar no escribe nada.
- `ptarjeta` manual: se muestra, se mantiene, y hay una casilla para borrarlo (queda `null` = automático). Si con el precio nuevo deja de ser mayor que el de efectivo se avisa que se ignora.
- Después de guardar, `catalogoSync` actualiza la ficha y la tienda solo; aparece una barra "Precio actualizado en la tienda ✓" con "Deshacer" durante 15 s (restaura `pventa`, y `ptarjeta` si se había borrado, fila por fila).
- Pruebas: `node test-precio-editar.mjs`.

## Fotos de producto con carga múltiple (etapa 5) — `fotos.js` y `fotos-ui.js`
- En la ficha de Catálogo y sitio (modal de fotos): "📷 Elegir fotos" acepta varias a la vez (hasta 8 por producto; si se eligen más entran las primeras y se avisa). Antes de subir se ven miniaturas y se puede sacar alguna; "Subir y guardar" las procesa.
- Compresión en el navegador (canvas): lado mayor máx. 1600 px, JPEG 0,85, respeta la orientación EXIF (`createImageBitmap` con `imageOrientation:'from-image'`), nunca agranda; PNG con transparencia → fondo blanco.
- Subida en paralelo (máx. 3) con la misma subida a Cloudinary de siempre (`subirFotoGenerica`); estados En cola / Subiendo / Lista / Error, contador "3 de 6", 1 reintento automático y botón "Reintentar" por foto. Las que ya subieron no se pierden ("Guardar solo las que ya subieron").
- `producto_fotos/<claveModelo>` se escribe UNA vez al terminar las subidas (`{fotos:[...], actualizado}`: las que había + las nuevas + lo que otro dispositivo haya agregado mientras tanto). Si se cierra la pantalla en medio, se cancela la cola y no se escribe nada (las fotos ya subidas a Cloudinary quedan huérfanas, sin costo).
- Ordenar con ◀ ▶ o arrastrando (escritorio); la primera es la principal (la de la tienda). Quitar pide confirmación y solo la saca de `producto_fotos`; no se borra nada de Cloudinary. Cada acción = una escritura; después `catalogoSync` actualiza ficha y tienda.
- Para probar sin subir nada: reemplazar `window.fotosSubirUna` (o `fetch` a Cloudinary) y usar el Firestore en memoria. Pruebas: `node test-fotos.mjs`.
- El modal de edición de Stock usa esta misma pantalla (`#pm-fo-root`, `fotosAbrir(..., {raiz, claveFn, campos})`): la clave `categoría|modelo|color` se toma de los campos del formulario (si faltan categoría o modelo avisa y no deja subir; si se cambian, recarga la galería de ese producto). Cerrar o guardar el producto con fotos elegidas sin subir pregunta antes. Ya no existen `subirFotoProducto` / `borrarFotoProducto` / `onFotoSeleccionada`.

## Configuración del sitio: campos que se editan (limpieza)
- La pantalla "Configuración del sitio" edita solo los 4 textos que la tienda lee: `heroTitulo`, `heroSubtitulo`, `bandaNegra` y `whatsappMensaje` (`config.js`, merge en `config_sitio/config`).
- Ya NO se editan desde acá `promoBarra` (la tienda no lo lee: la barra negra de arriba usa `mensajesPromo` de `datos-negocio.js` de tienda-premium) ni `heroFotos` (la tienda solo lo usa de respaldo del hero rotativo). Siguen guardados en Firestore y `guardarConfigSitio` no los envía, así que no se pisan.

## Recorte de fotos antes de subir (`recorte.js`, `recorte-ui.js`, `recorte.css`)
- Al elegir fotos en la ficha de Catálogo y sitio se abre la pantalla de recorte (4:5, la proporción de las tarjetas, hero y relacionados de la tienda; la ficha usa la proporción real de la foto, así que una foto 4:5 se ve completa). Arrastrar para mover, zoom con barra / rueda / pellizco (Pointer Events: mouse y dedo), vistas previas en vivo (tarjeta, ficha, carrito), "Aplicar recorte", "Usar sin recortar", Anterior/Siguiente y "Centrar automático en todas las que faltan".
- Cálculos puros en `recorte.js` (rect centrado, arrastre, zoom, tamaño de salida: 4:5 exacto, lado mayor ≤ 1600 px, nunca agranda). El archivo recortado (canvas → JPEG 0,92) reemplaza al que se comprime y sube (`n.comprimido`); el original no se sube. Si el recorte se cancela o falla, la foto queda como original y sube como siempre (`fotos-ui.js` no cambió su subida ni su guardado en `producto_fotos`).
- Cada foto pendiente tiene un botón "✂ Recortar / Recortada ✓ cambiar" para volver a abrir el recorte. Sin librerías externas. Pruebas: `node test-recorte.mjs`.

## Archivos que no se publican en la web (pre-lanzamiento)
- `_config.yml` excluye de GitHub Pages: `CLAUDE.md`, `*.md`, `test-*.mjs`, `worker/wrangler.jsonc` (config del worker, muestra el email autorizado) y `firestore.rules.copia.txt`.
- `firestore.rules.copia.txt` es SOLO documentación: copia de las reglas de Firestore vigentes en la consola de Firebase (lectura pública de `catalogo_publico`, `envios_publico` y `config_sitio`; todo lo demás y toda escritura, solo con el email del dueño). No se despliega: si se cambian las reglas en la consola, actualizar esta copia a mano. El worker se despliega desde la carpeta local (`wrangler`), no desde Pages.

## Modo mantenimiento de la tienda (rama `mantenimiento`) — `mantenimiento.js`, `mantenimiento-admin.js` + `.css`, `test-mantenimiento-admin.mjs`
- En Catálogo y sitio, tarjeta "Modo mantenimiento" (debajo de "Configuración del sitio"): estado ACTIVO/DESACTIVADO, interruptor con confirmación (`confirm2`), mensaje para los clientes (por defecto "Estamos actualizando la tienda. Volvemos en breve."), clave de acceso con "Generar nueva" y "Copiar link de acceso" (`https://tiendapremium.com.ar/?acceso=<clave>`).
- Escribe SOLO `mantenimiento`, `mantenimientoMensaje` y `mantenimientoClave` en `config_sitio/config` (merge). Activar guarda también mensaje y clave (la genera si no había); desactivar solo apaga. `guardarConfigSitio` (config.js) no toca estos campos. La tienda lo lee en vivo.
- La clave no es secreta (config_sitio es de lectura pública). `mantenimiento.js` es lógica pura; `mantenimiento-admin.js` es la UI (se monta sola en `#mant-root`, la redibuja `renderConfigSitio`). Pruebas: `node test-mantenimiento-admin.mjs` (Firestore simulado).

## Sincronización diferencial del catálogo y los envíos (rama `sync-catalogo-diferencial`) — `catalogo-sync.js`, `test-catalogo-sync.mjs`
- ANTES: cada sincronización reescribía las ~73 fichas de `catalogo_publico` con `actualizado: Date.now()` (y las 152 de `envios_publico`). Como el documento cambiaba de verdad, cada oyente (StockMGR y cada visitante con la tienda abierta) releía todo: ~73 × (1 + visitantes) lecturas por sincronización, y corría varias veces al abrir StockMGR y con cada venta. Era la causa principal de las ~97.000 lecturas/24 h del 21/10/2026.
- AHORA: `planSync()` compara lo deseado con lo ya publicado SIN el campo `actualizado` y escribe/borra solo lo que cambió; sin cambios = 0 escrituras y 0 lecturas, y el `actualizado` de lo que no cambió no se toca. No sincroniza hasta que llegó la primera lectura de lo publicado (`catalogoListo`). Los disparos (stock, reservas, fotos, config, envíos) se juntan en UNA corrida con espera de 2,5 s (`crearPlanificador`, nunca dos a la vez). Lotes de 400 operaciones. `envios_publico` usa lo mismo (sin sello, nunca lleva el costo).
- `node test-catalogo-sync.mjs`: puras + simulación de costos + catalogo.js/envios.js reales contra un Firestore simulado en memoria que cuenta escrituras y lecturas (no toca el real).

## Documentos únicos para la tienda (rama `catalogo-bundle`) — `catalogo-bundle.js`, `test-catalogo-sync.mjs`
- Al sincronizar, además de `catalogo_publico`/`envios_publico` (que SIGUEN como respaldo), `catalogo.js` y `envios.js` arman `config_sitio/catalogo` y `config_sitio/envios` (la tienda los lee: 1 lectura cada uno en vez de ~226). Se escriben SOLO si el contenido cambió (hash), con un `writeBatch`; si falla, las colecciones ya quedaron sincronizadas y la tienda usa el respaldo.
- Formato: `{ v:1, parte, partes, total, hash, datos:"<JSON texto>", actualizado }`; partes de hasta 600 KB (`catalogo_2`…; límite de Firestore 1 MiB por documento: hoy ~46 KB, ~950 fichas por parte; al llegar se reparte solo). Mismo hash cyrb53 y formato que lee `tienda-premium › catalogo-bundle.js`.
- Orden de publicación: PRIMERO StockMGR (genera los documentos al abrirlo), esperar a que existan `config_sitio/catalogo` y `config_sitio/envios`, y recién DESPUÉS la tienda. Volver atrás: tag `pre-bundle`.

## Precio en oferta (rama `ofertas`) — `ofertas.js`, `ofertas-admin.js`, `test-ofertas.mjs`
- En el modal de la ficha (Catálogo y sitio), debajo de "Precio": tarjeta "🏷️ Precio en oferta (opcional)". Se carga en los mismos términos que el precio normal (efectivo o transferencia). Se guarda como `poferta` en TODAS las filas de stock del producto (como `pventa`), con "Quitar oferta" y "Deshacer". Vacío = sin oferta.
- Validación (`validarOferta`): entero > 0 y MENOR que el precio normal; si no, muestra el error y no guarda. Si después el precio normal baja y la oferta deja de ser menor, la tarjeta avisa y la tienda no la muestra.
- `armarFicha` (catalogo.js) suma `precioOferta` y `precioOfertaTarjeta` (mismo recargo y redondeo que el normal; el `ptarjeta` manual NO se usa para la oferta) con `conOferta()`. Viajan en la ficha y en `config_sitio/catalogo`; la sincronización diferencial cambia solo esa ficha + el documento único (2 escrituras, probado en test-catalogo-sync.mjs). El porcentaje NO se guarda: lo calcula la tienda.
- `node test-ofertas.mjs` (puras + Chrome con Firestore simulado; `CAPTURAS=<carpeta>` guarda capturas). Volver atrás: tag `pre-ofertas`. Orden de publicación: primero StockMGR, después la tienda.

## Videos de TikTok (rama `tiktok`) — `videos-tiktok.js`, `videos-admin.js`, `videos-admin.css`, `test-tiktok.mjs`
- En Catálogo y sitio (debajo de "Configuración del sitio"), tarjeta "🎬 Videos de TikTok": agregar un video (pegar el link, subir la portada con el uploader de Cloudinary de las fotos = `window.subirFotoGenerica`, título opcional ≤ 60), ver la previsualización de la tarjeta (9:16 + play + título + "Ver en TikTok"), reordenar (↑ ↓), borrar y "Guardar videos". Los cambios son un borrador hasta guardar (una config nueva no los pisa).
- Validación (`validarLinkTiktok`): tiene que ser de tiktok.com (www./m./sin www) con forma `/@usuario/video/NÚMERO`; los links cortos (vm.tiktok.com, /t/) se rechazan con un mensaje. Se guarda LIMPIO (todo lo que va después de `?` o `#` se saca): `https://www.tiktok.com/@tiendapremium.ok/video/7701101006259571989`. Máximo 6, sin repetidos, portada obligatoria (https).
- Escribe SOLO `videosTiktok` en `config_sitio/config` con merge (no toca el resto de la config; `guardarConfigSitio` tampoco lo pisa). Sin colecciones nuevas ni cambios en las reglas. Lo lee la tienda en el documento de config que ya lee (sin lecturas extra).
- `node test-tiktok.mjs` (puras con los 3 links de ejemplo + Chrome con Firestore y Cloudinary simulados). Volver atrás: tag `pre-tiktok`. Orden de publicación: primero StockMGR, después la tienda.
