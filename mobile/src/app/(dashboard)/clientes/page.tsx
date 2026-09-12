"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/db/client";
import { centavosATexto } from "@/lib/money";
import { fechaATexto } from "@/lib/dates";
import { obtenerCuentasPorCobrar, type CuentaPorCobrar } from "@/lib/creditos";
import type { Cliente } from "@/lib/db/types";
import { IconAlertaTriangulo, IconBuscar } from "@/components/ui/icons";

export type FiltroClientes = { q?: string; cxc?: boolean };

// Contenido real de la pantalla: estado local, nada de useSearchParams. Así
// el carrusel de swipe puede montarla como vecina sin pelear por la URL
// (que solo existe una vez para toda la app).
export function ClientesContenido({ filtroInicial }: { filtroInicial?: FiltroClientes }) {
  const [q, setQ] = useState(filtroInicial?.q ?? "");
  const [cxc, setCxc] = useState(filtroInicial?.cxc ?? false);

  const [cargando, setCargando] = useState(true);
  const [simbolo, setSimbolo] = useState("Bs");
  const [todosActivos, setTodosActivos] = useState<Cliente[]>([]);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<CuentaPorCobrar[]>([]);

  useEffect(() => {
    let cancelado = false;
    async function cargar() {
      const [configuracion, activos, cuentas] = await Promise.all([
        db.configuracion.findFirst(),
        db.cliente.findMany({ activo: true }),
        obtenerCuentasPorCobrar(db),
      ]);
      if (cancelado) return;
      setSimbolo(configuracion?.simboloMoneda ?? "Bs");
      setTodosActivos(activos);
      setCuentasPorCobrar(cuentas);
      setCargando(false);
    }
    cargar();
    return () => {
      cancelado = true;
    };
  }, []);

  if (cargando) return <p className="text-sm text-slate-500">Cargando...</p>;

  const saldosPorCliente = new Map(cuentasPorCobrar.map((c) => [c.clienteId, c]));

  let clientes = todosActivos;
  if (q) {
    const qNormalizado = q.trim().toLowerCase();
    clientes = clientes.filter((c) => c.nombre.toLowerCase().includes(qNormalizado));
  }
  if (cxc) {
    clientes = clientes.filter((c) => saldosPorCliente.has(c.id));
    clientes.sort(
      (a, b) =>
        saldosPorCliente.get(a.id)!.fechaMasAntigua.getTime() - saldosPorCliente.get(b.id)!.fechaMasAntigua.getTime(),
    );
  } else {
    clientes = [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Clientes</h1>
        <Link
          href="/clientes/nuevo"
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          + Nuevo cliente
        </Link>
      </div>

      <div className="relative w-full">
        <IconBuscar className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-primary-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre"
          className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <button
        type="button"
        onClick={() => setCxc((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
          cxc ? "bg-danger-500 text-white" : "bg-red-50 text-danger-600 hover:bg-red-100"
        }`}
      >
        <IconAlertaTriangulo className="h-3.5 w-3.5" /> Cuentas por cobrar ({cuentasPorCobrar.length})
        {cxc ? " · mostrando solo estas" : ""}
      </button>

      {clientes.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm text-slate-500">No se encontraron clientes.</p>
      ) : (
        <ul className="space-y-2">
          {clientes.map((cliente) => {
            const cuenta = saldosPorCliente.get(cliente.id);
            return (
              <li key={cliente.id}>
                <Link
                  href={`/clientes/detalle?id=${cliente.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-primary-300"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{cliente.nombre}</p>
                    {cliente.telefono && <p className="text-xs text-slate-500">{cliente.telefono}</p>}
                  </div>
                  {cuenta && (
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-danger-600">{centavosATexto(cuenta.saldoPendiente, simbolo)}</p>
                      <p className="text-xs text-slate-500">Desde {fechaATexto(cuenta.fechaMasAntigua)}</p>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Punto de entrada por URL real (escritorio, o refresh directo de /clientes).
function ClientesDesdeUrl() {
  const searchParams = useSearchParams();
  const filtroInicial: FiltroClientes = {
    q: searchParams.get("q") ?? undefined,
    cxc: searchParams.get("cxc") === "1",
  };
  return <ClientesContenido filtroInicial={filtroInicial} />;
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Cargando...</p>}>
      <ClientesDesdeUrl />
    </Suspense>
  );
}
