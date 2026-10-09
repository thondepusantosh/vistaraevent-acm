// The works-wheel: events shown one at a time on a wheel you turn.
// A plain-JS port of the crafterui "works-wheel" component used before.
//
// At rest the cards sit in a ring around a label. The first turn opens the
// ring into a vertical drum: the card at the front lies flat and full size,
// its neighbours rotate away in perspective. Keep turning and the drum brings
// the next card to the front.
//
// Everything is driven by one number, `turn`: 0 is the ring, 1 is the drum
// with item 0 at the front, and each whole number after is one more item.
//
// Usage:
//   const wheel = new WorksWheel(container, {
//     items: [{ id, title }], label: "Day 1",
//     renderFace: (item, i) => "<html for the card face>",
//     onActiveChange: (index, open) => {},
//   });
//   wheel.goTo(i); wheel.next(); wheel.prev(); wheel.reset();

const CARD_H = 0.38; // front card height, of the stage
const CARD_MAX_W = 0.34; // but never wider than this much of the stage
const NARROW = 640; // below this stage width the card may be wider
const CARD_MAX_W_NARROW = 0.8;
const CARD_H_NARROW = 0.42;
const CARD_RATIO = 1.45;
const STEP = 40; // degrees between cards on the drum
const DRUM = 2.22; // drum radius, in card heights
const LENS = 2.7; // perspective distance
const RING_R = 1.14; // ring radius
const BOW = 1.82; // the drum curves away round an arc to the left
const TITLE = 0.124; // ring label size
const CULL = 1.6; // items either side of the front still drawn

const WHEEL_UNITS = 900; // wheel delta per item
const DRAG_UNITS = 420; // dragged px per item (mouse, vertical)
const SWIPE_UNITS = 260; // swiped px per item (touch, horizontal)
const TAP_SLOP = 6;
const SETTLE = 140;
const NUDGE = 0.04;
const EASE = 0.12;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rad = (deg) => (deg * Math.PI) / 180;
const bowAt = (drumDeg, bow) => -bow * (1 - Math.cos(rad(drumDeg)));

function place(ringDeg, drumDeg, ringR, drumR, bow, m) {
  return (
    `translateX(${m * bowAt(drumDeg, bow)}px)` +
    ` rotateZ(${(1 - m) * ringDeg}deg) translateY(${-(1 - m) * ringR}px)` +
    ` rotateX(${m * drumDeg}deg) translateZ(${m * drumR}px)`
  );
}

let uid = 0;

