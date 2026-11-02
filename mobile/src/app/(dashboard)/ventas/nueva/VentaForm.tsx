"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buscarProductosVenta,
  crearProductoRapido,
  crearVenta,
  type EstadoVentaForm,
  type ProductoBusquedaVenta,
} from "@/actions/ventas.actions";
import { crearClienteRapido } from "@/actions/clientes.actions";
import { centavosATexto, centavosATextoEditable, textoACentavos } from "@/lib/money";
import { textoAUnidadesMinimas } from "@/lib/stock";
import { inicioDelDia, textoAFecha } from "@/lib/dates";
import type { FormaPago } from "@/lib/constants";
import { IconAlertaTriangulo, IconBuscar } from "@/components/ui/icons";
import { SelectorServicios } from "./SelectorServicios";
import {
  borrarBorrador,
  guardarBorradorConDemora,
  type BorradorVenta,
  type ServicioBorrador,
} from "@/lib/borradorVenta";
import { useTipoNegocio } from "@/lib/tipoNegocio";

const ESTADO_INICIAL: EstadoVentaForm = {};

const clasesInput =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100";

type ItemCarrito = {
  productoId: number;
  nombre: string;
  unidadMedida: string;
  factorConversion: number;
  precioVenta: number;
  stockActual: number;
  proximoVencimiento: string | null;
  cantidadTexto: string;
  descuentoTexto: string;
  // Se calcula una sola vez al agregarlo (ver agregarAlCarrito): si el lote
  // que se despacharía (FEFO) ya estaba vencido en ese momento.
  vencido?: boolean;
};

// El lote que se despacharía (FEFO) para este producto ya venció. Vender
// stock vencido está permitido a propósito (el dueño puede tener ese stock
// físicamente en la tienda), pero si el producto es perecedero se avisa
// antes de agregarlo — si no es perecedero, alcanza con una nota discreta.
function loteVencido(proximoVencimiento: string | null): boolean {
  if (!proximoVencimiento) return false;
  try {
    return textoAFecha(proximoVencimiento) < inicioDelDia(new Date());
  } catch {
    return false;
  }
}

type ClienteOpcion = { id: number; nombre: string };

export type ServicioOpcion = { id: number; nombre: string; precio: number; duracionMinutos: number | null };

type ItemServicio = ServicioBorrador;

function calcularBrutoServicio(item: ItemServicio): number {
  try {
    const cantidad = Number(item.cantidadTexto.trim().replace(",", "."));
    if (!Number.isInteger(cantidad) || cantidad <= 0) return 0;
    return textoACentavos(item.precioTexto) * cantidad;
  } catch {
    return 0;
  }
}

function calcularDescuentoServicio(item: ItemServicio): number {
  if (!item.descuentoTexto.trim()) return 0;
  try {
    return textoACentavos(item.descuentoTexto);
  } catch {
    return 0;
  }
}

const FORMAS: { valor: FormaPago; etiqueta: React.ReactNode }[] = [
  { valor: "EFECTIVO", etiqueta: "Efectivo" },
  // Abreviado en dos líneas (igual que el diseño de referencia): en una sola
  // línea "Transferencia/QR" no entra en el tercio de la fila.
  {
    valor: "TRANSFERENCIA_QR",
    etiqueta: (
      <>
        Transf.
        <br />
        QR
      </>
    ),
  },
  { valor: "CREDITO", etiqueta: "Crédito" },
];

type Props = {
  clientes: ClienteOpcion[];
  servicios: ServicioOpcion[];
  serviciosFrecuentes: ServicioOpcion[];
  simbolo: string;
  borradorInicial?: BorradorVenta | null;
};

function calcularBruto(item: ItemCarrito): number {
  try {
    const cantidad = textoAUnidadesMinimas(item.cantidadTexto, item.factorConversion);
    return Math.round((item.precioVenta * cantidad) / item.factorConversion);
  } catch {
    return 0;
  }
}

function calcularDescuentoItem(item: ItemCarrito): number {
  if (!item.descuentoTexto.trim()) return 0;
  try {
    return textoACentavos(item.descuentoTexto);
  } catch {
    return 0;
  }
}

