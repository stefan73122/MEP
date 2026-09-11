-- CreateTable
CREATE TABLE "Configuracion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombreNegocio" TEXT NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'BOB',
    "simboloMoneda" TEXT NOT NULL DEFAULT 'Bs',
    "pinHash" TEXT,
    "diasAlertaVencimiento" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "unidadMedida" TEXT NOT NULL DEFAULT 'unidad',
    "factorConversion" INTEGER NOT NULL DEFAULT 1,
    "precioCompra" INTEGER NOT NULL,
    "precioVenta" INTEGER NOT NULL,
    "perecedero" BOOLEAN NOT NULL DEFAULT false,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "stockMinimo" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fechaVencimiento" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lote_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovimientoInventario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productoId" INTEGER NOT NULL,
    "loteId" INTEGER,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stockAnterior" INTEGER NOT NULL,
    "stockPosterior" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "ventaId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoInventario_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MovimientoInventario_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "limiteCredito" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" INTEGER NOT NULL,
    "descuento" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "formaPago" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'COMPLETADA',
    "motivoAnulacion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Venta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VentaItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" INTEGER NOT NULL,
    "descuento" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL,
    CONSTRAINT "VentaItem_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VentaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clienteId" INTEGER NOT NULL,
    "monto" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pago_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PagoVenta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pagoId" INTEGER NOT NULL,
    "ventaId" INTEGER NOT NULL,
    "montoAplicado" INTEGER NOT NULL,
    CONSTRAINT "PagoVenta_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PagoVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "monto" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entidad" TEXT NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "accion" TEXT NOT NULL,
    "detalle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Producto_sku_key" ON "Producto"("sku");

-- CreateIndex
CREATE INDEX "Producto_nombre_idx" ON "Producto"("nombre");

-- CreateIndex
CREATE INDEX "Lote_productoId_fechaVencimiento_idx" ON "Lote"("productoId", "fechaVencimiento");

-- CreateIndex
CREATE INDEX "MovimientoInventario_productoId_idx" ON "MovimientoInventario"("productoId");

-- CreateIndex
CREATE INDEX "MovimientoInventario_createdAt_idx" ON "MovimientoInventario"("createdAt");

-- CreateIndex
CREATE INDEX "Cliente_nombre_idx" ON "Cliente"("nombre");

-- CreateIndex
CREATE INDEX "Venta_fecha_idx" ON "Venta"("fecha");

-- CreateIndex
CREATE INDEX "Venta_clienteId_idx" ON "Venta"("clienteId");

-- CreateIndex
CREATE INDEX "Venta_estado_idx" ON "Venta"("estado");

-- CreateIndex
CREATE INDEX "VentaItem_ventaId_idx" ON "VentaItem"("ventaId");

-- CreateIndex
CREATE INDEX "VentaItem_productoId_idx" ON "VentaItem"("productoId");

-- CreateIndex
CREATE INDEX "Pago_clienteId_idx" ON "Pago"("clienteId");

-- CreateIndex
CREATE INDEX "PagoVenta_pagoId_idx" ON "PagoVenta"("pagoId");

-- CreateIndex
CREATE INDEX "PagoVenta_ventaId_idx" ON "PagoVenta"("ventaId");

-- CreateIndex
CREATE INDEX "Gasto_fecha_idx" ON "Gasto"("fecha");

-- CreateIndex
CREATE INDEX "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");

