"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { VentaForm } from "./VentaForm";

export default function NuevaVentaPage() {
  const [cargando, setCargando] = useState(true);
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [simbolo, setSimbolo] = useState("Bs");

  useEffect(() => {
    Promise.all([db.configuracion.findFirst(), db.cliente.findMany({ activo: true }, true)]).then(
      ([configuracion, listaClientes]) => {
        setSimbolo(configuracion?.simboloMoneda ?? "Bs");
        setClientes(listaClientes.map((c) => ({ id: c.id, nombre: c.nombre })));
        setCargando(false);
      },
    );
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Vender</h1>
        <Link href="/ventas" className="text-sm text-slate-500 hover:underline">
          Ver ventas →
        </Link>
      </div>

      {cargando ? (
        <p className="text-sm text-slate-500">Cargando...</p>
      ) : (
        <VentaForm clientes={clientes} simbolo={simbolo} />
      )}
    </div>
  );
}
