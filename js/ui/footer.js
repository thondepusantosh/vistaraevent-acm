// The site credit at the bottom of every page: who designed it, a LinkedIn
// button, an "open to freelance" badge and a phone number. The details come
// from CREDIT in js/config.js; set CREDIT to null there to hide the footer.
//
// Each page has <footer class="site-footer" id="site-footer"></footer>.

import { CREDIT, SITE } from "../config.js";
import { esc } from "./icons.js";

// LinkedIn glyph from Simple Icons (CC0).
const LINKEDIN = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;

export function mountFooter() {
  const el = document.getElementById("site-footer");
  if (!el || !CREDIT?.name) return;
  const tel = CREDIT.phone ? CREDIT.phone.replace(/[^\d+]/g, "") : "";

  el.innerHTML = `
    <p class="credit-line">
      <span>Design by <strong class="credit-name">${esc(CREDIT.name)}</strong></span>
      ${
        CREDIT.linkedin
          ? `<a class="credit-in" href="${esc(CREDIT.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(CREDIT.name)} on LinkedIn" title="LinkedIn">${LINKEDIN}</a>`
          : ""
      }
    </p>
    <p class="credit-meta">
      ${CREDIT.note ? `<span class="credit-pill"><span class="credit-dot" aria-hidden="true"></span>${esc(CREDIT.note)}</span>` : ""}
      ${CREDIT.phone ? `<a class="credit-phone tabular" href="tel:${esc(tel)}">${esc(CREDIT.phone)}</a>` : ""}
    </p>
    <p class="credit-copy">© 2026 ${esc(SITE.name)}</p>`;
}
