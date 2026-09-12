// Valores permitidos para los campos tipo "estado" del esquema.
// Prisma + SQLite no soporta enums nativos, así que se validan con Zod
// (ver src/validations) usando estas mismas constantes.

export const TIPOS_MOVIMIENTO_INVENTARIO = ["ENTRADA", "SALIDA", "AJUSTE"] as const;
export type TipoMovimientoInventario = (typeof TIPOS_MOVIMIENTO_INVENTARIO)[number];

export const FORMAS_PAGO = ["EFECTIVO", "TRANSFERENCIA_QR", "CREDITO"] as const;
export type FormaPago = (typeof FORMAS_PAGO)[number];

export const ESTADOS_VENTA = ["COMPLETADA", "ANULADA"] as const;
export type EstadoVenta = (typeof ESTADOS_VENTA)[number];

// Sistema de un solo usuario: no hay roles. Esta bitácora es solo qué pasó y
// cuándo (ver modelo AuditLog).
export const ACCIONES_AUDITORIA = ["CREAR", "ACTUALIZAR", "ANULAR", "AJUSTAR", "PAGAR"] as const;
export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

export const LARGO_PIN = 4;

// "Tipo de venta" es un concepto solo de la interfaz para simplificar la carga
// de productos: define unidadMedida + factorConversion al crear el producto.
// UNIDAD -> unidadMedida elegida por el usuario (paquete, caja, etc.), factorConversion 1.
// PESO   -> unidadMedida "kg", factorConversion 1000 (se guarda en gramos).
// VOLUMEN-> unidadMedida "litro", factorConversion 1000 (se guarda en mililitros).
export const TIPOS_VENTA = ["UNIDAD", "PESO", "VOLUMEN"] as const;
export type TipoVenta = (typeof TIPOS_VENTA)[number];

export const DIAS_ALERTA_VENCIMIENTO_DEFECTO = 30;
