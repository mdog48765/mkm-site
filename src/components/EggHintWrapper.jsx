// src/components/EggHintWrapper.jsx
import { useEffect, useRef, useState } from "react";

export default function EggHintWrapper({
  children,
  rippleRadius = 24,   // px distance to trigger ripple when tapping near area
  demoOnMount = true,  // flashes once after mount so you can verify it's working
}) {
  const wrapRef = useRef(null);
  const [demo, setDemo] = useState(demoOnMount);

  useEffect(() => {
    if (!demoOnMount) return;
    const t = setTimeout(() => setDemo(false), 1100);
    return () => clearTimeout(t);
  }, [demoOnMount]);

  // Mobile near-tap ripple + haptic
  useEffect(() => {
    const onTouch = (e) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const t = e.touches?.[0];
      if (!t) return;

      const dx = Math.max(r.left - t.clientX, 0, t.clientX - r.right);
      const dy = Math.max(r.top - t.clientY, 0, t.clientY - r.bottom);
      const dist = Math.hypot(dx, dy);

      if (dist <= rippleRadius) {
        const dot = document.createElement("span");
        dot.className =
          "pointer-events-none fixed h-2 w-2 rounded-full bg-white/70";
        dot.style.left = `${t.clientX}px`;
        dot.style.top = `${t.clientY}px`;
        dot.style.transform = "translate(-50%, -50%)";
        dot.style.zIndex = 60;
        dot.style.animation = "egg_ripple 600ms ease-out 1";
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 650);
        if (navigator.vibrate) navigator.vibrate(10);
      }
    };

    window.addEventListener("touchstart", onTouch, { passive: true });
    return () => window.removeEventListener("touchstart", onTouch);
  }, [rippleRadius]);

  return (
    <div ref={wrapRef} className="relative inline-block group/egg[line-height:0]">
      {children}

      {/* Halo overlay: brighter + guaranteed z-index */}
     <span
  aria-hidden
  className="pointer-events-none absolute left-0 right-0 top-0 bottom-0 rounded-md"
  style={{
    zIndex: 55,
    opacity: demo ? 1 : 0,
    transition: "opacity 200ms",
    boxShadow: "0 0 10px 1px rgba(255,255,255,0.35)",
    animation: demo ? "egg_breathe 1.1s ease-in-out 1" : undefined,
  }}
/>


      {/* ✅ fixed template literal closure */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .group\\/egg * {
            animation: none !important;
            transition: none !important;
          }
        }

        .group\\/egg:hover > span[aria-hidden],
        .group\\/egg:focus-within > span[aria-hidden] {
          opacity: 1 !important;
          animation: egg_breathe 1.1s ease-in-out 1;
        }

        @keyframes egg_breathe {
          0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.00); }
          50%  { box-shadow: 0 0 18px 2px rgba(255,255,255,0.40); }
          100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.00); }
        }

        @keyframes egg_ripple {
          0%   { opacity: 0.7; transform: translate(-50%, -50%) scale(0.8); }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(2.2); }
        }
      `}</style>
    </div>
  );
}
