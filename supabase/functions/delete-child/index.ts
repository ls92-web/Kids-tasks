import { createClient } from "jsr:@supabase/supabase-js@2";

/* A parent permanently deletes one of their own heroes — the auth account,
   profile, and (via ON DELETE CASCADE on every child-keyed table) all their
   quests, submissions, companions, achievements, events, challenge scores,
   redemptions and wishes, plus any proof files still in Storage. Mirrors
   create-child's auth pattern: caller JWT verified, parent role required,
   and the hero must belong to the caller's family. Irreversible. */

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
      return json({ error: "only parents can delete a hero" }, 403);
    }

    const { child_id } = await req.json();
    const { data: child } = await admin
      .from("profiles")
      .select("id, role, family_id, nickname")
      .eq("id", child_id)
      .maybeSingle();
    if (!child || child.role !== "child" || child.family_id !== profile.family_id) {
      return json({ error: "no such hero in your family" }, 404);
    }

    // any proof photos/recordings still in Storage live under <child_id>/
    const { data: files } = await admin.storage.from("proofs").list(child.id, { limit: 1000 });
    if (files && files.length > 0) {
      await admin.storage.from("proofs").remove(files.map((f) => `${child.id}/${f.name}`));
    }

    // deleting the auth user cascades: profiles → every child-keyed table
    const { error: delErr } = await admin.auth.admin.deleteUser(child.id);
    if (delErr) return json({ error: delErr.message }, 400);

    return json({ ok: true, nickname: child.nickname });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
