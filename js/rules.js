// The registration rules: selection, pricing and validation. Pure functions
// with no DOM, so they read in one place, are unit tested
// (tests/rules.test.mjs), and are mirrored by apps-script/Code.gs.
//
// A day page keeps one selection per bucket (Solo, Group, Craft 24 solo,
// Craft 24 group). Each is an array of event IDs that "+" toggles. Buckets
// never affect each other: picking a solo event can't replace or lock a group
// event, and each bucket is registered and paid for separately.
//
// Each event is paid to one UPI account (its `pay` field). One payment can't
// go to two accounts, so events paid to different accounts can't share a
// registration even within a bucket: their "+" is disabled with a note.

import { EVENTS, GROUP_TEAM_SIZES, MAX_TIERED_EVENTS, QR_CODES, TIER_PRICES, UPI_PAYEE } from "./config.js";

export const EVENTS_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

// ------------------------------------------------------------------ buckets

export const BUCKETS = ["solo", "group", "craft24-solo", "craft24-group"];

export const BUCKET_LABEL = {
  solo: "Solo",
  group: "Group",
  "craft24-solo": "Craft 24 solo",
  "craft24-group": "Craft 24 group",
};

export const CATEGORY_LABEL = { solo: "Solo", group: "Group", craft24: "Craft 24" };

export function bucketOf(event) {
  if (event.category === "craft24") return event.mode === "group" ? "craft24-group" : "craft24-solo";
  return event.category;
}

/** Solo and group allow 1 or 2 events. Craft 24 has no limit. */
export function bucketLimit(bucket) {
  return bucket === "solo" || bucket === "group" ? MAX_TIERED_EVENTS : Infinity;
}

/** A day's events in page order: solo, group, Craft 24 solo, Craft 24 group. */
export function eventsForDay(day) {
  return EVENTS.filter((e) => e.day === day).sort((a, b) => BUCKETS.indexOf(bucketOf(a)) - BUCKETS.indexOf(bucketOf(b)));
}

// ---------------------------------------------------------------- selection

export const LIMIT_NOTE = `You can participate in a maximum of ${MAX_TIERED_EVENTS} events.`;

export function emptySelections() {
  return { solo: [], group: [], "craft24-solo": [], "craft24-group": [] };
}

/** Whether an event's "+" is a tick ("selected"), clickable ("available") or disabled ("blocked"). */
export function addState(event, selections) {
  const bucket = bucketOf(event);
  const picked = selections[bucket];
  if (picked.includes(event.id)) return { kind: "selected" };
  if (picked.length >= bucketLimit(bucket)) return { kind: "blocked", reason: LIMIT_NOTE };
  if (picked.some((id) => EVENTS_BY_ID[id]?.pay !== event.pay)) {
    const names = picked.map((id) => EVENTS_BY_ID[id]?.name).filter(Boolean).join(" and ");
    return {
      kind: "blocked",
      reason: `${event.name} is paid to a different UPI account than ${names}, so it's registered separately. Finish or clear ${names} first.`,
    };
  }
  return { kind: "available" };
}

/** Tapping "+" or "✓". Adds when allowed, removes when picked, otherwise returns the same object. */
export function toggleEvent(selections, event) {
  const bucket = bucketOf(event);
  const picked = selections[bucket];
  if (picked.includes(event.id)) return { ...selections, [bucket]: picked.filter((id) => id !== event.id) };
  if (addState(event, selections).kind !== "available") return selections;
  return { ...selections, [bucket]: [...picked, event.id] };
}

export function atLimit(selections, bucket) {
  return selections[bucket].length >= bucketLimit(bucket);
}

/** Buckets with at least one pick, in page order. */
export function filledBuckets(selections) {
  return BUCKETS.filter((b) => selections[b].length > 0);
}

/** Cleans selections read back from storage: unknown IDs, other days, wrong buckets, over-limit. */
export function sanitizeSelections(raw, day) {
  const out = emptySelections();
  if (!raw || typeof raw !== "object") return out;
  for (const bucket of BUCKETS) {
    const ids = raw[bucket];
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      const event = typeof id === "string" ? EVENTS_BY_ID[id] : undefined;
      if (!event || event.day !== day || bucketOf(event) !== bucket) continue;
      if (addState(event, out).kind === "available") out[bucket].push(id);
    }
  }
  return out;
}

// ------------------------------------------------------------------ pricing

/**
 * Prices one checkout. Returns { ok: true, amount, kind, bucket, events } or
 * { ok: false, error }. kind is what Apps Script calls it: solo | group | craft24.
 */
