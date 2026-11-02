"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { crearProducto, type EstadoFormularioProducto } from "@/actions/productos.actions";
import type { TipoVenta } from "@/lib/constants";
import { CampoFecha } from "@/components/forms/CampoFecha";
import { textoAFecha } from "@/lib/dates";
import {
  borrarBorradorProducto,
  guardarBorradorProductoConDemora,
  leerBorradorProducto,
  type BorradorProducto,
} from "@/lib/borradorProducto";
import { useAvisoSinGuardar } from "@/lib/botonAtras";

const ESTADO_INICIAL: EstadoFormularioProducto = {};

const clasesInput =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const clasesLabel = "block text-sm font-medium text-slate-700";

function esTipoVenta(valor: string | undefined): valor is TipoVenta {
  return valor === "UNIDAD" || valor === "PESO" || valor === "VOLUMEN";
}

function fechaDeBorrador(texto: string | undefined): Date | undefined {
  if (!texto) return undefined;
  try {
    return textoAFecha(texto);
  } catch {
    return undefined;
  }
}

export function NuevoProductoForm() {
  const router = useRouter();
  const [estado, formAction, enviando] = useActionState(crearProducto, ESTADO_INICIAL);
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>("UNIDAD");
  const [perecedero, setPerecedero] = useState(false);

  // Borrador: lo cargado hasta ahora se va guardando para que no se pierda
  // si Android cierra la app en segundo plano (ver lib/borradorProducto.ts). Los campos son no
  // controlados, así que el borrador entra como valor inicial y el
  // formulario se remonta (`version`) cada vez que hay que volver a pintarlo.
  const [valores, setValores] = useState<BorradorProducto | null>(null);
  const [version, setVersion] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const ultimoRef = useRef<BorradorProducto>({});
  const cargadoRef = useRef(false);
  const [hayCambios, setHayCambios] = useState(false);
  // El botón atrás de Android avisa antes de descartar lo escrito.
  useAvisoSinGuardar(hayCambios && !estado.id);

  function pintar(borrador: BorradorProducto) {
    ultimoRef.current = borrador;
    setValores(borrador);
    setTipoVenta(esTipoVenta(borrador.tipoVenta) ? borrador.tipoVenta : "UNIDAD");
    setPerecedero(borrador.perecedero === "on");
    setVersion((v) => v + 1);
  }

  useEffect(() => {
    leerBorradorProducto()
      .catch(() => null)
      .then((borrador) => {
        // El formulario vacío igual trae la fecha de hoy y "UNIDAD": solo
        // cuenta como borrador si el usuario llegó a escribir algo.
        const hayDatos =
          !!borrador &&
          Object.entries(borrador).some(
            ([clave, valor]) => valor !== "" && clave !== "tipoVenta" && clave !== "fechaVencimientoInicialTexto",
          );
        pintar(hayDatos ? borrador! : {});
        setHayCambios(hayDatos);
        cargadoRef.current = true;
      });
    // Salir de la pantalla a propósito descarta el borrador (igual que
    // siempre: volver a entrar empieza de cero). Minimizar la app no pasa por
    // acá — la pantalla queda montada — y si Android mata el proceso tampoco,
    // así que en ese caso el borrador sobrevive.
    return () => {
      if (cargadoRef.current) borrarBorradorProducto();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se lee recién en el próximo tick: los campos que dependen de un render
  // (el oculto de la fecha) todavía tienen el valor anterior durante el evento.
  function recordarCambios() {
    setHayCambios(true);
    setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const borrador: BorradorProducto = {};
      new FormData(form).forEach((valor, clave) => {
        if (typeof valor === "string") borrador[clave] = valor;
      });
      ultimoRef.current = borrador;
      guardarBorradorProductoConDemora(borrador);
    }, 0);
  }

  useEffect(() => {
    if (estado.id) {
      borrarBorradorProducto();
      router.replace("/productos");
    } else if (estado.error) {
      // Al terminar la acción React vacía el formulario: se vuelve a pintar
      // con lo último que había escrito.
      pintar(ultimoRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, router]);

  if (valores === null) return null;

  return (
    <form
      key={version}
      ref={formRef}
      action={formAction}
      onInput={recordarCambios}
      onChange={recordarCambios}
      className="space-y-4"
    >
      <div>
        <label htmlFor="nombre" className={clasesLabel}>
          Nombre del producto
        </label>
        <input
          id="nombre"
          name="nombre"
          type="text"
          required
          autoFocus={!valores.nombre}
          defaultValue={valores.nombre ?? ""}
          className={clasesInput}
        />
      </div>

      <div>
        <label htmlFor="categoria" className={clasesLabel}>
          Categoría
        </label>
        <input
          id="categoria"
          name="categoria"
          type="text"
          defaultValue={valores.categoria ?? ""}
          className={clasesInput}
        />
      </div>

      <fieldset>
        <legend className={clasesLabel}>¿Cómo se vende?</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(
            [
              { valor: "UNIDAD", etiqueta: "Por unidad" },
              { valor: "PESO", etiqueta: "Por peso (kg)" },
              { valor: "VOLUMEN", etiqueta: "Por volumen (litro)" },
            ] as const
          ).map((opcion) => (
            <label
              key={opcion.valor}
              className={`flex -skew-x-[7deg] cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-medium ${
                tipoVenta === opcion.valor
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="tipoVenta"
                value={opcion.valor}
                checked={tipoVenta === opcion.valor}
                onChange={() => setTipoVenta(opcion.valor)}
                className="sr-only"
              />
              <span className="skew-x-[7deg]">{opcion.etiqueta}</span>
            </label>
          ))}
        </div>
        {tipoVenta === "UNIDAD" ? (
          <div className="mt-2">
            <label htmlFor="unidadMedidaPersonalizada" className={clasesLabel}>
              ¿Cómo se llama la unidad? (opcional)
            </label>
            <input
              id="unidadMedidaPersonalizada"
              name="unidadMedidaPersonalizada"
              type="text"
              placeholder="unidad, paquete, caja, docena..."
              defaultValue={valores.unidadMedidaPersonalizada ?? ""}
              className={clasesInput}
            />
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Vas a poder vender fracciones, por ejemplo 0.5 {tipoVenta === "PESO" ? "kg" : "litro"}.
          </p>
        )}
      </fieldset>

      <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5">
        <input
          type="checkbox"
          name="perecedero"
          checked={perecedero}
          onChange={(e) => setPerecedero(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="text-sm text-slate-700">
          Es perecedero (tiene fecha de vencimiento, se maneja por lotes)
        </span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col justify-end">
          <label htmlFor="precioCompraTexto" className={clasesLabel}>
            Precio de compra
          </label>
          <input
            id="precioCompraTexto"
            name="precioCompraTexto"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={valores.precioCompraTexto ?? ""}
            required
            className={clasesInput}
          />
        </div>
        <div className="flex flex-col justify-end">
          <label htmlFor="precioVentaTexto" className={clasesLabel}>
            Precio de venta
          </label>
          <input
            id="precioVentaTexto"
            name="precioVentaTexto"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            defaultValue={valores.precioVentaTexto ?? ""}
            required
            className={clasesInput}
          />
        </div>
      </div>

      {/* Grid de 2 filas x 2 columnas (no dos <div> independientes): así las
          etiquetas quedan en la misma fila y los campos arrancan siempre a
          la misma altura, sin importar si una etiqueta ocupa más líneas
          que la otra ("Cantidad del primer lote" vs. "Stock mínimo"). */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <label htmlFor="stockInicialTexto" className={clasesLabel}>
          {perecedero ? "Cantidad del primer lote" : "Stock inicial"}
        </label>
        <label htmlFor="stockMinimoTexto" className={clasesLabel}>
          Stock mínimo
        </label>
        <input
          id="stockInicialTexto"
          name="stockInicialTexto"
          type="text"
          inputMode="decimal"
          placeholder="0"
          defaultValue={valores.stockInicialTexto ?? ""}
          className={`self-start ${clasesInput}`}
        />
        <input
          id="stockMinimoTexto"
          name="stockMinimoTexto"
          type="text"
          inputMode="decimal"
          placeholder="0"
          defaultValue={valores.stockMinimoTexto ?? ""}
          required
          className={`self-start ${clasesInput}`}
        />
      </div>

      {perecedero && (
        <div>
          <CampoFecha
            id="fechaVencimientoInicialTexto"
            name="fechaVencimientoInicialTexto"
            label="Vencimiento del primer lote"
            defaultValue={fechaDeBorrador(valores.fechaVencimientoInicialTexto)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Hace falta solo si cargás una cantidad en &quot;Cantidad del primer lote&quot;. Después vas a
            poder agregar más lotes desde la ficha del producto.
          </p>
        </div>
      )}

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
      >
        {enviando ? "Guardando..." : "Guardar producto"}
      </button>
    </form>
  );
}
