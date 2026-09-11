import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.configuracion.deleteMany();
  await db.configuracion.create({
    data: {
      nombreNegocio: "Mi Tienda",
      moneda: "BOB",
      simboloMoneda: "Bs",
      pinHash: null, // sin PIN: se entra directo. Se activa desde Configuración.
      diasAlertaVencimiento: 30,
    },
  });

  const productosSimples = [
    {
      sku: "0001",
      nombre: "Arroz 1kg",
      categoria: "Abarrotes",
      unidadMedida: "unidad",
      factorConversion: 1,
      precioCompra: 650,
      precioVenta: 850,
      stockActual: 40,
      stockMinimo: 10,
    },
    {
      sku: "0002",
      nombre: "Aceite 900ml",
      categoria: "Abarrotes",
      unidadMedida: "unidad",
      factorConversion: 1,
      precioCompra: 1100,
      precioVenta: 1400,
      stockActual: 25,
      stockMinimo: 8,
    },
    {
      sku: "0003",
      nombre: "Coca Cola 2L",
      categoria: "Bebidas",
      unidadMedida: "unidad",
      factorConversion: 1,
      precioCompra: 900,
      precioVenta: 1200,
      stockActual: 30,
      stockMinimo: 10,
    },
    {
      sku: "0004",
      nombre: "Pan",
      categoria: "Panadería",
      unidadMedida: "unidad",
      factorConversion: 1,
      precioCompra: 40,
      precioVenta: 60,
      stockActual: 5,
      stockMinimo: 20,
    },
  ];

  for (const producto of productosSimples) {
    await db.producto.upsert({ where: { sku: producto.sku }, update: {}, create: producto });
  }

  // Producto perecedero de ejemplo, con lotes en distintas fechas de vencimiento
  // (uno vence pronto para poder probar las alertas de vencimiento).
  const queso = await db.producto.upsert({
    where: { sku: "0005" },
    update: {},
    create: {
      sku: "0005",
      nombre: "Queso criollo",
      categoria: "Lácteos",
      unidadMedida: "kg",
      factorConversion: 1000, // se maneja internamente en gramos
      precioCompra: 2500,
      precioVenta: 3200,
      perecedero: true,
      stockActual: 6000,
      stockMinimo: 1000,
    },
  });

  const yaTieneLotes = (await db.lote.count({ where: { productoId: queso.id } })) > 0;
  if (!yaTieneLotes) {
    const hoy = new Date();
    const enDias = (dias: number) => new Date(hoy.getTime() + dias * 24 * 60 * 60 * 1000);
    await db.lote.createMany({
      data: [
        { productoId: queso.id, cantidad: 2000, fechaVencimiento: enDias(5) },
        { productoId: queso.id, cantidad: 4000, fechaVencimiento: enDias(25) },
      ],
    });
  }

  await db.cliente.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nombre: "Cliente Ocasional",
      telefono: null,
      limiteCredito: 0,
    },
  });

  await db.cliente.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nombre: "Juana Pérez",
      telefono: "70011223",
      limiteCredito: 50000, // Bs 500.00
    },
  });

  console.log("Datos de ejemplo creados:");
  console.log("  Sin PIN configurado: se entra directo al sistema (activalo en Configuración si querés).");
  console.log(`  Productos: ${productosSimples.length + 1} (1 perecedero, con lotes)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
