import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";
import { db } from "@/lib/db/client";
import { DIAS_ALERTA_VENCIMIENTO_DEFECTO } from "@/lib/constants";

// Recordatorio de alertas de inventario (stock bajo, vencidos, por vencer).
// La app no tiene servidor ni corre en segundo plano: lo que se programa es
// una notificación local repetida, con el texto calculado en el momento de
// programarla. Por eso se reprograma cada vez que la app se abre o se manda a
// segundo plano (ver el layout del dashboard), para que el texto no quede
// viejo.
export type UnidadRepeticion = "minuto" | "hora" | "dia";

export type ConfigNotificaciones = {
  activadas: boolean;
  unidad: UnidadRepeticion;
  /** Cada cuántos minutos u horas se repite (no se usa con "dia"). */
  cada: number;
  /** Hora del aviso diario, "HH:MM" (solo se usa con "dia"). */
  hora: string;
};

export const CONFIG_NOTIFICACIONES_DEFECTO: ConfigNotificaciones = {
  activadas: false,
  unidad: "dia",
  cada: 1,
  hora: "08:00",
};

const CLAVE = "notificaciones";
const ID_PRUEBA = 2;
// Los recordatorios usan ids desde acá en adelante (uno por aviso).
const ID_RECORDATORIO_BASE = 100;
// Cuántos avisos se dejan programados por adelantado al repetir por minutos
// u horas (ver armarRecordatorios). Se renuevan cada vez que se abre la app.
const AVISOS_POR_ADELANTADO = { minuto: 100, hora: 48 } as const;
const TITULO_RECORDATORIO = "MIP — Alertas de inventario";
// Banderín rojo de alerta, el mismo de la lista de productos (ver
// android/app/src/main/res/drawable/ic_stat_alerta.xml).
const ICONO = { smallIcon: "ic_stat_alerta", iconColor: "#E63A2E" } as const;

const esNativo = () => Capacitor.isNativePlatform();

export async function leerConfigNotificaciones(): Promise<ConfigNotificaciones> {
  const { value } = await Preferences.get({ key: CLAVE });
  if (!value) return CONFIG_NOTIFICACIONES_DEFECTO;
  try {
    return { ...CONFIG_NOTIFICACIONES_DEFECTO, ...JSON.parse(value) };
  } catch {
    return CONFIG_NOTIFICACIONES_DEFECTO;
  }
}

async function pedirPermiso(): Promise<boolean> {
  let { display } = await LocalNotifications.checkPermissions();
  if (display !== "granted") ({ display } = await LocalNotifications.requestPermissions());
  return display === "granted";
}

