import React, { useEffect, useRef } from 'react';
import { Award, Droplets, Flame, X } from 'lucide-react';
import type { Language } from '../types/fitplate';

export type CelebrationKind = 'calorie' | 'water';

interface ConfettiOverlayProps {
  celebration: { id: number; kind: CelebrationKind } | null;
  language: Language;
  onDone: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  wobble: number;
  wobbleSpeed: number;
  shape: 'rect' | 'circle';
  alpha: number;
}

const CONFETTI_COLORS = [
  '#10b981', // emerald-500
  '#0ea5e9', // sky-500
  '#f59e0b', // amber-500
  '#14b8a6', // teal-500
  '#f43f5e', // rose-500
  '#34d399', // emerald-400
  '#38bdf8', // sky-400
];

export const ConfettiOverlay: React.FC<ConfettiOverlayProps> = ({
  celebration,
  language,
  onDone,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isHi = language === 'hi';

  useEffect(() => {
    if (!celebration) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const palette =
      celebration.kind === 'water'
        ? ['#0ea5e9', '#38bdf8', '#14b8a6', '#10b981', '#60a5fa', '#a5f3fc']
        : CONFETTI_COLORS;

    // Spawn burst from top-left, top-center, and top-right cannons
    const particles: Particle[] = Array.from({ length: 95 }, (_, idx) => {
      const originX =
        idx % 3 === 0 ? w * 0.25 : idx % 3 === 1 ? w * 0.5 : w * 0.75;
      const originY = h * 0.14;
      const spreadAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.45;
      const speed = 5 + Math.random() * 9.5;
      return {
        x: originX + (Math.random() - 0.5) * 40,
        y: originY + (Math.random() - 0.5) * 20,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed - 1.5,
        size: 6 + Math.random() * 6,
        color: palette[idx % palette.length],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.22,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.06 + Math.random() * 0.08,
        shape: idx % 4 === 0 ? 'circle' : 'rect',
        alpha: 1,
      };
    });

    const durationMs = 3400;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = elapsed / durationMs;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let activeCount = 0;
      for (const p of particles) {
        p.vy += 0.22; // gravity
        p.vx *= 0.985; // drag
        p.wobble += p.wobbleSpeed;
        p.x += p.vx + Math.sin(p.wobble) * 0.9;
        p.y += p.vy;
        p.rotation += p.vRot;
        if (progress > 0.65) {
          p.alpha = Math.max(0, 1 - (progress - 0.65) / 0.35);
        }

        if (p.alpha > 0.02 && p.y < window.innerHeight + 40) {
          activeCount++;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          if (p.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillRect(-p.size * 0.5, -p.size * 0.3, p.size, p.size * 0.6);
          }
          ctx.restore();
        }
      }

      if (elapsed < durationMs && activeCount > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        onDone();
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [celebration, onDone]);

  if (!celebration) return null;

  const isWater = celebration.kind === 'water';

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" aria-live="polite">
      <canvas ref={canvasRef} className="w-full h-full block" />

      <div className="fixed top-5 left-1/2 -translate-x-1/2 px-4 w-full max-w-sm pointer-events-auto">
        <div
          className={`rounded-2xl border shadow-lg px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md ${
            isWater
              ? 'bg-sky-600/95 border-sky-400 text-white'
              : 'bg-emerald-600/95 border-emerald-400 text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              {isWater ? <Droplets className="w-5 h-5" /> : <Flame className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs font-bold">
                <Award className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {isWater
                    ? isHi
                      ? '100% पानी का लक्ष्य पूर्ण!'
                      : '100% Water Goal Reached!'
                    : isHi
                    ? '100% कैलोरी लक्ष्य पूर्ण!'
                    : '100% Calorie Target Reached!'}
                </span>
              </div>
              <p className="text-[11px] text-white/90 truncate">
                {isWater
                  ? isHi
                    ? 'शानदार हाइड्रेशन! आज का लक्ष्य पूरा हुआ।'
                    : 'Great hydration! You hit your daily water goal.'
                  : isHi
                  ? 'बढ़िया! आपने आज का कैलोरी लक्ष्य हासिल कर लिया।'
                  : 'Awesome job hitting your daily calorie target!'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDone}
            aria-label="Dismiss celebration"
            className="min-h-[32px] min-w-[32px] rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
