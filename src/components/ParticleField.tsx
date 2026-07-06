"use client";

import { useEffect, useRef } from "react";
import { useWorld } from "./ThemeProvider";
import { ThemeId } from "@/lib/game";

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  alpha: number;
  hueShift: number;
}

/* Full-screen ambient particles: petals (ninja), golden leaves (samurai),
   energy streaks (speed). Runs on one canvas, ~40 particles, cheap. */
export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useWorld();
  const themeRef = useRef<ThemeId>(theme.id);
  themeRef.current = theme.id;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const COUNT = 42;
    const parts: P[] = Array.from({ length: COUNT }, () => spawn(true));

    function spawn(anywhere = false): P {
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -20,
        vx: 0,
        vy: 0,
        size: 3 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.04,
        alpha: 0.35 + Math.random() * 0.5,
        hueShift: Math.random(),
      };
    }

    let raf = 0;
    let t = 0;
    const draw = () => {
      t += 0.008;
      ctx.clearRect(0, 0, w, h);
      const mode = themeRef.current;

      for (const p of parts) {
        if (mode === "speed") {
          // horizontal energy streaks
          p.vx = 6 + p.size * 1.2;
          p.vy = Math.sin(t * 2 + p.rot) * 0.4;
          p.x += p.vx;
          p.y += p.vy;
          if (p.x > w + 40) {
            Object.assign(p, spawn(), { x: -40, y: Math.random() * h });
          }
          const grad = ctx.createLinearGradient(p.x - p.size * 8, p.y, p.x, p.y);
          grad.addColorStop(0, "rgba(35,213,255,0)");
          grad.addColorStop(1, `rgba(${p.hueShift > 0.7 ? "255,224,102" : "125,243,255"},${p.alpha})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = Math.max(1, p.size / 3);
          ctx.beginPath();
          ctx.moveTo(p.x - p.size * 8, p.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        } else {
          // falling petals / leaves
          p.vy = 0.4 + p.size * 0.08;
          p.vx = Math.sin(t + p.rot * 3) * 0.6 + (mode === "samurai" ? 0.35 : 0.15);
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vrot;
          if (p.y > h + 20 || p.x > w + 30) {
            Object.assign(p, spawn(), { y: -20, x: Math.random() * w });
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = p.alpha * 0.8;
          if (mode === "ninja") {
            ctx.fillStyle = p.hueShift > 0.75 ? "#8fd0ff" : "#ffb7d0";
            petal(ctx, p.size);
          } else {
            ctx.fillStyle = p.hueShift > 0.6 ? "#ffd98a" : "#f0a132";
            leaf(ctx, p.size);
          }
          ctx.restore();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    function petal(c: CanvasRenderingContext2D, s: number) {
      c.beginPath();
      c.ellipse(0, 0, s * 0.6, s, 0, 0, Math.PI * 2);
      c.fill();
    }
    function leaf(c: CanvasRenderingContext2D, s: number) {
      c.beginPath();
      c.moveTo(0, -s);
      c.quadraticCurveTo(s, 0, 0, s);
      c.quadraticCurveTo(-s, 0, 0, -s);
      c.fill();
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fx-heavy pointer-events-none fixed inset-0 z-[5]"
      aria-hidden
    />
  );
}
