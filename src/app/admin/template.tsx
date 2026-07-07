"use client";

import { motion } from "framer-motion";
import { page } from "@/lib/motion";

/* The same subtle transition the child app uses — one motion language. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div {...page}>{children}</motion.div>;
}
