// src/components/SnakeGame.jsx
import React, { useEffect, useRef, useState } from "react";

const BASE_CELL = 22;
const INIT_SPEED = 135;
const MIN_SPEED  = 70;
const SPEED_STEP = 6;
const PADDING    = 12;

export default function SnakeGame() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const tickTimerRef = useRef(null);

  // Game refs
  const dirRef = useRef({ x: 1, y: 0 });
  const nextDirRef = useRef({ x: 1, y: 0 });
  const snakeRef = useRef([{ x: 6, y: 10 }, { x: 5, y: 10 }, { x: 4, y: 10 }]);
  const foodRef  = useRef({ x: 12, y: 8 });
  const scoreRef = useRef(0);
  const speedRef = useRef(INIT_SPEED);
  const runningRef = useRef(false);
  const imgRef = useRef(null);

  // UI state
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [hi, setHi] = useState(() => Number(localStorage.getItem("mkm_hi") || 0));
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);                 // keeps toggle in sync for interval callbacks
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  // Grid
  const gridRef = useRef({ cols: 24, rows: 16, cell: BASE_CELL });

  // Touch
  const swipeRef = useRef({ x: 0, y: 0, active: false });

  // --- Audio ---
  const audioRef = useRef(null);
  const ensureAudio = () => {
    if (!audioRef.current) {
      try { audioRef.current = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { audioRef.current = null; }
    }
    return audioRef.current;
  };
  const playTone = (freq = 440, dur = 0.08, type = "sine", vol = 0.05) => {
    if (!soundOnRef.current) return;
    const ctx = ensureAudio(); if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = vol;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.stop(now + dur + 0.01);
  };
  const sfxEat = () => playTone(880, 0.06, "triangle", 0.06);
  const sfxCrash = () => { playTone(140, 0.12, "sawtooth", 0.08); setTimeout(() => playTone(110, 0.12, "square", 0.08), 70); };

  // Logo image
  useEffect(() => {
    const img = new Image();
    img.src = "/thumbnail_MKM%20Entertainment%20logo.png";
    img.onload = () => { imgRef.current = img; draw(); };
    img.onerror = () => { imgRef.current = null; draw(); };
    imgRef.current = img;
  }, []);

  // Canvas sizing
  function resizeCanvas() {
    const wrap = wrapRef.current, canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const cssW = Math.max(300, wrap.clientWidth);
    const cssH = Math.max(260, Math.floor(cssW * 0.66));

    const cols = Math.floor((cssW - PADDING * 2) / BASE_CELL);
    const rows = Math.floor((cssH - (PADDING + 4) * 2) / BASE_CELL);
    const cell = Math.floor(Math.min(
      (cssW - PADDING * 2) / cols,
      (cssH - (PADDING + 4) * 2) / rows
    ));
    gridRef.current = { cols: Math.max(16, cols), rows: Math.max(12, rows), cell: Math.max(14, cell) };

    const innerW = gridRef.current.cols * gridRef.current.cell + PADDING * 2;
    const innerH = gridRef.current.rows * gridRef.current.cell + (PADDING + 4) * 2;

    canvas.width  = Math.floor(innerW * dpr);
    canvas.height = Math.floor(innerH * dpr);
    canvas.style.width  = `${innerW}px`;
    canvas.style.height = `${innerH}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    wrapRef.current && ro.observe(wrapRef.current);
    window.addEventListener("resize", resizeCanvas);
    setTimeout(() => wrapRef.current?.focus(), 0);            // keyboard ready

    const onVis = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resizeCanvas);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === " " || k === "enter") { e.preventDefault(); toggle(); return; }
      let nx, ny;
      if (k === "arrowup" || k === "w") { nx = 0; ny = -1; }
      else if (k === "arrowdown" || k === "s") { nx = 0; ny = 1; }
      else if (k === "arrowleft" || k === "a") { nx = -1; ny = 0; }
      else if (k === "arrowright" || k === "d") { nx = 1; ny = 0; }
      else return;

      const cur = dirRef.current;
      if (nx === -cur.x && ny === -cur.y) return;
      nextDirRef.current = { x: nx, y: ny };
      if (!runningRef.current) { ensureAudio(); start(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Swipe
  function onTouchStart(e) {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY, active: true };
  }
  function onTouchMove(e) {
    if (!swipeRef.current.active) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeRef.current.x;
    const dy = t.clientY - swipeRef.current.y;
    const absx = Math.abs(dx), absy = Math.abs(dy);
    if (absx < 24 && absy < 24) return;
    let nx = nextDirRef.current.x, ny = nextDirRef.current.y;

    if (absx > absy) nx = dx > 0 ? 1 : -1;
    else ny = dy > 0 ? 1 : -1;

    const cur = dirRef.current;
    if (!(nx === -cur.x && ny === -cur.y)) nextDirRef.current = { x: nx, y: ny };
    swipeRef.current.active = false;
    if (!runningRef.current) { ensureAudio(); start(); }
  }
  function onTouchEnd() { swipeRef.current.active = false; }

  // Controls
  function start() {
    if (runningRef.current) return;
    runningRef.current = true; setRunning(true);
    clearInterval(tickTimerRef.current);
    tickTimerRef.current = setInterval(tick, speedRef.current);
    loop();
  }
  function pause() {
    runningRef.current = false; setRunning(false);
    clearInterval(tickTimerRef.current);
    cancelAnimationFrame(rafRef.current);
  }
  function toggle() { runningRef.current ? pause() : (ensureAudio(), start()); }

  function reset() {
    pause();
    const { rows } = gridRef.current;
    dirRef.current = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };
    snakeRef.current = [
      { x: 6, y: Math.floor(rows / 2) },
      { x: 5, y: Math.floor(rows / 2) },
      { x: 4, y: Math.floor(rows / 2) },
    ];
    foodRef.current  = randomFood();
    scoreRef.current = 0; setScore(0);
    speedRef.current = INIT_SPEED;
    draw();
  }

  function randomFood() {
    const { cols, rows } = gridRef.current;
    const snake = snakeRef.current;
    while (true) {
      const f = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
      if (!snake.some(s => s.x === f.x && s.y === f.y)) return f;
    }
  }

  // Tick — WALL KILL ONLY
  function tick() {
    dirRef.current = nextDirRef.current;
    const { cols, rows } = gridRef.current;
    const snake = snakeRef.current.slice();
    const head = { x: snake[0].x + dirRef.current.x, y: snake[0].y + dirRef.current.y };

    // solid walls
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
      sfxCrash(); reset(); return;
    }

    // self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      sfxCrash(); reset(); return;
    }

    snake.unshift(head);

    // eat?
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      scoreRef.current += 1; setScore(scoreRef.current);
      if (scoreRef.current > hi) { setHi(scoreRef.current); localStorage.setItem("mkm_hi", String(scoreRef.current)); }
      foodRef.current = randomFood();
      sfxEat();

      speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_STEP);
      clearInterval(tickTimerRef.current);
      tickTimerRef.current = setInterval(tick, speedRef.current);
    } else {
      snake.pop();
    }
    snakeRef.current = snake;
  }

  // Draw
  function draw() {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { cols, rows, cell } = gridRef.current;

    // bg
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const grad = ctx.createLinearGradient(0, 0, 0, rows * cell + PADDING * 2);
    grad.addColorStop(0, "#0b0f1a"); grad.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // field
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fillRect(PADDING, PADDING, cols * cell, rows * cell);

    // subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) { const px = PADDING + x * cell; ctx.beginPath(); ctx.moveTo(px, PADDING); ctx.lineTo(px, PADDING + rows * cell); ctx.stroke(); }
    for (let y = 0; y <= rows; y++) { const py = PADDING + y * cell; ctx.beginPath(); ctx.moveTo(PADDING, py); ctx.lineTo(PADDING + cols * cell, py); ctx.stroke(); }

    // snake
    const snake = snakeRef.current;
    snake.forEach((seg, i) => {
      const px = PADDING + seg.x * cell, py = PADDING + seg.y * cell;
      const inset = 3, w = cell - inset * 2, h = cell - inset * 2;

      ctx.save();
      ctx.shadowColor = i === 0 ? "rgba(59,130,246,0.75)" : "rgba(239,68,68,0.5)";
      ctx.shadowBlur = i === 0 ? 16 : 10;

      ctx.fillStyle = i === 0 ? "#60a5fa" : "#ef4444";
      roundRect(ctx, px + inset, py + inset, w, h, Math.min(6, w / 3)); ctx.fill();

      const sheen = ctx.createLinearGradient(px, py, px, py + h);
      sheen.addColorStop(0, "rgba(255,255,255,0.30)");
      sheen.addColorStop(1, "rgba(255,255,255,0.00)");
      ctx.fillStyle = sheen;
      roundRect(ctx, px + inset, py + inset, w, Math.max(2, h * 0.18), Math.min(6, w / 3)); ctx.fill();
      ctx.restore();
    });

    // food (MKM logo)
    const f = foodRef.current; const fx = PADDING + f.x * cell; const fy = PADDING + f.y * cell;
    const pad = Math.max(3, Math.floor(cell * 0.14));
    const img = imgRef.current;
    ctx.save(); ctx.shadowColor = "rgba(255,255,255,0.25)"; ctx.shadowBlur = 12;
    if (img && img.complete) ctx.drawImage(img, fx + pad, fy + pad, cell - pad * 2, cell - pad * 2);
    else { ctx.fillStyle = "#ffffff"; roundRect(ctx, fx + pad, fy + pad, cell - pad * 2, cell - pad * 2, 6); ctx.fill(); }
    ctx.restore();

    // HUD
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(`Score: ${scoreRef.current}  Hi: ${hi}`, PADDING, 18);
    ctx.fillText(runningRef.current ? "Running" : "Paused", PADDING + 140, 18);
  }

  function loop() {
    draw();
    if (runningRef.current) rafRef.current = requestAnimationFrame(loop);
  }

  useEffect(() => {
    reset(); draw();
    return () => { clearInterval(tickTimerRef.current); cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // D-pad helper
  const setDir = (x, y) => {
    const cur = dirRef.current;
    if (x === -cur.x && y === -cur.y) return;
    nextDirRef.current = { x, y };
    if (!runningRef.current) { ensureAudio(); start(); }
  };

  return (
    <div
      ref={wrapRef}
      className="w-full focus:outline-none"
      tabIndex={0}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-slate-900/70 p-3 shadow-xl">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="text-sm text-slate-300">Arrow keys / WASD • Swipe on mobile</div>
          <div className="flex items-center flex-wrap gap-2">
            <button onClick={() => (ensureAudio(), toggle())} className="rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">
              {running ? "Pause" : "Start"}
            </button>
            <button onClick={reset} className="rounded-lg bg-slate-700 px-3 py-2 text-white hover:bg-slate-600">
              Reset
            </button>
            <button
              onClick={() => setSoundOn(v => !v)}
              className="rounded-lg bg-slate-700 px-3 py-2 text-white hover:bg-slate-600"
              title={soundOn ? "Sound: On" : "Sound: Off"}
            >
              {soundOn ? "Sound: On" : "Sound: Off"}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="mt-2 flex justify-center">
          <canvas ref={canvasRef} className="rounded-xl border border-white/10" />
        </div>

        {/* Mobile D-pad — BIGGER + CLOSER */}
        <div className="mt-3 grid grid-cols-3 place-items-center gap-1.5 sm:hidden select-none">
          <span />
          <button
            onClick={() => setDir(0, -1)}
            className="rounded-xl bg-slate-700 px-7 py-7 text-white text-2xl active:scale-95"
            aria-label="Up"
          >▲</button>
          <span />
          <button
            onClick={() => setDir(-1, 0)}
            className="rounded-xl bg-slate-700 px-7 py-7 text-white text-2xl active:scale-95"
            aria-label="Left"
          >◀</button>
          <button
            onClick={() => setDir(0, 1)}
            className="rounded-xl bg-slate-700 px-7 py-7 text-white text-2xl active:scale-95"
            aria-label="Down"
          >▼</button>
          <button
            onClick={() => setDir(1, 0)}
            className="rounded-xl bg-slate-700 px-7 py-7 text-white text-2xl active:scale-95"
            aria-label="Right"
          >▶</button>
        </div>

        <div className="mt-2 text-center text-sm text-slate-400">
          Eat the MKM logos. Space/Enter to Start/Pause. Walls are deadly.
        </div>
      </div>
    </div>
  );
}

/* rounded rect helper */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

