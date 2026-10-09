// The registration flow: pick events → details → payment → confirmation.
// Used by day-1.html and day-2.html (<body data-flow="day" data-day="1">)
// and infusion26.html (<body data-flow="hackathon">, which starts at details).
//
// A day page keeps one selection per bucket (Solo, Group, Craft 24 solo,
// Craft 24 group; see js/rules.js). Picking in one never touches another.
// "Continue" checks out one bucket with its own form and price; after paying,
// the other buckets' picks are still there. Progress, minus the screenshot,
// survives a page refresh.

import { APPS_SCRIPT_URL, DAYS, GROUP_TEAM_SIZES, HACKATHON, REGISTRATION_OPEN, TIER_PRICES } from "./config.js";
import {
  BUCKETS,
  BUCKET_LABEL,
  CATEGORY_LABEL,
  EMPTY_DETAILS,
  EVENTS_BY_ID,
  LIMIT_NOTE,
  addState,
  atLimit,
  bucketOf,
  emptySelections,
  eventsForDay,
  filledBuckets,
  formTypeFor,
  formatINR,
  priceNote,
  priceSelection,
  qrFor,
  sanitizeSelections,
  toggleEvent,
  upiLink,
  validateDetails,
  validateUpi,
} from "./rules.js";
import { ImageReadError, compressImage } from "./ui/compress-image.js";
import { esc, icons } from "./ui/icons.js";
import { mountIceShards } from "./ui/ice-shards.js";
import { initMetalButtons } from "./ui/metal-button.js";
import { mountNav } from "./ui/nav.js";
import { WorksWheel } from "./ui/works-wheel.js";

// ------------------------------------------------------------------ setup

const isDay = document.body.dataset.flow === "day";
const day = isDay ? Number(document.body.dataset.day) : null;
const storageKey = isDay ? `vistara:day${day}` : "vistara:hackathon";
const firstStep = isDay ? "select" : "details";
const open = isDay ? REGISTRATION_OPEN[`day${day}`] : REGISTRATION_OPEN.hackathon;
const events = isDay ? eventsForDay(day) : [];
const CLIENT_TIMEOUT_MS = 60000;

const flowEl = document.getElementById("flow");
const traySlot = document.getElementById("tray-slot");

const newRequestId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const joinNames = (names) => (names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

const state = {
  step: firstStep,
  selections: emptySelections(),
  /** The bucket the tray shows, and the one "Continue" checks out. */
  bucket: "solo",
  details: structuredClone(EMPTY_DETAILS),
  upiId: "",
  screenshot: null,
  status: { state: "idle" },
  requestId: newRequestId(),
  result: null,
};

function save() {
  if (state.step === "done") return;
  try {
    const { step, selections, bucket, details, upiId, requestId } = state;
    sessionStorage.setItem(storageKey, JSON.stringify({ step, selections, bucket, details, upiId, requestId }));
  } catch {
    /* Private mode or storage full: progress just won't survive a refresh. */
  }
}

function restore() {
  let saved = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
  } catch {}
  if (!saved) return;
  if (isDay) state.selections = sanitizeSelections(saved.selections, day);
  if (BUCKETS.includes(saved.bucket)) state.bucket = saved.bucket;
  state.details = { ...structuredClone(EMPTY_DETAILS), ...saved.details };
  state.upiId = typeof saved.upiId === "string" ? saved.upiId : "";
  if (typeof saved.requestId === "string" && saved.requestId) state.requestId = saved.requestId;
  // A checkout step only makes sense if its bucket still prices.
  const canResume = !isDay || priceSelection(state.selections[state.bucket]).ok;
  if ((saved.step === "details" || saved.step === "payment") && canResume) state.step = saved.step;
}

// --------------------------------------------------------------- derived

function checkout() {
  const ids = state.selections[state.bucket];
  const price = isDay ? priceSelection(ids) : null;
  const names = ids.map((id) => EVENTS_BY_ID[id]?.name).filter(Boolean);
  const what = isDay ? joinNames(names) : `${HACKATHON.name} hackathon`;
  return {
    ids,
    price,
    kind: isDay ? (price?.ok ? price.kind : "solo") : "hackathon",
    amount: isDay ? (price?.ok ? price.amount : 0) : HACKATHON.fee,
    what,
    forWhat: isDay ? `${what}, ${DAYS[day].label}` : `${HACKATHON.name} registration`,
    formType: isDay ? formTypeFor(state.bucket) : "individual",
  };
}

// ------------------------------------------------------------- rendering

