"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db/client";
import { leerBorrador, type BorradorVenta } from "@/lib/borradorVenta";
import { VentaForm, type ServicioOpcion } from "./VentaForm";

// Sin useSearchParams ni dependencia de la URL: esta pantalla ya se puede
// montar tal cual dentro del carrusel de swipe como vecina de las otras.
export function NuevaVentaPage() {
  const [cargando, setCargando] = useState(true);
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);
  const [servicios, setServicios] = useState<ServicioOpcion[]>([]);
  const [serviciosFrecuentes, setServiciosFrecuentes] = useState<ServicioOpcion[]>([]);
  const [simbolo, setSimbolo] = useState("Bs");
  const [borradorInicial, setBorradorInicial] = useState<BorradorVenta | null>(null);

  useEffect(() => {
    Promise.all([
      db.configuracion.findFirst(),
      db.cliente.findMany({ activo: true }, true),
      db.servicio.findMany({ activo: true }),
      db.ventaServicio.idsMasUsados(5),
      leerBorrador(),
    ]).then(
      ([configuracion, listaClientes, listaServicios, idsMasUsados, borrador]) => {
        setSimbolo(configuracion?.simboloMoneda ?? "Bs");
        setClientes(listaClientes.map((c) => ({ id: c.id, nombre: c.nombre })));
        const opciones: ServicioOpcion[] = listaServicios.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          precio: s.precio,
          duracionMinutos: s.duracionMinutos,
        }));
        setServicios(opciones);
        // Los 5 más usados; si todavía no hay tantos con atenciones, se
        // completa con los primeros por orden alfabético.
        const porId = new Map(opciones.map((o) => [o.id, o]));
        const frecuentes = idsMasUsados.map((id) => porId.get(id)).filter((o): o is ServicioOpcion => !!o);
        for (const opcion of opciones) {
          if (frecuentes.length >= 5) break;
          if (!frecuentes.includes(opcion)) frecuentes.push(opcion);
        }
        setServiciosFrecuentes(frecuentes);
        setBorradorInicial(borrador);
        setCargando(false);
      },
    );
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {cargando ? (
        <p className="text-sm text-slate-500">Cargando...</p>
      ) : (
        <VentaForm
          clientes={clientes}
          servicios={servicios}
          serviciosFrecuentes={serviciosFrecuentes}
          simbolo={simbolo}
          borradorInicial={borradorInicial}
        />
      )}
    </div>
  );
}

export default NuevaVentaPage;
