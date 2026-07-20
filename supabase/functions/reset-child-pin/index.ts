import { createClient } from "jsr:@supabase/supabase-js@2";

/* A parent sets a new secret PIN for one of their own heroes — the recovery
   path for forgotten PINs (hero accounts have no real inbox, so email reset
   is impossible for them). Mirrors create-child's auth pattern: caller JWT
   verified, parent role required, and the child must be in the caller's
   family. The PIN is the child's Supabase Auth password (GoTrue-hashed). */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await caller.auth.getUser();
    if (userErr || !userData.user) return json({ error: "not authenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles").select("role, family_id").eq("id", userData.user.id).single();
    if (!profile || profile.role !== "parent") {
      return json({ error: "only parents can reset a hero's PIN" }, 403);
    }

    // GoTrue enforces the project's minimum password length (6) on UPDATES,
    // unlike createUser — so reset PINs need 6+ characters.
    const { child_id, pin } = await req.json();
    if (String(pin || "").length < 6) {
      return json({ error: "the new PIN must be at least 6 characters" }, 400);
    }

    // the hero must belong to the calling parent's own family
    const { data: child } = await admin
      .from("profiles")
      .select("id, role, family_id, username")
      .eq("id", child_id)
      .maybeSingle();
    if (!child || child.role !== "child" || child.family_id !== profile.family_id) {
      return json({ error: "no such hero in your family" }, 404);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(child.id, {
      password: String(pin),
    });
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ ok: true, username: child.username });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
