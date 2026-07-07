"use client";

/* Small shared building blocks for the parent console. */

/* When a page resolves a pending item (approves a proof, grants a reward,
   answers a wish), it fires this so the sidebar's "what needs me" badges
   recount immediately — the counts stay honest without a page reload. */
export const ADMIN_REFRESH = "qf-admin-refresh";
export function pingAdminRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ADMIN_REFRESH));
}

export function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-display mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-3.5 py-2.5 text-sm font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]/50 focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
      />
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="text-display mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </span>
      <textarea
        {...props}
        className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-3.5 py-2.5 text-sm font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-dim)]/50 focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
      />
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="text-display mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </span>
      <select
        {...props}
        className="w-full cursor-pointer rounded-xl border border-[var(--surface-border)] bg-[var(--surface-solid)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text)] outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
      >
        {children}
      </select>
    </label>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-display text-lg font-black">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[var(--text-dim)]">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-black/25 p-5 text-center text-sm font-semibold text-[var(--text-dim)]">
      {children}
    </p>
  );
}

/* The parent console's button — calm and elegant. No sparkles, no squash;
   just a clear, confident target with a quiet hover. This is deliberately
   NOT the child's GameButton. */
export function AdminButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  type = "button",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "subtle" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  title?: string;
}) {
  const sizes: Record<string, string> = {
    sm: "min-h-[36px] gap-1.5 px-3 text-xs",
    md: "min-h-[42px] gap-2 px-4 text-sm",
  };
  const variants: Record<string, string> = {
    primary: "bg-[var(--accent)] text-white hover:brightness-110",
    subtle: "bg-black/25 text-[var(--text)] hover:bg-black/35",
    ghost:
      "border border-[var(--surface-border)] text-[var(--text-dim)] hover:bg-black/25 hover:text-[var(--text)]",
    danger:
      "border border-[var(--danger)]/35 text-[var(--danger)] hover:bg-[var(--danger)]/12",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`text-display inline-flex select-none items-center justify-center rounded-xl font-bold transition-[background,filter,color] disabled:cursor-not-allowed disabled:opacity-40 ${
        disabled ? "" : "cursor-pointer"
      } ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/* Plain, quiet loading state for the parent console — no magic effects. */
export function AdminLoader({ label = "Loading\u2026" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm font-semibold text-[var(--text-dim)]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--surface-border)] border-t-[var(--accent)]" />
      {label}
    </div>
  );
}
