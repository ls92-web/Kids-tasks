/* Web Push client helpers — progressive enhancement only.
   Every path here fails QUIETLY: a device that can't do push (old browser,
   denied permission, Safari tab instead of the Home-Screen app) simply keeps
   using WonderNest exactly as before. Feature detection, never UA sniffing.

   The VAPID PUBLIC key is public by design (it identifies our app server to
   the browser's push service); the private twin lives only in Supabase Vault. */

import { createClient } from "@/lib/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BAAY3FP8__o4ZP10TgSp6621fmvyOk_UUBY37bRLP8MPzPF4bejK0e_LVTuAcRTX9Ol9xbAMQuoYkPPB0RSsW6s";

export type PushState =
  | "unsupported"      // browser has no push API at all
  | "needs-install"    // iOS: must be opened from the Home Screen icon first
  | "default"          // supported, user not asked yet
  | "granted"
  | "denied";

export function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari's legacy flag for Home-Screen web apps
      (navigator as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

export function pushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    // iPhone/iPad Safari TAB: push exists only for the installed app.
    // Feature-detect the gap (no PushManager outside standalone) and guide.
    const iosLike = "ontouchend" in document && !isStandalone();
    return iosLike ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

function b64ToUint8(base64url: string): Uint8Array {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob(b64 + pad);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch {
    return null; // the app must keep working if registration fails
  }
}

/** Ask permission (AFTER the user tapped a clear button) and store this
    device's subscription. Returns the resulting state for the UI. */
export async function enablePush(deviceLabel?: string): Promise<PushState> {
  const state = pushState();
  if (state === "unsupported" || state === "needs-install") return state;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return permission === "denied" ? "denied" : "default";
  }

  const reg = await registerWorker();
  if (!reg) return "unsupported";

  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "unsupported";
    const supabase = createClient();
    await supabase.rpc("save_push_subscription", {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_platform: isStandalone() ? "standalone" : "browser",
      p_device_label: deviceLabel ?? null,
    });
    return "granted";
  } catch {
    return "unsupported";
  }
}

/** Turn this device off: unsubscribe locally and delete the stored row. */
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const supabase = createClient();
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    }
  } catch {
    // best-effort — worst case the server disables it after failed sends
  }
}

/** Does THIS device currently hold a live push subscription? */
export async function hasLocalSubscription(): Promise<boolean> {
  try {
    if (pushState() !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    return !!(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/** On app load: if this device already opted in, quietly re-register the
    worker and refresh the stored subscription (keys can rotate). */
export async function refreshPushIfEnabled(): Promise<void> {
  try {
    if (pushState() !== "granted") return;
    const reg = await registerWorker();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
    const supabase = createClient();
    await supabase.rpc("save_push_subscription", {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys.p256dh,
      p_auth: json.keys.auth,
      p_platform: isStandalone() ? "standalone" : "browser",
    });
  } catch {
    // silent — push is never allowed to disturb the app
  }
}

/** Fire-and-forget: ask the server to drain this family's notification
    queue right now. Domain writes NEVER wait on this; if it fails, the
    sweeper delivers later. */
export function pingPush(): void {
  try {
    const supabase = createClient();
    void supabase.functions.invoke("send-push", { body: {} }).catch(() => {});
  } catch {
    // never let notification plumbing surface in the UI
  }
}
