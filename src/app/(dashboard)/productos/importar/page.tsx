import Link from "next/link";
import { requireAcceso } from "@/lib/auth";
import { ImportarForm } from "./ImportarForm";

export default async function ImportarProductosPage() {
  await requireAcceso();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/productos" className="text-sm text-slate-500 hover:underline">
        ← Productos
      </Link>
      <h1 className="text-lg font-semibold text-slate-900">Importar productos desde Excel</h1>

      <div className="rounded-xl bg-white p-4 text-sm text-slate-600">
        <p className="mb-2">
          1. Descargá la plantilla, completala con tus productos y subila de vuelta. Vas a poder revisar
          todo antes de que se guarde nada.
        </p>
        <a
          href="/api/productos/plantilla"
          className="inline-block rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Descargar plantilla
        </a>
      </div>

      <ImportarForm />
    </div>
  );
}