function stepper() {
  const steps = isDay ? ["Pick events", "Your details", "Payment"] : ["Your details", "Payment"];
  const order = isDay ? ["select", "details", "payment"] : ["details", "payment"];
  const current = order.indexOf(state.step);
  return `<ol class="stepper" aria-label="Registration steps">${steps
    .map((label, i) => {
      const s = i < current ? "done" : i === current ? "current" : "todo";
      return `<li data-state="${s}"${s === "current" ? ' aria-current="step"' : ""}>
        ${i ? `<span class="stepper-bar${i <= current ? " is-done" : ""}" aria-hidden="true"></span>` : ""}
        <span class="stepper-num tabular" aria-hidden="true">${i + 1}</span>
        <span class="stepper-label"><span class="sr-only">${s === "done" ? "Completed: " : s === "todo" ? "Next: " : ""}</span>${esc(label)}</span>
      </li>`;
    })
    .join("")}</ol>`;
}

let wheel = null;

function goTo(step) {
  state.step = step;
  save();
  render();
  flowEl.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function render() {
  wheel?.destroy();
  wheel = null;
  traySlot.innerHTML = "";

  if (!open) {
    flowEl.innerHTML = `<div class="closed"><p style="font-size:1.125rem">Registrations for this are closed.</p><a href="index.html">Back to home</a></div>`;
    return;
  }
  if (state.step === "select") return renderSelect();
  if (state.step === "details") return renderDetails();
  if (state.step === "payment") return renderPayment();
  if (state.step === "done") return renderDone();
}

// ---------------------------------------------------------- select step

let front = { index: 0, open: false };

function faceHtml(event) {
  return `<span class="face${addState(event, state.selections).kind === "selected" ? " is-picked" : ""}" data-id="${event.id}">
    ${event.image ? `<img src="${esc(event.image)}" alt="" draggable="false">` : shardArt(event)}
    <span class="face-shade"></span>
    <span class="face-badge">${esc(BUCKET_LABEL[bucketOf(event)])}</span>
    <span class="face-check" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    <span class="face-text"><span class="face-name">${esc(event.name)}</span><span class="face-blurb">${esc(event.blurb)}</span></span>
  </span>`;
}

/** Ice shards fanned from a point, laid out from the event id so each card differs. */
function shardArt(event) {
  let h = 2166136261;
  for (const ch of event.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const tint = { solo: "var(--ice-deep)", group: "var(--ice)", craft24: "var(--frost)" }[event.category];
  const cx = 110 + rand() * 70;
  const cy = 150 + rand() * 30;
  const pts = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI + (i / 8) * Math.PI + (rand() - 0.5) * 0.25;
    const r = 120 + rand() * 120;
    return [cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r];
  });
  const gid = `g-${event.id}`;
  const paths = pts
    .slice(0, -1)
    .map(
      (p, i) =>
        `<path d="M${cx.toFixed(1)} ${cy.toFixed(1)}L${p[0].toFixed(1)} ${p[1].toFixed(1)}L${pts[i + 1][0].toFixed(1)} ${pts[i + 1][1].toFixed(1)}Z" fill="url(#${gid})" opacity="${(0.18 + rand() * 0.6).toFixed(2)}" stroke="white" stroke-opacity="0.22" stroke-width="0.6"/>`,
    )
    .join("");
  return `<svg viewBox="0 0 290 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="1" x2="0.4" y2="0">
      <stop offset="0" stop-color="${tint}" stop-opacity="0.9"/><stop offset="0.6" stop-color="${tint}" stop-opacity="0.25"/><stop offset="1" stop-color="white" stop-opacity="0.05"/>
    </linearGradient></defs>${paths}</svg>`;
}

function renderSelect() {
  front = { index: 0, open: false };
  flowEl.innerHTML = `
    ${stepper()}
    <div class="select step-in">
      <nav class="cat-tabs glass" aria-label="Event categories" id="cat-tabs"></nav>
      <div class="select-grid">
        <div class="wheel-frame glass" id="wheel"></div>
        <nav class="event-index" aria-label="All events" id="event-index"></nav>
        <div class="event-panel glass">
          <div id="event-detail" aria-live="polite"></div>
          <div class="event-nav" id="event-nav" hidden>
            <button class="metal-btn metal-btn--secondary btn-icon" type="button" data-action="prev" aria-label="Previous event">${icons.chevronLeft()}</button>
            <button class="metal-btn metal-btn--secondary btn-icon" type="button" data-action="next" aria-label="Next event">${icons.chevronRight()}</button>
            <span class="count tabular" id="event-count"></span>
          </div>
        </div>
      </div>
    </div>`;

  traySlot.innerHTML = `
    <aside class="tray" aria-label="Your selection">
      <div class="tray-inner glass">
        <div class="tray-tabs" role="tablist" aria-label="Registration category" id="tray-tabs"></div>
        <div class="tray-body">
          <div class="tray-picks" id="tray-picks" aria-live="polite"></div>
          <div class="tray-total">
            <p class="total"><span class="total-label">Total</span> <span class="total-amount tabular" id="total">${formatINR(0)}</span></p>
            <button class="metal-btn btn-lg" type="button" data-action="continue" id="continue">Continue<span class="sr-only" id="continue-sr"></span></button>
          </div>
        </div>
      </div>
    </aside>`;

  wheel = new WorksWheel(document.getElementById("wheel"), {
    items: events.map((e) => ({ id: e.id, title: e.name })),
    label: DAYS[day].label,
    renderFace: (_, i) => faceHtml(events[i]),
    onActiveChange: (index, isOpen) => {
      front = { index, open: isOpen };
      if (isOpen) state.bucket = bucketOf(events[index]);
      updateDetail(true);
      updateTabs();
      updateTray();
    },
  });
  updateSelect();
}

