/* WonderNest service worker — PUSH ONLY, by design.
   No fetch handler, no caching, no offline layer: quests, rewards and
   approvals must always come fresh from the network, and a worker that
   never intercepts requests can never trap users on a stale version
   (updates activate naturally; skipWaiting is deliberately not used). */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "WonderNest";
  const body = typeof data.body === "string" && data.body ? data.body : "Something magical happened!";
  // untrusted payload: only recognised INTERNAL routes may be a destination
  const dest =
    typeof data.destination === "string" && /^\/(app|admin)(\/|$)?/.test(data.destination)
      ? data.destination
      : "/";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/brand/app-icon-192.png",
      badge: "/brand/app-icon-192.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { destination: dest },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const dest =
    (event.notification.data && event.notification.data.destination) || "/";
  event.waitUntil(
    (async () => {
      const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const win of wins) {
        if ("focus" in win) {
          await win.focus();
          if ("navigate" in win) {
            try { await win.navigate(dest); } catch {}
          }
          return;
        }
      }
      await clients.openWindow(dest);
    })()
  );
});
