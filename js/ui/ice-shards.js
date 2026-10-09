// "Icy night shards": the animated WebGL background behind event selection
// and the forms. A domain-warped fbm plasma broken into slowly drifting
// Voronoi shards, each catching the light at its own angle, with faint
// glowing cracks between them. Colours come from the --shard-1..4 tokens.
// (Modelled on the 21st.dev community shader of that name, whose source is
// not public; this is an original shader in the same style.)
//
// Cheap on purpose: half resolution, 30 fps, paused while the tab is hidden,
// and a single still frame for reduced motion.
//
// Usage: mountIceShards(hostElement). The host keeps a CSS gradient as the
// fallback when WebGL is unavailable.

const VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  u_resolution;
uniform float u_time;
uniform vec3  u_colors[4];

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 hash2(vec2 p) {
  float n = hash(p);
  return vec2(n, hash(p + n));
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
vec3 palette(float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  if (t < 1.0) return mix(u_colors[0], u_colors[1], t);
  if (t < 2.0) return mix(u_colors[1], u_colors[2], t - 1.0);
  return mix(u_colors[2], u_colors[3], t - 2.0);
}
// x: distance to nearest seed, y: to second nearest, z: shard id
vec3 voronoi(vec2 x, float t) {
  vec2 n = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0; vec2 id = vec2(0.0);
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = hash2(n + g);
    o = 0.5 + 0.42 * sin(t * 0.6 + 6.2831 * o);
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = n + g; } else if (d < d2) { d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2), hash(id));
}
vec3 shade(vec2 uv, float t) {
  vec2 q = vec2(fbm(uv * 1.5 + t), fbm(uv * 1.5 - t + 3.1));
  vec2 r = vec2(fbm(uv * 1.3 + 2.0 * q + vec2(1.7, 9.2) + 1.3 * t),
                fbm(uv * 1.3 + 2.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(uv * 1.1 + 2.3 * r);

  vec3 v = voronoi(uv * 2.6 + r * 0.7, t);
  float a = v.z * 6.2831;
  float facet = dot(uv, vec2(cos(a), sin(a))) * 0.22 + (v.z - 0.5) * 0.18;
  float crack = 1.0 - smoothstep(0.0, 0.035, v.y - v.x);

  float level = pow(f, 1.45) * 1.85 + facet * f;
  vec3 col = palette(level);
  col += u_colors[3] * crack * 0.5 * smoothstep(0.28, 0.7, f);
  return col;
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.035;
  vec3 col = shade(uv, t);
  col *= mix(1.0, 0.5, smoothstep(0.45, 1.35, length(uv * vec2(0.85, 1.0))));
  gl_FragColor = vec4(col, 1.0);
}
`;

const RENDER_SCALE = 0.5;
const FRAME_MS = 1000 / 30;

function hexToRgb(hex) {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("[ice-shards]", gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

export function mountIceShards(host, { speed = 1 } = {}) {
  const canvas = document.createElement("canvas");
  host.prepend(canvas);
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  const vs = gl && compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = gl && compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl && vs && fs ? gl.createProgram() : null;
  if (program) {
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
  }
  if (!program || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    canvas.remove(); // the host's CSS gradient stays
    return () => {};
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(program, "u_resolution");
  const uTime = gl.getUniformLocation(program, "u_time");
  const style = getComputedStyle(host);
  const palette = [1, 2, 3, 4].map((i) => style.getPropertyValue(`--shard-${i}`) || "#000000");
  gl.uniform3fv(gl.getUniformLocation(program, "u_colors"), new Float32Array(palette.flatMap(hexToRgb)));

  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * RENDER_SCALE));
    const h = Math.max(1, Math.round(canvas.clientHeight * RENDER_SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  };

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const offset = 400; // start mid-motion, not at the noise origin
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  let prev = performance.now();

  const draw = () => {
    gl.uniform1f(uTime, offset + elapsed * speed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    elapsed += Math.min(now - prev, 100) / 1000;
    prev = now;
    if (now - last < FRAME_MS) return;
    last = now;
    draw();
  };
  const play = () => {
    if (reduced || frame) return;
    prev = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const pause = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const onVisibility = () => (document.hidden ? pause() : play());

  const ro = new ResizeObserver(() => {
    resize();
    draw();
  });
  ro.observe(canvas);
  resize();
  draw();
  document.addEventListener("visibilitychange", onVisibility);
  play();

  return () => {
    pause();
    ro.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
  };
}
