// Genera texto CSV simple (separado por comas, con comillas cuando hace
// falta) para las exportaciones de reportes. Sin librerías externas.

function escaparCelda(valor: string | number): string {
  const texto = String(valor);
  if (/["\n,]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export function filasACsv(encabezados: string[], filas: (string | number)[][]): string {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(escaparCelda).join(","));
  // BOM al inicio para que Excel abra bien los acentos.
  return "﻿" + lineas.join("\r\n");
}

export function respuestaCsv(nombreArchivo: string, contenido: string): Response {
  return new Response(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
