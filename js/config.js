// Every fact, event and price on the site comes from this file.
// To add, rename or reprice an event, edit it here (and mirror price changes
// in apps-script/Code.gs, which recomputes amounts on the server).

// ------------------------------------------------------------------ backend

/**
 * The Apps Script Web App URL (Deploy > Manage deployments > Web app URL,
 * ends in /exec). Leave empty until the Sheet is set up: on localhost the
 * site then fakes a successful registration so you can click through; on a
 * real domain it shows "Registrations aren't connected yet".
 */
export const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbykWhtZVQJOI4AViNqXYEmpxmzoeJO9FcQrI07JXl62ajiJU0xqMGs_ImeY7GgdBqR8yg/exec";

// --------------------------------------------------------------------- site

export const SITE = {
  name: "Vistara",
  tagline: ["Explore", "Innovate", "Create", "Beyond"],
  organizer: "ACM Student Chapter",
  institution: "Siddhartha Academy of Higher Education",
  institutionNote: "Deemed to be University",
  venue: "Siddhartha Academy of Higher Education, Vijayawada",
  venueShort: "SAHE, Vijayawada",
  /** Shown everywhere a prize pool is mentioned. */
  prizePool: 100000,
};

export const DAYS = {
  1: { label: "Day 1", date: "16 October 2026", short: "16 Oct", weekday: "Friday" },
  2: { label: "Day 2", date: "17 October 2026", short: "17 Oct", weekday: "Saturday" },
};

/** Flip to false to close registrations. Apps Script has its own switch too. */
export const REGISTRATION_OPEN = { day1: true, day2: true, hackathon: true };

/** Organizer phone numbers shown in the Contact section of the home page. */
export const CONTACTS = [
  // Add a name and role (e.g. "Events and registrations") when known; empty ones are hidden.
  { name: "Parna Sri", role: "Coordinator", phone: "+91 77801 93618" },
  { name: "Ipsitha", role: "Coordinator", phone: "+91 96765 83697" },
  { name: "Teja", role: "Coordinator", phone: "+91 92463 09791" },
];

// ------------------------------------------------------------------- prices

/** Bundle prices for solo and group events (per participant / per team), by tier. */
export const TIER_PRICES = {
  solo: { 1: 150, 2: 250 },
  group: { 1: 250, 2: 350 },
  /** Events paid to Vinanya: Rubik's Cube, Singing, Instrumental, Meme War, Dancing. */
  cultural: { 1: 150, 2: 300 },
};

/** Most events in one solo or group registration. Craft 24 has no limit. */
export const MAX_TIERED_EVENTS = 2;

export const HACKATHON_PRICE = 350;

/** Team size options for regular group events (including the team leader). */
export const GROUP_TEAM_SIZES = [2, 3];

// ---------------------------------------------------------------- hackathon

export const HACKATHON = {
  id: "infusion26",
  name: "INFUSION26",
  tagline: "Build for real clients today.",
  summary:
    "A hackathon with real clients instead of made-up problem statements. You work on requirements from an actual client, and what you build can go further than the hackathon.",
  fee: HACKATHON_PRICE,
  teamNote: "Teams will be formed by the organizers after registration.",
  /** Not announced yet. Replace these strings when they are. */
  dates: "Dates to be announced",
  venue: "Venue to be announced",
  rules: "Rules will be shared with registered participants.",
  rulesUrl: null,
  steps: [
    { title: "Find your team", body: "5 strangers. One mission." },
    { title: "Meet the real world", body: "Real client. Real requirements." },
    { title: "Build under pressure", body: "Think fast. Adapt faster." },
    { title: "Make it real", body: "Build it. Deliver it. Take it further." },
  ],
};

// ------------------------------------------------------------------- events

/**
 * category: which list the event appears in (solo | group | craft24)
 * pay:      which UPI account the event is paid to (a key of PAYEES). It
 *           picks the payment QR codes; events paid to different accounts
 *           can't share one registration.
 * mode:     whether one person or a team takes part (solo | group)
 * pricing:  { type: "tiered", tier: "solo" | "group" | "cultural" } priced by
 *           how many events of that tier are picked (see TIER_PRICES), or
 *           { type: "flat", amount }
 * image:    optional cover image path; without one a card face is drawn
 */
