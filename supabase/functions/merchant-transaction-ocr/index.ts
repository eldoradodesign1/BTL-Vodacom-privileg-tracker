import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type OcrStatus = "identified" | "unreadable" | "date_mismatch" | "not_configured" | "unavailable" | "invalid_image";

type OcrPayload = { transactionId?: string | null; status?: OcrStatus };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function parseOcrPayload(text: string): OcrPayload {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] || text;
  try {
    const parsed = JSON.parse(jsonText) as OcrPayload;
    return { transactionId: parsed.transactionId?.trim() || null, status: parsed.status };
  } catch {
    const reference = text.match(/(?:reference|ref)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{4,})/i)?.[1];
    return reference ? { transactionId: reference.toUpperCase(), status: "identified" } : { transactionId: null, status: "unreadable" };
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ transactionId: null, status: "unavailable" satisfies OcrStatus }, 500);

  try {
    const body = await request.json() as { imageDataUrl?: string; transactionDate?: string };
    const imageDataUrl = body.imageDataUrl?.trim();
    const transactionDate = body.transactionDate?.trim();
    if (!imageDataUrl?.startsWith("data:image/") || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate || "")) {
      return json({ transactionId: null, status: "invalid_image" satisfies OcrStatus }, 400);
    }

    const database = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    const { data: secret, error: secretError } = await database
      .from("app_runtime_secrets")
      .select("gemini_api_key")
      .eq("id", true)
      .single();
    if (secretError || !secret?.gemini_api_key) return json({ transactionId: null, status: "not_configured" satisfies OcrStatus });

    const [header, data] = imageDataUrl.split(",", 2);
    const mimeType = header.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64$/)?.[1] || "image/jpeg";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(secret.gemini_api_key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          {
            text: `Analyse la capture de SMS M-Pesa en respectant strictement les règles suivantes. La date attendue de la transaction est ${transactionDate}. La capture peut contenir plusieurs messages. Ignore totalement les publicités, cashback, achats de bundle, soldes, messages d’échec, messages système et tout SMS qui n’est pas un transfert d’argent. Parmi les seuls messages transactionnels clairement identifiables comme « Money Received », « Money Sent », « Argent reçu » ou « Argent envoyé », sélectionne le DERNIER message visible dans l’ordre chronologique. Extrais uniquement son numéro « Reference », « Ref » ou identifiant de transaction. Si une date complète est visible dans le message retenu, elle doit correspondre exactement à ${transactionDate}; sinon réponds date_mismatch. Ne devine jamais. Réponds exclusivement par ce JSON : {"transactionId":"ID ou null","status":"identified|unreadable|date_mismatch"}.`,
          },
          { inline_data: { mime_type: mimeType, data } },
        ] }],
        generationConfig: { temperature: 0, maxOutputTokens: 512, responseMimeType: "application/json" },
      }),
    });
    if (!response.ok) return json({ transactionId: null, status: "unavailable" satisfies OcrStatus, providerStatus: response.status });

    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join(" ") || "";
    const result = parseOcrPayload(text);
    if (result.status === "date_mismatch") return json({ transactionId: null, status: "date_mismatch" satisfies OcrStatus });
    if (result.status === "identified" && result.transactionId) return json({ transactionId: result.transactionId.toUpperCase(), status: "identified" satisfies OcrStatus });
    return json({ transactionId: null, status: "unreadable" satisfies OcrStatus });
  } catch {
    return json({ transactionId: null, status: "unavailable" satisfies OcrStatus });
  }
});
