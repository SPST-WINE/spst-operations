// app/api/quote-public/[token]/accept/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function makeSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[API/quote-public/:token/accept] Missing Supabase env", {
      hasUrl: !!url,
      hasKey: !!key,
    });
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: "spst" },
  });
}

function jsonError(
  status: number,
  error: string,
  extra?: Record<string, any>
) {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(extra || {}),
    },
    { status }
  );
}

type AcceptPayload = {
  optionId?: string;
};

export async function POST(
  req: NextRequest,
  context: { params: { token: string } }
) {
  const { token } = context.params;

  if (!token) {
    return jsonError(400, "MISSING_TOKEN");
  }

  const supabase = makeSupabase();
  if (!supabase) {
    return jsonError(500, "NO_SUPABASE_CONFIG");
  }

  let body: AcceptPayload;
  try {
    body = (await req.json()) as AcceptPayload;
  } catch (e: any) {
    console.error("[API/quote-public/:token/accept:POST] invalid json", e);
    return jsonError(400, "INVALID_JSON");
  }

  const optionId = body.optionId;
  if (!optionId) {
    return jsonError(400, "MISSING_OPTION_ID");
  }

  try {
    // 1) recupero quote tramite token
    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("id, status, accepted_option_id")
      .eq("public_token", token)
      .single();

    if (qErr || !quote) {
      console.error(
        "[API/quote-public/:token/accept:POST] quote not found",
        qErr
      );
      return jsonError(404, "QUOTE_NOT_FOUND");
    }

    // se già accettata, non rifaccio i cambi
    if (quote.accepted_option_id && quote.status === "accettata") {
      return NextResponse.json(
        {
          ok: true,
          alreadyAccepted: true,
        },
        { status: 200 }
      );
    }

    // 2) verifico che l'opzione appartenga a questa quote ed è visibile
    const { data: opt, error: oErr } = await supabase
      .from("quote_options")
      .select("id, quote_id, visible_to_client")
      .eq("id", optionId)
      .single();

    if (oErr || !opt || opt.quote_id !== quote.id || !opt.visible_to_client) {
      console.error(
        "[API/quote-public/:token/accept:POST] invalid option for this quote",
        oErr
      );
      return jsonError(400, "INVALID_OPTION");
    }

    const now = new Date().toISOString();

    // 3) aggiorno la quote -> accettata
    const { error: upQuoteErr } = await supabase
      .from("quotes")
      .update({
        status: "accettata",
        accepted_option_id: optionId,
        updated_at: now,
      })
      .eq("id", quote.id);

    if (upQuoteErr) {
      console.error(
        "[API/quote-public/:token/accept:POST] update quote error",
        upQuoteErr
      );
      return jsonError(500, "UPDATE_QUOTE_ERROR", {
        message: upQuoteErr.message,
      });
    }

    // 4) l'opzione scelta -> accettata
    const { error: upOptChosenErr } = await supabase
      .from("quote_options")
      .update({
        status: "accettata",
        accepted_at: now,
        updated_at: now,
      })
      .eq("id", optionId)
      .eq("quote_id", quote.id);

    if (upOptChosenErr) {
      console.error(
        "[API/quote-public/:token/accept:POST] update chosen option error",
        upOptChosenErr
      );
      return jsonError(500, "UPDATE_OPTION_ERROR", {
        message: upOptChosenErr.message,
      });
    }

    // 5) tutte le altre opzioni -> rifiutate (se non già rifiutate)
    const { error: upOthersErr } = await supabase
      .from("quote_options")
      .update({
        status: "rifiutata",
        updated_at: now,
      })
      .eq("quote_id", quote.id)
      .neq("id", optionId);

    if (upOthersErr) {
      console.error(
        "[API/quote-public/:token/accept:POST] update other options error",
        upOthersErr
      );
      // non blocco il successo, ma lo segnalo
    }

    return NextResponse.json(
      {
        ok: true,
        accepted_option_id: optionId,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("[API/quote-public/:token/accept:POST] ERROR", e?.message);
    return jsonError(500, "SERVER_ERROR", { message: e?.message });
  }
}
