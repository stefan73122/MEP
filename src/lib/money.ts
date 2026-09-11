// Todos los importes de la aplicación se guardan como enteros en centavos
// (nunca en float) para evitar errores de redondeo.

export function centavosATexto(centavos: number, simbolo = "Bs"): string {
  const monto = (centavos / 100).toFixed(2);
  return `${simbolo} ${monto}`;
}

// Igual que centavosATexto pero sin símbolo de moneda, para precargar inputs de formularios.
export function centavosATextoEditable(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

// Convierte un texto ingresado por el usuario (ej. "12.50" o "12,50") a centavos enteros.
// Lanza un error legible si el texto no es un número válido.
export function textoACentavos(texto: string): number {
  const normalizado = texto.trim().replace(",", ".");
  const valor = Number(normalizado);

  if (!Number.isFinite(valor)) {
    throw new Error(`"${texto}" no es un monto válido`);
  }

  return Math.round(valor * 100);
}
