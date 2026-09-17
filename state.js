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
  ventaCart: [], // [{prodId, cant, pventa, pcosto}] — carrito único de "Registrar Venta"
  uvMayorista: false, // toggle: usar precio mayorista en el carrito de venta
  uvMismoPrecio: false, // toggle: un solo precio para todos los items del carrito
  uvModo: 'ahora', // 'ahora' | 'cuotas'

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
