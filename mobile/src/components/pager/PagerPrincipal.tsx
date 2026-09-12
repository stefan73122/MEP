"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PANTALLAS_PRINCIPALES } from "@/lib/pantallasPrincipales";
import { PagerContext, type FiltroPantalla } from "./PagerContext";

const DURACION_MS = 200;
const CURVA = "cubic-bezier(0,0,0.2,1)";
const UMBRAL_DECISION_PX = 8; // para distinguir un swipe horizontal de un scroll vertical

function tieneScrollHorizontalReal(el: Element): boolean {
  const estilo = getComputedStyle(el);
  const permiteScroll = estilo.overflowX === "auto" || estilo.overflowX === "scroll";
  return permiteScroll && el.scrollWidth > el.clientWidth;
}

// El gesto no se activa dentro de listas que ya se desplazan horizontal (a
// prueba de futuro, hoy no hay ninguna) ni sobre el carrito de la venta en
// curso (marcado explícitamente con data-swipe-ignorar).
function debeIgnorarGesto(objetivo: EventTarget | null): boolean {
  let el = objetivo instanceof Element ? objetivo : null;
  let niveles = 0;
  while (el && niveles < 8) {
    if (el.hasAttribute("data-swipe-ignorar")) return true;
    if (tieneScrollHorizontalReal(el)) return true;
    el = el.parentElement;
    niveles++;
  }
  return false;
}

type EstadoGesto = { decidido: "horizontal" | "vertical" | null; inicioX: number; inicioY: number };
type FiltroPendiente = { href: string; filtro: FiltroPantalla; nonce: number } | null;

function indicesAMontar(activo: number): number[] {
  return [activo - 1, activo, activo + 1].filter((i) => i >= 0 && i < PANTALLAS_PRINCIPALES.length);
}

