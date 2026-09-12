// Copiado tal cual del script del diseño de referencia (Mi Tienda
// Mobile.dc.html): todas las alertas [data-mt-sync] anclan su animación al
// origen de la línea de tiempo del documento, así los banderines montados
// después (al cambiar de pantalla o aparecer nuevos productos) laten en
// fase con los que ya estaban — nunca cada uno arrancando su propio ciclo.
export function sincronizarAlertas(): void {
  document.querySelectorAll("[data-mt-sync]").forEach((el) => {
    (el as HTMLElement).style.animationDelay = "";
    el.getAnimations().forEach((a) => {
      try {
        a.startTime = 0;
      } catch {
        // Se ignora en navegadores donde no se puede fijar startTime.
      }
    });
  });
}
