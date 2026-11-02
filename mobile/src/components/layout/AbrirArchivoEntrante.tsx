"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { alRecibirArchivoEntrante, hayArchivoEntrante } from "@/lib/archivoEntrante";

// Si la app se abrió con un Excel ("Abrir con" desde WhatsApp, Archivos...),
// lleva directo a Productos > Importar; ahí ImportarForm toma el archivo y
// muestra la vista previa. Va dentro de AuthGate, así que con bloqueo por PIN
// esto recién corre después de desbloquear.
export function AbrirArchivoEntrante() {
  const router = useRouter();

  useEffect(() => {
    const irAImportar = () => router.push("/productos/importar");

    hayArchivoEntrante()
      .then((hay) => {
        if (hay) irAImportar();
      })
      .catch(() => {});

    return alRecibirArchivoEntrante(irAImportar);
  }, [router]);

  return null;
}
