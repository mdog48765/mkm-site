import React, { useEffect, useRef, useState, useCallback } from "react";

/* ===== Local, persistent high score (no backend) ===== */
const HI_KEY = "mkm-snake-hi";
function loadHigh() {
  try { const v = localStorage.getItem(HI_KEY); return v ? Math.max(0, Number(v)) : 0; }
  catch { return 0; }
}
function saveHigh(score) {
  try { localStorage.setItem(HI_KEY, String(score)); } catch {}
}

/* ===== Gentle speed curve =====
   Starts ~180ms, speeds up every 4 apples, floors at 75ms */
function speedFor(score) {
  const BASE = 180, MIN = 75;
  const level = Math.floor(Math.max(0, score) / 4);
  const interval = BASE * Math.pow(0.94, level);
  return Math.max(MIN, Math.round(interval));
}

/* ===== One-shot timer clock (no stacking setIntervals) ===== */
class GameClock {
  constructor(stepFn, intervalMs = 180) {
    this.stepFn = stepFn;
    this.interval = intervalMs;
    this._timer = null;
    this._running = false;
  }
  _tick = () => {
    if (!this._running) return;
    this.stepFn();
    this._timer = setTimeout(this._tick, this.interval);
  };
  start() {
    if (this._running) return;
    this._running = true;
    this._timer && clearTimeout(this._timer);
    this._timer = setTimeout(this._tick, this.interval);
  }
  stop() {
    this._running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
  setInterval(ms) {
    this.interval = Math.max(10, ms | 0);
    if (this._running) {
      this._timer && clearTimeout(this._timer);
      this._timer = setTimeout(this._tick, this.interval);
    }
  }
}

/* ===== DPR-fit canvas to its CSS size (no body/class hacks) ===== */
function fitCanvas(canvas) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export default function SnakeGame() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const clockRef  = useRef(null);

  const [score, setScore] = useState(0);
  const [high, setHigh]   = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // direction refs
  const dirRef = useRef("right");
  const pendingDirRef = useRef(null);

  // game state ref
  const stateRef = useRef(null);

  /* === init === */
  useEffect(() => {
    setHigh(loadHigh());

    const canvas = canvasRef.current;
    const onResize = () => fitCanvas(canvas);
    onResize();

    window.addEventListener("resize", onResize);
    const vv = window.visualViewport;
    vv && vv.addEventListener("resize", onResize);

    // welcome screen
    drawWelcome();

    return () => {
      window.removeEventListener("resize", onResize);
      vv && vv.removeEventListener("resize", onResize);
      clockRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* === keyboard === */
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "w") queueDir("up");
      else if (k === "arrowdown" || k === "s") queueDir("down");
      else if (k === "arrowleft" || k === "a") queueDir("left");
      else if (k === "arrowright" || k === "d") queueDir("right");
      else if (k === " " || k === "enter") { running ? pauseGame() : startGame(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running]);

  /* === touch (only inside the game wrapper; no document/body hooks) === */
  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    let startX = 0, startY = 0, active = false;

    const onStart = (e) => {
      active = true;
      const t = e.touches ? e.touches[0] : e;
      startX = t.clientX; startY = t.clientY;
      // prevent only inside the wrapper
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!active) return;
      const t = e.touches ? e.touches[0] : e;
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.abs(dx) > 18 || Math.abs(dy) > 18) {
        if (Math.abs(dx) > Math.abs(dy)) queueDir(dx > 0 ? "right" : "left");
        else queueDir(dy > 0 ? "down" : "up");
        active = false;
      }
      e.preventDefault();
    };
    const onEnd = (e) => { active = false; e.preventDefault(); };

    root.addEventListener("touchstart", onStart, { passive: false });
    root.addEventListener("touchmove", onMove, { passive: false });
    root.addEventListener("touchend", onEnd, { passive: false });
    root.addEventListener("touchcancel", onEnd, { passive: false });

