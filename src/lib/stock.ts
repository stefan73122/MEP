// Las cantidades de stock se guardan como enteros en la "unidad mínima" del
// producto (ver factorConversion en schema.prisma). Estas funciones convierten
// entre esa unidad mínima y el número que ve el usuario en pantalla
// (ej. "2.5" kg <-> 2500 gramos), igual que money.ts hace con los centavos.

export function unidadesMinimasATexto(cantidad: number, factorConversion: number): string {
  if (factorConversion <= 1) {
    return String(cantidad);
  }

  const valor = cantidad / factorConversion;
  const decimales = String(factorConversion).length - 1; // 1000 -> 3 decimales
  return valor.toFixed(decimales).replace(/\.?0+$/, "") || "0";
}

// Convierte un texto ingresado por el usuario (en la unidad que ve, ej. kg) a
// la unidad mínima entera (ej. gramos). Lanza un error legible si no es válido.
export function textoAUnidadesMinimas(texto: string, factorConversion: number): number {
  const normalizado = texto.trim().replace(",", ".");
  const valor = Number(normalizado);

  if (!Number.isFinite(valor)) {
    throw new Error(`"${texto}" no es una cantidad válida`);
  }

  return Math.round(valor * factorConversion);
}
