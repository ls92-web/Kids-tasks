"use client";

import { motion } from "framer-motion";
import { page } from "@/lib/motion";

/* One subtle, consistent transition on every route change. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div {...page}>{children}</motion.div>;
}
