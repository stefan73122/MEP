"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PANTALLAS_PRINCIPALES } from "@/lib/pantallasPrincipales";
import { PagerContext, type FiltroPantalla } from "./PagerContext";

const DURACION_MS = 200;
const UMBRAL_DECISION_PX = 8; // para distinguir un swipe horizontal de un scroll vertical

// Registro temporal para diagnosticar el gesto en el dispositivo real (ver
// con `adb logcat` o Chrome remoto). Sacar cuando se confirme que anda bien.
const DEPURAR = false;
function log(...args: unknown[]) {
  if (DEPURAR) console.log("[pager]", ...args);
}

function suavizadoSalida(t: number): number {
  // Misma sensación que cubic-bezier(0,0,0.2,1): arranca rápido, frena suave.
  return 1 - Math.pow(1 - t, 3);
}

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

type EstadoGesto = {
  decidido: "horizontal" | "vertical" | null;
  inicioX: number;
  inicioY: number;
  origenPx: number;
  scrollInicial: number;
};
type FiltroPendiente = { href: string; filtro: FiltroPantalla; nonce: number } | null;

function indicesAMontar(activo: number): number[] {
  return [activo - 1, activo, activo + 1].filter((i) => i >= 0 && i < PANTALLAS_PRINCIPALES.length);
}

