import Link from "next/link";
import { NuevoClienteForm } from "./NuevoClienteForm";

export default function NuevoClientePage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/clientes" className="text-sm text-slate-500 hover:underline">
        ← Clientes
      </Link>
      <h1 className="text-lg font-semibold text-slate-900">Nuevo cliente</h1>
      <div className="rounded-xl bg-white p-4">
        <NuevoClienteForm />
      </div>
    </div>
  );
}