// El motor de gestos del carrusel entre las 5 pantallas principales.
//
// Principio central (para evitar el desfase entre el botón tocado, la
// pantalla activa y la posición del contenedor): NADA de la posición visual
// se guarda ni se muta por fuera de React. `indiceActivo` es la única
// fuente de verdad; la lista de pantallas montadas, la posición de la
// activa dentro de esa lista y el transform del carril se RECALCULAN en
// cada render a partir de ese único estado (más el offset de arrastre en
// vivo). Así, cuando la ventana de 3 pantallas montadas cambia (se suelta
// una vecina y entra otra), el transform nuevo siempre corresponde al
// nuevo orden real del DOM — nunca queda un valor imperativo viejo dando
// vueltas.
export function PagerPrincipal() {
  const router = useRouter();
  const pathname = usePathname();

  const [indiceActivo, setIndiceActivo] = useState(() => {
    const i = PANTALLAS_PRINCIPALES.findIndex((p) => p.href === pathname);
    return i === -1 ? 0 : i;
  });
  const [anchoContenedor, setAnchoContenedor] = useState(0);
  const [arrastrePx, setArrastrePx] = useState(0);
  const [transicionando, setTransicionando] = useState(false);
  const [filtroPendiente, setFiltroPendiente] = useState<FiltroPendiente>(null);

  const contenedorRef = useRef<HTMLDivElement>(null);
  const gestoRef = useRef<EstadoGesto | null>(null);
  const arrastrePendienteRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const indiceActivoRef = useRef(indiceActivo);
  indiceActivoRef.current = indiceActivo;

  // Medido con ResizeObserver (no una sola vez): si gira el teléfono o
  // cambia el tamaño de la ventana, el ancho por pantalla se recalcula.
  // useLayoutEffect (no useEffect) para tener el ancho ANTES del primer
  // paint y no mostrar un frame con el transform en 0.
  useLayoutEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const medir = () => setAnchoContenedor(el.offsetWidth);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Sincroniza con navegación que no vino del arrastre (click en NavBar, un
  // <Link> cualquiera hacia una de las 5 rutas, o irA()): el pathname es la
  // señal, pero el índice/posición siguen derivándose del mismo estado de
  // siempre, con el mismo camino que usa el gesto al soltar.
  useLayoutEffect(() => {
    const idx = PANTALLAS_PRINCIPALES.findIndex((p) => p.href === pathname);
    if (idx !== -1 && idx !== indiceActivoRef.current) {
      setTransicionando(true);
      setArrastrePx(0);
      setIndiceActivo(idx);
    }
  }, [pathname]);

  useLayoutEffect(
    () => () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    },
    [],
  );

  function programarArrastre(valor: number) {
    arrastrePendienteRef.current = valor;
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      setArrastrePx(arrastrePendienteRef.current);
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (debeIgnorarGesto(e.target)) return;
    // Si llega un toque nuevo mientras la pantalla todavía se estaba
    // asentando de un cambio anterior, se corta esa transición ya mismo
    // (queda en su posición final) y el gesto nuevo arranca limpio — nunca
    // se arrastra sobre un movimiento a medio animar.
    setTransicionando(false);
    gestoRef.current = { decidido: null, inicioX: e.clientX, inicioY: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gestoRef.current;
    if (!g) return;
    const dx = e.clientX - g.inicioX;
    const dy = e.clientY - g.inicioY;

    if (g.decidido === null) {
      if (Math.abs(dx) < UMBRAL_DECISION_PX && Math.abs(dy) < UMBRAL_DECISION_PX) return;
      g.decidido = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (g.decidido === "vertical") {
        gestoRef.current = null; // scroll vertical normal: se lo dejamos a la página
        return;
      }
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
    if (g.decidido !== "horizontal") return;

    e.preventDefault();
    let offset = dx;
    if (indiceActivo === 0) offset = Math.min(offset, 0);
    if (indiceActivo === PANTALLAS_PRINCIPALES.length - 1) offset = Math.max(offset, 0);
    programarArrastre(offset);
  }

  function finalizarGesto(offsetFinal: number) {
    const ancho = anchoContenedor;
    const umbral = ancho / 2;
    let nuevoIndice = indiceActivo;
    if (ancho > 0 && Math.abs(offsetFinal) > umbral) {
      nuevoIndice = offsetFinal > 0 ? indiceActivo - 1 : indiceActivo + 1;
      nuevoIndice = Math.max(0, Math.min(PANTALLAS_PRINCIPALES.length - 1, nuevoIndice));
    }
    setTransicionando(true);
    setArrastrePx(0);
    setIndiceActivo(nuevoIndice);
    if (nuevoIndice !== indiceActivo) {
      window.scrollTo({ top: 0 });
      const pantalla = PANTALLAS_PRINCIPALES[nuevoIndice];
      if (pantalla && pathname !== pantalla.href) router.replace(pantalla.href, { scroll: false });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const g = gestoRef.current;
    gestoRef.current = null;
    if (!g || g.decidido !== "horizontal") return;
    finalizarGesto(e.clientX - g.inicioX);
  }

  function onPointerCancel() {
    const eraArrastreHorizontal = gestoRef.current?.decidido === "horizontal";
    gestoRef.current = null;
    if (eraArrastreHorizontal) finalizarGesto(0);
  }

  function irA(ruta: string, filtroInicial?: FiltroPantalla) {
    const esPantallaDelCarrusel = PANTALLAS_PRINCIPALES.some((p) => p.href === ruta);
    if (filtroInicial) setFiltroPendiente({ href: ruta, filtro: filtroInicial, nonce: Date.now() });
    if (esPantallaDelCarrusel) router.replace(ruta, { scroll: false });
    else router.push(ruta);
  }

  // --- Todo lo visual sale de acá, recalculado en cada render ---
  const montados = indicesAMontar(indiceActivo);
  const posicionActivaEnTrack = montados.indexOf(indiceActivo);
  const progreso = anchoContenedor > 0 ? -arrastrePx / anchoContenedor : 0;
  const centro = posicionActivaEnTrack - progreso;
  const transform = `translate3d(${-posicionActivaEnTrack * anchoContenedor + arrastrePx}px, 0, 0)`;

  return (
    <PagerContext.Provider value={{ indiceActivo, progreso, irA }}>
      <div
        ref={contenedorRef}
        className="relative overflow-x-hidden"
        style={{ touchAction: "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className="flex items-start"
          style={{
            transform,
            transition: transicionando ? `transform ${DURACION_MS}ms ${CURVA}` : "none",
            willChange: transicionando || gestoRef.current ? "transform" : "auto",
          }}
          onTransitionEnd={() => setTransicionando(false)}
        >
          {montados.map((indice) => {
            const pantalla = PANTALLAS_PRINCIPALES[indice];
            const conFiltro = filtroPendiente?.href === pantalla.href ? filtroPendiente : null;
            const posicionEnTrack = montados.indexOf(indice);
            const opacidad = 1 - 0.15 * Math.min(1, Math.abs(posicionEnTrack - centro));
            return (
              <div key={pantalla.href} className="w-full shrink-0" style={{ opacity: opacidad }}>
                <pantalla.Componente key={conFiltro ? conFiltro.nonce : "base"} filtroInicial={conFiltro?.filtro} />
              </div>
            );
          })}
        </div>
      </div>
    </PagerContext.Provider>
  );
}
