import React, { useEffect, useRef, useState, useCallback } from "react";
//v1.0.9
/* ========= High score (local, persistent) ========= */
const HI_KEY = "mkm-snake-hi";
function loadHigh() {
  try { const v = localStorage.getItem(HI_KEY); return v ? Math.max(0, Number(v)) : 0; }
  catch { return 0; }
}
function saveHigh(score) {
  try { localStorage.setItem(HI_KEY, String(score)); } catch {}
}

/* ========= Speed curve =========
   Starts ~180ms, speeds up gently every 4 apples, floors at 75ms */
function speedFor(score) {
  const BASE = 180, MIN = 75;
  const level = Math.floor(Math.max(0, score) / 4);
  const interval = BASE * Math.pow(0.94, level);
  return Math.max(MIN, Math.round(interval));
}

/* ========= One-shot timer clock that can change interval without stacking ========= */
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

/* ========= Touch helpers (swipe + D-pad buttons) ========= */
function attachTouchControls(root, onDirection) {
  if (!root) return () => {};
  let startX = 0, startY = 0, active = false;

  const onStart = (e) => {
    active = true;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY;
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!active) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - startX, dy = t.clientY - startY;
    if (Math.abs(dx) > 18 || Math.abs(dy) > 18) {
      if (Math.abs(dx) > Math.abs(dy)) onDirection(dx > 0 ? "right" : "left");
      else onDirection(dy > 0 ? "down" : "up");
      active = false;
    }
    e.preventDefault();
  };
  const onEnd = (e) => { active = false; e.preventDefault(); };

  root.addEventListener("touchstart", onStart, { passive: false });
  root.addEventListener("touchmove", onMove, { passive: false });
  root.addEventListener("touchend", onEnd, { passive: false });
  root.addEventListener("touchcancel", onEnd, { passive: false });

  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dir]");
    if (btn) onDirection(btn.getAttribute("data-dir"));
  });

  return () => {
    root.removeEventListener("touchstart", onStart);
    root.removeEventListener("touchmove", onMove);
    root.removeEventListener("touchend", onEnd);
    root.removeEventListener("touchcancel", onEnd);
  };
}

/* ========= Canvas fit to CSS size (DPR aware + visualViewport) ========= */
function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width * dpr));
  const h = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ========= Main component ========= */
export default function SnakeGame() {
  const canvasRef = useRef(null);
  const clockRef  = useRef(null);
  const [score, setScore] = useState(0);
  const [high, setHigh]   = useState(0);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const dirRef = useRef("right");     // current direction
  const pendingDirRef = useRef(null); // buffer to prevent instant backtracking
  const stateRef = useRef(null);      // game state (snake, food, grid)

  /* ====== Init / viewport & scroll lock ====== */
  useEffect(() => {
    setHigh(loadHigh());
    const canvas = canvasRef.current;
    const onResize = () => fitCanvas(canvas);
    const vv = window.visualViewport;
    onResize();
    window.addEventListener("resize", onResize);
    vv && vv.addEventListener("resize", onResize);

    // Lock page scrolling while game visible
    document.body.classList.add("game-locked");
    const stop = (e) => e.preventDefault();
    document.addEventListener("touchmove", stop, { passive: false });

    return () => {
      window.removeEventListener("resize", onResize);
      vv && vv.removeEventListener("resize", onResize);
      document.body.classList.remove("game-locked");
      document.removeEventListener("touchmove", stop);
    };
  }, []);

  /* ====== Touch controls ====== */
  useEffect(() => {
    const root = document.getElementById("game-root");
    const detach = attachTouchControls(root, (d) => queueDir(d));
    return () => detach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ====== Keyboard ====== */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  /* ====== Helpers ====== */
  const queueDir = (d) => {
    // prevent 180° turns
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
      grow: 0,
    };
    dirRef.current = "right";
    pendingDirRef.current = null;
    setScore(0);
    setGameOver(false);
  }, []);

  const spawnFood = (cols, rows, occupiedSet) => {
    while (true) {
      const x = (Math.random() * cols) | 0;
      const y = (Math.random() * rows) | 0;
      const key = x + "," + y;
      if (!occupiedSet.has(key)) return { x, y };
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const S = stateRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // background grid (subtle)
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0B1220";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

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
      const msg = "Game Over • Tap Start";
      ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      const m = ctx.measureText(msg);
      ctx.fillText(msg, (canvas.clientWidth - m.width) / 2, 36);
    }
  };

  const step = () => {
    const S = stateRef.current;
    if (!S) return;
    // commit any queued direction once per tick
    if (pendingDirRef.current) {
      dirRef.current = pendingDirRef.current;
      pendingDirRef.current = null;
    }

    const head = { ...S.snake[0] };
    if (dirRef.current === "up") head.y -= 1;
    else if (dirRef.current === "down") head.y += 1;
    else if (dirRef.current === "left") head.x -= 1;
    else head.x += 1;

    // wall-kill only (no wrap)
    if (head.x < 0 || head.y < 0 || head.x >= S.cols || head.y >= S.rows) {
      endGame();
      return;
    }

    // self collision
    for (const p of S.snake) {
      if (p.x === head.x && p.y === head.y) {
        endGame();
        return;
      }
    }

    S.snake.unshift(head);
    // food?
    if (head.x === S.food.x && head.y === S.food.y) {
      setScore(s => s + 1);
      // mark occupied cells to spawn outside snake
      const occ = new Set(S.snake.map(p => p.x + "," + p.y));
      S.food = spawnFood(S.cols, S.rows, occ);
      // grow by 1 (i.e., do not pop tail this tick)
    } else {
      S.snake.pop();
    }
    draw();
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

  /* adjust speed when score changes */
  useEffect(() => {
    clockRef.current?.setInterval(speedFor(score));
  }, [score]);

  /* initial canvas draw */
  useEffect(() => {
    // ensure canvas fits whenever mounted
    fitCanvas(canvasRef.current);
    // draw a welcome screen
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "#0B1220";
    ctx.fillRect(0, 0, canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    const msg = "Snake • Tap Start";
    const m = ctx.measureText(msg);
    ctx.fillText(msg, (canvasRef.current.clientWidth - m.width) / 2, 36);
  }, []);

  return (
    <div id="game-root">
      <div className="game-wrap bg-[#0F172A] text-white rounded-lg mx-auto">
        {/* Top bar */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <div className="opacity-80 text-sm">Arrow keys / WASD • Swipe on mobile</div>
          <div className="flex gap-2">
            <button className="ctl-btn px-4 py-2 bg-slate-700" onClick={startGame}>Start</button>
            <button className="ctl-btn px-4 py-2 bg-slate-700" onClick={resetGame}>Reset</button>
            <span className="text-sm opacity-80 select-none">Score: {score} • Hi: {high}</span>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 w-full flex gap-4 items-center justify-center">
          <div className="board-shell">
            <canvas id="game-canvas" ref={canvasRef} className="block w-full h-full" />
          </div>
          <div className="controls-column">{/* optional landscape-only extras */}</div>
        </div>

        {/* Portrait D-pad */}
        <div className="portrait-only flex flex-col items-center gap-3 pt-1">
          <div className="grid grid-cols-3 gap-2">
            <div />
            <button className="dpad-btn bg-slate-700" data-dir="up">▲</button>
            <div />
            <button className="dpad-btn bg-slate-700" data-dir="left">◀︎</button>
            <div />
            <button className="dpad-btn bg-slate-700" data-dir="right">▶︎</button>
            <div />
            <button className="dpad-btn bg-slate-700 col-start-2" data-dir="down">▼</button>
          </div>
        </div>
      </div>
    </div>
  );
}