export function VentaForm({ clientes, servicios, serviciosFrecuentes, simbolo, borradorInicial }: Props) {
  const router = useRouter();
  const { tipo, textos } = useTipoNegocio();
  const modoServicios = tipo === "servicios";
  const [estado, formAction, enviando] = useActionState(crearVenta, ESTADO_INICIAL);

  // Atención (modo servicios): servicios elegidos, con precio editable.
  const [serviciosCarrito, setServiciosCarrito] = useState<ItemServicio[]>(() => borradorInicial?.servicios ?? []);
  const [nota, setNota] = useState(() => borradorInicial?.nota ?? "");
  const [mostrarServicios, setMostrarServicios] = useState(false);

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ProductoBusquedaVenta[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [carrito, setCarrito] = useState<ItemCarrito[]>(() => borradorInicial?.carrito ?? []);
  const [productoPendienteVencido, setProductoPendienteVencido] = useState<ProductoBusquedaVenta | null>(null);
  const [clienteId, setClienteId] = useState(() => borradorInicial?.clienteId ?? "");
  const [formaPago, setFormaPago] = useState<FormaPago>(() => borradorInicial?.formaPago ?? "EFECTIVO");
  const [descuentoTotalTexto, setDescuentoTotalTexto] = useState(() => borradorInicial?.descuentoTotalTexto ?? "");
  const confirmarExcesoRef = useRef<HTMLInputElement>(null);

  const [clientesLista, setClientesLista] = useState<ClienteOpcion[]>(clientes);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState("");
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState("");
  const [nuevoClienteLimite, setNuevoClienteLimite] = useState("");
  const [errorNuevoCliente, setErrorNuevoCliente] = useState<string | null>(null);
  const [creandoCliente, iniciarCreacionCliente] = useTransition();

  const [mostrarNuevoProducto, setMostrarNuevoProducto] = useState(false);
  const [nuevoProductoNombre, setNuevoProductoNombre] = useState("");
  const [nuevoProductoPrecio, setNuevoProductoPrecio] = useState("");
  const [errorNuevoProducto, setErrorNuevoProducto] = useState<string | null>(null);
  const [creandoProducto, iniciarCreacionProducto] = useTransition();

  // En modo servicios los productos van en segundo plano: el buscador se
  // abre a pedido (o ya abierto si la atención tiene productos).
  const [mostrarProductos, setMostrarProductos] = useState(() => (borradorInicial?.carrito.length ?? 0) > 0);
  const buscadorProductosVisible = !modoServicios || mostrarProductos || carrito.length > 0;

  useEffect(() => {
    if (estado.id) {
      borrarBorrador();
      router.replace(`/ventas/detalle?id=${estado.id}`);
    }
  }, [estado, router]);

  // Venta a medio registrar: se guarda en el dispositivo para no perderla al
  // cambiar de pantalla (swipe) ni si el sistema interrumpe la app.
  useEffect(() => {
    guardarBorradorConDemora({
      carrito,
      clienteId,
      formaPago,
      descuentoTotalTexto,
      servicios: serviciosCarrito,
      nota,
    });
  }, [carrito, clienteId, formaPago, descuentoTotalTexto, serviciosCarrito, nota]);

  function vaciarCarrito() {
    setCarrito([]);
    setServiciosCarrito([]);
    setNota("");
    setClienteId("");
    setFormaPago("EFECTIVO");
    setDescuentoTotalTexto("");
    borrarBorrador();
  }

  useEffect(() => {
    // Si cambia el cliente o el carrito, cualquier confirmación de exceso de
    // crédito anterior queda obsoleta.
    if (confirmarExcesoRef.current) confirmarExcesoRef.current.value = "";
  }, [clienteId, carrito, serviciosCarrito]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const id = setTimeout(() => {
      buscarProductosVenta(q).then((r) => {
        setResultados(r);
        setBuscando(false);
      });
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  function agregarAlCarrito(producto: ProductoBusquedaVenta) {
    setCarrito((prev) => {
      const existente = prev.find((item) => item.productoId === producto.id);
      if (!existente) {
        return [
          ...prev,
          {
            productoId: producto.id,
            nombre: producto.nombre,
            unidadMedida: producto.unidadMedida,
            factorConversion: producto.factorConversion,
            precioVenta: producto.precioVenta,
            stockActual: producto.stockActual,
            proximoVencimiento: producto.proximoVencimiento,
            cantidadTexto: "1",
            descuentoTexto: "",
            vencido: loteVencido(producto.proximoVencimiento),
          },
        ];
      }
      const valorActual = Number(existente.cantidadTexto.replace(",", ".")) || 0;
      return prev.map((item) =>
        item.productoId === producto.id ? { ...item, cantidadTexto: String(valorActual + 1) } : item,
      );
    });
    setQuery("");
    setResultados([]);
    setMostrarNuevoProducto(false);
  }

  // Punto de entrada real al tocar un resultado de búsqueda: si el lote que
  // se despacharía ya venció y el producto es perecedero, primero hay que
  // confirmar (advertencia clara). Si no es perecedero, se agrega directo —
  // el aviso "Vencido" queda como nota discreta en la fila del carrito.
  function agregarProducto(producto: ProductoBusquedaVenta) {
    if (loteVencido(producto.proximoVencimiento) && producto.perecedero) {
      setProductoPendienteVencido(producto);
      setResultados([]);
      return;
    }
    agregarAlCarrito(producto);
  }

  function confirmarAgregarVencido() {
    if (!productoPendienteVencido) return;
    agregarAlCarrito(productoPendienteVencido);
    setProductoPendienteVencido(null);
  }

  function abrirNuevoProducto() {
    setNuevoProductoNombre(query.trim());
    setNuevoProductoPrecio("");
    setErrorNuevoProducto(null);
    setMostrarNuevoProducto(true);
  }

  function confirmarNuevoProducto() {
    setErrorNuevoProducto(null);
    iniciarCreacionProducto(async () => {
      const resultado = await crearProductoRapido(nuevoProductoNombre, nuevoProductoPrecio);
      if (resultado.error) {
        setErrorNuevoProducto(resultado.error);
        return;
      }
      if (resultado.producto) {
        agregarProducto(resultado.producto);
      }
    });
  }

  function confirmarNuevoCliente() {
    setErrorNuevoCliente(null);
    iniciarCreacionCliente(async () => {
      const resultado = await crearClienteRapido(nuevoClienteNombre, nuevoClienteTelefono, nuevoClienteLimite);
      if (resultado.error) {
        setErrorNuevoCliente(resultado.error);
        return;
      }
      if (resultado.cliente) {
        const nuevo = resultado.cliente;
        setClientesLista((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
        setClienteId(String(nuevo.id));
        setMostrarNuevoCliente(false);
        setNuevoClienteNombre("");
        setNuevoClienteTelefono("");
        setNuevoClienteLimite("");
      }
    });
  }

  function agregarServicio(servicio: ServicioOpcion) {
    setServiciosCarrito((prev) => {
      const existente = prev.find((item) => item.servicioId === servicio.id);
      if (!existente) {
        return [
          ...prev,
          {
            servicioId: servicio.id,
            nombre: servicio.nombre,
            precioSugerido: servicio.precio,
            precioTexto: centavosATextoEditable(servicio.precio),
            cantidadTexto: "1",
            descuentoTexto: "",
          },
        ];
      }
      const valorActual = Number(existente.cantidadTexto) || 0;
      return prev.map((item) =>
        item.servicioId === servicio.id ? { ...item, cantidadTexto: String(valorActual + 1) } : item,
      );
    });
  }

  function actualizarServicio(servicioId: number, cambios: Partial<ItemServicio>) {
    setServiciosCarrito((prev) => prev.map((item) => (item.servicioId === servicioId ? { ...item, ...cambios } : item)));
  }

  function quitarServicio(servicioId: number) {
    setServiciosCarrito((prev) => prev.filter((item) => item.servicioId !== servicioId));
  }

  function actualizarItem(productoId: number, cambios: Partial<ItemCarrito>) {
    setCarrito((prev) => prev.map((item) => (item.productoId === productoId ? { ...item, ...cambios } : item)));
  }

  function quitarItem(productoId: number) {
    setCarrito((prev) => prev.filter((item) => item.productoId !== productoId));
  }

  const hayDescuentoPorItem =
    carrito.some((item) => calcularDescuentoItem(item) > 0) ||
    serviciosCarrito.some((item) => calcularDescuentoServicio(item) > 0);
  const hayDescuentoTotal = descuentoTotalTexto.trim() !== "" && descuentoTotalTexto.trim() !== "0";

  const subtotalVenta = useMemo(
    () =>
      carrito.reduce((acc, item) => acc + calcularBruto(item), 0) +
      serviciosCarrito.reduce((acc, item) => acc + calcularBrutoServicio(item), 0),
    [carrito, serviciosCarrito],
  );
  const descuentoFinal = useMemo(() => {
    if (hayDescuentoTotal) {
      try {
        return textoACentavos(descuentoTotalTexto);
      } catch {
        return 0;
      }
    }
    return (
      carrito.reduce((acc, item) => acc + calcularDescuentoItem(item), 0) +
      serviciosCarrito.reduce((acc, item) => acc + calcularDescuentoServicio(item), 0)
    );
  }, [carrito, serviciosCarrito, descuentoTotalTexto, hayDescuentoTotal]);
  const total = Math.max(0, subtotalVenta - descuentoFinal);

  const itemsJson = JSON.stringify(
    carrito.map((item) => ({
      productoId: item.productoId,
      cantidadTexto: item.cantidadTexto,
      descuentoTexto: item.descuentoTexto,
    })),
  );

  const serviciosJson = JSON.stringify(
    serviciosCarrito.map((item) => ({
      servicioId: item.servicioId,
      precioTexto: item.precioTexto,
      cantidadTexto: item.cantidadTexto,
      descuentoTexto: item.descuentoTexto,
    })),
  );

  const faltaClienteParaCredito = formaPago === "CREDITO" && !clienteId;
  const hayAlgo = carrito.length > 0 || serviciosCarrito.length > 0;
  const puedeEnviar = hayAlgo && !faltaClienteParaCredito && !enviando;
  const sinResultados = query.trim() !== "" && !buscando && resultados.length === 0;

  // Servicios: en modo servicios van primero y siempre visibles; en modo
  // tienda, en segundo plano detrás de "+ Agregar servicio" (igual que los
  // productos en modo servicios).
  const selectorServiciosVisible = modoServicios || mostrarServicios || serviciosCarrito.length > 0;
  const bloqueServicios = (
    <>
      {selectorServiciosVisible ? (
        <div>
          <label className="block text-sm font-medium text-slate-700">Servicios</label>
          <div className="mt-1">
            <SelectorServicios
              servicios={servicios}
              frecuentes={serviciosFrecuentes}
              simbolo={simbolo}
              onElegir={agregarServicio}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setMostrarServicios(true)}
          className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          + Agregar servicio
        </button>
      )}

        {serviciosCarrito.length > 0 && (
          <div data-swipe-ignorar="true">
            <span className="text-sm font-medium text-slate-700">
              Servicios elegidos ({serviciosCarrito.length})
            </span>
            <ul className="mt-2 space-y-2">
              {serviciosCarrito.map((item) => (
                <li key={item.servicioId} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium text-slate-900">{item.nombre}</p>
                    <button
                      type="button"
                      onClick={() => quitarServicio(item.servicioId)}
                      className="shrink-0 text-xs font-medium text-danger-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="flex flex-col justify-end">
                      <label className="block text-xs text-slate-500">Precio</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.precioTexto}
                        onChange={(e) => actualizarServicio(item.servicioId, { precioTexto: e.target.value })}
                        className={`mt-1 ${clasesInput}`}
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="block text-xs text-slate-500">Cantidad</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.cantidadTexto}
                        onChange={(e) => actualizarServicio(item.servicioId, { cantidadTexto: e.target.value })}
                        className={`mt-1 ${clasesInput}`}
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <label className="block text-xs text-slate-500">Descuento</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={item.descuentoTexto}
                        disabled={hayDescuentoTotal}
                        onChange={(e) => actualizarServicio(item.servicioId, { descuentoTexto: e.target.value })}
                        className={`mt-1 ${clasesInput} disabled:bg-slate-100 disabled:text-slate-400`}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-right text-sm font-medium text-slate-900">
                    {centavosATexto(calcularBrutoServicio(item) - calcularDescuentoServicio(item), simbolo)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
    </>
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="itemsJson" value={itemsJson} readOnly />
      <input type="hidden" name="serviciosJson" value={serviciosJson} readOnly />
      <input type="hidden" name="confirmarExcesoCredito" ref={confirmarExcesoRef} defaultValue="" />

      {modoServicios && bloqueServicios}

      {!buscadorProductosVisible && (
        <button
          type="button"
          onClick={() => setMostrarProductos(true)}
          className="w-full rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          + Agregar producto
        </button>
      )}

      {buscadorProductosVisible && (
      <>
      <div className="relative">
        <label className="block text-sm font-medium text-slate-700">Buscar producto</label>
        <div className="relative mt-1">
          <IconBuscar className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-primary-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMostrarNuevoProducto(false);
            }}
            placeholder="Código o nombre del producto"
            className={`${clasesInput} pl-9`}
          />
        </div>
        {resultados.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full space-y-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            {resultados.map((producto) => {
              const vencido = loteVencido(producto.proximoVencimiento);
              return (
                <li key={producto.id}>
                  <button
                    type="button"
                    onClick={() => agregarProducto(producto)}
                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
                  >
                    <span className="min-w-0 truncate">
                      {producto.nombre}
                      {producto.proximoVencimiento && (
                        <span className={`block text-xs ${vencido ? "font-medium text-danger-600" : "text-slate-400"}`}>
                          {vencido ? "Vencido " : "Vence "}
                          {producto.proximoVencimiento}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-slate-600">
                      {centavosATexto(producto.precioVenta, simbolo)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {productoPendienteVencido && (
          <div className="absolute z-10 mt-1 w-full space-y-2 rounded-lg border border-danger-600 bg-white p-3 shadow-lg">
            <p className="flex items-center gap-2 text-sm font-medium text-danger-600">
              <IconAlertaTriangulo className="h-4 w-4 shrink-0" />
              &quot;{productoPendienteVencido.nombre}&quot; tiene el lote vencido desde el{" "}
              {productoPendienteVencido.proximoVencimiento}.
            </p>
            <p className="text-xs text-slate-500">Es perecedero: confirma que quieres venderlo igual.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmarAgregarVencido}
                className="flex-1 rounded-lg border border-danger-600 px-3 py-2 text-sm font-medium text-danger-600 hover:bg-red-50"
              >
                Agregar igual
              </button>
              <button
                type="button"
                onClick={() => setProductoPendienteVencido(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {sinResultados && !mostrarNuevoProducto && (
          <div className="absolute z-10 mt-1 w-full space-y-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            <p className="text-sm text-slate-500">No se encontró ningún producto.</p>
            <button
              type="button"
              onClick={abrirNuevoProducto}
              className="w-full rounded-lg border border-primary-500 px-3 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
            >
              + Crear &quot;{query.trim()}&quot;
            </button>
          </div>
        )}

        {mostrarNuevoProducto && (
          <div className="absolute z-10 mt-1 w-full space-y-2 rounded-lg border border-primary-500 bg-white p-3 shadow-lg">
            <p className="text-sm font-medium text-slate-700">Nuevo producto</p>
            <div>
              <label className="block text-xs text-slate-500">Nombre</label>
              <input
                type="text"
                value={nuevoProductoNombre}
                onChange={(e) => setNuevoProductoNombre(e.target.value)}
                className={`mt-1 ${clasesInput}`}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500">Precio de venta</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={nuevoProductoPrecio}
                onChange={(e) => setNuevoProductoPrecio(e.target.value)}
                className={`mt-1 ${clasesInput}`}
              />
            </div>
            {errorNuevoProducto && <p className="text-xs text-danger-600">{errorNuevoProducto}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmarNuevoProducto}
                disabled={creandoProducto}
                className="flex-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
              >
                {creandoProducto ? "Creando..." : "Crear y agregar"}
              </button>
              <button
                type="button"
                onClick={() => setMostrarNuevoProducto(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
            <p className="text-xs text-slate-400">
              El resto de los datos (categoría, precio de compra, stock mínimo...) los puedes completar
              después desde la ficha del producto.
            </p>
          </div>
        )}
      </div>

      <div data-swipe-ignorar="true">
      {carrito.length === 0 ? (
        !modoServicios && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Todavía no agregaste productos.</p>
        )
      ) : (
        <>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Carrito ({carrito.length} producto{carrito.length === 1 ? "" : "s"})
          </span>
          <button
            type="button"
            onClick={vaciarCarrito}
            className="text-xs font-medium text-danger-600 hover:underline"
          >
            Vaciar
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {carrito.map((item) => (
            <li key={item.productoId} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{item.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {centavosATexto(item.precioVenta, simbolo)} / {item.unidadMedida}
                    {item.proximoVencimiento && (
                      <span className={item.vencido ? "font-medium text-danger-600" : "text-slate-400"}>
                        {" "}
                        · {item.vencido ? "vencido desde" : "vence"} {item.proximoVencimiento}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => quitarItem(item.productoId)}
                  className="shrink-0 text-xs font-medium text-danger-600 hover:underline"
                >
                  Quitar
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="flex flex-col justify-end">
                  <label className="block text-xs text-slate-500">Cantidad ({item.unidadMedida})</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.cantidadTexto}
                    onChange={(e) => actualizarItem(item.productoId, { cantidadTexto: e.target.value })}
                    className={`mt-1 ${clasesInput}`}
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="block text-xs text-slate-500">Descuento (opcional)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={item.descuentoTexto}
                    disabled={hayDescuentoTotal}
                    onChange={(e) => actualizarItem(item.productoId, { descuentoTexto: e.target.value })}
                    className={`mt-1 ${clasesInput} disabled:bg-slate-100 disabled:text-slate-400`}
                  />
                </div>
              </div>

              <p className="mt-1 text-right text-sm font-medium text-slate-900">
                {centavosATexto(calcularBruto(item) - calcularDescuentoItem(item), simbolo)}
              </p>
            </li>
          ))}
        </ul>
        </>
      )}
      </div>
      </>
      )}

      {!modoServicios && bloqueServicios}

      {modoServicios && hayAlgo && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={vaciarCarrito}
            className="text-xs font-medium text-danger-600 hover:underline"
          >
            Empezar de nuevo
          </button>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-700">Cliente</label>
          {formaPago === "CREDITO" && !mostrarNuevoCliente && (
            <button
              type="button"
              onClick={() => {
                setMostrarNuevoCliente(true);
                setErrorNuevoCliente(null);
              }}
              className="text-xs font-medium text-primary-700 hover:underline"
            >
              + Nuevo cliente
            </button>
          )}
        </div>
        <select
          name="clienteId"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className={`mt-1 ${clasesInput}`}
        >
          <option value="">Cliente ocasional (sin registrar)</option>
          {clientesLista.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre}
            </option>
          ))}
        </select>

        {mostrarNuevoCliente && (
          <div className="mt-2 space-y-2 rounded-lg border border-primary-500 bg-white p-3">
            <p className="text-sm font-medium text-slate-700">Nuevo cliente</p>
            <div>
              <label className="block text-xs text-slate-500">Nombre</label>
              <input
                type="text"
                value={nuevoClienteNombre}
                onChange={(e) => setNuevoClienteNombre(e.target.value)}
                className={`mt-1 ${clasesInput}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col justify-end">
                <label className="block text-xs text-slate-500">Teléfono (opcional)</label>
                <input
                  type="text"
                  value={nuevoClienteTelefono}
                  onChange={(e) => setNuevoClienteTelefono(e.target.value)}
                  className={`mt-1 ${clasesInput}`}
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="block text-xs text-slate-500">Límite de crédito</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={nuevoClienteLimite}
                  onChange={(e) => setNuevoClienteLimite(e.target.value)}
                  className={`mt-1 ${clasesInput}`}
                />
              </div>
            </div>
            {errorNuevoCliente && <p className="text-xs text-danger-600">{errorNuevoCliente}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmarNuevoCliente}
                disabled={creandoCliente}
                className="flex-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-60"
              >
                {creandoCliente ? "Creando..." : "Crear cliente"}
              </button>
              <button
                type="button"
                onClick={() => setMostrarNuevoCliente(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700">Forma de pago</legend>
        {/* pl-1.5: la primera píldora se inclina con -skew-x, así que su
            esquina inferior izquierda sobresale un poco de su propia caja
            (es el aspecto buscado). Sin este margen no le queda dónde
            sobresalir dentro de esta misma pantalla, y el recorte del
            carrusel (que evita que se cuele en la pantalla vecina) le corta
            la esquina de forma visible. */}
        <div className="mt-1 grid grid-cols-3 gap-2 pl-1.5">
          {FORMAS.map((opcion) => (
            <label
              key={opcion.valor}
              className={`flex min-w-0 -skew-x-[7deg] cursor-pointer items-center justify-center overflow-hidden rounded-lg border px-1 py-2 text-center text-xs font-medium ${
                formaPago === opcion.valor
                  ? "border-primary-500 bg-primary-50 text-primary-700"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="formaPago"
                value={opcion.valor}
                checked={formaPago === opcion.valor}
                onChange={() => setFormaPago(opcion.valor)}
                className="sr-only"
              />
              <span className="skew-x-[7deg] leading-tight">{opcion.etiqueta}</span>
            </label>
          ))}
        </div>
        {faltaClienteParaCredito && (
          <p className="mt-2 flex items-center gap-2 rounded-lg bg-danger-500/10 px-3 py-2 text-xs font-medium text-danger-600">
            <IconAlertaTriangulo className="h-4 w-4" /> Elige un cliente para{" "}
            {modoServicios ? "registrar a crédito" : "vender a crédito"}.
          </p>
        )}
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-slate-700">Descuento al total (opcional)</label>
        <input
          type="text"
          inputMode="decimal"
          name="descuentoTotalTexto"
          placeholder="0.00"
          value={descuentoTotalTexto}
          disabled={hayDescuentoPorItem}
          onChange={(e) => setDescuentoTotalTexto(e.target.value)}
          className={`mt-1 ${clasesInput} disabled:bg-slate-100 disabled:text-slate-400`}
        />
        {hayDescuentoPorItem && (
          <p className="mt-1 text-xs text-slate-500">
            Ya hay descuentos por producto: no se puede usar además un descuento al total.
          </p>
        )}
      </div>

      {(modoServicios || nota) && (
        <div>
          <label htmlFor="nota" className="block text-sm font-medium text-slate-700">
            Nota (opcional)
          </label>
          <textarea
            id="nota"
            name="nota"
            rows={2}
            maxLength={300}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={modoServicios ? "Ej: color 6.1, volver en 3 semanas" : ""}
            className={`mt-1 ${clasesInput}`}
          />
        </div>
      )}

      <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span>{centavosATexto(subtotalVenta, simbolo)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Descuento</span>
          <span>{centavosATexto(descuentoFinal, simbolo)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-slate-900">
          <span>Total</span>
          <span>{centavosATexto(total, simbolo)}</span>
        </div>
      </div>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600" role="alert">
          {estado.error}
        </p>
      )}

      {estado.requiereConfirmacion ? (
        <button
          type="submit"
          disabled={enviando}
          onClick={() => {
            if (confirmarExcesoRef.current) confirmarExcesoRef.current.value = "1";
          }}
          className="w-full rounded-lg border border-danger-600 px-4 py-2.5 font-medium text-danger-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          {enviando ? "Registrando..." : textos.confirmarIgual}
        </button>
      ) : (
        <button
          type="submit"
          disabled={!puedeEnviar}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {enviando ? "Registrando..." : textos.confirmarVenta}
        </button>
      )}
    </form>
  );
}