/** Refreshes everything on the select step that depends on the selection. */
function updateSelect() {
  updateDetail(false);
  updateTabs();
  updateIndex();
  updateTray();
  document.querySelectorAll(".face[data-id]").forEach((f) => {
    f.classList.toggle("is-picked", addState(EVENTS_BY_ID[f.dataset.id], state.selections).kind === "selected");
  });
}

function updateTabs() {
  const current = front.open ? events[front.index].category : null;
  document.getElementById("cat-tabs").innerHTML = ["solo", "group", "craft24"]
    .map((c) => {
      const list = events.filter((e) => e.category === c);
      if (!list.length) return "";
      const picked = list.filter((e) => addState(e, state.selections).kind === "selected").length;
      return `<button class="cat-tab" type="button" data-action="cat" data-cat="${c}"${c === current ? ' aria-current="true"' : ""}>
        ${esc(CATEGORY_LABEL[c])}
        <span class="badge tabular${picked ? " is-picked" : ""}"><span class="sr-only">${picked ? `${picked} picked of ` : ""}</span>${picked || list.length}<span class="sr-only"> events</span></span>
      </button>`;
    })
    .join("");
}

function updateIndex() {
  const activeId = front.open ? events[front.index].id : null;
  document.getElementById("event-index").innerHTML = events
    .map((e, i) => {
      const group = BUCKET_LABEL[bucketOf(e)];
      const newGroup = i === 0 || group !== BUCKET_LABEL[bucketOf(events[i - 1])];
      const picked = addState(e, state.selections).kind === "selected";
      return `${newGroup ? `<p class="group-label">${esc(group)}</p>` : ""}
        <button type="button" data-action="index" data-index="${i}"${e.id === activeId ? ' aria-current="true"' : ""}>
          <span>${esc(e.name)}</span>${picked ? icons.check().replace("<svg", '<svg aria-label="Added"') : ""}
        </button>`;
    })
    .join("");
}

function updateDetail(animate) {
  const el = document.getElementById("event-detail");
  const nav = document.getElementById("event-nav");
  if (!front.open) {
    el.innerHTML = `<div class="intro${animate ? " swap-in" : ""}">
      <h2 class="intro-title">${events.length} events to choose from</h2>
      <p class="intro-body">Scroll over the wheel, drag it, or use the arrow keys to turn it. On a phone, swipe it. Each event has a + button to add it.</p>
      <button class="metal-btn btn-lg" type="button" data-action="first">Show the first event</button>
    </div>`;
    nav.hidden = true;
    return;
  }
  const e = events[front.index];
  const s = addState(e, state.selections);
  const selected = s.kind === "selected";
  const blocked = s.kind === "blocked";
  el.innerHTML = `<article class="${animate ? "swap-in" : ""}" aria-labelledby="title-${e.id}">
    <p class="event-kicker">${esc(BUCKET_LABEL[bucketOf(e)])}</p>
    <div class="event-head">
      <h2 class="event-name" id="title-${e.id}">${esc(e.name)}</h2>
      <span class="blocked-wrap${blocked ? " is-blocked" : ""}">
        <button class="metal-btn btn-icon-lg" type="button" data-action="toggle" data-id="${e.id}"
          aria-pressed="${selected}" aria-label="${selected ? "Remove" : "Add"} ${esc(e.name)}"
          ${blocked ? `disabled aria-describedby="note-${e.id}"` : ""} data-selected="${selected}">
          <span class="toggle-icon">${selected ? icons.check() : icons.plus()}</span>
        </button>
      </span>
    </div>
    <p class="event-desc">${esc(e.description)}</p>
    <p class="event-price tabular">${esc(priceNote(e))}</p>
    <p class="event-note${blocked ? " is-blocked" : selected ? " is-selected" : ""}" id="note-${e.id}"${blocked ? ' role="status"' : ""}>
      ${blocked ? esc(s.reason) : selected ? "Added. Tap the tick to remove it." : ""}
    </p>
  </article>`;
  nav.hidden = false;
  nav.querySelector('[data-action="prev"]').disabled = front.index === 0;
  nav.querySelector('[data-action="next"]').disabled = front.index === events.length - 1;
  document.getElementById("event-count").textContent = `${front.index + 1} of ${events.length}`;
}

