"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/Icon";
import { overlayFade, popSpring } from "@/lib/motion";
import { useEscape } from "@/lib/a11y";
import {
  QUEST_LIBRARY,
  QuestProfile,
  PILLARS,
  Pillar,
  QuestPriority,
  PRIORITY_META,
  SCHEDULE_LABEL,
} from "@/lib/questLibrary";

/* The Official Quest Library browser. Read-only: pick a profile to pre-fill the
   existing Quest / Routine form, where every field stays editable before saving.
   Purely additive — it never changes the create flow, economy, or taxonomy. */
export function QuestLibraryModal({
  onPick,
  onClose,
}: {
  onPick: (p: QuestProfile) => void;
  onClose: () => void;
}) {
  const [pillar, setPillar] = useState<Pillar | "all">("all");
  const [priority, setPriority] = useState<QuestPriority | "all">("all");
  const [search, setSearch] = useState("");
  useEscape(true, onClose);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return QUEST_LIBRARY.filter(
      (p) =>
        (pillar === "all" || p.pillar === pillar) &&
        (priority === "all" || p.priority === priority) &&
        (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    );
  }, [pillar, priority, search]);

  // group by pillar, in the official order, priority-first within each
  const groups = useMemo(
    () =>
      PILLARS.map((pl) => ({
        pillar: pl,
        items: filtered
          .filter((p) => p.pillar === pl.id)
          .sort(
            (a, b) =>
              PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank ||
              a.name.localeCompare(b.name)
          ),
      })).filter((g) => g.items.length > 0),
    [filtered]
  );

  return (
    <motion.div
      {...overlayFade}
      role="dialog"
      aria-modal="true"
      aria-label="Official Quest Library"
      className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={popSpring}
        onClick={(e) => e.stopPropagation()}
        className="panel panel-glow flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden p-0"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--surface-border)] p-5">
          <div className="flex items-center gap-2.5">
            <Icon name="scroll" size={26} art muted />
            <div>
              <h2 className="text-display text-lg font-black">Official Quest Library</h2>
              <p className="text-xs text-[var(--text-dim)]">
                Tap a quest to load it into the form — you can edit every field before saving.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-black/25 hover:text-[var(--text)]"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* filters */}
        <div className="flex flex-col gap-2.5 border-b border-[var(--surface-border)] p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quests…"
            className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-2.5 text-sm font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
          />
          <div className="flex flex-wrap gap-1.5">
            <Chip active={pillar === "all"} onClick={() => setPillar("all")}>
              All
            </Chip>
            {PILLARS.map((pl) => (
              <Chip key={pl.id} active={pillar === pl.id} onClick={() => setPillar(pl.id)}>
                <Icon name={pl.icon} size={13} art muted /> {pl.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={priority === "all"} onClick={() => setPriority("all")}>
              Any priority
            </Chip>
            {(Object.keys(PRIORITY_META) as QuestPriority[]).map((pr) => (
              <Chip key={pr} active={priority === pr} onClick={() => setPriority(pr)}>
                {PRIORITY_META[pr].label}
              </Chip>
            ))}
          </div>
        </div>

        {/* list */}
        <div className="flex-1 overflow-y-auto p-4">
          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text-dim)]">
              No quests match those filters.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {groups.map((g) => (
                <div key={g.pillar.id}>
                  <div className="mb-2 flex items-center gap-2">
                    <Icon name={g.pillar.icon} size={16} art muted />
                    <h3 className="text-display text-sm font-black">{g.pillar.label}</h3>
                    <span className="text-[11px] font-bold text-[var(--text-dim)]">
                      {g.items.length}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {g.items.map((p) => (
                      <ProfileRow key={p.id} p={p} onPick={() => onPick(p)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProfileRow({ p, onPick }: { p: QuestProfile; onPick: () => void }) {
  const pr = PRIORITY_META[p.priority];
  return (
    <button
      onClick={onPick}
      className="group flex w-full items-center gap-3 rounded-xl bg-black/25 px-4 py-3 text-left transition-colors hover:bg-black/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-display text-sm font-bold">{p.name}</span>
          <span
            className="text-display rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
            style={{ color: pr.color, background: "rgba(0,0,0,0.35)" }}
          >
            {pr.label}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-[var(--text-dim)]">
          {p.category} · {SCHEDULE_LABEL[p.schedule]} · Ages {p.ageMin}–{p.ageMax} · {p.verification}
        </p>
      </div>
      <Icon
        name="plus"
        size={16}
        className="shrink-0 text-[var(--text-dim)] transition-colors group-hover:text-[var(--accent-2)]"
      />
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`text-display inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "bg-[var(--accent)] text-white"
          : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40 hover:text-[var(--text)]"
      }`}
    >
      {children}
    </button>
  );
}
