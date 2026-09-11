import { requireAcceso } from "@/lib/auth";
import { generarPlantillaExcel } from "@/lib/excelProductos";

export async function GET() {
  await requireAcceso();

  const buffer = await generarPlantillaExcel();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-productos.xlsx"',
    },
  });
}
