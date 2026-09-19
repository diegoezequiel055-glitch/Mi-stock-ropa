// Estado compartido entre todos los módulos de la app.
// Se accede siempre como state.NOMBRE (nunca se reasigna la variable "state").
export const state = {
  stockData: [],
  ventasData: [],
  comprasData: [],
  gastosData: [],
  cuotasData: [],
  reservasData: [],

  dateFilter: 'all',
  compraFilter: 'all',
  gastoFilter: 'all',
  cobrosFilter: 'activos',
  reservaFilter: 'activas',
  tipoVenta: 'minorista',

  cpItems: [],
  cpActualizaStock: true, // toggle: si la compra suma al stock o solo guarda historial
  ventaCart: [], // [{prodId, cant, tipoPrecio, pventa, pcosto}] — carrito único de "Registrar Venta"
  uvTipoPrecio: 'menor', // precio por defecto para lo que se agrega al carrito: 'menor' | 'mayorista' | 'curva'
  uvModo: 'ahora', // 'ahora' | 'cuotas'
  filtroSinCosto: false, // lista de stock: mostrar solo productos sin costo

  confirmCb: null,
  unsubStock: null, unsubVentas: null, unsubCompras: null, unsubGastos: null, unsubCuotas: null, unsubReservas: null,

  lastCatList: '',
  currentEditId: null,
  lastStockRenderKey: '',

  inventarioMode: false,
  inventarioCounts: {},
  stockBajoAlertado: false,

  tallesSeleccionados: {}, // {talle: qty}
};
