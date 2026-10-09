// Kinetic grid background: a grid that warps toward the pointer and ripples
// on every click. A plain-JS port of the KineticGrid React component, with:
// crisp rendering on retina screens, colours from the --grid-* tokens, touch
// support, a pause while the tab is hidden, and one still frame for reduced
// motion.
//
// Usage: mountKineticGrid(canvasElement)

const CELL_SIZE = 55;
const INFLUENCE_RADIUS = 260;
const MAX_WARP = 24;
const DOT_SPACING = 28;
const LERP_SPEED = 0.08;
const DPR_CAP = 2;
const LINE_BASE = { r: 255, g: 255, b: 255, a: 0.13 };
const NODE_BASE_RADIUS = 1.8;
const NODE_ACTIVE_RADIUS = 3.2;

const lerp = (a, b, t) => a + (b - a) * t;

function lerpColor(base, active, t) {
  const r = Math.round(lerp(base.r, active.r, t));
  const g = Math.round(lerp(base.g, active.g, t));
  const b = Math.round(lerp(base.b, active.b, t));
  return `rgba(${r},${g},${b},${lerp(base.a, active.a, t).toFixed(3)})`;
}

function readTheme(el) {
  const s = getComputedStyle(el);
  const bg = s.getPropertyValue("--grid-bg").trim() || "#161618";
  let parts = (s.getPropertyValue("--grid-active").trim() || "74, 158, 255").split(",").map((n) => Number(n.trim()));
  if (parts.length !== 3 || parts.some(Number.isNaN)) parts = [74, 158, 255];
  const [r, g, b] = parts;
  const light = (k) => [r, g, b].map((c) => Math.min(255, Math.round(c + (255 - c) * k))).join(",");
  return {
    bg,
    lineActive: { r, g, b, a: 0.9 },
    nodeActive: { r, g, b, a: 1 },
    glow: `${r},${g},${b}`,
    ripple: light(0.2),
  };
}

export function mountKineticGrid(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const theme = readTheme(canvas);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const mouse = { x: -9999, y: -9999 };
  const target = { x: -9999, y: -9999 };
  const ripples = [];
  let W = 0;
  let H = 0;
  let raf = 0;

  function warped(gx, gy, col, row, cols, rows) {
    // Edge pin: boundary rows and columns stay put.
    const m = 1.5;
    const colPin = Math.min(col / m, (cols - 1 - col) / m, 1);
    const rowPin = Math.min(row / m, (rows - 1 - row) / m, 1);
    const pin = colPin * colPin * rowPin * rowPin;

    const dx = gx - mouse.x;
    const dy = gy - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const proximity = Math.max(0, 1 - dist / INFLUENCE_RADIUS) * pin;

    let rx = 0;
    let ry = 0;
    for (const r of ripples) {
      const rdx = gx - r.x;
      const rdy = gy - r.y;
      const diff = Math.sqrt(rdx * rdx + rdy * rdy) - r.radius;
      const wave = 55;
      if (Math.abs(diff) < wave) {
        const strength = (1 - Math.abs(diff) / wave) * r.opacity * 18 * pin;
        const angle = Math.atan2(rdy, rdx);
        const sign = diff < 0 ? -1 : 1;
        rx -= Math.cos(angle) * strength * sign;
        ry -= Math.sin(angle) * strength * sign;
      }
    }

    if (dist < INFLUENCE_RADIUS && dist > 0 && pin > 0) {
      const t = dist / INFLUENCE_RADIUS;
      const eased = t < 0.01 ? 0 : (1 - t) * (1 - t) * Math.min(1, dist / 60);
      const amt = eased * MAX_WARP * pin;
      const angle = Math.atan2(dy, dx);
      return { x: gx - Math.cos(angle) * amt + rx, y: gy - Math.sin(angle) * amt + ry, p: proximity };
    }
    return { x: gx + rx, y: gy + ry, p: proximity };
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = DOT_SPACING / 2; x < W; x += DOT_SPACING) {
      for (let y = DOT_SPACING / 2; y < H; y += DOT_SPACING) {
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      const age = (now - r.born) / 1000;
      r.radius = Math.max(0, age * 400);
      r.opacity = Math.max(0, 1 - age * 1.2);
      if (r.opacity <= 0) ripples.splice(i, 1);
    }

    const cols = Math.max(2, Math.ceil(W / CELL_SIZE)) + 1;
    const rows = Math.max(2, Math.ceil(H / CELL_SIZE)) + 1;
    const cw = W / (cols - 1);
    const ch = H / (rows - 1);
    const pts = [];
    for (let row = 0; row < rows; row++) {
      pts[row] = [];
      for (let col = 0; col < cols; col++) pts[row][col] = warped(col * cw, row * ch, col, row, cols, rows);
    }

    const seg = (a, b) => {
      const avg = (a.p + b.p) / 2;
      const t = avg * avg * (3 - 2 * avg);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = lerpColor(LINE_BASE, theme.lineActive, t);
      ctx.lineWidth = lerp(0.8, 1.5, t);
      ctx.stroke();
    };
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols - 1; col++) seg(pts[row][col], pts[row][col + 1]);
    for (let col = 0; col < cols; col++) for (let row = 0; row < rows - 1; row++) seg(pts[row][col], pts[row + 1][col]);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const p = pts[row][col];
        const t = p.p * p.p * (3 - 2 * p.p);
        const r = lerp(NODE_BASE_RADIUS, NODE_ACTIVE_RADIUS, t);
        if (t > 0.3) {
          const glowR = r + lerp(0, 6, (t - 0.3) / 0.7);
          const grd = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, glowR);
          grd.addColorStop(0, `rgba(${theme.glow},${(t * 0.3).toFixed(3)})`);
          grd.addColorStop(1, `rgba(${theme.glow},0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = lerpColor({ r: 255, g: 255, b: 255, a: 0.2 }, theme.nodeActive, t);
        ctx.fill();
      }
    }

    for (const r of ripples) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, Math.max(0, r.radius), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${theme.ripple},${(r.opacity * 0.28).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function resize() {
    W = innerWidth;
    H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduced) draw(performance.now());
  }

  function loop(now) {
    mouse.x = lerp(mouse.x, target.x, LERP_SPEED);
    mouse.y = lerp(mouse.y, target.y, LERP_SPEED);
    draw(now);
    raf = requestAnimationFrame(loop);
  }
  const start = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const onMove = (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
  };
  // Touch has no hover: ease the warp away after the finger lifts.
  const onUp = (e) => {
    if (e.pointerType !== "mouse") target.x = target.y = -9999;
  };
  const onClick = (e) => ripples.push({ x: e.clientX, y: e.clientY, radius: 0, opacity: 1, born: performance.now() });
  const onVisibility = () => (document.hidden ? stop() : start());

  resize();
  addEventListener("resize", resize);
  if (reduced) return () => removeEventListener("resize", resize);

  addEventListener("pointermove", onMove, { passive: true });
  addEventListener("pointerup", onUp, { passive: true });
  addEventListener("click", onClick);
  document.addEventListener("visibilitychange", onVisibility);
  start();

  return () => {
    stop();
    removeEventListener("resize", resize);
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerup", onUp);
    removeEventListener("click", onClick);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
