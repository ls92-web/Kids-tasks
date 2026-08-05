// send-push — drains the notification_deliveries outbox via Web Push (VAPID).
//
// Invocation paths:
//   1. Any authenticated family member right after a domain action (fire and
//      forget from the client): processes THAT family's queued deliveries.
//   2. The sweeper / service role: processes every family's queue (retries
//      whatever a transient failure left behind).
//
// Durability: deliveries are committed by DB triggers before this function
// ever runs. If sending fails here, rows stay queued/failed and are retried
// later — nothing is lost, and domain actions never depend on this function.
//
// Privacy: payloads carry only title/body/destination already rendered by the
// DB fan-out (nickname-level wording, internal routes only). VAPID keys live
// in Supabase Vault; nothing secret ever reaches the client.

import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const MAX_ATTEMPTS = 5;
const BATCH = 50;

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(b64 + pad), (c) => c.charCodeAt(0));
}
function bytesToB64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sweeper-token",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---- secrets from Vault via a service-role-only RPC (the vault schema
    // itself is not exposed through PostgREST)
    const { data: sec, error: secErr } = await service.rpc("get_push_secrets");
    if (secErr || !sec?.vapid_public_key || !sec?.vapid_private_key || !sec?.push_sweeper_token) {
      throw new Error("vault keys unavailable");
    }

    // ---- who is asking? (verify_jwt is off; ALL auth happens right here)
    //  - the pg_cron sweeper presents the Vault sweeper token → drains ALL
    //  - the service role key → drains ALL
    //  - a signed-in family member's JWT → drains THEIR family only
    //  - anything else → 401
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const sweeperToken = req.headers.get("x-sweeper-token") ?? "";
    let familyFilter: string | null = null;
    const isSweeper =
      sweeperToken.length > 0 && sweeperToken === sec.push_sweeper_token;
    if (!isSweeper && token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      const { data: userData, error: userErr } = await service.auth.getUser(token);
      if (userErr || !userData.user) {
        return new Response(JSON.stringify({ error: "not authorized" }), {
          status: 401, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const { data: prof } = await service
        .from("profiles").select("family_id").eq("id", userData.user.id).single();
      if (!prof) {
        return new Response(JSON.stringify({ error: "no profile" }), {
          status: 403, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      familyFilter = prof.family_id;
    }

    // raw base64url VAPID pair → JWK pair for the webpush library
    const pub = b64urlToBytes(sec.vapid_public_key); // 65 bytes: 0x04 || x || y
    const x = bytesToB64url(pub.slice(1, 33));
    const y = bytesToB64url(pub.slice(33, 65));
    const vapidKeys = await webpush.importVapidKeys(
      {
        publicKey: { kty: "EC", crv: "P-256", x, y, ext: true },
        privateKey: { kty: "EC", crv: "P-256", x, y, d: sec.vapid_private_key, ext: true },
      },
      { extractable: false }
    );
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: sec.vapid_subject,
      vapidKeys,
    });

    // ---- pull due deliveries
    let q = service
      .from("notification_deliveries")
      .select("id, family_id, recipient_user_id, title, body, destination, tag, attempts, status")
      .in("status", ["queued", "failed"])
      .lt("attempts", MAX_ATTEMPTS)
      .lte("scheduled_for", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(BATCH);
    if (familyFilter) q = q.eq("family_id", familyFilter);
    const { data: deliveries, error: delErr } = await q;
    if (delErr) throw delErr;
    if (!deliveries || deliveries.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // subscriptions for every recipient in this batch
    const recipientIds = [...new Set(deliveries.map((d) => d.recipient_user_id))];
    const { data: subs } = await service
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh_key, auth_key, failure_count")
      .eq("enabled", true)
      .in("user_id", recipientIds);
    const byUser = new Map<string, NonNullable<typeof subs>>();
    for (const s of subs ?? []) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id)!.push(s);
    }

    let sent = 0, skipped = 0, failed = 0;
    for (const d of deliveries) {
      const targets = byUser.get(d.recipient_user_id) ?? [];
      if (targets.length === 0) {
        await service.from("notification_deliveries")
          .update({ status: "skipped", last_error: "no enabled subscriptions" })
          .eq("id", d.id);
        skipped++;
        continue;
      }

      let anySuccess = false;
      let lastError = "";
      for (const t of targets) {
        try {
          const subscriber = appServer.subscribe({
            endpoint: t.endpoint,
            keys: { p256dh: t.p256dh_key, auth: t.auth_key },
          });
          await subscriber.pushTextMessage(
            JSON.stringify({
              title: d.title,
              body: d.body,
              destination: d.destination,
              // stable per-item tag (e.g. submission-review:<id>) so an updated
              // alert REPLACES its sibling; unrelated alerts never collide
              tag: (d as { tag?: string }).tag ?? d.id,
            }),
            { urgency: webpush.Urgency.Normal }
          );
          anySuccess = true;
          await service.from("push_subscriptions")
            .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
            .eq("id", t.id);
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status ?? 0;
          lastError = `push ${status || "error"}`;
          if (status === 404 || status === 410) {
            // gone forever — the browser revoked this subscription
            await service.from("push_subscriptions")
              .update({ enabled: false, last_failure_at: new Date().toISOString() })
              .eq("id", t.id);
          } else {
            await service.from("push_subscriptions")
              .update({
                failure_count: (t.failure_count ?? 0) + 1,
                last_failure_at: new Date().toISOString(),
              })
              .eq("id", t.id);
          }
        }
      }

      if (anySuccess) {
        await service.from("notification_deliveries")
          .update({ status: "sent", sent_at: new Date().toISOString(), attempts: d.attempts + 1 })
          .eq("id", d.id);
        sent++;
      } else {
        const attempts = d.attempts + 1;
        await service.from("notification_deliveries")
          .update({
            status: attempts >= MAX_ATTEMPTS ? "dead" : "failed",
            attempts,
            last_error: lastError || "all devices failed",
            // back off: retry no sooner than 2^attempts minutes from now
            scheduled_for: new Date(Date.now() + 2 ** attempts * 60_000).toISOString(),
          })
          .eq("id", d.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed: deliveries.length, sent, skipped, failed }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", (err as Error).message);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