const HINT = {
  solo: "Pick 1 or 2 solo events.",
  group: "Pick 1 or 2 group events. One registration covers your whole team.",
  "craft24-solo": "Pick as many solo Craft 24 events as you like. Their prices add up.",
  "craft24-group": "Group Craft 24 events are registered on their own, by the team leader.",
};

let lastTotal = null;

function updateTray() {
  const b = state.bucket;
  const ids = state.selections[b];
  const price = priceSelection(ids);
  const present = BUCKETS.filter((x) => events.some((e) => bucketOf(e) === x));

  document.getElementById("tray-tabs").innerHTML = present
    .map((x) => {
      const n = state.selections[x].length;
      return `<button class="tray-tab" type="button" role="tab" aria-selected="${x === b}" data-action="bucket" data-bucket="${x}">
        ${esc(BUCKET_LABEL[x])}${n ? `<span class="badge is-picked tabular">${n}</span>` : ""}
      </button>`;
    })
    .join("");

  let tier;
  if (b === "solo" || b === "group") {
    const t = TIER_PRICES[b];
    tier = `${[1, 2]
      .map((n) => `<span class="${ids.length === n ? "is-current" : ""}">${n} event${n > 1 ? "s" : ""} ${formatINR(t[n])}</span>`)
      .join(" · ")} ${b === "group" ? "per team" : "per person"}`;
  } else {
    tier = ids.length
      ? `<span class="tabular">${ids.map((id) => `${esc(EVENTS_BY_ID[id].name)} ${formatINR(EVENTS_BY_ID[id].pricing.amount)}`).join(" + ")}</span>`
      : "No limit. Each event has its own price.";
  }

  document.getElementById("tray-picks").innerHTML = `
    ${
      ids.length
        ? `<ul class="chips">${ids
            .map(
              (id) => `<li class="chip">${esc(EVENTS_BY_ID[id].name)}
              <button type="button" data-action="remove" data-id="${id}" aria-label="Remove ${esc(EVENTS_BY_ID[id].name)}">${icons.x()}</button></li>`,
            )
            .join("")}</ul>`
        : `<p class="tray-hint">${esc(HINT[b])}</p>`
    }
    <p class="tray-tier">${tier}${atLimit(state.selections, b) ? ` <span class="warn">${esc(LIMIT_NOTE)}</span>` : ""}${
      ids.length ? ` <button type="button" data-action="clear">Clear</button>` : ""
    }</p>`;

  const total = price.ok ? price.amount : 0;
  const totalEl = document.getElementById("total");
  totalEl.textContent = formatINR(total);
  if (lastTotal !== null && lastTotal !== total) {
    totalEl.classList.remove("bump");
    void totalEl.offsetWidth;
    totalEl.classList.add("bump");
  }
  lastTotal = total;
  document.getElementById("continue").disabled = !price.ok;
  document.getElementById("continue-sr").textContent = ` with ${BUCKET_LABEL[b]} registration`;
}

function toggle(id) {
  const event = EVENTS_BY_ID[id];
  if (!event) return;
  state.selections = toggleEvent(state.selections, event);
  state.bucket = bucketOf(event);
  save();
  updateSelect();
}

// --------------------------------------------------------- details step

function field({ id, label, value, type = "text", hint, error, attrs = "" }) {
  const described = [hint && `${id}-hint`, `${id}-error`].filter(Boolean).join(" ");
  return `<div class="field">
    <label for="${id}">${esc(label)}</label>
    <input class="input glass-input" id="${id}" name="${id}" type="${type}" value="${esc(value)}"
      aria-describedby="${described}"${error ? ' aria-invalid="true"' : ""} ${attrs}>
    ${hint ? `<p class="hint" id="${id}-hint">${esc(hint)}</p>` : ""}
    <p class="error" id="${id}-error"${error ? "" : " hidden"}>${esc(error ?? "")}</p>
  </div>`;
}

function teammatesHtml() {
  const d = state.details;
  return Array.from({ length: d.teamSize - 1 }, (_, i) =>
    field({ id: `f-teammates-${i}`, label: `Teammate ${i + 2} full name`, value: d.teammates[i] ?? "", attrs: 'autocomplete="off" maxlength="80"' }),
  ).join("");
}