function plural(cantidad: number, singular: string, pluralTexto: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

// Texto del aviso según las alertas de este momento; null si no hay ninguna.
async function resumenAlertas(): Promise<string | null> {
  const ahora = new Date();
  const configuracion = await db.configuracion.findFirst();
  const diasAlerta = configuracion?.diasAlertaVencimiento ?? DIAS_ALERTA_VENCIMIENTO_DEFECTO;
  const [stockBajo, vencidos, porVencer] = await Promise.all([
    db.producto.contarStockBajo(),
    db.lote.contarProductosVencidos(ahora),
    db.lote.contarProductosPorVencer(ahora, diasAlerta),
  ]);

  const partes: string[] = [];
  if (stockBajo > 0) partes.push(`${plural(stockBajo, "producto", "productos")} con stock bajo`);
  if (vencidos > 0) partes.push(plural(vencidos, "vencido", "vencidos"));
  if (porVencer > 0) partes.push(`${porVencer} por vencer`);
  return partes.length > 0 ? partes.join(" · ") : null;
}

// Arma los avisos a programar.
//
// "Cada día" usa la repetición a hora fija del plugin (`on`), que se vuelve a
// armar sola después de cada aviso.
//
// Por minutos u horas NO se usa la repetición del plugin (`every`): en
// Android esa va por una alarma repetitiva inexacta, que el sistema agrupa y
// atrasa a su criterio (un "cada 1 minuto" puede tardar muchísimo o no verse
// nunca), y además reutiliza el mismo aviso sin volver a sonar. En su lugar
// se programa una tanda de avisos sueltos, cada uno con su hora exacta.
function armarRecordatorios(config: ConfigNotificaciones, texto: string): LocalNotificationSchema[] {
  if (config.unidad === "dia") {
    const [hora, minuto] = config.hora.split(":").map(Number);
    return [
      {
        id: ID_RECORDATORIO_BASE,
        title: TITULO_RECORDATORIO,
        body: texto,
        ...ICONO,
        schedule: { on: { hour: hora || 0, minute: minuto || 0 }, allowWhileIdle: true },
      },
    ];
  }

  const cada = Math.max(1, Math.floor(config.cada) || 1);
  const intervaloMs = cada * (config.unidad === "minuto" ? 60_000 : 3_600_000);
  const ahora = Date.now();
  return Array.from({ length: AVISOS_POR_ADELANTADO[config.unidad] }, (_, i) => ({
    id: ID_RECORDATORIO_BASE + i,
    title: TITULO_RECORDATORIO,
    body: texto,
    ...ICONO,
    schedule: { at: new Date(ahora + intervaloMs * (i + 1)), allowWhileIdle: true },
  }));
}

async function reprogramar(): Promise<void> {
  const config = await leerConfigNotificaciones();

  const { notifications: pendientes } = await LocalNotifications.getPending();
  const recordatorios = pendientes.filter((n) => n.id !== ID_PRUEBA).map((n) => ({ id: n.id }));
  if (recordatorios.length > 0) await LocalNotifications.cancel({ notifications: recordatorios });
  if (!config.activadas) return;

  const { display } = await LocalNotifications.checkPermissions();
  if (display !== "granted") return;

  const resumen = await resumenAlertas();
  if (!resumen) return;

  await LocalNotifications.schedule({ notifications: armarRecordatorios(config, resumen) });
}

// Cancela lo programado y, si las notificaciones están activadas y hay
// alguna alerta, lo vuelve a programar con el texto al día. Las llamadas se
// encadenan: dos a la vez (abrir la app y guardar en Ajustes) se pisarían
// entre el cancelar de una y el programar de la otra.
let enCurso: Promise<void> = Promise.resolve();

export function reprogramarNotificaciones(): Promise<void> {
  if (!esNativo()) return Promise.resolve();
  enCurso = enCurso.catch(() => {}).then(reprogramar);
  return enCurso;
}

// Avisa cuando el usuario toca una notificación de MIP (también si con ese
// toque se abrió la app: el plugin lo retiene hasta que alguien escucha).
// Devuelve la función para dejar de escuchar.
export function alTocarNotificacion(escuchar: () => void): () => void {
  if (!esNativo()) return () => {};
  const listener = LocalNotifications.addListener("localNotificationActionPerformed", escuchar);
  return () => {
    listener.then((h) => h.remove());
  };
}

export type ResultadoNotificaciones = { ok: true } | { ok: false; error: string };

const ERROR_SIN_PERMISO = "MIP no tiene permiso para mostrar notificaciones. Actívalo en los ajustes del teléfono.";
const ERROR_SOLO_APK = "Las notificaciones solo funcionan en la app instalada en el teléfono.";

export async function guardarConfigNotificaciones(config: ConfigNotificaciones): Promise<ResultadoNotificaciones> {
  if (config.activadas) {
    if (!esNativo()) return { ok: false, error: ERROR_SOLO_APK };
    if (!(await pedirPermiso())) return { ok: false, error: ERROR_SIN_PERMISO };
  }
  await Preferences.set({ key: CLAVE, value: JSON.stringify(config) });
  await reprogramarNotificaciones();
  return { ok: true };
}

// Muestra un aviso a los pocos segundos, para comprobar que llegan.
export async function probarNotificacion(): Promise<ResultadoNotificaciones> {
  if (!esNativo()) return { ok: false, error: ERROR_SOLO_APK };
  if (!(await pedirPermiso())) return { ok: false, error: ERROR_SIN_PERMISO };

  const resumen = await resumenAlertas();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: ID_PRUEBA,
        title: "MIP — Notificación de prueba",
        body: resumen ?? "Ahora mismo no hay alertas de inventario.",
        ...ICONO,
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      },
    ],
  });
  return { ok: true };
}
