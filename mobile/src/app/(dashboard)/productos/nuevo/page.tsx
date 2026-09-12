import Link from "next/link";
import { NuevoProductoForm } from "./NuevoProductoForm";

export default function NuevoProductoPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/productos" className="text-sm text-slate-500 hover:underline">
          ← Productos
        </Link>
      </div>
      <h1 className="text-lg font-semibold text-slate-900">Nuevo producto</h1>
      <div className="rounded-xl bg-white p-4">
        <NuevoProductoForm />
      </div>
    </div>
  );
}
