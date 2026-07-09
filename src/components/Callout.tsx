import { Icon } from "./Icon";

/* One status message for the whole app — error, success, or info. Replaces
   the half-dozen ad-hoc "centered danger text" and "panel p-3" treatments so
   every message reads the same on every screen, parent and child alike. */

type Tone = "error" | "success" | "info";

const TONES: Record<Tone, { color: string; icon: string }> = {
  error: { color: "var(--danger)", icon: "close" },
  success: { color: "var(--success)", icon: "check" },
  info: { color: "var(--accent-2)", icon: "sparkle" },
};

export function Callout({
  tone = "info",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-center gap-2.5 rounded-xl bg-black/25 px-4 py-3 text-sm font-bold ${className}`}
      style={{ color: t.color, boxShadow: `inset 0 0 0 1px ${t.color}33` }}
    >
      <Icon art name={t.icon} size={16} className="shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
