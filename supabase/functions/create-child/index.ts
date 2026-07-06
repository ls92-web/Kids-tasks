import { createClient } from "jsr:@supabase/supabase-js@2";

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
      return json({ error: "only parents can create child accounts" }, 403);
    }

    const { username, pin, nickname, avatar, character_class, pet } = await req.json();
    const cleanUsername = String(username || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (cleanUsername.length < 3) {
      return json({ error: "username must be at least 3 characters (letters/numbers)" }, 400);
    }
    if (String(pin || "").length < 4) {
      return json({ error: "PIN must be at least 4 characters" }, 400);
    }

    const { data: existing } = await admin
      .from("profiles").select("id").eq("username", cleanUsername).maybeSingle();
    if (existing) return json({ error: "that hero name is already taken — try another" }, 400);

    // Global username → deterministic login email, so kids sign in with name + PIN only
    const email = `${cleanUsername}@kidsquest.app`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: String(pin),
      email_confirm: true,
      user_metadata: {
        role: "child",
        family_id: profile.family_id,
        username: cleanUsername,
        nickname: nickname || cleanUsername,
        avatar: avatar || "fox",
        character_class: character_class || "shadow_warrior",
        pet: pet || "dragon",
      },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    return json({ ok: true, child_id: created.user?.id, username: cleanUsername });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
