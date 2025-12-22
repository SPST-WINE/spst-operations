// app/api/spedizioni/[id]/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServerSpst } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/requireStaff";

export const dynamic = "force-dynamic";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// tipi di documento ammessi (colonne jsonb in spst.shipments)
const VALID_TYPES = [
  "ldv",
  "fattura_proforma",
  "fattura_commerciale",
  "dle",
  "allegato1",
  "allegato2",
  "allegato3",
  "allegato4",
] as const;

type ValidType = (typeof VALID_TYPES)[number];

// ✅ Owner-or-staff gate
async function requireOwnerOrStaff(shipmentId: string) {
  // 1) prova staff
  const staff = await requireStaff();
  if (!("response" in staff)) {
    return { ok: true as const, mode: "staff" as const };
  }

  // 2) non staff -> deve essere utente loggato + owner (RLS deve permettere vedere quella shipment)
  const supa = supabaseServerSpst();
  const {
    data: { user },
  } = await supa.auth.getUser();

  if (!user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      ),
    };
  }

  // RLS: se non è owner, non trova la riga
  const { data, error } = await supa
    .from("shipments")
    .select("id")
    .eq("id", shipmentId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "FORBIDDEN_OR_NOT_FOUND" },
        { status: 404 }
      ),
    };
  }

  return { ok: true as const, mode: "client" as const };
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const shipmentId = params.id;

  // ✅ gate prima di qualunque azione “potente”
  const gate = await requireOwnerOrStaff(shipmentId);
  if (!gate.ok) return gate.response;

  const supa = admin();

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file || !type) {
      return NextResponse.json(
        { ok: false, error: "FILE_OR_TYPE_MISSING" },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(type as ValidType)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_TYPE" },
        { status: 400 }
      );
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
    const safeExt = ext || "bin";
    const safeType = type as ValidType;

    // es: eb48cb60-.../ldv.pdf
    const path = `${shipmentId}/${safeType}.${safeExt}`;

    // Upload nel bucket "shipment-docs"
    const { error: uploadError } = await supa.storage
      .from("shipment-docs")
      .upload(path, file, {
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("[upload] storage error:", uploadError);
      return NextResponse.json(
        { ok: false, error: uploadError.message },
        { status: 500 }
      );
    }

    // URL pubblico
    const { data: publicData } = supa.storage
      .from("shipment-docs")
      .getPublicUrl(path);

    const publicUrl = publicData.publicUrl;

    // payload da salvare nella colonna jsonb corrispondente
    const updatePayload: Record<string, any> = {
      [safeType]: {
        url: publicUrl,
        file_name: file.name,
        mime_type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      },
    };

    // aggiorniamo la riga in spst.shipments
    const { error: updateError } = await supa
      .schema("spst")
      .from("shipments")
      .update(updatePayload)
      .eq("id", shipmentId);

    if (updateError) {
      console.error("[upload] db update error:", updateError);
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      file_name: file.name,
      type: safeType,
      scope: gate.mode, // "staff" | "client" (debug utile)
    });
  } catch (e: any) {
    console.error("[upload] unknown error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "UNKNOWN_ERROR" },
      { status: 500 }
    );
  }
}
