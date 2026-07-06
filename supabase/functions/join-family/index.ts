import { createClient } from "jsr:@supabase/supabase-js@2";

/* A hero joins their family with the Family Code — no parent action needed.
   The code IS the credential here (this endpoint is reachable without a JWT,
   because the child has no account yet), so:
     - the code must match an existing family exactly
     - username stays globally unique
     - inputs are validated/cleaned exactly like create-child */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SPECIES = [
  "dragon", "fox", "owl", "wolf", "tiger", "phoenix",
  "turtle", "forest", "robot", "ninja", "samurai", "pirate",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { family_code, username, pin, nickname, pet } = await req.json();

    // normalize the code the way kids type it: qf7x92, qf-7x92, QF 7X92...
    const cleanCode = String(family_code || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .replace(/^QF/, "");
    if (cleanCode.length !== 4) {
      return json({ error: "that doesn't look like a family code — it's QF- plus 4 letters" }, 400);
    }
    const code = `QF-${cleanCode}`;

    const { data: family } = await admin
      .from("families").select("id, name").eq("code", code).maybeSingle();
    if (!family) {
      return json({ error: "no family found with that code — check it with your parent" }, 400);
    }

    const cleanUsername = String(username || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (cleanUsername.length < 3) {
      return json({ error: "hero name must be at least 3 characters (letters/numbers)" }, 400);
    }
    if (String(pin || "").length < 4) {
      return json({ error: "PIN must be at least 4 characters" }, 400);
    }
    const species = SPECIES.includes(pet) ? pet : "dragon";

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
        family_id: family.id,
        username: cleanUsername,
        nickname: nickname || cleanUsername,
        pet: species,
      },
    });
    if (createErr) return json({ error: createErr.message }, 400);

    return json({
      ok: true,
      child_id: created.user?.id,
      username: cleanUsername,
      family_name: family.name,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
