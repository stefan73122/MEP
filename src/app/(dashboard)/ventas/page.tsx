import Link from "next/link";
import { requireAcceso } from "@/lib/auth";
import { db } from "@/lib/db";
import { centavosATexto } from "@/lib/money";
import { fechaHoraATexto, finDelDia, inicioDelDia, textoAFecha } from "@/lib/dates";
import type { Prisma } from "@prisma/client";

const ETIQUETAS_FORMA_PAGO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA_QR: "Transferencia/QR",
  CREDITO: "Crédito",
};

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; clienteId?: string; formaPago?: string }>;
}) {
  await requireAcceso();
  const { desde, hasta, clienteId, formaPago } = await searchParams;

  const where: Prisma.VentaWhereInput = {};

  if (desde || hasta) {
    where.fecha = {};
    if (desde) {
      try {
        where.fecha.gte = inicioDelDia(textoAFecha(desde));
      } catch {
        // fecha inválida en la URL: se ignora el filtro
      }
    }
    if (hasta) {
      try {
        where.fecha.lte = finDelDia(textoAFecha(hasta));
      } catch {
        // fecha inválida en la URL: se ignora el filtro
      }
    }
  }
  if (clienteId) where.clienteId = Number(clienteId);
  if (formaPago) where.formaPago = formaPago;

  const [configuracion, clientes, ventas] = await Promise.all([
    db.configuracion.findFirst(),
    db.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    db.venta.findMany({
      where,
      include: { cliente: true },
      orderBy: { fecha: "desc" },
      take: 100,
    }),
  ]);
  const simbolo = configuracion?.simboloMoneda ?? "Bs";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">Ventas</h1>
        <Link
          href="/ventas/nueva"
          className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + Nueva venta
        </Link>
      </div>

      <form action="/ventas" method="GET" className="grid grid-cols-2 gap-2 rounded-xl bg-white p-3 sm:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Desde</label>
          <input
            type="text"
            name="desde"
            defaultValue={desde ?? ""}
            placeholder="dd/mm/aaaa"
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Hasta</label>
          <input
            type="text"
            name="hasta"
            defaultValue={hasta ?? ""}
            placeholder="dd/mm/aaaa"
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Cliente</label>
          <select
            name="clienteId"
            defaultValue={clienteId ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Forma de pago</label>
          <select
            name="formaPago"
            defaultValue={formaPago ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todas</option>
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA_QR">Transferencia/QR</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <button
            type="submit"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:w-auto"
          >
            Filtrar
          </button>
        </div>
      </form>

      {ventas.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm text-slate-500">
          No se encontraron ventas con estos filtros.
        </p>
      ) : (
        <ul className="space-y-2">
          {ventas.map((venta) => (
            <li key={venta.id}>
              <Link
                href={`/ventas/${venta.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-primary-300"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    Venta #{venta.id} · {venta.cliente?.nombre ?? "Cliente ocasional"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {fechaHoraATexto(venta.fecha)} · {ETIQUETAS_FORMA_PAGO[venta.formaPago] ?? venta.formaPago}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-slate-900">{centavosATexto(venta.total, simbolo)}</p>
                  {venta.estado === "ANULADA" && (
                    <p className="text-xs font-medium text-danger-600">Anulada</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
