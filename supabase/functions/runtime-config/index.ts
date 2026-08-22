import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Actor = { phone?: string; password?: string };

type SharedConfig = {
  supabaseUrl: string;
  publishableKey: string;
  geminiConfigured: boolean;
  updatedAt: string;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ error: "Runtime configuration is unavailable" }, 500);
  const database = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const body = await request.json() as {
      action?: "get" | "update";
      actor?: Actor;
      supabaseUrl?: string;
      publishableKey?: string;
      geminiApiKey?: string;
    };

    if (body.action === "get") {
      const { data, error } = await database
        .from("app_runtime_config")
        .select("supabase_url, publishable_key, gemini_configured, updated_at")
        .eq("id", true)
        .single();
      if (error || !data) return json({ error: "Shared configuration not found" }, 404);
      const config: SharedConfig = {
        supabaseUrl: data.supabase_url,
        publishableKey: data.publishable_key,
        geminiConfigured: data.gemini_configured,
        updatedAt: data.updated_at,
      };
      return json({ config });
    }

    if (body.action !== "update") return json({ error: "Unknown action" }, 400);
    const phone = body.actor?.phone?.trim();
    const password = body.actor?.password?.trim();
    if (!phone || !password) return json({ error: "Super admin credentials are required" }, 401);

    const { data: actor, error: actorError } = await database
      .from("users")
      .select("id, role")
      .eq("phone", phone)
      .eq("password_hash", password)
      .maybeSingle();
    if (actorError || actor?.role !== "super_admin") return json({ error: "Super admin access required" }, 403);

    const supabaseUrl = body.supabaseUrl?.trim();
    const publishableKey = body.publishableKey?.trim();
    if (!supabaseUrl || !publishableKey) return json({ error: "Supabase URL and publishable key are required" }, 400);
    try { new URL(supabaseUrl); } catch { return json({ error: "Supabase URL is invalid" }, 400); }

    const geminiApiKey = body.geminiApiKey?.trim();
    const { data: current } = await database
      .from("app_runtime_config")
      .select("gemini_configured")
      .eq("id", true)
      .maybeSingle();

    const { error: configError } = await database
      .from("app_runtime_config")
      .upsert({
        id: true,
        supabase_url: supabaseUrl,
        publishable_key: publishableKey,
        gemini_configured: geminiApiKey ? true : Boolean(current?.gemini_configured),
      });
    if (configError) return json({ error: configError.message }, 500);

    if (geminiApiKey) {
      const { error: secretError } = await database
        .from("app_runtime_secrets")
        .upsert({ id: true, gemini_api_key: geminiApiKey });
      if (secretError) return json({ error: secretError.message }, 500);
    }

    const { data, error } = await database
      .from("app_runtime_config")
      .select("supabase_url, publishable_key, gemini_configured, updated_at")
      .eq("id", true)
      .single();
    if (error || !data) return json({ error: "Configuration could not be read" }, 500);
    return json({ config: {
      supabaseUrl: data.supabase_url,
      publishableKey: data.publishable_key,
      geminiConfigured: data.gemini_configured,
      updatedAt: data.updated_at,
    } satisfies SharedConfig });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