function renderDetails() {
  const c = checkout();
  const d = state.details;
  const leader = c.formType !== "individual";
  const title = !isDay
    ? `Register for ${HACKATHON.name}`
    : c.formType === "team"
      ? "Team details"
      : c.formType === "leader"
        ? "Team leader's details"
        : "Your details";
  const sub = isDay
    ? `${esc(BUCKET_LABEL[state.bucket])} registration for <strong>${esc(c.what)}</strong>.`
    : `${esc(HACKATHON.teamNote)} Fill in your own details only.`;
  const note =
    c.formType === "leader"
      ? "Only the team leader registers for Short Film. Fill in your own details; no team name or member details are needed."
      : !isDay
        ? HACKATHON.teamNote
        : "";

  flowEl.innerHTML = `
    ${stepper()}
    <div class="panel panel--narrow glass step-in">
      <h2 class="step-title">${esc(title)}</h2>
      <p class="step-sub">${sub}</p>
      <form class="form" id="details-form" novalidate>
        ${
          c.formType === "team"
            ? `<fieldset>
                <legend>Your team</legend>
                ${field({ id: "f-teamName", label: "Team name", value: d.teamName, attrs: 'autocomplete="off" maxlength="60"' })}
                <div class="field" role="radiogroup" aria-labelledby="team-size-label">
                  <span class="field-label" id="team-size-label">Team size, including you</span>
                  <div class="seg">
                    ${GROUP_TEAM_SIZES.map(
                      (n) => `<label><input class="sr-only" type="radio" name="teamSize" value="${n}"${d.teamSize === n ? " checked" : ""}>${n} members</label>`,
                    ).join("")}
                  </div>
                </div>
              </fieldset>`
            : ""
        }
        <fieldset>
          <legend${leader ? "" : ' class="sr-only"'}>${leader ? "Team leader" : "Your details"}</legend>
          ${note ? `<p class="glass-note">${esc(note)}</p>` : ""}
          ${field({ id: "f-name", label: leader ? "Team leader's full name" : "Full name", value: d.name, attrs: 'autocomplete="name" maxlength="80"' })}
          <div class="two-col">
            ${field({ id: "f-phone", label: "Phone number", type: "tel", value: d.phone, hint: "10-digit mobile number", attrs: 'inputmode="numeric" autocomplete="tel-national" placeholder="98765 43210" maxlength="16"' })}
            ${field({ id: "f-email", label: "Email", type: "email", value: d.email, hint: "Your confirmation is sent here", attrs: 'inputmode="email" autocomplete="email" placeholder="name@example.com" maxlength="120"' })}
          </div>
          ${field({ id: "f-college", label: "College name", value: d.college, attrs: 'autocomplete="organization" maxlength="120"' })}
        </fieldset>
        ${c.formType === "team" ? `<fieldset><legend>Teammates</legend><div id="teammates" style="display:grid;gap:1.25rem">${teammatesHtml()}</div></fieldset>` : ""}
        <div class="form-actions">
          ${isDay ? `<button class="metal-btn metal-btn--secondary btn-lg" type="button" data-action="back-select">Change events</button>` : "<span></span>"}
          <button class="metal-btn btn-lg" type="submit">Continue to payment</button>
        </div>
        <p class="form-alert" id="form-alert" role="alert" hidden>Some details need fixing. Check the highlighted fields.</p>
      </form>
    </div>`;

  const form = document.getElementById("details-form");
  const touched = new Set();
  let attempted = false;

  const keyOf = (id) => id.replace(/^f-/, "").replace(/^teammates-(\d)$/, "teammates.$1");
  const showErrors = () => {
    const r = validateDetails(state.details, c.formType);
    const errors = r.ok ? {} : r.errors;
    form.querySelectorAll("input.input").forEach((input) => {
      const key = keyOf(input.id);
      const msg = attempted || touched.has(key) ? errors[key] : undefined;
      const errEl = document.getElementById(`${input.id}-error`);
      errEl.textContent = msg ?? "";
      errEl.hidden = !msg;
      if (msg) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    });
    document.getElementById("form-alert").hidden = !(attempted && !r.ok);
    return r;
  };

  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.name === "teamSize") {
      state.details.teamSize = Number(t.value);
      document.getElementById("teammates").innerHTML = teammatesHtml();
    } else if (t.id?.startsWith("f-teammates-")) {
      state.details.teammates[Number(t.id.slice(-1))] = t.value;
    } else if (t.id?.startsWith("f-")) {
      state.details[t.id.slice(2)] = t.value;
    }
    save();
    if (attempted || touched.has(keyOf(t.id || ""))) showErrors();
  });
  form.addEventListener("focusout", (e) => {
    if (e.target.matches?.("input.input")) {
      touched.add(keyOf(e.target.id));
      showErrors();
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    attempted = true;
    const r = showErrors();
    if (r.ok) return goTo("payment");
    form.querySelector('[aria-invalid="true"]')?.focus();
  });
}

// --------------------------------------------------------- payment step

