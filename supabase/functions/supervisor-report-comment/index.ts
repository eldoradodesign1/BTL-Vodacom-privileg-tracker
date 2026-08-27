import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Body = {
  campaign?: "merchant" | "privilege";
  kind?: "daily" | "weekly" | "compiled";
  startsOn?: string;
  endsOn?: string;
  userId?: string;
  metrics?: Record<string, string | number>;
  agentComments?: string[];
};

function cleanOutput(value: string): string {
  return value
    .replace(/^\s*(?:process(?:us|ing)?|summary|synth[eè]se|comment(?:aire)?|analysis|analyse)\s*:\s*(?:\*+\s*)?/i, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeComments(values: unknown): string[] {
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => cleanOutput(value.trim()).slice(0, 1800)).slice(0, 120) : [];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ comment: null, status: "invalid_method" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ comment: null, status: "unavailable" }, 500);
  try {
    const body = await request.json() as Body;
    if (!body.campaign || !body.kind || !/^\d{4}-\d{2}-\d{2}$/.test(body.startsOn || "") || !/^\d{4}-\d{2}-\d{2}$/.test(body.endsOn || "")) return json({ comment: null, status: "invalid_request" }, 400);
    const database = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    if (body.userId) {
      const { data: user } = await database.from("users").select("role").eq("id", body.userId).maybeSingle();
      const role = String(user?.role || "").toLowerCase();
      if (!["supervisor", "admin", "super_admin", "sub_admin"].includes(role)) return json({ comment: null, status: "forbidden" }, 403);
    }
    const { data: secret, error: secretError } = await database.from("app_runtime_secrets").select("gemini_api_key").eq("id", true).maybeSingle();
    if (secretError || !secret?.gemini_api_key) return json({ comment: null, status: "not_configured" });
    const comments = safeComments(body.agentComments);
    const metrics = Object.entries(body.metrics || {}).map(([key, value]) => `${key}: ${value}`).join("\n");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(secret.gemini_api_key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Rédige uniquement en français professionnel un commentaire de superviseur pour un rapport ${body.kind} de la campagne ${body.campaign === "merchant" ? "Merchant Educational Campaign" : "Vodacom Privilège"}, couvrant ${body.startsOn} à ${body.endsOn}. Même si les commentaires agents sont dans une autre langue, traduis et synthétise leur sens en français. Utilise strictement les informations fournies, sans inventer de causes, de chiffres ou de résultats. Fais une synthèse concise de 2 ou 3 paragraphes : bilan chiffré, points opérationnels issus des commentaires agents, puis priorité de suivi. Si aucun commentaire agent n’est donné, indique sobrement que la synthèse se fonde sur les indicateurs terrain. Commence directement par une phrase complète : ne produis ni titre, ni libellé tel que « Process », « Synthèse », « Summary » ou « Commentaire », ni liste, ni markdown, ni astérisque.\n\nINDICATEURS\n${metrics || "Aucun indicateur"}\n\nCOMMENTAIRES AGENTS\n${comments.length ? comments.map((comment, index) => `${index + 1}. ${comment}`).join("\n") : "Aucun commentaire agent disponible."}` }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 520 },
      }),
    });
    if (!response.ok) return json({ comment: null, status: "unavailable", providerStatus: response.status });
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const generated = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join(" ").trim() || "";
    const comment = generated ? cleanOutput(generated) : null;
    return json({ comment, status: comment ? "generated" : "unavailable" });
  } catch {
    return json({ comment: null, status: "unavailable" });
  }
});
