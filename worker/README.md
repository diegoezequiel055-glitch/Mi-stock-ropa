# Función de IA de StockMGR (Cloudflare Worker)

Interpreta el texto pegado de WhatsApp (compras, ventas, productos nuevos) y devuelve una lista
estructurada. **No lee ni escribe Firestore**: la app guarda después de que el usuario confirma.

- `POST /interpretar` — requiere `Authorization: Bearer <token de Firebase>` del dueño.
- `GET /` — chequeo de que está vivo.
- Solo acepta pedidos de los orígenes de `ALLOWED_ORIGINS` y del email de `ALLOWED_EMAILS`.
- La IA es Cloudflare Workers AI (plan gratuito, sin tarjeta). El modelo se cambia con `MODEL`.

Se publica sola desde GitHub (carpeta `worker/`). No lleva secretos.
