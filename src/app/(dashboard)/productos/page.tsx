import Link from "next/link";
import { requireAcceso } from "@/lib/auth";
import { db } from "@/lib/db";
import { centavosATexto } from "@/lib/money";
import { unidadesMinimasATexto } from "@/lib/stock";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "@/lib/constants";
import { obtenerLotesPorVencer, obtenerLotesVencidos } from "@/lib/lotes";

function construirUrl(base: string, params: Record<string, string | undefined>) {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor) busqueda.set(clave, valor);
  }
  const query = busqueda.toString();
  return query ? `${base}?${query}` : base;
}

export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; bajo?: string; vencimiento?: string }>;
}) {
  await requireAcceso();
  const { q, bajo, vencimiento } = await searchParams;

  const [configuracion, todosActivos] = await Promise.all([
    db.configuracion.findFirst(),
    db.producto.findMany({ where: { activo: true } }),
  ]);
  const simbolo = configuracion?.simboloMoneda ?? "Bs";
  const diasAlerta = configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO;

  const [lotesVencidos, lotesPorVencer] = await Promise.all([
    obtenerLotesVencidos(db),
    obtenerLotesPorVencer(db, diasAlerta),
  ]);
  const productosVencidos = new Set(lotesVencidos.map((l) => l.productoId));
  const productosPorVencer = new Set(lotesPorVencer.map((l) => l.productoId));

  const totalBajoStock = todosActivos.filter((p) => p.stockActual < p.stockMinimo).length;

  let productos = todosActivos;
  if (q) {
    const qNormalizado = q.trim().toLowerCase();
    productos = productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(qNormalizado) ||
        p.sku.toLowerCase().includes(qNormalizado),
    );
  }
  if (bajo === "1") {
    productos = productos.filter((p) => p.stockActual < p.stockMinimo);
  }
  if (vencimiento === "vencido") {
    productos = productos.filter((p) => productosVencidos.has(p.id));
  } else if (vencimiento === "porVencer") {
    productos = productos.filter((p) => productosPorVencer.has(p.id) && !productosVencidos.has(p.id));
  }
  productos = [...productos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Productos</h1>
        <div className="flex gap-2">
          <Link
            href="/productos/importar"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Importar Excel
          </Link>
          <Link
            href="/productos/nuevo"
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            + Nuevo
          </Link>
        </div>
      </div>

      <form action="/productos" method="GET" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre o código"
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
        {bajo === "1" && <input type="hidden" name="bajo" value="1" />}
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Link
          href={construirUrl("/productos", { q, bajo: bajo === "1" ? undefined : "1", vencimiento })}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
            bajo === "1" ? "bg-danger-500 text-white" : "bg-red-50 text-danger-600 hover:bg-red-100"
          }`}
        >
          ⚠ Stock bajo ({totalBajoStock})
        </Link>
        {lotesVencidos.length > 0 && (
          <Link
            href={construirUrl("/productos", { q, bajo, vencimiento: vencimiento === "vencido" ? undefined : "vencido" })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              vencimiento === "vencido" ? "bg-danger-500 text-white" : "bg-red-50 text-danger-600 hover:bg-red-100"
            }`}
          >
            ⛔ Vencidos ({productosVencidos.size})
          </Link>
        )}
        {lotesPorVencer.length > 0 && (
          <Link
            href={construirUrl("/productos", { q, bajo, vencimiento: vencimiento === "porVencer" ? undefined : "porVencer" })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              vencimiento === "porVencer" ? "bg-warning-500 text-white" : "bg-orange-50 text-warning-500 hover:bg-orange-100"
            }`}
          >
            ⏳ Por vencer ({productosPorVencer.size})
          </Link>
        )}
      </div>

      {productos.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm text-slate-500">
          No se encontraron productos.
        </p>
      ) : (
        <ul className="space-y-2">
          {productos.map((producto) => {
            const bajoStock = producto.stockActual < producto.stockMinimo;
            const vencido = productosVencidos.has(producto.id);
            const porVencer = productosPorVencer.has(producto.id);
            return (
              <li key={producto.id}>
                <Link
                  href={`/productos/${producto.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-primary-300"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{producto.nombre}</p>
                    <p className="text-xs text-slate-500">
                      Código: {producto.sku}
                      {producto.categoria ? ` · ${producto.categoria}` : ""}
                    </p>
                    {(vencido || porVencer) && (
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          vencido ? "bg-danger-500 text-white" : "bg-orange-100 text-warning-500"
                        }`}
                      >
                        {vencido ? "Tiene lotes vencidos" : "Por vencer"}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-slate-900">
                      {centavosATexto(producto.precioVenta, simbolo)}
                    </p>
                    <p
                      className={`text-xs ${bajoStock ? "font-medium text-danger-600" : "text-slate-500"}`}
                    >
                      Stock: {unidadesMinimasATexto(producto.stockActual, producto.factorConversion)}{" "}
                      {producto.unidadMedida}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
