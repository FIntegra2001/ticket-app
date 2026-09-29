import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import cloudinary from "@/lib/cloudinary";
import prisma from "@/lib/db";
import { getDayNumber } from "@/lib/utils";
import { userFolderName } from "@/lib/office-expenses";


export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get("image") as File;
    const tripId = formData.get("tripId") as string | null;
    // 🆕 Alternativa a tripId: el ticket pertenece a un parte de gastos de oficina
    const officeExpenseId = formData.get("officeExpenseId") as string | null;

    if (!image || (!tripId && !officeExpenseId)) {
      return NextResponse.json(
        { error: "Falta la imagen o el viaje/parte al que pertenece" },
        { status: 400 },
      );
    }

    const uploadDate = new Date();
    const year = uploadDate.getFullYear();
    const month = String(uploadDate.getMonth() + 1).padStart(2, "0");

    // 🆕 Dos árboles de carpetas distintos, y esto importa:
    //   · `tickets/{año}/{mes}/{nºfactura}`  → gastos de VIAJE. Es el prefijo que
    //     recorre la migración a SharePoint.
    //   · `office-tickets/{año}/{mes}/{userId}` → gastos de OFICINA. Fuera de ese
    //     prefijo, así que NO entran en la migración. Si algún día financiero los
    //     quiere en SharePoint, basta añadir el segundo prefijo al route de
    //     migración; hoy no se ha pedido.
    let folder: string;

    if (tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: { numberInvoice: true, city: true, createdAt: true },
      });

      if (!trip) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }

      // ✅ Nombre de carpeta basado en numberInvoice o ciudad + día como fallback
      const folderName = trip.numberInvoice
        ? trip.numberInvoice.replace(/[^a-zA-Z0-9-_]/g, "_") // Sanitizar para Cloudinary
        : `${trip.city}_day${getDayNumber(trip.createdAt)}`;

      folder = `tickets/${year}/${month}/${folderName}`;
    } else {
      const parte = await prisma.officeExpense.findUnique({
        where: { id: officeExpenseId! },
        select: {
          userId: true,
          year: true,
          month: true,
          // El nombre del usuario, para que la carpeta sea legible en Cloudinary
          user: { select: { id: true, name: true, email: true } },
        },
      });

      if (!parte) {
        return NextResponse.json(
          { error: "Parte de gastos de oficina no encontrado" },
          { status: 404 },
        );
      }

      // Aquí el año/mes salen del PARTE, no de la fecha de subida: un ticket de
      // octubre subido el 2 de noviembre tiene que archivarse en octubre.
      const parteMes = String(parte.month).padStart(2, "0");
      // Carpeta por NOMBRE del usuario (`Nicolas_Mendoza`), no por id: estas
      // carpetas las abre financiero y un cuid no le dice nada.
      const carpetaUsuario = userFolderName(parte.user ?? { id: parte.userId });
      folder = `office-tickets/${parte.year}/${parteMes}/${carpetaUsuario}`;
    }

    // Convertir File a Buffer
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generar nombre único para el archivo
    const timestamp = Date.now();
    const originalName = image.name.replace(/\.[^/.]+$/, ""); // Sin extensión

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder,
            public_id: `${timestamp}_${originalName}`,
            resource_type: "auto",
            format: "jpg",
            transformation: [
              { quality: "auto:good" },
              { fetch_format: "auto" },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        )
        .end(buffer);
    });

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      folder: result.folder,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: "Error uploading image" },
      { status: 500 },
    );
  }
}