    return () => {
      root.removeEventListener("touchstart", onStart);
      root.removeEventListener("touchmove", onMove);
      root.removeEventListener("touchend", onEnd);
      root.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  /* === speed adjust when score changes === */
  useEffect(() => {
    clockRef.current?.setInterval(speedFor(score));
  }, [score]);

  /* === helpers === */
  const queueDir = (d) => {
    const cur = dirRef.current;
    if ((cur === "up" && d === "down") || (cur === "down" && d === "up") ||
        (cur === "left" && d === "right") || (cur === "right" && d === "left")) return;
    pendingDirRef.current = d;
  };

  const newGame = useCallback(() => {
    const canvas = canvasRef.current;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    // choose cell size that fills canvas nicely
    const cell = Math.max(16, Math.floor(Math.min(w, h) / 24));
    const cols = Math.floor(w / cell);
    const rows = Math.floor(h / cell);
    const start = { x: Math.floor(cols / 3), y: Math.floor(rows / 2) };

    stateRef.current = {
      cell, cols, rows,
      snake: [start, { x: start.x - 1, y: start.y }, { x: start.x - 2, y: start.y }],
      food: spawnFood(cols, rows, new Set()),
    };
    dirRef.current = "right";
    pendingDirRef.current = null;
    setScore(0);
    setGameOver(false);
    draw(); // first frame
  }, []);

  const spawnFood = (cols, rows, occupied) => {
    while (true) {
      const x = (Math.random() * cols) | 0;
      const y = (Math.random() * rows) | 0;
      const key = x + "," + y;
      if (!occupied.has(key)) return { x, y };
    }
  };

  const endGame = useCallback(() => {
    clockRef.current?.stop();
    setRunning(false);
    setGameOver(true);
    setHigh(h => {
      const next = score > h ? score : h;
      if (score > h) saveHigh(score);
      return next;
    });
  }, [score]);

  const step = () => {
    const S = stateRef.current;
    if (!S) return;

    if (pendingDirRef.current) {
      dirRef.current = pendingDirRef.current;
      pendingDirRef.current = null;
    }

    const head = { ...S.snake[0] };
    if (dirRef.current === "up") head.y -= 1;
    else if (dirRef.current === "down") head.y += 1;
    else if (dirRef.current === "left") head.x -= 1;
    else head.x += 1;

    // wall-kill only
    if (head.x < 0 || head.y < 0 || head.x >= S.cols || head.y >= S.rows) {
      endGame(); return;
    }
    // self collision
    for (const p of S.snake) {
      if (p.x === head.x && p.y === head.y) { endGame(); return; }
    }

    S.snake.unshift(head);

    // food?
    if (head.x === S.food.x && head.y === S.food.y) {
      setScore(s => s + 1);
      const occ = new Set(S.snake.map(p => p.x + "," + p.y));
      S.food = spawnFood(S.cols, S.rows, occ);
      // don't pop tail this tick (grow by 1)
    } else {
      S.snake.pop();
    }

    draw();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    fitCanvas(canvas);
    const ctx = canvas.getContext("2d");
    const S = stateRef.current;

    // bg
    ctx.fillStyle = "#0B1220";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    if (!S) return;

    // snake
    ctx.fillStyle = "#22d3ee";
    for (const p of S.snake) {
      ctx.fillRect(p.x * S.cell, p.y * S.cell, S.cell - 1, S.cell - 1);
    }

    // food
    ctx.fillStyle = "#f97316";
    ctx.fillRect(S.food.x * S.cell, S.food.y * S.cell, S.cell - 1, S.cell - 1);

    // HUD
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.fillText(`Score: ${score}  Hi: ${high}`, 8, 18);

    if (gameOver) {
      const msg = "Game Over — Press Start";
      ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const m = ctx.measureText(msg);
      ctx.fillText(msg, (canvas.clientWidth - m.width) / 2, 36);
    }
  };

  const drawWelcome = () => {
    const canvas = canvasRef.current;
    fitCanvas(canvas);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0B1220";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const msg = "Snake — Press Start";
    const m = ctx.measureText(msg);
    ctx.fillText(msg, (canvas.clientWidth - m.width) / 2, 36);
  };

  const startGame = useCallback(() => {
    if (!clockRef.current) {
      clockRef.current = new GameClock(step, speedFor(0));
    }
    newGame();
    clockRef.current.setInterval(speedFor(0));
    clockRef.current.start();
    setRunning(true);
  }, [newGame]);

  const pauseGame = useCallback(() => {
    clockRef.current?.stop();
    setRunning(false);
  }, []);

  const resetGame = useCallback(() => {
    pauseGame();
    newGame();
    draw();
  }, [newGame, pauseGame]);

  /* redraw when score/over change (ensures HUD always updates) */
  useEffect(() => { draw(); }, [score, high, gameOver]);

  return (
    <div ref={wrapRef} className="mx-auto max-w-[900px] w-[92vw]">
      <div className="flex items-center justify-between gap-2 py-2">
        <div className="opacity-80 text-sm select-none">Arrow keys / WASD • Swipe inside the game</div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-slate-700 text-white" onClick={startGame}>Start</button>
          <button className="px-4 py-2 rounded bg-slate-700 text-white" onClick={resetGame}>Reset</button>
        </div>
      </div>

      {/* The board: fixed aspect so it doesn’t jump around */}
      <div className="relative w-full" style={{ aspectRatio: "16/11", background: "#0B1220", borderRadius: 12, overflow: "hidden" }}>
        <canvas ref={canvasRef} className="block w-full h-full" />
        {/* Simple D-pad for touch (inside wrapper only) */}
        <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-auto select-none">
          <div className="grid grid-cols-3 gap-2">
            <div />
            <button className="px-4 py-3 rounded bg-slate-700 text-white" onClick={() => queueDir("up")}>▲</button>
            <div />
            <button className="px-4 py-3 rounded bg-slate-700 text-white" onClick={() => queueDir("left")}>◀︎</button>
            <div />
            <button className="px-4 py-3 rounded bg-slate-700 text-white" onClick={() => queueDir("right")}>▶︎</button>
            <div />
            <button className="px-4 py-3 rounded bg-slate-700 text-white col-start-2" onClick={() => queueDir("down")}>▼</button>
          </div>
        </div>
      </div>
    </div>
  );
}
