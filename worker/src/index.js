// Función de IA de StockMGR (Cloudflare Worker).
// Recibe el texto pegado de WhatsApp + un catálogo compacto del stock y devuelve una lista
// interpretada. NO lee ni escribe Firestore: guarda la app, después de que el usuario confirma.

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwksCache = { keys: null, exp: 0 };

const MAX_TEXTO = 6000;
const MAX_CATALOGO = 800;

// ── utilidades ──
const b64uToBytes = (s) => {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '='.repeat((4 - (b.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const b64uToJson = (s) => JSON.parse(new TextDecoder().decode(b64uToBytes(s)));

function respuesta(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

// ── autenticación: solo el dueño (token de Firebase) ──
async function claves() {
  if (jwksCache.keys && Date.now() < jwksCache.exp) return jwksCache.keys;
  const r = await fetch(JWKS_URL);
  if (!r.ok) throw new Error('no_se_pudieron_leer_claves');
  const j = await r.json();
  jwksCache = { keys: j.keys, exp: Date.now() + 60 * 60 * 1000 };
  return jwksCache.keys;
}

async function verificarToken(token, env) {
  const partes = token.split('.');
  if (partes.length !== 3) throw new Error('token_invalido');
  const header = b64uToJson(partes[0]);
  const payload = b64uToJson(partes[1]);
  if (header.alg !== 'RS256') throw new Error('token_invalido');

  const jwk = (await claves()).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('token_invalido');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const firmaOk = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, b64uToBytes(partes[2]), new TextEncoder().encode(partes[0] + '.' + partes[1]),
  );
  if (!firmaOk) throw new Error('token_invalido');

  const ahora = Math.floor(Date.now() / 1000);
  const proyecto = env.FIREBASE_PROJECT_ID;
  if (payload.aud !== proyecto || payload.iss !== `https://securetoken.google.com/${proyecto}`) throw new Error('token_invalido');
  if (!payload.sub || payload.exp <= ahora) throw new Error('token_vencido');

  const permitidos = (env.ALLOWED_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!payload.email || !permitidos.includes(String(payload.email).toLowerCase())) throw new Error('no_autorizado');
  return payload;
}

// ── entrada ──
function validarEntrada(body) {
  if (!body || typeof body !== 'object') throw new Error('entrada_invalida');
  const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
  if (!texto) throw new Error('texto_vacio');
  if (texto.length > MAX_TEXTO) throw new Error('texto_muy_largo');
  if (!Array.isArray(body.catalogo) || body.catalogo.length > MAX_CATALOGO) throw new Error('catalogo_invalido');
  const limpio = (v, max) => String(v ?? '').replace(/[|\n\r]/g, ' ').trim().slice(0, max);
  const catalogo = body.catalogo.map((c) => ({ k: limpio(c.k, 12), cat: limpio(c.cat, 40), modelo: limpio(c.modelo, 120), color: limpio(c.color, 60) })).filter((c) => c.k);
  const operacion = ['compra', 'venta', 'producto_nuevo'].includes(body.operacion) ? body.operacion : null;
  const modelo = typeof body.modelo === 'string' && /^@cf\/[\w.\-/]+$/.test(body.modelo) ? body.modelo : null;
  return { texto, catalogo, operacion, modelo };
}

// ── prompt ──
const SISTEMA = `Sos un asistente que interpreta mensajes de WhatsApp de un negocio de indumentaria (Argentina) y los convierte en JSON. Respondé SOLO con el JSON pedido.

REGLAS:
1. operacion: "compra" si habla de mercadería comprada/recibida de un proveedor (compré, compra, pedido que llegó, pack); "venta" si es una venta a un cliente (venta, vendí, pedido de un cliente); "producto_nuevo" si dice nuevo producto / agregar producto con precios; si no está claro, "desconocida".
2. tipo_precio (solo ventas): "mayorista", "curva" o "menor" (menor = minorista / por unidad / normal) si el texto lo dice; si no, "ninguno".
3. Un item por cada combinación producto + talle. Un pack surtido NUNCA es un item "pack": se desglosa por talle. Notación abreviada: talle seguido de número = talle + cantidad. "S1 M1" son dos items (talle S cantidad 1, talle M cantidad 1); "L2" es talle L cantidad 2; también "M x2" o "2 L". Si un producto (equipo) va seguido de varios talles, repetí el producto en cada item. Talles: XS, S, M, L, XL, XXL, XXXL o numéricos (36, 38, 40, 42, 44...). "cantidad" es el número de unidades de ese item.
4. Si no se aclara el talle, talle = "". Si no se aclara la cantidad, cantidad = 1.
5. "producto": las palabras del equipo/modelo tal como las escribió el usuario (ej: "River", "Boca", "conjunto musculosa y short river"). "categoria": el tipo de prenda normalizado a una categoría del catálogo si se puede (remera / camiseta / camiseta de fútbol -> Camiseta; "musculosa y short" -> Conjunto; short -> Short). Si no se puede, "".
6. Precios (costo, mayorista, curva, menor): SOLO si el texto los trae explícitos con esa palabra ("costo 12000", "mayorista 18000", "curva 20000", "menor 25000" o "unidad 25000"). 12.000, 12000 y 12k significan 12000. Si no aparece, 0. NUNCA inventes precios.
7. total_pack: si el texto da un precio total del pack o pedido (ej: "pack $120.000", "total 90000"), ponelo; si no, 0.
8. candidatos: hasta 8 claves del CATÁLOGO cuyo modelo pueda corresponder al item (mismo equipo y tipo de prenda). Si hay dudas incluí TODOS los plausibles: no elijas uno solo si el texto no alcanza para distinguirlo. Usá SOLO claves que existan en el catálogo. Si ninguno corresponde, [].
9. Todo fragmento que no puedas interpretar va textual en no_entendido.
10. proveedor y cliente: solo si el texto los menciona; si no, "".`;

const ESQUEMA = {
  type: 'object',
  properties: {
    operacion: { type: 'string', enum: ['compra', 'venta', 'producto_nuevo', 'desconocida'] },
    tipo_precio: { type: 'string', enum: ['menor', 'mayorista', 'curva', 'ninguno'] },
    proveedor: { type: 'string' },
    cliente: { type: 'string' },
    total_pack: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          texto: { type: 'string' },
          categoria: { type: 'string' },
          producto: { type: 'string' },
          color: { type: 'string' },
          talle: { type: 'string' },
          cantidad: { type: 'integer' },
          costo: { type: 'number' },
          mayorista: { type: 'number' },
          curva: { type: 'number' },
          menor: { type: 'number' },
          candidatos: { type: 'array', items: { type: 'string' } },
        },
        required: ['texto', 'categoria', 'producto', 'color', 'talle', 'cantidad', 'costo', 'mayorista', 'curva', 'menor', 'candidatos'],
      },
    },
    no_entendido: { type: 'array', items: { type: 'string' } },
  },
  required: ['operacion', 'tipo_precio', 'proveedor', 'cliente', 'total_pack', 'items', 'no_entendido'],
};

function armarUsuario({ texto, catalogo, operacion }) {
  const lineas = catalogo.map((c) => `${c.k}|${c.cat}|${c.modelo}|${c.color}`).join('\n');
  return `CATÁLOGO (clave|categoría|modelo|color):\n${lineas}\n\n${operacion ? `OPERACIÓN INDICADA POR EL USUARIO: ${operacion}\n\n` : ''}TEXTO:\n"""\n${texto}\n"""`;
}

// ── IA ──
const esCuotaAgotada = (e) => /4006|daily free allocation|neurons/i.test(String(e?.message || e));

async function llamarIA(env, modelo, usuario) {
  const base = {
    messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: usuario }],
    max_tokens: 3000,
    temperature: 0,
  };
  try {
    return await env.AI.run(modelo, { ...base, response_format: { type: 'json_schema', json_schema: ESQUEMA } });
  } catch (e) {
    if (esCuotaAgotada(e)) throw e;
    // Algunos modelos no soportan json_schema: reintenta sin restricción y se valida abajo.
    return await env.AI.run(modelo, base);
  }
}

