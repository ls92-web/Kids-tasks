"use client";

/* Small shared building blocks for the parent console. */

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
    <p className="rounded-xl bg-black/20 p-5 text-center text-sm font-semibold text-[var(--text-dim)]">
      {children}
    </p>
  );
}
