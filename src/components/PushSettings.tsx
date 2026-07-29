"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { sfx } from "@/lib/sound";
import {
  PushState,
  pushState,
  enablePush,
  disablePush,
  hasLocalSubscription,
} from "@/lib/push";

/* One notifications card for both worlds. Progressive enhancement only:
   permission is requested strictly AFTER a tap, denial is respected without
   nagging, and unsupported devices see a calm explanation (or, on an iPhone/
   iPad Safari tab, the add-to-Home-Screen steps push requires there). */
export function PushSettings({ role }: { role: "parent" | "child" }) {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [thisDevice, setThisDevice] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(pushState());
    hasLocalSubscription().then(setThisDevice);
  }, []);

  const parent = role === "parent";
  const title = parent ? "Parent Alerts" : "Adventure Reminders";
  const blurb = parent
    ? "Get alerts when a child submits a quest, claims a reward or asks to join your family."
    : "Get gentle nudges when quests are approved, rewards arrive and badges are earned.";

  async function turnOn() {
    if (busy) return;
    setBusy(true);
    const result = await enablePush();
    setState(result);
    setThisDevice(await hasLocalSubscription());
    if (result === "granted") {
      try { sfx.chirp(); } catch {}
    }
    setBusy(false);
  }

  async function turnOff() {
    if (busy) return;
    setBusy(true);
    await disablePush();
    setThisDevice(false);
    setBusy(false);
  }

  return (
    <section className="panel p-5">
      <h2 className="text-display mb-1 flex items-center gap-2 text-lg font-black">
        <Icon art name="notification" size={22} /> {title}
      </h2>
      <p className="mb-3 text-xs leading-relaxed text-[var(--text-dim)]">{blurb}</p>

      {state === "loading" ? null : state === "needs-install" ? (
        <p className="rounded-xl bg-black/25 px-4 py-3 text-xs leading-relaxed text-[var(--text-dim)]">
          To receive WonderNest notifications on this device, first add WonderNest to your
          Home Screen (Share <span aria-hidden>→</span> Add to Home Screen), open it from the
          new icon, then come back here and turn alerts on.
        </p>
      ) : state === "unsupported" ? (
        <p className="rounded-xl bg-black/25 px-4 py-3 text-xs text-[var(--text-dim)]">
          This browser can&apos;t receive notifications — everything else works normally.
        </p>
      ) : state === "denied" ? (
        <p className="rounded-xl bg-black/25 px-4 py-3 text-xs leading-relaxed text-[var(--text-dim)]">
          Notifications are blocked for WonderNest in this device&apos;s settings. To turn
          them on, allow notifications for WonderNest there, then return here.
        </p>
      ) : state === "granted" && thisDevice ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-display flex items-center gap-1.5 rounded-xl bg-black/25 px-3 py-2 text-xs font-bold text-[var(--success)]">
            <Icon art name="check" size={14} /> On for this device
          </span>
          <button
            onClick={turnOff}
            disabled={busy}
            className="text-display cursor-pointer rounded-xl bg-black/25 px-3 py-2 text-xs font-bold text-[var(--text-dim)] transition-colors hover:bg-black/40 hover:text-[var(--text)]"
          >
            {busy ? "Turning off…" : "Turn off on this device"}
          </button>
        </div>
      ) : (
        <button
          onClick={turnOn}
          disabled={busy}
          className="text-display cursor-pointer rounded-xl px-4 py-2.5 text-sm font-black text-white transition-[filter] hover:brightness-110"
          style={{
            background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
            boxShadow: "0 0 16px -4px var(--glow)",
          }}
        >
          {busy
            ? "Setting up…"
            : parent
              ? "Enable Parent Alerts"
              : "Enable Adventure Reminders"}
        </button>
      )}
    </section>
  );
}
