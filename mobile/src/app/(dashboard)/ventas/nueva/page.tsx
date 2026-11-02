"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { leerBorrador, type BorradorVenta } from "@/lib/borradorVenta";
import { useTipoNegocio } from "@/lib/tipoNegocio";
import { VentaForm, type ServicioOpcion } from "./VentaForm";

// Sin useSearchParams ni dependencia de la URL: esta pantalla ya se puede
// montar tal cual dentro del carrusel de swipe como vecina de las otras.
export function NuevaVentaPage() {
  const [cargando, setCargando] = useState(true);
  const { textos } = useTipoNegocio();
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [servicios, setServicios] = useState<ServicioOpcion[]>([]);
  const [simbolo, setSimbolo] = useState("Bs");
  const [borradorInicial, setBorradorInicial] = useState<BorradorVenta | null>(null);

  useEffect(() => {
    Promise.all([
      db.configuracion.findFirst(),
      db.cliente.findMany({ activo: true }, true),
      db.servicio.findMany({ activo: true }),
      leerBorrador(),
    ]).then(
      ([configuracion, listaClientes, listaServicios, borrador]) => {
        setSimbolo(configuracion?.simboloMoneda ?? "Bs");
        setClientes(listaClientes.map((c) => ({ id: c.id, nombre: c.nombre })));
        setServicios(
          listaServicios.map((s) => ({ id: s.id, nombre: s.nombre, precio: s.precio, duracionMinutos: s.duracionMinutos })),
        );
        setBorradorInicial(borrador);
        setCargando(false);
      },
    );
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="flex items-center justify-end">
        <Link href="/ventas" className="text-sm text-slate-500 hover:underline">
          {textos.verVentas}
        </Link>
      </div>

      {cargando ? (
        <p className="text-sm text-slate-500">Cargando...</p>
      ) : (
        <VentaForm clientes={clientes} servicios={servicios} simbolo={simbolo} borradorInicial={borradorInicial} />
      )}
    </div>
  );
}

export default NuevaVentaPage;
