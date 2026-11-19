import React, { useEffect, useRef } from 'react';
import { Award, Droplets, Flame, Sparkles, X } from 'lucide-react';
import type { Language } from '../types/fitplate';

export type CelebrationKind = 'calorie' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'water';

interface ConfettiOverlayProps {
  celebration: { id: number; kind: CelebrationKind } | null;
  language: Language;
  onDone: () => void;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
  flickerPhase: number;
  flickerSpeed: number;
  kind: 'star' | 'ember';
  alpha: number;
}

const SPARKLE_PALETTES: Record<CelebrationKind, string[]> = {
  calorie: ['#fbbf24', '#f59e0b', '#fb7185', '#10b981', '#fde68a', '#34d399'],
  protein: ['#34d399', '#10b981', '#fbbf24', '#a7f3d0', '#fde047', '#2dd4bf'],
  carbs: ['#38bdf8', '#fbbf24', '#60a5fa', '#fde68a', '#22d3ee', '#f59e0b'],
  fat: ['#fbbf24', '#f59e0b', '#fb923c', '#fde68a', '#facc15', '#34d399'],
  fiber: ['#2dd4bf', '#10b981', '#fbbf24', '#5eead4', '#a7f3d0', '#fde68a'],
  water: ['#38bdf8', '#0ea5e9', '#67e8f9', '#2dd4bf', '#bae6fd', '#fbbf24'],
};

function getCelebrationCopy(kind: CelebrationKind, isHi: boolean) {
  switch (kind) {
    case 'protein':
      return {
        title: isHi ? 'प्रोटीन लक्ष्य पूरा! शानदार!' : '100% Protein Target Met!',
        subtitle: isHi
          ? 'मांसपेशियों और रिकवरी के लिए आज का प्रोटीन लक्ष्य हासिल हुआ।'
          : 'Fueling muscle & recovery—your daily protein target is complete!',
      };
    case 'carbs':
      return {
        title: isHi ? 'कार्ब्स लक्ष्य पूर्ण!' : '100% Carbs Target Met!',
        subtitle: isHi
          ? 'संपूर्ण ऊर्जा के लिए आपका दैनिक कार्बोहाइड्रेट लक्ष्य पूरा हुआ।'
          : 'Great steady energy—you hit your daily carbs target!',
      };
    case 'fat':
      return {
        title: isHi ? 'हेल्दी फैट्स लक्ष्य पूर्ण!' : '100% Healthy Fats Target Met!',
        subtitle: isHi
          ? 'हार्मोन और पोषण संतुलन के लिए आज का फैट लक्ष्य पूरा हुआ।'
          : 'Balanced nutrition—your daily healthy fat target is complete!',
      };
    case 'fiber':
      return {
        title: isHi ? 'फाइबर लक्ष्य पूर्ण!' : '100% Fiber Target Met!',
        subtitle: isHi
          ? 'बेहतर पाचन और फिटनेस के लिए आज का फाइबर लक्ष्य पूरा हुआ।'
          : 'Awesome gut health—you reached your daily fiber goal!',
      };
    case 'water':
      return {
        title: isHi ? '100% पानी का लक्ष्य पूर्ण!' : '100% Water Goal Reached!',
        subtitle: isHi
          ? 'शानदार हाइड्रेशन! आज का पानी का लक्ष्य पूरा हुआ।'
          : 'Great hydration! You hit your daily water goal.',
      };
    case 'calorie':
    default:
      return {
        title: isHi ? '100% कैलोरी लक्ष्य पूर्ण!' : '100% Calorie Target Reached!',
        subtitle: isHi
          ? 'बढ़िया! आपने आज का कैलोरी लक्ष्य हासिल कर लिया।'
          : 'Awesome job hitting your daily calorie target!',
      };
  }
}

function drawFourPointStar(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath();
  const spikes = 4;
  const inner = radius * 0.34;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? radius : inner;
    const angle = (i * Math.PI) / spikes;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

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
    const palette = SPARKLE_PALETTES[celebration.kind] || SPARKLE_PALETTES.calorie;

    // Multi-point burning sparkle starbursts across the home screen
    const origins = [
      { x: w * 0.22, y: h * 0.24 },
      { x: w * 0.5, y: h * 0.18 },
      { x: w * 0.78, y: h * 0.24 },
      { x: w * 0.35, y: h * 0.42 },
      { x: w * 0.65, y: h * 0.42 },
    ];

    const particles: SparkleParticle[] = Array.from({ length: 120 }, (_, idx) => {
      const origin = origins[idx % origins.length];
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 7.5;
      return {
        x: origin.x + (Math.random() - 0.5) * 16,
        y: origin.y + (Math.random() - 0.5) * 16,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.8,
        size: 4 + Math.random() * 6.5,
        color: palette[idx % palette.length],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.16,
        flickerPhase: Math.random() * Math.PI * 2,
        flickerSpeed: 0.18 + Math.random() * 0.16,
        kind: idx % 3 === 0 ? 'ember' : 'star',
        alpha: 1,
      };
    });

    const durationMs = 3200;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = elapsed / durationMs;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let activeCount = 0;
      for (const p of particles) {
        p.vy += 0.085;
        p.vx *= 0.975;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;
        p.flickerPhase += p.flickerSpeed;

        const twinkle = 0.65 + 0.35 * Math.sin(p.flickerPhase);
        const fade = progress > 0.55 ? Math.max(0, 1 - (progress - 0.55) / 0.45) : 1;
        p.alpha = fade * twinkle;

        if (p.alpha > 0.02 && p.y < window.innerHeight + 40) {
          activeCount++;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.shadowBlur = 14;
          ctx.shadowColor = p.color;
          ctx.fillStyle = p.color;

          if (p.kind === 'star') {
            drawFourPointStar(ctx, p.size);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, Math.max(1, p.size * 0.18), 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
            ctx.fill();
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
  const copy = getCelebrationCopy(celebration.kind, isHi);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" aria-live="polite">
      <canvas ref={canvasRef} className="w-full h-full block" />

      <div className="fixed top-5 left-1/2 -translate-x-1/2 px-4 w-full max-w-sm pointer-events-auto">
        <div
          className={`rounded-2xl border shadow-xl px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md ${
            isWater
              ? 'bg-sky-600/95 border-sky-300 text-white'
              : 'bg-slate-900/95 dark:bg-emerald-900/95 border-amber-400/80 text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
              {isWater ? (
                <Droplets className="w-5 h-5 text-sky-200" />
              ) : celebration.kind === 'calorie' ? (
                <Flame className="w-5 h-5 text-amber-300" />
              ) : (
                <Sparkles className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs font-bold">
                <Award className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">{copy.title}</span>
              </div>
              <p className="text-[11px] text-white/90 truncate">{copy.subtitle}</p>
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
