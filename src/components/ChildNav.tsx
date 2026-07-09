"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "./Icon";
import { sfx } from "@/lib/sound";
import { tapSpring } from "@/lib/motion";

/* Three destinations, nothing more. A child should never wonder where to tap. */
const items = [
  { href: "/app", icon: "adventure", label: "Adventure" },
  { href: "/app/shop", icon: "chest", label: "Treasures" },
  { href: "/app/character", icon: "hero", label: "Hero" },
];

export function ChildNav() {
  const pathname = usePathname();

  return (
    <nav className="panel fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 px-2 py-2">
      {items.map((item) => {
        const active =
          item.href === "/app" ? pathname === "/app" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => sfx.click()}
            aria-current={active ? "page" : undefined}
            className="relative"
          >
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.92 }}
              className={`relative flex flex-col items-center gap-0.5 rounded-2xl px-4 py-2 transition-colors ${
                active ? "text-[var(--accent-2)]" : "text-[var(--text-dim)]"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background: "var(--glow-soft)",
                    boxShadow: "0 0 18px -2px var(--glow), inset 0 0 0 1px var(--surface-border)",
                  }}
                  transition={tapSpring}
                />
              )}
              <Icon
                name={item.icon}
                size={26}
                art
                className={`relative transition-[filter,opacity] ${active ? "" : "opacity-70 saturate-[0.9]"}`}
              />
              <span className="text-display relative text-[11px] font-bold">{item.label}</span>
            </motion.div>
          </Link>
        );
      })}
    </nav>
  );
}
