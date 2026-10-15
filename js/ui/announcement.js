// The "Vistara is postponed" announcement, in two sizes. Text comes from
// ANNOUNCEMENT in js/config.js.
//
//   updateBlock()   the poster's message: kicker, headline, two lines, the
//                   "Vistara — Postponed" badge and "New dates coming soon".
//   noticePanel()   the official announcement text, the sign-off and the
//                   poster image, as a glass panel.

import { ANNOUNCEMENT as A } from "../config.js";
import { esc } from "./icons.js";

export function updateBlock({ headingLevel = 2 } = {}) {
  const h = `h${headingLevel}`;
  return `<div class="update">
    <p class="update-kicker">${esc(A.kicker)}</p>
    <span class="update-rule" aria-hidden="true"></span>
    <${h} class="update-headline">${esc(A.headline)}</${h}>
    <p class="update-lines">${A.lines.map((l) => `<span>${esc(l)}</span>`).join(" ")}</p>
    <p class="update-badge">${esc(A.badge)}</p>
    <p class="update-soon">${esc(A.soon)}</p>
  </div>`;
}

export function noticePanel({ headingLevel = 2, poster = true } = {}) {
  const h = `h${headingLevel}`;
  return `<div class="notice${poster ? " notice--poster" : ""}">
    <article class="notice-text glass">
      <p class="notice-kicker"><span class="notice-dot" aria-hidden="true"></span>Postponed</p>
      <${h} class="notice-title">${esc(A.title)}</${h}>
      ${A.body.map((p) => `<p class="notice-body">${esc(p)}</p>`).join("")}
      <p class="notice-signoff">${esc(A.signoff)}</p>
    </article>
    ${
      poster && A.poster
        ? `<figure class="notice-poster glass">
            <a href="${esc(A.poster)}" target="_blank" rel="noopener">
              <img src="${esc(A.poster)}" width="1024" height="1536" loading="lazy" alt="Vistara update poster: Great things deserve the right moment. The vision remains. The dates change. Vistara postponed. New dates coming soon. ACM Student Chapter, SAHE.">
            </a>
            <figcaption>Official update poster · tap to open</figcaption>
          </figure>`
        : ""
    }
  </div>`;
}
