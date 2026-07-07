"use client";

import { useEffect } from "react";

/* Close any modal/overlay with the Escape key while it's active.
   Used by every dialog in the app so keyboard users are never trapped. */
export function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}
