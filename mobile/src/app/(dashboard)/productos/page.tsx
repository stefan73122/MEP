"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/db/client";
import { centavosATexto } from "@/lib/money";
import { unidadesMinimasATexto } from "@/lib/stock";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "@/lib/constants";
import { obtenerLotesPorVencer, obtenerLotesVencidos } from "@/lib/lotes";
import type { Producto } from "@/lib/db/types";
import { IconAlertaBandera, IconAlertaTriangulo, IconBuscar, IconProductos, IconReloj } from "@/components/ui/icons";

function construirUrl(base: string, params: Record<string, string | undefined>) {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor) busqueda.set(clave, valor);
  }
  const query = busqueda.toString();
  return query ? `${base}?${query}` : base;
}

function ProductosContenido() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? undefined;
  const bajo = searchParams.get("bajo") ?? undefined;
  const vencimiento = searchParams.get("vencimiento") ?? undefined;

  const [cargando, setCargando] = useState(true);
  const [simbolo, setSimbolo] = useState("Bs");
  const [todosActivos, setTodosActivos] = useState<Producto[]>([]);
  const [productosVencidos, setProductosVencidos] = useState<Set<number>>(new Set());
  const [productosPorVencer, setProductosPorVencer] = useState<Set<number>>(new Set());
  const [totalVencidos, setTotalVencidos] = useState(0);
  const [totalPorVencer, setTotalPorVencer] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const [configuracion, activos] = await Promise.all([
        db.configuracion.findFirst(),
        db.producto.findMany({ activo: true }),
      ]);
      const diasAlerta = configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO;
      const [lotesVencidos, lotesPorVencer] = await Promise.all([
        obtenerLotesVencidos(db),
        obtenerLotesPorVencer(db, diasAlerta),
      ]);
      if (cancelado) return;
      setSimbolo(configuracion?.simboloMoneda ?? "Bs");
      setTodosActivos(activos);
      setProductosVencidos(new Set(lotesVencidos.map((l) => l.productoId)));
      setProductosPorVencer(new Set(lotesPorVencer.map((l) => l.productoId)));
      setTotalVencidos(new Set(lotesVencidos.map((l) => l.productoId)).size);
      setTotalPorVencer(new Set(lotesPorVencer.map((l) => l.productoId)).size);
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>;

  const totalBajoStock = todosActivos.filter((p) => p.stockActual < p.stockMinimo).length;

  let productos = todosActivos;
  if (q) {
    const qNormalizado = q.trim().toLowerCase();
    productos = productos.filter(
      (p) => p.nombre.toLowerCase().includes(qNormalizado) || p.sku.toLowerCase().includes(qNormalizado),
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
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:brightness-110"
          >
            + Nuevo
          </Link>
        </div>
      </div>

      <form action="/productos" method="GET" className="flex gap-2">
        <div className="relative w-full">
          <IconBuscar className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-primary-500" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre o código"
            className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
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
          <IconAlertaTriangulo className="h-3.5 w-3.5" /> Stock bajo ({totalBajoStock})
        </Link>
        {totalVencidos > 0 && (
          <Link
            href={construirUrl("/productos", { q, bajo, vencimiento: vencimiento === "vencido" ? undefined : "vencido" })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              vencimiento === "vencido" ? "bg-danger-500 text-white" : "bg-red-50 text-danger-600 hover:bg-red-100"
            }`}
          >
            <IconAlertaTriangulo className="h-3.5 w-3.5" /> Vencidos ({totalVencidos})
          </Link>
        )}
        {totalPorVencer > 0 && (
          <Link
            href={construirUrl("/productos", { q, bajo, vencimiento: vencimiento === "porVencer" ? undefined : "porVencer" })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              vencimiento === "porVencer" ? "bg-warning-500 text-white" : "bg-orange-50 text-warning-500 hover:bg-orange-100"
            }`}
          >
            <IconReloj className="h-3.5 w-3.5" /> Por vencer ({totalPorVencer})
          </Link>
        )}
      </div>

      {productos.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No se encontraron productos.</p>
      ) : (
        <ul className="space-y-2">
          {productos.map((producto) => {
            const bajoStock = producto.stockActual < producto.stockMinimo;
            const vencido = productosVencidos.has(producto.id);
            const porVencer = productosPorVencer.has(producto.id);
            return (
              <li key={producto.id}>
                <Link
                  href={`/productos/detalle?id=${producto.id}`}
                  className={`relative flex items-center gap-3 rounded-xl border bg-white p-3 hover:border-primary-300 ${
                    vencido ? "border-danger-600/40" : porVencer ? "border-warning-500/40" : "border-slate-200"
                  }`}
                >
                  {(vencido || porVencer) && (
                    <span className="absolute -top-2 left-1 z-10">
                      <IconAlertaBandera variante={vencido ? "danger" : "warning"} />
                    </span>
                  )}
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
                      vencido
                        ? "border-danger-600/35 bg-danger-500/10"
                        : porVencer
                          ? "border-warning-500/35 bg-warning-500/15"
                          : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <IconProductos
                      className={vencido ? "text-danger-600" : porVencer ? "text-warning-500" : "text-slate-500"}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
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
                    <p className="font-semibold text-slate-900">{centavosATexto(producto.precioVenta, simbolo)}</p>
                    <p className={`text-xs ${bajoStock ? "font-medium text-danger-600" : "text-slate-500"}`}>
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

export default function ProductosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando...</p>}>
      <ProductosContenido />
    </Suspense>
  );
}
