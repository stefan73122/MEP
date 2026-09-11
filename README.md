# Mi Tienda — sistema administrativo para un vendedor o tienda pequeña

Sistema web de un solo usuario (el dueño del negocio) para manejar productos e
inventario, ventas, clientes con fiado, y reportes. Pensado para usarse desde
el celular, con textos simples en español.

## Stack técnico

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- SQLite mediante [Prisma ORM](https://www.prisma.io) (archivo local `dev.db`)
- Tailwind CSS
- Autenticación propia con PIN numérico (opcional) — sin librerías de auth
- Validación con [Zod](https://zod.dev)
- [ExcelJS](https://github.com/exceljs/exceljs) para la plantilla y la carga masiva de productos

## Requisitos

- Node.js 20 o superior
- npm

## Instalación

```bash
npm install
```

Copiá el archivo de variables de entorno de ejemplo y generá tu propio secreto de sesión:

```bash
cp .env.example .env
```

Editá `.env` y reemplazá `SESSION_SECRET` por una cadena aleatoria larga (por ejemplo, con
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

Creá la base de datos y cargá los datos de ejemplo:

```bash
npm run db:migrate
npm run db:seed
```

El seed crea 5 productos de ejemplo (uno perecedero, con lotes) y 2 clientes. No configura
ningún PIN: el sistema queda accesible directo, sin pedir login.

## Uso en desarrollo

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000). La pantalla de inicio es directamente
la de "Vender".

## Scripts disponibles

| Comando             | Qué hace                                              |
| -------------------- | ------------------------------------------------------ |
| `npm run dev`         | Levanta el servidor de desarrollo                      |
| `npm run build`       | Compila para producción                                |
| `npm run start`       | Corre la build de producción                           |
| `npm run db:generate` | Regenera el cliente de Prisma después de tocar el schema |
| `npm run db:migrate`  | Crea/aplica migraciones de la base de datos (desarrollo)|
| `npm run db:seed`     | Carga los datos de ejemplo                             |
| `npm run db:reset`    | Borra la base, la vuelve a crear y la reseedea          |

## Módulos

### Productos e inventario (`/productos`)
- Alta, edición y baja (soft delete) de productos: código, nombre, categoría, unidad de
  medida, precios de compra/venta, stock mínimo.
- El stock nunca se edita a mano: todo cambio queda registrado como un movimiento de
  inventario (entrada, salida o ajuste), con motivo y fecha.
- **Productos perecederos**: se manejan por lotes con fecha de vencimiento. Al vender se
  descuenta automáticamente del lote que vence primero (FEFO). Un lote vencido no se puede
  vender. Hay alertas de vencidos y por vencer (plazo configurable en Ajustes).
- **Carga masiva desde Excel** (`/productos/importar`): descargá la plantilla, completala y
  subila. Antes de guardar nada se muestra una vista previa fila por fila, marcando errores
  (código repetido, precio inválido, etc.) para corregir.

### Ventas (`/ventas`, pantalla principal de la app)
- Venta rápida: buscar por código o nombre, agregar al carrito, cambiar cantidad, aplicar
  descuento por producto o al total.
- Si buscás un producto que no existe, lo podés crear ahí mismo con nombre y precio (el
  resto se completa después).
- Formas de pago: efectivo, transferencia/QR o crédito (fiado). Si vendés a crédito a un
  cliente que no está cargado, lo podés crear sin salir de la venta.
- Si una venta a crédito supera el límite del cliente, se avisa antes de confirmar.
- Listado con filtros por fecha, cliente y forma de pago; anulación con motivo (revierte
  stock, no borra el registro).

### Clientes y fiados (`/clientes`)
- Ficha simple: nombre, teléfono y límite de crédito.
- Estado de cuenta: ventas a crédito, pagos recibidos, saldo pendiente.
- Los pagos se aplican automáticamente a la deuda más antigua primero.
- Listado de cuentas por cobrar ordenado por antigüedad de la deuda.

### Reportes (`/reportes`)
- Resumen del día siempre visible: total vendido, desglose por forma de pago, cantidad de
  ventas.
- Ventas por día o por mes, productos más vendidos, ganancia estimada (precio de venta menos
  precio de compra actual).
- Registro simple y opcional de gastos del día, para ver la ganancia real.
- Cada reporte se puede exportar a CSV.

### Configuración (`/configuracion`)
- Nombre del negocio, moneda y símbolo.
- Días de anticipación para las alertas de vencimiento.
- Activar, cambiar o quitar el PIN de acceso.

## Notas de diseño

- Todos los importes se guardan como enteros en centavos (nunca en float).
- Es un sistema de un solo usuario: no hay roles ni pantalla de gestión de usuarios. El PIN
  es opcional — si no lo configurás, se entra directo.
- Todas las operaciones que tocan stock, lotes o ventas van dentro de una transacción de
  Prisma.