function renderPayment() {
  const c = checkout();
  const qr = qrFor(c.amount);
  const payLink = upiLink(c.amount, `Vistara ${c.forWhat}`.slice(0, 60));

  flowEl.innerHTML = `
    ${stepper()}
    <div class="panel glass step-in">
      <h2 class="step-title">Payment</h2>
      <p class="step-sub">Pay with UPI, then upload proof of payment.</p>
      <form id="pay-form" novalidate>
        <div class="pay-grid">
          <section class="pay-card glass-input" aria-labelledby="pay-title">
            <h3 id="pay-title" class="muted" style="font-size:.875rem;font-weight:400">Amount to pay</h3>
            <p class="pay-amount tabular">${formatINR(c.amount)}</p>
            <p class="pay-for">${esc(c.forWhat)}</p>
            ${
              qr
                ? `<img class="qr" src="${esc(qr)}" alt="UPI QR code for ${formatINR(c.amount)}" width="220" height="220">`
                : `<p class="error" style="margin-top:1.25rem">The QR code for this amount is missing. Contact the organizers.</p>`
            }
            <p class="hint">Scan with any UPI app. On this phone, take a screenshot of the QR and choose it from your UPI app's scanner.</p>
            ${payLink ? `<a class="metal-btn btn-lg btn-block" href="${esc(payLink)}">${icons.phone()} Pay ${formatINR(c.amount)} with a UPI app</a>` : ""}
          </section>
          <div class="pay-side">
            <div>
              <h3>After you pay</h3>
              <p>Pay exactly ${formatINR(c.amount)}, then add the UPI ID you paid from and a screenshot of the successful payment. The organizers match these against the payment.</p>
            </div>
            ${field({ id: "f-upi", label: "Your UPI ID", value: state.upiId, attrs: 'placeholder="name@okhdfcbank" autocomplete="off" autocapitalize="none" spellcheck="false" inputmode="email" maxlength="120"' })}
            <div class="field">
              <span class="field-label">Payment screenshot</span>
              <div id="upload"></div>
              <p class="error" id="upload-error" role="alert" hidden></p>
            </div>
          </div>
        </div>
        <div class="pay-footer">
          <div class="alert" id="pay-alert" role="alert" hidden></div>
          <div class="form-actions" style="border:0;padding:0">
            <button class="metal-btn metal-btn--secondary btn-lg" type="button" data-action="back-details">Back to details</button>
            <div class="submit-col">
              <button class="metal-btn btn-lg" type="submit" id="submit"><span id="submit-label">Submit registration</span></button>
              <p class="hint" id="submit-hint" aria-live="polite"></p>
            </div>
          </div>
        </div>
      </form>
    </div>`;

  const upi = document.getElementById("f-upi");
  let upiTouched = false;
  const refresh = () => {
    const upiErr = validateUpi(state.upiId);
    const errEl = document.getElementById("f-upi-error");
    const show = upiTouched && upiErr;
    errEl.textContent = show ? upiErr : "";
    errEl.hidden = !show;
    if (show) upi.setAttribute("aria-invalid", "true");
    else upi.removeAttribute("aria-invalid");

    const submitting = state.status.state === "submitting";
    const ready = !upiErr && !!state.screenshot;
    const missing = [upiErr && "your UPI ID", !state.screenshot && "the payment screenshot"].filter(Boolean);
    const btn = document.getElementById("submit");
    btn.disabled = !ready || submitting;
    btn.setAttribute("aria-busy", String(submitting));
    document.getElementById("submit-label").innerHTML = submitting
      ? `<span style="display:inline-flex;align-items:center;gap:.5rem">${icons.loader("icon spin")} Submitting registration</span>`
      : state.status.state === "error"
        ? "Try again"
        : "Submit registration";
    document.getElementById("submit-hint").textContent = submitting
      ? "This can take up to 20 seconds. Keep this page open."
      : !ready
        ? `Add ${missing.join(" and ")} to submit.`
        : "You can't change details after submitting.";
    const alert = document.getElementById("pay-alert");
    alert.hidden = state.status.state !== "error";
    alert.textContent = state.status.state === "error" ? state.status.message : "";
    upi.disabled = submitting;
    document.querySelector('[data-action="back-details"]').disabled = submitting;
  };

  upi.addEventListener("input", () => {
    state.upiId = upi.value.trim();
    save();
    refresh();
  });
  upi.addEventListener("blur", () => {
    upiTouched = true;
    refresh();
  });

  renderUpload(refresh);
  refresh();

  document.getElementById("pay-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (validateUpi(state.upiId) || !state.screenshot || state.status.state === "submitting") return;
    submit(refresh);
  });
}