function extraerJSON(res) {
  const r = res?.response ?? res?.result?.response ?? res?.choices?.[0]?.message?.content ?? res;
  if (r && typeof r === 'object') return r;
  if (typeof r !== 'string') throw new Error('respuesta_vacia');
  const m = r.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : r);
}

// ── salida ──
function limpiarSalida(raw, claves) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
  const str = (v, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const talle = (v) => str(v, 10).toUpperCase().replace(/\s+/g, '');
  const items = (Array.isArray(raw.items) ? raw.items : []).slice(0, 80).map((it) => ({
    texto: str(it.texto, 200),
    categoria: str(it.categoria, 40) || null,
    producto: str(it.producto) || null,
    color: str(it.color, 60) || null,
    talle: talle(it.talle) || null,
    cantidad: Math.max(1, Math.min(999, parseInt(it.cantidad, 10) || 1)),
    precios: { costo: num(it.costo), mayorista: num(it.mayorista), curva: num(it.curva), menor: num(it.menor) },
    candidatos: (Array.isArray(it.candidatos) ? it.candidatos : []).filter((k) => claves.has(k)).slice(0, 8),
  }));
  return {
    operacion: ['compra', 'venta', 'producto_nuevo'].includes(raw.operacion) ? raw.operacion : 'desconocida',
    tipo_precio: ['menor', 'mayorista', 'curva'].includes(raw.tipo_precio) ? raw.tipo_precio : null,
    proveedor: str(raw.proveedor) || null,
    cliente: str(raw.cliente) || null,
    total_pack: num(raw.total_pack),
    items,
    no_entendido: (Array.isArray(raw.no_entendido) ? raw.no_entendido : []).map((s) => str(s, 200)).filter(Boolean).slice(0, 20),
  };
}

