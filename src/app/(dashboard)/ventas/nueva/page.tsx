import Link from "next/link";
import { requireAcceso } from "@/lib/auth";
import { db } from "@/lib/db";
import { VentaForm } from "./VentaForm";

export default async function NuevaVentaPage() {
  await requireAcceso();

  const [configuracion, clientes] = await Promise.all([
    db.configuracion.findFirst(),
    db.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Vender</h1>
        <Link href="/ventas" className="text-sm text-slate-500 hover:underline">
          Ver ventas →
        </Link>
      </div>

      <VentaForm
        clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))}
        simbolo={configuracion?.simboloMoneda ?? "Bs"}
      />
    </div>
  );
}
