import ExcelJS from "exceljs";
import { textoAFecha, fechaATexto } from "./dates";

const COLUMNAS = [
  { clave: "codigo", encabezado: "Código" },
  { clave: "nombre", encabezado: "Nombre" },
  { clave: "categoria", encabezado: "Categoría" },
  { clave: "unidad", encabezado: "Unidad (unidad, kg, litro...)" },
  { clave: "precioCompra", encabezado: "Precio de compra" },
  { clave: "precioVenta", encabezado: "Precio de venta" },
  { clave: "stockInicial", encabezado: "Stock inicial (no perecederos)" },
  { clave: "stockMinimo", encabezado: "Stock mínimo" },
  { clave: "perecedero", encabezado: "Perecedero (SI/NO)" },
  { clave: "fechaVencimiento", encabezado: "Vencimiento del lote (dd/mm/aaaa)" },
  { clave: "cantidadLote", encabezado: "Cantidad de lote (perecederos)" },
] as const;

export async function generarPlantillaExcel(): Promise<ArrayBuffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Productos");

  hoja.columns = COLUMNAS.map((c) => ({ header: c.encabezado, key: c.clave, width: 26 }));
  hoja.getRow(1).font = { bold: true };

  hoja.addRow({
    codigo: "0001",
    nombre: "Arroz 1kg",
    categoria: "Abarrotes",
    unidad: "unidad",
    precioCompra: 6.5,
    precioVenta: 8.5,
    stockInicial: 40,
    stockMinimo: 10,
    perecedero: "NO",
    fechaVencimiento: "",
    cantidadLote: "",
  });
  hoja.addRow({
    codigo: "0002",
    nombre: "Yogurt bebible 1L",
    categoria: "Lácteos",
    unidad: "unidad",
    precioCompra: 6,
    precioVenta: 9,
    stockInicial: "",
    stockMinimo: 5,
    perecedero: "SI",
    fechaVencimiento: "31/12/2026",
    cantidadLote: 20,
  });

  const buffer = await libro.xlsx.writeBuffer();
  return buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).buffer;
}

export type FilaImportacion = {
  numero: number;
  sku: string;
  nombre: string;
  categoria: string | null;
  unidadMedida: string;
  factorConversion: number;
  precioCompraTexto: string;
  precioVentaTexto: string;
  stockInicialTexto: string;
  stockMinimoTexto: string;
  perecedero: boolean;
  fechaVencimientoTexto: string | null;
  cantidadLoteTexto: string | null;
  errores: string[];
};

function normalizarTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return fechaATexto(valor);
  if (typeof valor === "object") {
    const conTexto = valor as { text?: unknown; result?: unknown };
    if ("text" in conTexto) return String(conTexto.text ?? "").trim();
    if ("result" in conTexto) return String(conTexto.result ?? "").trim();
  }
  return String(valor).trim();
}

function normalizarNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor === "number") return valor;
  const texto = normalizarTexto(valor).replace(",", ".");
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

export async function leerArchivoImportacion(
  buffer: ArrayBuffer,
): Promise<{ filas: FilaImportacion[]; error?: string }> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    return { filas: [], error: "No se pudo leer el archivo. Asegurate de subir un Excel (.xlsx) válido." };
  }

  const hoja = libro.worksheets[0];
  if (!hoja) return { filas: [], error: "El archivo no tiene ninguna hoja" };

  const filas: FilaImportacion[] = [];
  const skusVistos = new Set<string>();

  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila === 1) return; // encabezado

    const valores = fila.values as unknown[]; // 1-based; valores[0] no se usa

    const sku = normalizarTexto(valores[1]);
    const nombre = normalizarTexto(valores[2]);
    const categoria = normalizarTexto(valores[3]) || null;
    const unidadTexto = normalizarTexto(valores[4]).toLowerCase();
    const precioCompraNum = normalizarNumero(valores[5]);
    const precioVentaNum = normalizarNumero(valores[6]);
    const stockInicialNum = normalizarNumero(valores[7]);
    const stockMinimoNum = normalizarNumero(valores[8]);
    const perecederoTexto = normalizarTexto(valores[9]).toLowerCase();
    const fechaVencimientoTexto = normalizarTexto(valores[10]) || null;
    const cantidadLoteNum = normalizarNumero(valores[11]);

    if (!sku && !nombre) return; // fila vacía: se ignora

    const errores: string[] = [];
    if (!sku) errores.push("Falta el código");
    if (!nombre) errores.push("Falta el nombre");
    if (precioCompraNum === null || precioCompraNum < 0) errores.push("Precio de compra inválido");
    if (precioVentaNum === null || precioVentaNum < 0) errores.push("Precio de venta inválido");
    if (stockMinimoNum === null || stockMinimoNum < 0) errores.push("Stock mínimo inválido");

    if (perecederoTexto && !["si", "sí", "no"].includes(perecederoTexto)) {
      errores.push('La columna "Perecedero" debe decir SI o NO');
    }
    const perecedero = perecederoTexto === "si" || perecederoTexto === "sí";

    const esPesoOVolumen = unidadTexto === "kg" || unidadTexto === "litro";
    const factorConversion = esPesoOVolumen ? 1000 : 1;
    const unidadMedida = unidadTexto || "unidad";

    if (perecedero) {
      if (cantidadLoteNum !== null && cantidadLoteNum > 0 && !fechaVencimientoTexto) {
        errores.push("Falta la fecha de vencimiento del lote");
      }
      if (fechaVencimientoTexto) {
        try {
          textoAFecha(fechaVencimientoTexto);
        } catch {
          errores.push("Fecha de vencimiento inválida (usá dd/mm/aaaa)");
        }
      }
    }

    if (sku) {
      const skuNormalizado = sku.toLowerCase();
      if (skusVistos.has(skuNormalizado)) {
        errores.push("Código duplicado en el archivo");
      }
      skusVistos.add(skuNormalizado);
    }

    filas.push({
      numero: numeroFila,
      sku,
      nombre,
      categoria,
      unidadMedida,
      factorConversion,
      precioCompraTexto: precioCompraNum !== null ? String(precioCompraNum) : "",
      precioVentaTexto: precioVentaNum !== null ? String(precioVentaNum) : "",
      stockInicialTexto: perecedero ? "0" : stockInicialNum !== null ? String(stockInicialNum) : "0",
      stockMinimoTexto: stockMinimoNum !== null ? String(stockMinimoNum) : "0",
      perecedero,
      fechaVencimientoTexto,
      cantidadLoteTexto: cantidadLoteNum !== null ? String(cantidadLoteNum) : null,
      errores,
    });
  });

  return { filas };
}
