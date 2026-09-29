import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import {
  getOcrCategories,
  isValidCategoryForScope,
  type CategoryScope,
} from "@/lib/expense-categories";

// ── Modelo OCR ───────────────────────────────────────────────────────────────
// Alias SIN fecha: apunta siempre al último snapshot de Haiku 4.5, así no se
// rompe por una retirada de versión fechada (lo que acaba de pasar con
// claude-sonnet-4-20250514, retirado el 15/06/2026).
// Versión fijada equivalente, por si la prefieres: "claude-haiku-4-5-20251001"
const OCR_MODEL = "claude-haiku-4-5";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

// 🆕 Pistas de categorización por contexto. Los casos que un ticket no deja
// claros por sí solos (un AVE frente a un avión, mensajería frente a material)
// se explican aquí; la lista de valores válidos sale de expense-categories.
const CATEGORY_HINTS: Record<CategoryScope, string> = {
  trip: `    · "Ave" = billetes de tren AVE / Renfe.
    · "Avion" = vuelos / billetes de avión.
    · "Metrobus/Parking" = transporte público urbano o aparcamiento.
    · "Comida" = restaurantes, bares, cafeterías.`,
  office: `    · "Mensajeria" = mensajería o paquetería (Correos, MRW, SEUR, Glovo de envíos...).
    · "Material" = material de oficina y papelería.
    · "Limpieza" = productos o servicios de limpieza.
    · "ComidasOficina" = comida o catering para la oficina, restaurantes y cafeterías.
    · "ParkingOficina" = aparcamiento o transporte público urbano (metrobús).
    · "TaxiOficina" = taxi o VTC.
    · "GasolinaOficina" = combustible / gasolineras.
    · "Regalos" = regalos, detalles u obsequios.`,
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get("image") as File | null;

    // 🆕 Contexto del gasto: "trip" (por defecto, retrocompatible) u "office".
    // Determina qué categorías se le ofrecen al modelo y contra qué se valida su
    // respuesta. Dentro de un parte de oficina, un ticket de taxi ES taxi de
    // oficina: el contexto resuelve la ambigüedad que antes obligaba a que las
    // categorías de oficina fuesen de selección manual.
    const scopeParam = formData.get("scope");
    const scope: CategoryScope = scopeParam === "office" ? "office" : "trip";
    const allowedCategories = getOcrCategories(scope);

    if (!image) {
      return NextResponse.json(
        { error: "No se recibió ninguna imagen" },
        { status: 400 }
      );
    }

    // Validar el tipo ANTES de gastar tokens. La compresión cliente ya entrega
    // JPEG, pero esto evita un error confuso de la API si llega otra cosa.
    if (!ALLOWED_MEDIA_TYPES.includes(image.type as AllowedMediaType)) {
      return NextResponse.json(
        {
          error: `Formato no soportado (${
            image.type || "desconocido"
          }). Usa JPEG, PNG o WebP.`,
        },
        { status: 400 }
      );
    }
    const mediaType = image.type as AllowedMediaType;

    // Convertir imagen a base64
    const arrayBuffer = await image.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    // Llamar a Claude Vision para extraer datos del ticket
    const message = await anthropic.messages.create({
      model: OCR_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: "text",
              text: `Analiza este ticket/recibo y extrae la información en formato JSON EXACTAMENTE con esta estructura:
{
  "vendor": "nombre del establecimiento/proveedor",
  "amount": número (solo el importe total, sin símbolos de moneda),
  "date": "YYYY-MM-DD" (fecha del ticket),
  "invoiceNumber": "NIF o CIF de la empresa emisora",
  "category": "una de estas opciones: ${allowedCategories.join(", ")}",
  "description": "breve descripción del gasto (qué se compró o consumió) no mas de 10 palabras"
}

REGLAS:
- invoiceNumber: busca el NIF/CIF de la empresa emisora (formatos como A12345678, B87654321, 12345678A...). Suele estar en la cabecera del ticket, junto al nombre o razón social.
- category: elige la más apropiada según el tipo de establecimiento.
${CATEGORY_HINTS[scope]}
- amount: debe ser un número, sin símbolos de moneda.
- Si no encuentras algún dato, usa null.
- Responde SOLO con el objeto JSON, sin texto adicional ni bloques de markdown.`,
            },
          ],
        },
      ],
    });

    const block = message.content[0];
    const responseText = block && block.type === "text" ? block.text : "";

    // Parsear respuesta JSON de forma segura (antes un JSON.parse pelado podía
    // tumbar la request con un 500 si el modelo devolvía algo inesperado).
    let extractedData;
    try {
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      extractedData = JSON.parse(cleaned);
    } catch {
      console.error("OCR: respuesta no parseable como JSON:", responseText);
      return NextResponse.json(
        {
          error:
            "El modelo no devolvió un JSON válido. Revisa la foto e inténtalo de nuevo.",
        },
        { status: 502 }
      );
    }

    // Whitelist de categoría contra el MISMO scope con el que se construyó el
    // prompt. Si el modelo devuelve algo fuera de lista — por ejemplo "Taxi"
    // (cuenta de viaje) en un parte de oficina — lo descartamos para que el
    // usuario la elija en el formulario. NO rompemos la request por esto.
    // Sin esta comprobación el valor acabaría en el fallback `?? SUBCUENTAS
    // ["Taxi"]` del Excel y se contabilizaría mal en silencio.
    if (
      extractedData &&
      typeof extractedData === "object" &&
      "category" in extractedData &&
      !isValidCategoryForScope(extractedData.category, scope)
    ) {
      extractedData.category = "";
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
    });
  } catch (error) {
    // Distinguir los errores de la API de Anthropic para no enterrarlos todos
    // en un 500 genérico (es lo que ocultó el 404 del modelo retirado).
    if (error instanceof Anthropic.APIError) {
      console.error(`OCR Anthropic API error [${error.status}]:`, error.message);

      // 404 = modelo inexistente o retirado → fallo de CONFIGURACIÓN, no del usuario.
      if (error.status === 404) {
        return NextResponse.json(
          {
            error:
              "El modelo de OCR configurado no está disponible. Avisa al administrador.",
            code: "model_not_found",
          },
          { status: 500 }
        );
      }

      // 429 (rate limit) / 529 (overloaded) = saturación → reintentable desde el cliente.
      if (error.status === 429 || error.status === 529) {
        return NextResponse.json(
          {
            error:
              "El servicio de OCR está saturado. Inténtalo de nuevo en unos segundos.",
            retryable: true,
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: "Error del servicio de OCR.", details: error.message },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }

    console.error("OCR Error inesperado:", error);
    return NextResponse.json(
      {
        error: "Error procesando la imagen",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}