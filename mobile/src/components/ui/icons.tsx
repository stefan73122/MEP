type IconProps = { className?: string };

const base = "shrink-0";

export function IconBuscar({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      className={`${base} ${className}`}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export function IconCalendario({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
      <path d="M3 9.5h18" />
      <path d="M8 2.5v4" />
      <path d="M16 2.5v4" />
    </svg>
  );
}

export function IconAlertaTriangulo({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconReloj({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconInicio({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

export function IconVender({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <path d="M4 3h16v18l-2.7-1.6L14.6 21l-2.6-1.6L9.4 21l-2.7-1.6L4 21Z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

export function IconVentas({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </svg>
  );
}

export function IconProductos({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

export function IconClientes({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconReportes({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <path d="M3 3v18h18" />
      <rect x="7" y="11" width="3" height="6" />
      <rect x="12.5" y="7" width="3" height="10" />
      <rect x="18" y="13" width="3" height="4" />
    </svg>
  );
}

export function IconAjustes({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

export function IconHuella({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <path d="M12 3.5c-4.7 0-8.5 3.8-8.5 8.5 0 1.6.1 2.9.5 4.2" />
      <path d="M12 3.5c4.7 0 8.5 3.8 8.5 8.5 0 .9-.05 1.7-.15 2.5" />
      <path d="M7.5 20.2c-.9-1.6-1.5-3.6-1.5-6.2a6 6 0 0 1 12 0c0 .6 0 1.1-.05 1.6" />
      <path d="M9.8 21c-.8-1.4-1.3-3.2-1.3-5.5v-1a3.5 3.5 0 0 1 7 0v1c0 .8-.05 1.5-.15 2.2" />
      <path d="M13.5 20.5c1.4-1 2-2.7 2-5v-1" />
    </svg>
  );
}

export function IconBackspace({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${base} ${className}`}
    >
      <path d="M9 4h10a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20H9l-6.5-8L9 4Z" />
      <path d="M13.5 9.5 18 14" />
      <path d="M18 9.5 13.5 14" />
    </svg>
  );
}

/** Etiqueta de alerta animada (banderín) que se usa sobre productos
 * vencidos (rojo) o por vencer (ámbar), igual que en el diseño. */
export function IconAlertaBandera({
  variante = "danger",
  contexto = "flat",
  className = "",
}: {
  variante?: "danger" | "warning";
  /** "nav": para usarse dentro de una pestaña ya inclinada (-skewX(8deg)). */
  contexto?: "flat" | "nav";
  className?: string;
}) {
  const relleno = variante === "danger" ? "#E63A2E" : "#D97706";
  const animacion =
    contexto === "nav"
      ? "mt-alerta-bandera-nav"
      : variante === "danger"
        ? "mt-alerta-bandera"
        : "mt-alerta-bandera-ambar";
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="21"
      fill="none"
      data-mt-sync="1"
      className={`${base} ${className}`}
      style={{ animation: `${animacion} 2.6s ease-in-out infinite` }}
    >
      <path
        d="M4.3 2.2 H19.7 Q22.8 2.2 21.3 4.9 L13.7 19.6 Q12 22.9 10.3 19.6 L2.7 4.9 Q1.2 2.2 4.3 2.2 Z"
        fill={relleno}
        stroke="#141418"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <rect x="10.5" y="5.6" width="3" height="6.9" rx="1.5" fill="#ffffff" />
      <circle cx="12" cy="15.4" r="1.6" fill="#ffffff" />
    </svg>
  );
}