export function priceSelection(eventIds) {
  if (eventIds.length === 0) return { ok: false, error: "Pick at least one event." };
  if (new Set(eventIds).size !== eventIds.length) return { ok: false, error: "The same event was picked twice." };

  const events = eventIds.map((id) => EVENTS_BY_ID[id]);
  if (events.some((e) => !e)) return { ok: false, error: "One of the events doesn't exist." };
  if (new Set(events.map((e) => e.category)).size > 1) {
    return { ok: false, error: "One registration can only cover one category." };
  }
  if (new Set(events.map((e) => e.day)).size > 1) return { ok: false, error: "One registration can only cover one day." };
  if (new Set(events.map(bucketOf)).size > 1) {
    return { ok: false, error: "Group Craft 24 events are registered separately from solo Craft 24 events." };
  }
  if (new Set(events.map((e) => e.pay)).size > 1) {
    return { ok: false, error: "These events are paid to different UPI accounts, so they're registered separately." };
  }

  const kind = events[0].category;
  const bucket = bucketOf(events[0]);

  if (kind === "solo" || kind === "group") {
    if (events.length > MAX_TIERED_EVENTS) return { ok: false, error: LIMIT_NOTE };
    const tier = tierOf(events);
    if (!tier) return { ok: false, error: "These events are priced differently, so they're registered separately." };
    return { ok: true, amount: TIER_PRICES[tier][events.length], kind, bucket, events };
  }

  // Craft 24: any number of events, each priced on its own.
  let amount = 0;
  for (const e of events) {
    if (e.pricing.type !== "flat") return { ok: false, error: `${e.name} has no price set.` };
    amount += e.pricing.amount;
  }
  return { ok: true, amount, kind, bucket, events };
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function formatINR(amount) {
  return inr.format(amount);
}

/** How an event is priced, for its card. */
export function priceNote(event) {
  if (event.pricing.type === "flat") {
    return event.mode === "group"
      ? `${formatINR(event.pricing.amount)} per team, registered by the leader`
      : `${formatINR(event.pricing.amount)} per person`;
  }
  const t = TIER_PRICES[event.pricing.tier];
  const who = event.mode === "group" ? "per team" : "per person";
  return `${formatINR(t[1])} for one event, ${formatINR(t[2])} for two, ${who}`;
}

/**
 * Which account a checkout pays, as a key of QR_CODES in config.js:
 * "hackathon", or the shared `pay` of its events. Null if they differ, which
 * the selection rules never allow.
 */
export function payeeOf(kind, events) {
  if (kind === "hackathon") return "hackathon";
  const accounts = new Set(events.map((e) => e.pay));
  return accounts.size === 1 ? [...accounts][0] : null;
}

/** The price tier shared by tiered events (a key of TIER_PRICES), or null if they differ. */
export function tierOf(events) {
  const tiers = new Set(events.map((e) => e.pricing.tier));
  return tiers.size === 1 && !tiers.has(undefined) ? [...tiers][0] : null;
}

/** The QR image for a checkout, or null if there isn't one. */
export function qrFor(kind, events, amount) {
  return QR_CODES[payeeOf(kind, events)]?.[amount] ?? null;
}

export function upiLink(amount, note) {
  if (!UPI_PAYEE.payeeVpa) return null;
  const params = new URLSearchParams({
    pa: UPI_PAYEE.payeeVpa,
    pn: UPI_PAYEE.payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

// --------------------------------------------------------------- validation

export const PHONE_RE = /^[6-9]\d{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

/** Accepts "+91 98765 43210", "098765-43210" and similar; returns 10 digits. */
export function normalizePhone(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

const clean = (v) => String(v ?? "").trim().replace(/\s+/g, " ");

function checkText(v, min, max, missing, tooLong) {
  const s = clean(v);
  if (s.length < min) return [null, missing];
  if (s.length > max) return [null, tooLong];
  return [s, null];
}

/**
 * Which form a bucket uses:
 *   individual  solo events, solo Craft 24 events, INFUSION26
 *   team        regular group events: team name, size, leader, teammates
 *   leader      group Craft 24 events (Short Film): the leader's details only
 */
export function formTypeFor(bucket) {
  if (bucket === "group") return "team";
  if (bucket === "craft24-group") return "leader";
  return "individual";
}

export const EMPTY_DETAILS = {
  name: "",
  phone: "",
  email: "",
  college: "",
  teamName: "",
  teamSize: 2,
  teammates: ["", ""],
};

/**
 * Validates the details form. Returns { ok: true, data } with cleaned values,
 * or { ok: false, errors } keyed by field (teammates as "teammates.0").
 */
export function validateDetails(values, formType) {
  const errors = {};
  const data = {};
  const put = (key, [value, error]) => (error ? (errors[key] = error) : (data[key] = value));

  const individual = formType === "individual";
  put(
    "name",
    checkText(
      values.name,
      2,
      80,
      individual ? "Enter your full name." : "Enter the team leader's full name.",
      "That name is too long.",
    ),
  );
  const phone = normalizePhone(values.phone);
  if (PHONE_RE.test(phone)) data.phone = phone;
  else errors.phone = "Enter a 10-digit Indian mobile number.";

  const email = String(values.email ?? "").trim().toLowerCase();
  if (email.length <= 120 && EMAIL_RE.test(email)) data.email = email;
  else errors.email = "Enter a valid email, like name@example.com.";

  put("college", checkText(values.college, 2, 120, "Enter your college name.", "Keep the college name under 120 characters."));

  if (formType === "team") {
    put("teamName", checkText(values.teamName, 2, 60, "Enter a team name.", "Keep the team name under 60 characters."));
    const size = GROUP_TEAM_SIZES.includes(Number(values.teamSize)) ? Number(values.teamSize) : 2;
    data.teamSize = size;
    data.teammates = [];
    for (let i = 0; i < size - 1; i++) {
      const [v, err] = checkText(values.teammates?.[i], 2, 80, "Enter this teammate's full name.", "That name is too long.");
      if (err) errors[`teammates.${i}`] = err;
      else data.teammates.push(v);
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

export function validateUpi(value) {
  return UPI_RE.test(String(value ?? "").trim()) ? null : "Enter the UPI ID you paid from, like name@okhdfcbank.";
}
