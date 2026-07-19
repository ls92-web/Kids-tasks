"use client";

import { Icon } from "@/components/Icon";

/* A visual grid the parent taps to pick a card icon — used when creating a
   quest, reward, or challenge. Options are pre-filtered to a curated,
   content-appropriate pool per call site; the currently-selected one is
   highlighted. */
export function IconPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  /** `art` overrides which icon slug renders, when the stored `id` is a
      category (e.g. rewards store a category like "movie", not the art
      slug "golden-ticket" it renders as) rather than an art slug itself. */
  options: { id: string; label: string; art?: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <span className="text-display mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </span>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              title={o.label}
              aria-label={o.label}
              aria-pressed={selected}
              onClick={() => onChange(o.id)}
              className={`grid aspect-square cursor-pointer place-items-center rounded-xl transition-colors ${
                selected ? "bg-[var(--accent)]/25 ring-2 ring-[var(--accent)]" : "bg-black/25 hover:bg-black/40"
              }`}
            >
              <Icon name={o.art ?? o.id} art size={24} muted={!selected} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
