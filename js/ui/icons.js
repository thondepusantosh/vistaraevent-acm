// Inline SVG icons (Lucide shapes, ISC licence). Each returns markup.

const svg = (body, cls = "icon") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  plus: (c) => svg('<path d="M5 12h14"/><path d="M12 5v14"/>', c),
  check: (c) => svg('<path d="M20 6 9 17l-5-5"/>', c),
  x: (c) => svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', c),
  menu: (c) => svg('<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>', c),
  chevronLeft: (c) => svg('<path d="m15 18-6-6 6-6"/>', c),
  chevronRight: (c) => svg('<path d="m9 18 6-6-6-6"/>', c),
  arrowDown: (c) => svg('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>', c),
  arrowUpRight: (c) => svg('<path d="M7 7h10v10"/><path d="M7 17 17 7"/>', c),
  calendar: (c) =>
    svg('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>', c),
  mapPin: (c) =>
    svg('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>', c),
  trophy: (c) =>
    svg('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>', c),
  imageUp: (c) =>
    svg('<path d="M10.3 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10l-3.1-3.1a2 2 0 0 0-2.814.014L6 21"/><path d="m14 19.5 3-3 3 3"/><path d="M17 22v-5.5"/><circle cx="9" cy="9" r="2"/>', c),
  loader: (c) => svg('<path d="M21 12a9 9 0 1 1-6.219-8.56"/>', c),
  copy: (c) =>
    svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', c),
  phone: (c) =>
    svg('<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>', c),
};

/** Escapes text for safe use inside HTML templates. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
