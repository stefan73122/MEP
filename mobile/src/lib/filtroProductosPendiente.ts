import type { FiltroProductos } from "@/app/(dashboard)/productos/page";

// Filtro que la lista de Productos tiene que aplicar cuando el pedido viene
// de fuera de la navegación normal (hoy: al tocar una notificación). No puede
// ir por la URL ni por el carrusel: en celular Productos se monta dentro del
// carrusel sin leer la URL, y al volver de segundo plano AuthGate remonta
// todo. Se guarda acá y Productos lo toma al montarse (o al instante, si ya
// estaba en pantalla).
let pendiente: FiltroProductos | null = null;
const oyentes = new Set<() => void>();

export function pedirFiltroProductos(filtro: FiltroProductos): void {
  pendiente = filtro;
  oyentes.forEach((avisar) => avisar());
}

// Devuelve el filtro pendiente y lo descarta: se aplica una sola vez.
export function tomarFiltroProductosPendiente(): FiltroProductos | null {
  const filtro = pendiente;
  pendiente = null;
  return filtro;
}

export function alPedirFiltroProductos(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => {
    oyentes.delete(avisar);
  };
}

// Solo consulta, sin descartarlo (lo usa el selector del catálogo para saber
// que tiene que mostrar Productos).
export function hayFiltroProductosPendiente(): boolean {
  return pendiente !== null;
}