// El motor de gestos del carrusel entre las 5 pantallas principales.
//
// Principio central: `indiceActivo` es la única fuente de verdad de QUÉ
// pantalla está asentada, y solo cambia en un instante muy preciso — nunca
// al arrancar un gesto o una animación, solo cuando `arrastrePx` ya llegó
// exactamente al valor que hace que ese cambio sea visualmente idéntico a
// como se veía un instante antes (ver animarHacia). Así, mientras dura
// cualquier animación (arrastre en vivo o el acomodo final), la ventana de
// pantallas montadas (`indicesAMontar`) NUNCA cambia — nada se desmonta ni
// se reordena en el DOM mientras el carril se está moviendo. Esa mezcla
// (layout de flex cambiando de golpe mientras el transform se anima) era la
// causa real de que el deslizamiento se viera "atorado a la mitad" con dos
// pantallas encimadas: quedaba a mitad de camino porque la animación se
// basaba en un layout que cambiaba por debajo antes de terminar.
//
// El acomodo final tampoco depende de eventos de transición CSS
// (transitionend nunca es 100% confiable: se pierde si algo interrumpe el
// gesto, si el elemento que capturó el puntero desaparece, o si un hijo con
// su propia transición hace burbujear su propio evento). Se anima con
// requestAnimationFrame, controlado enteramente por este componente: se
// sabe con certeza absoluta cuándo termina, porque lo decide este mismo
// código, no un evento externo que puede no llegar.
export function PagerPrincipal() {
  const router = useRouter();
  const pathname = usePathname();

  const [indiceActivo, setIndiceActivo] = useState(() => {
    const i = PANTALLAS_PRINCIPALES.findIndex((p) => p.href === pathname);
    return i === -1 ? 0 : i;
  });
  const [anchoContenedor, setAnchoContenedor] = useState(0);
  const [arrastrePx, setArrastrePx] = useState(0);
  const [filtroPendiente, setFiltroPendiente] = useState<FiltroPendiente>(null);

  const contenedorRef = useRef<HTMLDivElement>(null);
  const gestoRef = useRef<EstadoGesto | null>(null);
  const arrastreRealRef = useRef(0); // valor verdadero de arrastrePx, sin esperar al re-render
  const rafIdRef = useRef<number | null>(null);
  const indiceActivoRef = useRef(indiceActivo);
  indiceActivoRef.current = indiceActivo;
  const anchoContenedorRef = useRef(anchoContenedor);
  anchoContenedorRef.current = anchoContenedor;

  // Medido con ResizeObserver (no una sola vez): si gira el teléfono o
  // cambia el tamaño de la ventana, el ancho por pantalla se recalcula.
  // useLayoutEffect (no useEffect) para tener el ancho ANTES del primer
  // paint y no mostrar un frame con el transform en 0.
  useLayoutEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    // getBoundingClientRect (no offsetWidth): offsetWidth redondea a entero,
    // pero cada pantalla se dibuja con el ancho real (con decimales) del
    // contenedor — esa fracción perdida se acumulaba entre pantallas vecinas
    // y se veía como una línea del borde de una pantalla asomando en la de al lado.
    const medir = () => setAnchoContenedor(el.getBoundingClientRect().width);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function cancelarAnimacion() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }

  // Anima `arrastrePx` desde su valor real actual hasta `destinoPx`, y solo
  // AL TERMINAR ejecuta `alTerminar` (que es quien realmente cambia
  // `indiceActivo`). Se puede interrumpir en cualquier frame: si llega un
  // nuevo gesto, `arrastreRealRef.current` ya tiene el valor real de ESE
  // instante (nunca 0 ni el destino teórico), así que el gesto nuevo arranca
  // exactamente donde el ojo lo ve, sin saltos.
  function animarHacia(destinoPx: number, alTerminar: () => void) {
    cancelarAnimacion();
    const origenPx = arrastreRealRef.current;
    const distancia = destinoPx - origenPx;
    if (distancia === 0) {
      alTerminar();
      return;
    }
    const inicio = performance.now();
    const frame = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION_MS);
      const valor = origenPx + distancia * suavizadoSalida(t);
      arrastreRealRef.current = valor;
      setArrastrePx(valor);
      if (t < 1) {
        rafIdRef.current = requestAnimationFrame(frame);
      } else {
        rafIdRef.current = null;
        alTerminar();
      }
    };
    rafIdRef.current = requestAnimationFrame(frame);
  }

  function asentarEn(nuevoIndice: number) {
    arrastreRealRef.current = 0;
    setArrastrePx(0);
    setIndiceActivo(nuevoIndice);
  }

  // Sincroniza con navegación que no vino del arrastre (click en NavBar, un
  // <Link> cualquiera hacia una de las 5 rutas, o irA()). Si la ruta nueva es
  // vecina inmediata de la actual, se anima igual que un swipe; si es un
  // salto más grande (o el ancho todavía no se midió), no hay una física de
  // arrastre razonable que animar y se va directo.
  useLayoutEffect(() => {
    const idx = PANTALLAS_PRINCIPALES.findIndex((p) => p.href === pathname);
    if (idx === -1 || idx === indiceActivoRef.current) return;
    const ancho = anchoContenedorRef.current;
    const diferencia = idx - indiceActivoRef.current;
    if (ancho > 0 && Math.abs(diferencia) === 1) {
      animarHacia(diferencia > 0 ? -ancho : ancho, () => asentarEn(idx));
    } else {
      cancelarAnimacion();
      asentarEn(idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useLayoutEffect(() => cancelarAnimacion, []);

  function programarArrastre(valor: number) {
    arrastreRealRef.current = valor;
    if (rafIdRef.current !== null) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      setArrastrePx(arrastreRealRef.current);
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    log("down", { id: e.pointerId, tipo: e.pointerType, x: e.clientX, y: e.clientY });
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (debeIgnorarGesto(e.target)) {
      log("down ignorado por debeIgnorarGesto");
      return;
    }
    // Si llega un toque nuevo mientras el carril todavía se estaba
    // acomodando de un cambio anterior, se corta esa animación ya mismo y el
    // gesto nuevo arranca desde la posición REAL en la que iba (nunca desde
    // 0): `arrastreRealRef` ya tiene ese valor exacto.
    cancelarAnimacion();
    gestoRef.current = {
      decidido: null,
      inicioX: e.clientX,
      inicioY: e.clientY,
      origenPx: arrastreRealRef.current,
      scrollInicial: window.scrollY,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gestoRef.current;
    if (!g) {
      log("move sin gesto activo (ignorado)", { id: e.pointerId, x: e.clientX, y: e.clientY });
      return;
    }
    const dx = e.clientX - g.inicioX;
    const dy = e.clientY - g.inicioY;
    log("move", { id: e.pointerId, x: e.clientX, y: e.clientY, dx, dy, decidido: g.decidido });

    if (g.decidido === null) {
      if (Math.abs(dx) < UMBRAL_DECISION_PX && Math.abs(dy) < UMBRAL_DECISION_PX) return;
      g.decidido = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      log("eje decidido:", g.decidido, { dx, dy });
      // Se intenta capturar en e.target (el elemento que realmente recibió
      // el toque) — es lo estándar. Si por lo que sea esa captura se pierde
      // antes de tiempo, onLostPointerCapture (más abajo) rescata el gesto
      // en vez de dejarlo trabado para siempre.
      try {
        (e.target as Element)?.setPointerCapture?.(e.pointerId);
        log("setPointerCapture OK sobre", e.target);
      } catch (err) {
        log("setPointerCapture FALLÓ", err);
      }
    }

    if (g.decidido === "vertical") {
      // `touch-action: none` (ver el contenedor) le pide al navegador que
      // NUNCA haga scroll nativo acá — a propósito: con "pan-y", el
      // reconocedor de gestos de Android decidía el eje POR SU CUENTA, en
      // paralelo a nuestra propia decisión, y si más tarde entendía "esto es
      // un scroll vertical" cancelaba el gesto de golpe (pointercancel) au
      // que ya lo hubiéramos decidido horizontal — eso era exactamente la
      // vista volviendo sola al origen con el dedo todavía apoyado. Sin
      // scroll nativo posible, el scroll vertical hay que hacerlo a mano.
      e.preventDefault();
      window.scrollTo({ top: g.scrollInicial - dy, behavior: "auto" });
      return;
    }
    if (g.decidido !== "horizontal") return;

    e.preventDefault();
    const ancho = anchoContenedor;
    let offset = g.origenPx + dx;
    if (ancho > 0) offset = Math.max(-ancho, Math.min(ancho, offset));
    if (indiceActivo === 0) offset = Math.min(offset, 0);
    if (indiceActivo === PANTALLAS_PRINCIPALES.length - 1) offset = Math.max(offset, 0);
    programarArrastre(offset);
  }

  // Decide a qué pantalla acomodarse a partir del arrastre REAL acumulado
  // (`arrastreRealRef`), no solo del último tramo del gesto — así, si un
  // gesto anterior se interrumpió a mitad de camino, ese avance ya hecho
  // cuenta para el umbral, en vez de perderse.
  function finalizarGesto() {
    const ancho = anchoContenedor;
    const offsetFinal = arrastreRealRef.current;
    // 30% del ancho, no 50%: con la mitad de la pantalla como umbral, un
    // deslizamiento normal (no exagerado) siempre quedaba por debajo y
    // volvía a su lugar — se sentía como si "no pasara nada". Bajado un 10%
    // más (0.27) a pedido, para que haga falta todavía menos recorrido.
    const umbral = ancho * 0.27;
    let nuevoIndice = indiceActivo;
    if (ancho > 0 && Math.abs(offsetFinal) > umbral) {
      nuevoIndice = offsetFinal > 0 ? indiceActivo - 1 : indiceActivo + 1;
      nuevoIndice = Math.max(0, Math.min(PANTALLAS_PRINCIPALES.length - 1, nuevoIndice));
    }
    const cambia = nuevoIndice !== indiceActivo;
    const destino = ancho > 0 && cambia ? (nuevoIndice > indiceActivo ? -ancho : ancho) : 0;
    log("finalizarGesto", { ancho, offsetFinal, umbral, indiceActivo, nuevoIndice, cambia, destino });
    animarHacia(destino, () => {
      asentarEn(nuevoIndice);
      if (cambia) {
        window.scrollTo({ top: 0 });
        const pantalla = PANTALLAS_PRINCIPALES[nuevoIndice];
        if (pantalla && pathname !== pantalla.href) router.replace(pantalla.href, { scroll: false });
      }
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    log("up", { id: e.pointerId, decidido: gestoRef.current?.decidido ?? null });
    const g = gestoRef.current;
    gestoRef.current = null;
    if (!g || g.decidido !== "horizontal") return;
    finalizarGesto();
  }

  function onPointerCancel(e: React.PointerEvent) {
    log("cancel", { id: e.pointerId, decidido: gestoRef.current?.decidido ?? null });
    const eraArrastreHorizontal = gestoRef.current?.decidido === "horizontal";
    gestoRef.current = null;
    if (eraArrastreHorizontal) finalizarGesto();
  }

  // Red de seguridad final: si por lo que sea se pierde la captura del
  // puntero sin que llegue un pointerup/pointercancel antes (algunos
  // WebView de Android lo hacen al mostrar un menú contextual, seleccionar
  // texto, etc.), este evento SIEMPRE llega. Sin esto, el arrastre se queda
  // congelado a mitad de camino para siempre, esperando un pointerup que
  // nunca va a llegar.
  function onLostPointerCapture(e: React.PointerEvent) {
    log("lostPointerCapture", { id: e.pointerId, decidido: gestoRef.current?.decidido ?? null });
    const eraArrastreHorizontal = gestoRef.current?.decidido === "horizontal";
    gestoRef.current = null;
    if (eraArrastreHorizontal) finalizarGesto();
  }

  function irA(ruta: string, filtroInicial?: FiltroPantalla) {
    const esPantallaDelCarrusel = PANTALLAS_PRINCIPALES.some((p) => p.href === ruta);
    if (filtroInicial) setFiltroPendiente({ href: ruta, filtro: filtroInicial, nonce: Date.now() });
    if (esPantallaDelCarrusel) router.replace(ruta, { scroll: false });
    else router.push(ruta);
  }

  // --- Todo lo visual sale de acá, recalculado en cada render. La ventana
  // montada depende SOLO de `indiceActivo`, que a su vez solo cambia cuando
  // ya no hay ninguna animación corriendo (ver el comentario grande arriba).
  const montados = indicesAMontar(indiceActivo);
  const posicionActivaEnTrack = montados.indexOf(indiceActivo);
  const progreso = anchoContenedor > 0 ? -arrastrePx / anchoContenedor : 0;
  const centro = posicionActivaEnTrack - progreso;
  const transform = `translate3d(${-posicionActivaEnTrack * anchoContenedor + arrastrePx}px, 0, 0)`;
  // Sin gesto ni animación en curso, las vecinas quedan totalmente fuera de
  // la vista (traducidas un ancho entero para cualquier lado) — atenuarlas
  // igual con opacity < 1 las obliga a componerse en una capa GPU aparte y
  // translúcida, y esa capa dejaba asomar una línea de su contenido justo en
  // el borde de la pantalla activa (el "Efectivo" de Vender sobre Inicio).
  // El difuminado sólo tiene sentido, y sólo se aplica, mientras se ve la
  // transición en vivo.
  const enMovimiento = gestoRef.current !== null || rafIdRef.current !== null;

  return (
    <PagerContext.Provider value={{ indiceActivo, progreso, irA }}>
      <div
        ref={contenedorRef}
        className="relative overflow-x-hidden"
        // "none", no "pan-y": con "pan-y" el reconocedor de gestos nativo de
        // Android decide el eje por su cuenta, en paralelo a nuestra propia
        // decisión en JS, y puede cancelar el gesto de golpe (pointercancel)
        // aunque ya lo hayamos decidido horizontal — eso causaba que la
        // vista volviera sola al origen con el dedo todavía apoyado. Con
        // "none" el navegador nunca hace scroll nativo acá; el scroll
        // vertical se hace a mano en onPointerMove cuando el gesto se decide
        // vertical (ver más abajo).
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        onGotPointerCapture={(e) => log("gotPointerCapture", { id: e.pointerId })}
      >
        <div
          className="flex items-start"
          style={{ transform, willChange: gestoRef.current || rafIdRef.current !== null ? "transform" : "auto" }}
        >
          {montados.map((indice) => {
            const pantalla = PANTALLAS_PRINCIPALES[indice];
            const conFiltro = filtroPendiente?.href === pantalla.href ? filtroPendiente : null;
            const posicionEnTrack = montados.indexOf(indice);
            const opacidad = enMovimiento ? 1 - 0.15 * Math.min(1, Math.abs(posicionEnTrack - centro)) : 1;
            return (
              <div key={pantalla.href} className="w-full shrink-0 overflow-hidden" style={{ opacity: opacidad }}>
                <pantalla.Componente key={conFiltro ? conFiltro.nonce : "base"} filtroInicial={conFiltro?.filtro} />
              </div>
            );
          })}
        </div>
      </div>
    </PagerContext.Provider>
  );
}