function renderUpload(onChange) {
  const host = document.getElementById("upload");
  const errEl = document.getElementById("upload-error");
  const shot = state.screenshot;
  const disabled = state.status.state === "submitting";

  host.innerHTML = shot
    ? `<div class="preview glass-input">
        <img src="${shot.dataUrl}" alt="Preview of your payment screenshot">
        <div class="preview-info">
          <div>
            <p style="font-weight:500">Screenshot added</p>
            <p class="hint tabular" style="font-size:.875rem;margin-top:.125rem">${Math.round(shot.bytes / 1024)} KB, ${shot.width}×${shot.height}</p>
            <p class="hint" style="font-size:.875rem;margin-top:.5rem">Check the amount and transaction ID are readable.</p>
          </div>
          <div class="preview-actions">
            <label class="small-btn glass-input">Replace<input class="sr-only" type="file" accept="image/*" id="f-screenshot"${disabled ? " disabled" : ""}></label>
            <button class="link-btn" type="button" id="remove-shot"${disabled ? " disabled" : ""}>Remove</button>
          </div>
        </div>
      </div>`
    : `<label class="upload glass-input" id="drop">
        ${icons.imageUp()}
        <strong>Add your payment screenshot</strong>
        <span class="hint" style="font-size:.875rem">Tap to choose from your gallery. JPG or PNG.</span>
        <input class="sr-only" type="file" accept="image/*" id="f-screenshot"${disabled ? " disabled" : ""}>
      </label>`;

  const handle = async (file) => {
    if (!file) return;
    errEl.hidden = true;
    const drop = document.getElementById("drop");
    drop?.classList.add("is-busy");
    if (drop) drop.querySelector("strong").textContent = "Preparing your screenshot…";
    try {
      state.screenshot = await compressImage(file);
    } catch (e) {
      errEl.textContent = e instanceof ImageReadError ? e.message : "This image couldn't be processed. Try another screenshot.";
      errEl.hidden = false;
    }
    renderUpload(onChange);
    onChange();
  };

  document.getElementById("f-screenshot").addEventListener("change", (e) => handle(e.target.files?.[0]));
  document.getElementById("remove-shot")?.addEventListener("click", () => {
    state.screenshot = null;
    renderUpload(onChange);
    onChange();
  });
  const drop = document.getElementById("drop");
  if (drop) {
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("is-dragging");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-dragging"));
    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      drop.classList.remove("is-dragging");
      handle(e.dataTransfer.files?.[0]);
    });
  }
}

// ---------------------------------------------------------------- submit

const isLocal = ["localhost", "127.0.0.1", "[::1]", ""].includes(location.hostname);

async function submit(refresh) {
  const c = checkout();
  const v = validateDetails(state.details, c.formType);
  if (!v.ok || !state.screenshot) {
    state.status = { state: "error", message: "Some details are missing. Go back and check the form." };
    return refresh();
  }
  const d = v.data;
  const payload = {
    requestId: state.requestId,
    kind: c.kind,
    day: isDay ? day : null,
    eventIds: isDay ? c.ids : [],
    amount: c.amount,
    participant: { name: d.name, phone: d.phone, email: d.email, college: d.college },
    upiId: state.upiId.trim(),
    screenshot: { mimeType: state.screenshot.mimeType, base64: state.screenshot.base64, fileName: "payment.jpg" },
  };
  if (c.kind === "group") payload.team = { name: d.teamName, size: d.teamSize, members: d.teammates };

  state.status = { state: "submitting" };
  refresh();
  renderUpload(refresh);

  let data;
  try {
    if (!APPS_SCRIPT_URL) {
      // Lets the whole flow be tried locally before the Sheet exists. Never on a real domain.
      if (!isLocal) throw new Error("not-connected");
      await new Promise((r) => setTimeout(r, 900));
      const tag = c.kind === "hackathon" ? "H" : `D${day}`;
      data = { success: true, registrationId: `VST-${tag}-DEMO-${state.requestId.slice(0, 4).toUpperCase()}` };
    } else {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
      try {
        // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
        const res = await fetch(APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
          redirect: "follow",
          signal: controller.signal,
        });
        data = await res.json().catch(() => {
          throw new Error("bad-response");
        });
      } finally {
        clearTimeout(timer);
      }
    }
  } catch (e) {
    state.status = {
      state: "error",
      message:
        e?.name === "AbortError"
          ? "The server is taking too long to respond. Try again. If your first attempt went through, you'll get the same registration ID, not a duplicate."
          : e?.message === "not-connected"
            ? "Registrations aren't connected yet. Contact the organizers."
            : e?.message === "bad-response"
              ? "The server sent back something unexpected. Try again in a moment."
              : "Couldn't reach the server. Check your internet connection and try again.",
    };
    refresh();
    renderUpload(refresh);
    return;
  }

  if (!data?.success) {
    state.status = { state: "error", message: data?.error || "Registration failed. Try again." };
    refresh();
    renderUpload(refresh);
    return;
  }

  state.result = { id: data.registrationId, amount: c.amount, what: c.what, name: d.name };
  state.status = { state: "idle" };
  // This bucket is paid for. Keep every other bucket's picks for the next checkout.
  if (isDay) state.selections = { ...state.selections, [state.bucket]: [] };
  state.screenshot = null;
  state.upiId = "";
  state.requestId = newRequestId();
  try {
    if (isDay && filledBuckets(state.selections).length) {
      const { selections, bucket, details, requestId } = state;
      sessionStorage.setItem(storageKey, JSON.stringify({ step: "select", selections, bucket, details, upiId: "", requestId }));
    } else sessionStorage.removeItem(storageKey);
  } catch {}
  goTo("done");
}

