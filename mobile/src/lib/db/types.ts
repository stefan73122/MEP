// Tipos que reflejan el esquema (ver la versión Prisma en prisma/schema.prisma
// de la raíz del repo). Las fechas se guardan como epoch ms en SQLite y se
// exponen aquí ya convertidas a Date, igual que las devolvía Prisma.

export type Configuracion = {
  id: number;
  nombreNegocio: string;
  moneda: string;
  simboloMoneda: string;
  pinHash: string | null;
  diasAlertaVencimiento: number;
  bloqueoActivado: boolean;
  huellaActivada: boolean;
  updatedAt: Date;
};

export type Producto = {
  id: number;
  nombre: string;
  categoria: string | null;
  unidadMedida: string;
  factorConversion: number;
  precioCompra: number;
  precioVenta: number;
  perecedero: boolean;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Lote = {
  id: number;
  productoId: number;
  cantidad: number;
  fechaVencimiento: Date;
  createdAt: Date;
};

export type LoteConProducto = Lote & {
  producto: Pick<Producto, "nombre" | "unidadMedida" | "factorConversion" | "activo">;
};

export type TipoMovimiento = "ENTRADA" | "SALIDA" | "AJUSTE";

export type MovimientoInventario = {
  id: number;
  productoId: number;
  loteId: number | null;
  tipo: TipoMovimiento;
  cantidad: number;
  stockAnterior: number;
  stockPosterior: number;
  motivo: string;
  ventaId: number | null;
  createdAt: Date;
};

export type Cliente = {
  id: number;
  nombre: string;
  telefono: string | null;
  limiteCredito: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type FormaPago = "EFECTIVO" | "TRANSFERENCIA_QR" | "CREDITO";
export type EstadoVenta = "COMPLETADA" | "ANULADA";

export type Venta = {
  id: number;
  clienteId: number | null;
  fecha: Date;
  subtotal: number;
  descuento: number;
  total: number;
  formaPago: FormaPago;
  estado: EstadoVenta;
  motivoAnulacion: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type VentaItem = {
  id: number;
  ventaId: number;
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  subtotal: number;
};

export type VentaItemConProducto = VentaItem & {
  producto: Pick<Producto, "nombre" | "unidadMedida" | "factorConversion" | "precioCompra">;
};

export type VentaConPagos = Venta & { pagosAplicados: PagoVenta[] };
export type VentaConCliente = Venta & { cliente: Cliente | null };
export type VentaDetalle = Venta & { cliente: Cliente | null; items: VentaItemConProducto[] };

export type Pago = {
  id: number;
  clienteId: number;
  monto: number;
  fecha: Date;
  observacion: string | null;
  createdAt: Date;
};

export type PagoVenta = {
  id: number;
  pagoId: number;
  ventaId: number;
  montoAplicado: number;
};

export type Gasto = {
  id: number;
  monto: number;
  descripcion: string;
  fecha: Date;
  createdAt: Date;
};

export type AccionAuditoria = "CREAR" | "ACTUALIZAR" | "ANULAR" | "AJUSTAR" | "PAGAR";

export type AuditLog = {
  id: number;
  entidad: string;
  entidadId: number;
  accion: AccionAuditoria;
  detalle: string | null;
  createdAt: Date;
};

// Error de restricción única (equivalente al P2002 de Prisma), usado para dar
// un mensaje legible cuando se repite un valor que debe ser único.
export class ErrorRestriccionUnica extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorRestriccionUnica";
  }
}