export const EVENTS = [
  // ---------------------------------------------------------------- Day 1
  {
    id: "prompt-to-pixel",
    pay: "jaya",
    name: "Prompt to Pixel",
    day: 1,
    category: "solo",
    mode: "solo",
    blurb: "Prompt an AI image to match a reference.",
    description:
      "You get a reference image and an AI image generator. Write prompts that bring the output as close to the reference as you can before time runs out.",
    pricing: { type: "tiered", tier: "solo" },
  },
  {
    id: "code-migration",
    pay: "jaya",
    name: "Code Migration",
    day: 1,
    category: "solo",
    mode: "solo",
    blurb: "Port working code to a new language.",
    description:
      "Take a working program and rewrite it in another language against the clock. It has to run and behave exactly like the original.",
    pricing: { type: "tiered", tier: "solo" },
  },
  {
    id: "no-mouse-race",
    pay: "jaya",
    name: "No Mouse Navigation Race",
    day: 1,
    category: "solo",
    mode: "solo",
    blurb: "Keyboard only. Fastest finish wins.",
    description:
      "Complete a run of everyday computer tasks using only the keyboard. Shortcuts are your friends; the mouse stays out of reach.",
    pricing: { type: "tiered", tier: "solo" },
  },
  {
    id: "rubiks-cube",
    pay: "vinanya",
    name: "Rubik's Cube",
    day: 1,
    category: "solo",
    mode: "solo",
    blurb: "Solve a scrambled 3×3, fast.",
    description: "A speed-solving round on a scrambled 3×3 cube. Bring your own cube if you have one you trust.",
    pricing: { type: "tiered", tier: "cultural" },
  },
  {
    id: "gen-ai-tag-team",
    pay: "jaya",
    name: "The Gen AI Tag Team",
    day: 1,
    category: "group",
    mode: "group",
    blurb: "Pass the prompt, solve together.",
    description:
      "Teammates take turns with generative AI tools, picking up where the last person left off, to crack a series of challenges.",
    pricing: { type: "tiered", tier: "group" },
  },
  {
    id: "domain-word-sprint",
    pay: "jaya",
    name: "Domain Word Sprint",
    day: 1,
    category: "group",
    mode: "group",
    blurb: "Rapid rounds of tech vocabulary.",
    description:
      "Quick-fire rounds of terms from across computing. Guess, define and connect them as a team before the timer runs out.",
    pricing: { type: "tiered", tier: "group" },
  },
  {
    id: "elevator-pitch",
    pay: "jaya",
    name: "Elevator Pitch",
    day: 1,
    category: "group",
    mode: "group",
    blurb: "Sell an idea in under a minute.",
    description:
      "Pitch an idea to the judges in the time an elevator ride takes. Clarity and conviction count more than slides.",
    pricing: { type: "tiered", tier: "group" },
  },
  {
    id: "best-shot",
    pay: "jaya",
    name: "Best Shot",
    day: 1,
    category: "craft24",
    mode: "solo",
    blurb: "Photograph the fest. Submit one frame.",
    description:
      "A photography event. Shoot around the campus during the fest and submit the one picture you think is your best.",
    pricing: { type: "flat", amount: 150 },
  },

  // ---------------------------------------------------------------- Day 2
  {
    id: "singing",
    pay: "vinanya",
    name: "Singing",
    day: 2,
    category: "solo",
    mode: "solo",
    blurb: "A solo vocal performance.",
    description: "Sing a piece of your choice, in any language and any genre. Just you and the stage.",
    pricing: { type: "tiered", tier: "cultural" },
  },
  {
    id: "instrumental",
    pay: "vinanya",
    name: "Instrumental Performance",
    day: 2,
    category: "solo",
    mode: "solo",
    blurb: "Play a solo piece on your instrument.",
    description: "Perform a solo piece on the instrument of your choice. Bring your own instrument.",
    pricing: { type: "tiered", tier: "cultural" },
  },
  {
    id: "meme-war",
    pay: "vinanya",
    name: "Meme War",
    day: 2,
    category: "solo",
    mode: "solo",
    blurb: "Sharpest meme on the prompt wins.",
    description: "Prompts are revealed on the spot. Make the funniest, sharpest meme you can before time is up.",
    pricing: { type: "tiered", tier: "cultural" },
  },
  {
    id: "five-word-trap",
    pay: "jaya",
    name: "The 5-Word Trap",
    day: 2,
    category: "group",
    mode: "group",
    blurb: "Verbal ping-pong. Don't fall in.",
    description: "Verbal ping-pong between teams. Keep the rally going and stay clear of the trap words.",
    pricing: { type: "tiered", tier: "group" },
  },
  {
    id: "dancing",
    pay: "vinanya",
    name: "Dancing",
    day: 2,
    category: "group",
    mode: "group",
    blurb: "Take the stage as a crew.",
    description: "A group dance performance in a style of your choice. Full rules will be shared before the fest.",
    pricing: { type: "tiered", tier: "cultural" },
  },
  {
    id: "storytelling",
    pay: "jaya",
    name: "Storytelling",
    day: 2,
    category: "craft24",
    mode: "solo",
    blurb: "One voice, one original story.",
    description: "Tell an original story on stage with nothing but your voice and your timing.",
    pricing: { type: "flat", amount: 500 },
  },
  {
    id: "short-film",
    pay: "jaya",
    name: "Short Film",
    day: 2,
    category: "craft24",
    mode: "group",
    blurb: "Make a short film, screen it here.",
    description:
      "Make a short film and screen it at the fest. Registered on its own: only the team leader fills the form, with no team name or member details.",
    pricing: { type: "flat", amount: 700 },
  },
];

// ----------------------------------------------------------------- payments

/** The UPI accounts that receive payments. Events say which one with `pay`. */
export const PAYEES = {
  jaya: { name: "jaya lakshmi", upi: "jaya1123@okicici" },
  vinanya: { name: "Vinanya Dintakurthi", upi: "vinanyadintakurthi07@oksbi" },
};

/**
 * Payment QR codes: for each account, the image for each amount it can be
 * charged. INFUSION26 has its own entry. If an amount is missing, the
 * payment step says "The QR code for this amount is missing"; `npm test`
 * catches that before it goes live.
 */
export const QR_CODES = {
  jaya: {
    150: "qr/jaya-150.jpg", // 1 technical solo event, or Best Shot
    250: "qr/jaya-250.jpg", // 2 technical solo events, or 1 group event
    350: "qr/jaya-350.jpg", // 2 group events
    500: "qr/jaya-500.jpg", // Storytelling
    700: "qr/jaya-700.jpg", // Short Film
  },
  vinanya: {
    150: "qr/vinanya-150.jpg", // 1 event (or Dancing, per team)
    300: "qr/vinanya-300.jpg", // 2 events
  },
  // INFUSION26 is paid to Jaya.
  hackathon: {
    350: "qr/jaya-350.jpg",
  },
};

/**
 * The account that receives payments. Leave `payeeVpa` empty until the real
 * UPI ID is confirmed: the "Pay with a UPI app" button only appears when set.
 */
export const UPI_PAYEE = { payeeVpa: "", payeeName: "ACM Student Chapter SAHE" };
