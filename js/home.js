// Home page: fills the hero facts, day cards, INFUSION26 section and
// contacts from js/config.js, and starts the kinetic grid background.

import { CONTACTS, DAYS, HACKATHON, REGISTRATION_OPEN, SITE } from "./config.js";
import { BUCKET_LABEL, BUCKETS, bucketOf, eventsForDay, formatINR } from "./rules.js";
import { esc, icons } from "./ui/icons.js";
import { mountKineticGrid } from "./ui/kinetic-grid.js";
import { initMetalButtons } from "./ui/metal-button.js";
import { mountNav } from "./ui/nav.js";

const $ = (sel) => document.querySelector(sel);

function renderHero() {
  $("#hero-org").textContent = `${SITE.organizer}, ${SITE.institution}`;
  $("#tagline").innerHTML = SITE.tagline
    .map((w, i) => `${i ? '<span class="sep" aria-hidden="true">|</span>' : ""}<span>${esc(w)}</span>`)
    .join("");
  $("#tagline").setAttribute("aria-label", SITE.tagline.join(", "));
  const facts = [
    { icon: icons.calendar(), label: "Dates", value: `${DAYS[1].short}–${DAYS[2].short} 2026` },
    { icon: icons.mapPin(), label: "Venue", value: SITE.venueShort },
    { icon: icons.trophy(), label: "Prize pool", value: formatINR(SITE.prizePool) },
  ];
  $("#facts").innerHTML = facts
    .map(
      (f) => `<div class="fact glass">${f.icon}<div style="min-width:0"><dt>${esc(f.label)}</dt><dd class="tabular">${esc(f.value)}</dd></div></div>`,
    )
    .join("");
}

function renderDays() {
  $("#day-grid").innerHTML = [1, 2]
    .map((day) => {
      const info = DAYS[day];
      const open = REGISTRATION_OPEN[`day${day}`];
      const groups = BUCKETS.map((b) => [b, eventsForDay(day).filter((e) => bucketOf(e) === b)]).filter(([, list]) => list.length);
      const body = `
        <div class="day-card-head">
          <h3>${esc(info.label)}</h3>
          <p class="day-card-date">${esc(info.weekday)}<br><strong class="tabular">${esc(info.date)}</strong></p>
        </div>
        <dl>
          ${groups
            .map(([b, list]) => `<div><dt>${esc(BUCKET_LABEL[b])}</dt><dd>${list.map((e) => esc(e.name)).join(", ")}</dd></div>`)
            .join("")}
        </dl>
        ${
          open
            ? `<span class="metal-btn btn-lg">Register for ${esc(info.label)} ${icons.arrowUpRight()}</span>`
            : `<span class="muted">Registrations closed</span>`
        }`;
      return open
        ? `<a class="day-card glass reveal" href="day-${day}.html">${body}</a>`
        : `<div class="day-card glass reveal" style="opacity:.7">${body}</div>`;
    })
    .join("");

  // Glow that follows the pointer across a card
  document.querySelectorAll(".day-card").forEach((card) =>
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    }),
  );
}

function renderHackathon() {
  const h = HACKATHON;
  $("#hack-name").textContent = h.name;
  $("#hack-tagline").textContent = h.tagline;
  $("#hack-summary").textContent = h.summary;
  $("#hack-facts").innerHTML = `
    <div><dt>Fee</dt><dd class="fee tabular">${formatINR(h.fee)} per person</dd></div>
    <div><dt>When</dt><dd>${esc(h.dates)}</dd></div>
    <div><dt>Where</dt><dd>${esc(h.venue)}</dd></div>
    <div><dt>Rules</dt><dd>${h.rulesUrl ? `<a href="${esc(h.rulesUrl)}" style="text-decoration:underline">Read the rules</a>` : esc(h.rules)}</dd></div>`;
  $("#hack-note").textContent = `You register on your own. ${h.teamNote}`;
  $("#hack-cta").innerHTML = REGISTRATION_OPEN.hackathon
    ? `<a class="metal-btn btn-xl" href="infusion26.html">Register for ${esc(h.name)}</a>`
    : `<p class="muted">Registrations for ${esc(h.name)} are closed.</p>`;
  $("#timeline").innerHTML = h.steps
    .map(
      (s, i) => `
      <li>
        <span class="timeline-num tabular" aria-hidden="true">${i + 1}</span>
        <div>
          <p class="timeline-title"><span class="sr-only">Step ${i + 1}: </span>${esc(s.title)}</p>
          <p class="timeline-body">${esc(s.body)}</p>
        </div>
      </li>`,
    )
    .join("");
}

function renderContacts() {
  $("#contacts").innerHTML = CONTACTS.map(
    (c) => `
    <li class="contact glass reveal">
      <p class="contact-name">${esc(c.name)}</p>
      <p class="contact-role">${esc(c.role)}</p>
      <a class="contact-phone tabular" href="tel:${esc(c.phone.replace(/\s/g, ""))}">${esc(c.phone)}</a>
    </li>`,
  ).join("");
  $("#footer-note").textContent = `${SITE.name} 2026 is organized by the ${SITE.organizer}, ${SITE.institution} (${SITE.institutionNote}).`;
}

/** Fades sections in as they scroll into view. */
function revealOnScroll() {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      }),
    { rootMargin: "0px 0px -10% 0px" },
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

mountNav();
renderHero();
renderDays();
renderHackathon();
renderContacts();
revealOnScroll();
initMetalButtons();
mountKineticGrid(document.getElementById("grid"));
