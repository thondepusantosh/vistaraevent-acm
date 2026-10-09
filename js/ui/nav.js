// The navigation bar, shared by every page. A floating glass pill with the
// wordmark, links with a highlight that slides to the hovered or current
// link, and a Register button. On phones the links fold into a menu.
//
// Each page has <header class="site-header" id="site-nav"></header> and
// <body data-page="home | day-1 | day-2 | infusion26">.

import { HACKATHON, SITE } from "../config.js";
import { esc, icons } from "./icons.js";

const LINKS = [
  { href: "index.html", label: "Home", page: "home" },
  { href: "day-1.html", label: "Day 1", page: "day-1" },
  { href: "day-2.html", label: "Day 2", page: "day-2" },
  { href: "infusion26.html", label: HACKATHON.name, page: "infusion26" },
  { href: "index.html#contact", label: "Contact" },
];

export function mountNav() {
  const header = document.getElementById("site-nav");
  if (!header) return;
  const page = document.body.dataset.page;
  const current = (l) => (l.page && l.page === page ? ' aria-current="page"' : "");

  header.innerHTML = `
    <nav class="nav glass" aria-label="Main">
      <div class="nav-bar">
        <a class="nav-brand" href="index.html"><span class="nav-dot" aria-hidden="true"></span>${esc(SITE.name.toUpperCase())}</a>
        <ul class="nav-links">
          <li aria-hidden="true"><span class="nav-pill"></span></li>
          ${LINKS.map((l) => `<li><a class="nav-link" href="${l.href}"${current(l)}>${esc(l.label)}</a></li>`).join("")}
        </ul>
        <div class="nav-actions">
          <a class="metal-btn btn-sm nav-register" href="index.html#days">Register</a>
          <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="Open menu">
            ${icons.menu("icon-menu")}${icons.x("icon-close")}
          </button>
        </div>
      </div>
      <div class="nav-menu" id="nav-menu">
        <div>
          <ul>
            ${LINKS.map(
              (l, i) =>
                `<li><a class="nav-menu-link" style="--i:${i}" href="${l.href}"${current(l)} tabindex="-1">${esc(l.label)}</a></li>`,
            ).join("")}
            <li><a class="metal-btn btn-lg btn-block" href="index.html#days" tabindex="-1">Register now</a></li>
          </ul>
        </div>
      </div>
    </nav>`;

  const nav = header.querySelector(".nav");
  const toggle = header.querySelector(".nav-toggle");
  const menuLinks = header.querySelectorAll(".nav-menu a");

  // Mobile menu
  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menuLinks.forEach((a) => (a.tabIndex = open ? 0 : -1));
  };
  toggle.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  menuLinks.forEach((a) => a.addEventListener("click", () => setOpen(false)));
  addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));

  // Shadow once the page scrolls
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 8);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });

  // Sliding highlight behind the hovered or current link
  const list = header.querySelector(".nav-links");
  const pill = header.querySelector(".nav-pill");
  const links = [...list.querySelectorAll(".nav-link")];
  const home = links.find((a) => a.hasAttribute("aria-current"));
  const moveTo = (a, instant) => {
    if (!a) {
      pill.style.opacity = "0";
      return;
    }
    if (instant) pill.style.transition = "none";
    pill.style.width = `${a.offsetWidth}px`;
    pill.style.transform = `translateX(${a.offsetLeft}px) translateY(${a.offsetTop}px)`;
    pill.style.opacity = "1";
    if (instant) requestAnimationFrame(() => (pill.style.transition = ""));
  };
  links.forEach((a) => {
    a.addEventListener("pointerenter", () => moveTo(a));
    a.addEventListener("focus", () => moveTo(a));
  });
  list.addEventListener("pointerleave", () => moveTo(home));
  list.addEventListener("focusout", () => moveTo(home));
  // Fonts change link widths; place the pill once they've loaded.
  document.fonts?.ready.then(() => moveTo(home, true));
  moveTo(home, true);
  addEventListener("resize", () => moveTo(home, true));
}
