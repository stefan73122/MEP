"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/db/client";
import { centavosATexto, centavosATextoEditable } from "@/lib/money";
import { unidadesMinimasATexto } from "@/lib/stock";
import { fechaATexto, fechaHoraATexto } from "@/lib/dates";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "@/lib/constants";
import type { Lote, MovimientoInventario, Producto } from "@/lib/db/types";
import { EditarProductoForm } from "./EditarProductoForm";
import { MovimientoForm } from "./MovimientoForm";
import { EstadoProductoToggle } from "./EstadoProductoToggle";
import { EntradaLoteForm } from "./EntradaLoteForm";
import { SalidaLoteForm } from "./SalidaLoteForm";
import { AjustarLoteForm } from "./AjustarLoteForm";
import { IconAlertaTriangulo } from "@/components/ui/icons";

const ETIQUETAS_TIPO_VENTA: Record<string, string> = {
  kg: "Por peso (kg)",
  litro: "Por volumen (litro)",
};

const ETIQUETAS_MOVIMIENTO: Record<string, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
};

function ProductoDetalleContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));

  const [cargando, setCargando] = useState(true);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [simbolo, setSimbolo] = useState("Bs");
  const [diasAlerta, setDiasAlerta] = useState(DIAS_ALERTA_VENCIMIENTO_DEFECTO);
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [recargarClave, setRecargarClave] = useState(0);

  const recargar = useCallback(() => setRecargarClave((c) => c + 1), []);

  useEffect(() => {
    if (!Number.isInteger(id)) {
      router.replace("/productos");
      return;
    }
    let cancelado = false;
    async function cargar() {
      const [p, configuracion, movs] = await Promise.all([
        db.producto.findUnique(id),
        db.configuracion.findFirst(),
        db.movimientoInventario.findByProducto(id, 20),
      ]);
      if (!p) {
        router.replace("/productos");
        return;
      }
      const lotesData = p.perecedero ? await db.lote.findByProducto(id) : [];
      if (cancelado) return;
      setProducto(p);
      setSimbolo(configuracion?.simboloMoneda ?? "Bs");
      setDiasAlerta(configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO);
      setMovimientos(movs);
      setLotes(lotesData);
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, [id, recargarClave, router]);

  if (cargando || !producto) return <p className="text-sm text-slate-500">Cargando...</p>;

  const bajoStock = producto.stockActual < producto.stockMinimo;
  const tipoVentaTexto = ETIQUETAS_TIPO_VENTA[producto.unidadMedida] ?? `Por unidad (${producto.unidadMedida})`;

  const ahora = new Date();
  const limiteAlerta = new Date(ahora.getTime() + diasAlerta * 24 * 60 * 60 * 1000);

  function estadoLote(fechaVencimiento: Date): { etiqueta: string; clase: string } | null {
    if (fechaVencimiento < ahora) return { etiqueta: "Vencido", clase: "bg-danger-500 text-white" };
    if (fechaVencimiento <= limiteAlerta) return { etiqueta: "Por vencer", clase: "bg-orange-100 text-warning-500" };
    return null;
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/productos" className="text-sm text-slate-500 hover:underline">
        ← Productos
      </Link>

      <div className="rounded-xl bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{producto.nombre}</h1>
            <p className="text-xs text-slate-500">
              {tipoVentaTexto}
              {producto.categoria ? ` · ${producto.categoria}` : ""}
              {producto.perecedero ? " · Perecedero" : ""}
            </p>
          </div>
          {!producto.activo && (
            <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
              Inactivo
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-xs text-slate-500">Stock actual</p>
            <p className={`flex items-center gap-1 font-semibold ${bajoStock ? "text-danger-600" : "text-slate-900"}`}>
              {unidadesMinimasATexto(producto.stockActual, producto.factorConversion)} {producto.unidadMedida}
              {bajoStock && <IconAlertaTriangulo className="h-3.5 w-3.5" />}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <p className="text-xs text-slate-500">Precio de venta</p>
            <p className="font-semibold text-slate-900">{centavosATexto(producto.precioVenta, simbolo)}</p>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <EstadoProductoToggle productoId={producto.id} activo={producto.activo} onExito={recargar} />
        </div>
      </div>

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Editar datos</h2>
        <EditarProductoForm
          productoId={producto.id}
          nombre={producto.nombre}
          categoria={producto.categoria}
          precioCompraTexto={centavosATextoEditable(producto.precioCompra)}
          precioVentaTexto={centavosATextoEditable(producto.precioVenta)}
          stockMinimoTexto={unidadesMinimasATexto(producto.stockMinimo, producto.factorConversion)}
          onExito={recargar}
        />
      </div>

      {producto.activo && producto.perecedero && (
        <>
          <div className="rounded-xl bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Lotes</h2>
            {lotes.length === 0 ? (
              <p className="text-sm text-slate-500">Este producto todavía no tiene lotes con stock.</p>
            ) : (
              <ul className="space-y-2">
                {lotes.map((lote) => {
                  const estado = estadoLote(lote.fechaVencimiento);
                  return (
                    <li key={lote.id} className="rounded-lg border border-slate-100 p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">
                          {unidadesMinimasATexto(lote.cantidad, producto.factorConversion)} {producto.unidadMedida}
                        </span>
                        <span className="text-xs text-slate-500">Vence {fechaATexto(lote.fechaVencimiento)}</span>
                      </div>
                      {estado && (
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}>
                          {estado.etiqueta}
                        </span>
                      )}
                      <div className="mt-1">
                        <AjustarLoteForm
                          loteId={lote.id}
                          unidadMedida={producto.unidadMedida}
                          cantidadActualTexto={unidadesMinimasATexto(lote.cantidad, producto.factorConversion)}
                          onExito={recargar}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Agregar lote (entrada)</h2>
            <EntradaLoteForm productoId={producto.id} unidadMedida={producto.unidadMedida} onExito={recargar} />
          </div>

          <div className="rounded-xl bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Salida o merma</h2>
            <SalidaLoteForm productoId={producto.id} unidadMedida={producto.unidadMedida} onExito={recargar} />
          </div>
        </>
      )}

      {producto.activo && !producto.perecedero && (
        <div className="rounded-xl bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Registrar movimiento</h2>
          <MovimientoForm productoId={producto.id} unidadMedida={producto.unidadMedida} onExito={recargar} />
        </div>
      )}

      <div className="rounded-xl bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Últimos movimientos</h2>
        {movimientos.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay movimientos registrados.</p>
        ) : (
          <ul className="space-y-2">
            {movimientos.map((movimiento) => (
              <li key={movimiento.id} className="rounded-lg border border-slate-100 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    {ETIQUETAS_MOVIMIENTO[movimiento.tipo] ?? movimiento.tipo}
                  </span>
                  <span className="text-xs text-slate-500">{fechaHoraATexto(movimiento.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-500">{movimiento.motivo}</p>
                <p className="text-xs text-slate-500">
                  {unidadesMinimasATexto(movimiento.stockAnterior, producto.factorConversion)} →{" "}
                  {unidadesMinimasATexto(movimiento.stockPosterior, producto.factorConversion)} {producto.unidadMedida}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function ProductoDetallePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando...</p>}>
      <ProductoDetalleContenido />
    </Suspense>
  );
}
