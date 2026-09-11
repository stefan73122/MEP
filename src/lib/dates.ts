// Formato de fecha estándar de la aplicación: dd/mm/aaaa.

export function fechaATexto(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

export function fechaHoraATexto(fecha: Date): string {
  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  return `${fechaATexto(fecha)} ${horas}:${minutos}`;
}

// Convierte "dd/mm/aaaa" a Date. Lanza un error legible si el formato es inválido.
export function textoAFecha(texto: string): Date {
  const coincidencia = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (!coincidencia) {
    throw new Error(`"${texto}" no tiene el formato dd/mm/aaaa`);
  }

  const [, dia, mes, anio] = coincidencia;
  const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));

  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`"${texto}" no es una fecha válida`);
  }

  return fecha;
}

// Límites de un día calendario, útil para filtrar por rango de fechas.
export function inicioDelDia(fecha: Date): Date {
  const nueva = new Date(fecha);
  nueva.setHours(0, 0, 0, 0);
  return nueva;
}

export function finDelDia(fecha: Date): Date {
  const nueva = new Date(fecha);
  nueva.setHours(23, 59, 59, 999);
  return nueva;
}