// ------------------------------------------------------------ done step

function renderDone() {
  const r = state.result;
  const pending = isDay ? filledBuckets(state.selections).map((b) => BUCKET_LABEL[b]) : [];
  flowEl.innerHTML = `
    <div class="confirm step-in">
      <span class="confirm-tick">${icons.check()}</span>
      <h2 tabindex="-1" id="done-title">You're registered, ${esc(r.name.split(" ")[0])}</h2>
      <p class="muted" style="margin-top:.5rem">Keep this registration ID. You'll need it at the venue.</p>
      <div class="confirm-card glass">
        <p class="muted" style="font-size:.875rem">Registration ID</p>
        <p class="confirm-id tabular">${esc(r.id)}</p>
        <button class="metal-btn metal-btn--secondary btn-sm" type="button" data-action="copy">${icons.copy()} <span>Copy ID</span></button>
        <dl>
          <div><dt>Registered for</dt><dd>${esc(r.what)}</dd></div>
          ${isDay ? `<div><dt>Day</dt><dd>${esc(`${DAYS[day].label}, ${DAYS[day].date}`)}</dd></div>` : ""}
          <div><dt>Amount paid</dt><dd class="tabular" style="font-weight:600">${formatINR(r.amount)}</dd></div>
          <div><dt>Payment</dt><dd style="color:var(--warn)">Waiting for verification</dd></div>
        </dl>
      </div>
      <p class="note">The organizers will verify your payment against the screenshot you uploaded. If something doesn't match, they'll contact you on the phone number you gave.${isDay ? "" : ` ${esc(HACKATHON.teamNote)}`}</p>
      ${pending.length ? `<p class="glass-note">You still have ${esc(pending.join(" and "))} picks waiting. Each category is registered and paid for separately.</p>` : ""}
      <div class="confirm-actions">
        ${isDay ? `<button class="metal-btn btn-lg" type="button" data-action="another">${pending.length ? "Register the rest" : "Register for more events"}</button>` : ""}
        <a class="metal-btn metal-btn--secondary btn-lg" href="index.html">Back to home</a>
      </div>
    </div>`;
  document.getElementById("done-title").focus({ preventScroll: true });
}

// ---------------------------------------------------------- one listener

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  if (a === "toggle") toggle(el.dataset.id);
  else if (a === "remove") toggle(el.dataset.id);
  else if (a === "prev") wheel?.prev();
  else if (a === "next") wheel?.next();
  else if (a === "first") wheel?.goTo(0);
  else if (a === "index") wheel?.goTo(Number(el.dataset.index));
  else if (a === "cat") wheel?.goTo(events.findIndex((ev) => ev.category === el.dataset.cat));
  else if (a === "bucket") {
    state.bucket = el.dataset.bucket;
    save();
    updateTray();
    wheel?.goTo(events.findIndex((ev) => bucketOf(ev) === el.dataset.bucket));
  } else if (a === "clear") {
    state.selections = { ...state.selections, [state.bucket]: [] };
    save();
    updateSelect();
  } else if (a === "continue") {
    if (priceSelection(state.selections[state.bucket]).ok) goTo("details");
  } else if (a === "back-select") goTo("select");
  else if (a === "back-details") {
    state.status = { state: "idle" };
    goTo("details");
  } else if (a === "another") {
    state.result = null;
    const next = filledBuckets(state.selections)[0];
    if (next) state.bucket = next;
    goTo(firstStep);
  } else if (a === "copy") {
    try {
      await navigator.clipboard.writeText(state.result.id);
      el.querySelector("span:last-child").textContent = "Copied";
      setTimeout(() => (el.querySelector("span:last-child").textContent = "Copy ID"), 2000);
    } catch {
      /* Clipboard blocked; the ID is selectable instead. */
    }
  }
});

// ------------------------------------------------------------------ start

mountNav();
document.getElementById("page-title").textContent = isDay ? DAYS[day].label : HACKATHON.name;
document.getElementById("page-sub").innerHTML = isDay
  ? `${esc(DAYS[day].weekday)}, <span class="tabular" style="color:var(--paper)">${esc(DAYS[day].date)}</span>`
  : `${esc(HACKATHON.tagline)} <span class="tabular" style="color:var(--paper)">${formatINR(HACKATHON.fee)}</span> per person.`;
mountIceShards(document.getElementById("shards"));
restore();
render();
initMetalButtons();