// ── servidor ──
export default {
  async fetch(request, env) {
    const origen = request.headers.get('Origin') || '';
    const permitidos = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (origen && !permitidos.includes(origen)) return respuesta({ error: 'origen_no_permitido' }, 403);
    const cors = origen ? {
      'Access-Control-Allow-Origin': origen,
      'Vary': 'Origin',
    } : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
      } });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return respuesta({ ok: true, servicio: 'stockmgr-ia' }, 200, cors);
    if (!(request.method === 'POST' && url.pathname === '/interpretar')) return respuesta({ error: 'no_encontrado' }, 404, cors);

    try {
      const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      if (!token) return respuesta({ error: 'sin_sesion' }, 401, cors);
      try { await verificarToken(token, env); }
      catch (e) { return respuesta({ error: e.message === 'no_autorizado' ? 'no_autorizado' : 'sesion_invalida', detalle: e.message }, e.message === 'no_autorizado' ? 403 : 401, cors); }

      let entrada;
      try { entrada = validarEntrada(await request.json()); }
      catch (e) { return respuesta({ error: 'entrada_invalida', detalle: e.message }, 400, cors); }

      const modelo = entrada.modelo || env.MODEL;
      let salida;
      try {
        const res = await llamarIA(env, modelo, armarUsuario(entrada));
        salida = limpiarSalida(extraerJSON(res), new Set(entrada.catalogo.map((c) => c.k)));
      } catch (e) {
        if (esCuotaAgotada(e)) return respuesta({ error: 'cuota_agotada' }, 429, cors);
        return respuesta({ error: 'ia_fallo', detalle: String(e?.message || e).slice(0, 300) }, 502, cors);
      }
      return respuesta({ ok: true, modelo, resultado: salida }, 200, cors);
    } catch (e) {
      return respuesta({ error: 'error_interno', detalle: String(e?.message || e).slice(0, 300) }, 500, cors);
    }
  },
};
