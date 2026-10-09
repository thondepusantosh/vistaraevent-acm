// Liquid metal buttons, after "Liquid Metal Button" by johuniq
// (https://jolyui.dev/docs/components/buttons/liquid-metal-button, MIT).
//
// Write a plain button or link with the class `metal-btn` and a size class:
//   <button class="metal-btn btn-lg">Continue</button>
//   <a class="metal-btn metal-btn--secondary btn-md" href="/">Home</a>
//
// This module adds the layers (a CSS brushed-metal rim, the liquid metal
// shader, the dark core), the click ripple and the shader speeds the original
// uses (0.6 at rest, 1 on hover, a 2.4 burst on click). It watches the page,
// so buttons added later are set up too.
//
// The WebGL shader goes on primary buttons only, only while they're on screen,
// and at most MAX_LIVE at once (browsers allow ~16 WebGL contexts per page).
// Everything else keeps the CSS rim, which also covers browsers without WebGL.

const SHADERS_URL = "https://cdn.jsdelivr.net/npm/@paper-design/shaders@0.0.81/+esm";
const MAX_LIVE = 8;
const SPEED = { rest: 0.6, hover: 1, burst: 2.4 };

/** The original's uniforms, unchanged. */
const UNIFORMS = {
  u_repetition: 4,
  u_softness: 0.5,
  u_shiftRed: 0.3,
  u_shiftBlue: 0.3,
  u_distortion: 0,
  u_contour: 0,
  u_angle: 45,
  u_scale: 8,
  u_shape: 1,
  u_offsetX: 0.1,
  u_offsetY: -0.1,
};

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let shaderLib = null;
const loadShaders = () => (shaderLib ??= import(SHADERS_URL).catch(() => null));

/** Buttons with a shader mounted right now. */
const live = new Set();
const io = new IntersectionObserver(onIntersect, { rootMargin: "120px" });

function setSpeed(btn, speed) {
  if (!reduced) btn._metal?.mount?.setSpeed(speed);
}

async function start(btn) {
  const state = btn._metal;
  if (!state || state.mount || state.starting || live.size >= MAX_LIVE) return;
  state.starting = true;
  const lib = await loadShaders();
  state.starting = false;
  if (!lib || !btn.isConnected || !state.visible || state.mount || live.size >= MAX_LIVE) return;
  try {
    state.mount = new lib.ShaderMount(
      state.host,
      lib.liquidMetalFragmentShader,
      UNIFORMS,
      { alpha: true, premultipliedAlpha: true, antialias: false },
      reduced ? 0 : SPEED.rest,
      Math.random() * 10000, // neighbours don't move in lockstep
      1, // the rim is 2px wide; no need for 2x supersampling
    );
    live.add(btn);
    state.host.classList.add("is-live");
  } catch {
    // No WebGL: the CSS rim stays.
  }
}

function stop(btn) {
  const state = btn._metal;
  if (!state?.mount) return;
  const m = state.mount;
  state.mount = null;
  live.delete(btn);
  state.host.classList.remove("is-live");
  const gl = m.gl;
  m.dispose();
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
}

function onIntersect(entries) {
  for (const entry of entries) {
    const btn = entry.target;
    const state = btn._metal;
    if (!state) continue;
    clearTimeout(state.hideTimer);
    state.visible = entry.isIntersecting;
    if (entry.isIntersecting) start(btn);
    // A short delay so scrolling past doesn't churn contexts.
    else state.hideTimer = setTimeout(() => stop(btn), 1500);
  }
}

function enhance(btn) {
  if (btn._metal) return;
  const rim = document.createElement("span");
  rim.className = "metal-rim";
  const host = document.createElement("span");
  host.className = "metal-shader";
  const core = document.createElement("span");
  core.className = "metal-core";
  for (const el of [rim, host, core]) el.setAttribute("aria-hidden", "true");
  btn.prepend(rim, host, core);
  btn._metal = { host, mount: null, visible: false, hovered: false };

  btn.addEventListener("pointerenter", () => {
    btn._metal.hovered = true;
    setSpeed(btn, SPEED.hover);
  });
  btn.addEventListener("pointerleave", () => {
    btn._metal.hovered = false;
    setSpeed(btn, SPEED.rest);
  });
  btn.addEventListener("click", (e) => {
    setSpeed(btn, SPEED.burst);
    setTimeout(() => setSpeed(btn, btn._metal.hovered ? SPEED.hover : SPEED.rest), 300);
    const r = btn.getBoundingClientRect();
    // Keyboard clicks report 0,0: start those from the centre.
    const fromKeys = e.clientX === 0 && e.clientY === 0;
    const ripple = document.createElement("span");
    ripple.className = "metal-ripple";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.left = `${fromKeys ? r.width / 2 : e.clientX - r.left}px`;
    ripple.style.top = `${fromKeys ? r.height / 2 : e.clientY - r.top}px`;
    btn.append(ripple);
    setTimeout(() => ripple.remove(), 600);
  });

  if (!btn.classList.contains("metal-btn--secondary") && !btn.hasAttribute("data-no-shader")) io.observe(btn);
}

function scan(root) {
  if (root.nodeType !== 1) return;
  if (root.matches(".metal-btn")) enhance(root);
  root.querySelectorAll(".metal-btn").forEach(enhance);
}

/** Sets up every .metal-btn now and in future. Call once per page. */
export function initMetalButtons() {
  scan(document.body);
  new MutationObserver((records) => {
    let removed = false;
    for (const r of records) {
      r.addedNodes.forEach(scan);
      if (r.removedNodes.length) removed = true;
    }
    // Free the shaders of buttons that left the page.
    if (removed) {
      for (const btn of [...live]) {
        if (!btn.isConnected) {
          io.unobserve(btn);
          stop(btn);
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