export class WorksWheel {
  constructor(container, { items, label = "", renderFace, onActiveChange }) {
    this.items = items;
    this.onActiveChange = onActiveChange;
    this.turn = 0;
    this.target = 0;
    this.active = 0;
    this.open = false;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.id = `ww${++uid}`;
    this.last = Math.max(items.length - 1, 0);

    container.innerHTML = `
      <section class="ww" aria-label="${label}">
        <div class="ww-stage" tabindex="0" role="listbox" aria-label="${label}">
          <div class="ww-wheel">
            ${items
              .map(
                (item, i) => `
              <div class="ww-card" id="${this.id}-${i}" role="option" aria-selected="false" aria-label="${item.title}" data-index="${i}">
                <span class="ww-face">${renderFace ? renderFace(item, i) : ""}</span>
              </div>`,
              )
              .join("")}
          </div>
        </div>
        <div class="ww-label">${label}</div>
      </section>`;

    this.stage = container.querySelector(".ww-stage");
    this.wheel = container.querySelector(".ww-wheel");
    this.labelEl = container.querySelector(".ww-label");
    this.cards = [...container.querySelectorAll(".ww-card")];

    this.measure();
    this.ro = new ResizeObserver(() => {
      this.measure();
      this.drawn = NaN;
    });
    this.ro.observe(this.stage);
    this.bindInput();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  measure() {
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    const narrow = w < NARROW;
    const cardW = Math.min(h * (narrow ? CARD_H_NARROW : CARD_H) * CARD_RATIO, w * (narrow ? CARD_MAX_W_NARROW : CARD_MAX_W));
    const cardH = cardW / CARD_RATIO;
    const ringR = narrow ? Math.min(cardH * RING_R, (Math.min(w, h) / 2) * 0.6) : cardH * RING_R;
    const count = this.items.length;
    this.m = {
      cardW,
      cardH,
      ringR,
      drumR: cardH * DRUM,
      bow: cardH * BOW,
      ringScale: count ? clamp((((2 * Math.PI * ringR) / count) * 0.82) / (cardW || 1), 0.16, 1) : 1,
    };
    this.stage.style.perspective = `${cardH * LENS}px`;
    this.labelEl.style.fontSize = `${cardH * TITLE}px`;
    for (const card of this.cards) {
      card.style.width = `${cardW}px`;
      card.style.height = `${cardH}px`;
      card.style.marginLeft = `${-cardW / 2}px`;
      card.style.marginTop = `${-cardH / 2}px`;
    }
  }

  frame(now) {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    if (!this.m.cardH) return;
    // Ease by elapsed time, so a 30 fps device glides at the same speed as 120 Hz.
    const frames = this.then ? Math.min((now - this.then) / (1000 / 60), 6) : 1;
    this.then = now;
    const gap = this.target - this.turn;
    if (Math.abs(gap) < 0.0005) this.turn = this.target;
    else this.turn += gap * (this.reduced ? 1 : 1 - Math.pow(1 - EASE, frames));

    const t = this.turn;
    if (t === this.drawn) return; // nothing moved
    this.drawn = t;
    const m = clamp(t, 0, 1);
    const pos = Math.max(0, t - 1);
    const { ringR, drumR, bow, ringScale } = this.m;
    const count = this.items.length;

    // Pull the drum back so its front face lands on the picture plane.
    this.wheel.style.transform = `translateZ(${-m * drumR}px)`;
    this.cards.forEach((card, i) => {
      const d = i - pos;
      card.style.transform = place(d * (360 / count), d * STEP, ringR, drumR, bow, m);
      const hidden = m > 0.5 && Math.abs(d) > CULL;
      card.style.opacity = hidden ? "0" : "1";
      card.style.pointerEvents = hidden ? "none" : "";
      card.style.zIndex = String(Math.round(100 - Math.abs(d) * 2));
      card.firstElementChild.style.transform = `scale(${lerp(ringScale, 1, m)})`;
    });
    this.labelEl.style.opacity = String(1 - m);

    const near = clamp(Math.round(pos), 0, this.last);
    const open = m >= 0.5;
    if (near !== this.active || open !== this.open) {
      this.cards[this.active]?.setAttribute("aria-selected", "false");
      this.active = near;
      this.open = open;
      this.cards[near]?.setAttribute("aria-selected", "true");
      this.stage.setAttribute("aria-activedescendant", `${this.id}-${near}`);
      this.onActiveChange?.(near, open);
    }
  }

  to(next) {
    this.target = clamp(next, 0, this.last + 1);
  }
  goTo(index) {
    this.to(index + 1);
  }
  next() {
    this.to(Math.max(1, Math.round(this.target) + 1));
  }
  prev() {
    this.to(Math.max(1, Math.round(this.target) - 1));
  }
  reset() {
    this.to(0);
  }

  /** Land on a whole item, in the direction the gesture was heading. */
  settle(from) {
    const t = this.target;
    const moved = t - from;
    if (Math.abs(moved) < NUDGE) this.to(Math.round(t));
    else this.to(moved > 0 ? Math.ceil(t - 1e-4) : Math.floor(t + 1e-4));
  }

  bindInput() {
    const stage = this.stage;
    let gestureFrom = null;
    let settleTimer = 0;
    let drag = null;
    let suppressClick = false;

    // Cancels the wheel only while the drum still has somewhere to go, so the
    // page scrolls on at either end instead of trapping the reader.
    stage.addEventListener(
      "wheel",
      (e) => {
        const scale = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
        const next = this.target + (e.deltaY * scale) / WHEEL_UNITS;
        if (next > 0 && next < this.last + 1) e.preventDefault();
        else if (gestureFrom === null) return;
        if (gestureFrom === null) gestureFrom = this.target;
        this.to(next);
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          const from = gestureFrom ?? this.target;
          gestureFrom = null;
          this.settle(from);
        }, SETTLE);
      },
      { passive: false },
    );

    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, touch: e.pointerType === "touch", moved: 0, from: this.target };
      // Touch keeps native vertical panning, so only mouse and pen capture.
      if (e.pointerType !== "touch") stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved += Math.hypot(dx, dy);
      // Mouse drags vertically like the drum turns; a finger swipes sideways.
      this.to(this.target + (drag.touch ? -dx / SWIPE_UNITS : -dy / DRAG_UNITS));
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    const end = () => {
      if (!drag) return;
      suppressClick = drag.moved > TAP_SLOP;
      if (suppressClick) this.settle(drag.from);
      drag = null;
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);

    // A tap on any card but the front one turns it to the front.
    stage.addEventListener("click", (e) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      const card = e.target.closest(".ww-card");
      if (!card) return;
      const i = Number(card.dataset.index);
      if (!this.open || i !== this.active) this.goTo(i);
    });

    stage.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") this.next();
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") this.to(Math.round(this.target) - 1);
      else if (e.key === "Home") this.to(1);
      else if (e.key === "End") this.to(this.last + 1);
      else return;
      e.preventDefault();
    });
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }
}
