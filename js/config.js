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
export const APPS_SCRIPT_URL = "";

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

/** Placeholders until the organizers confirm names and numbers. */
export const CONTACTS = [
  { name: "Coordinator name", role: "Fest coordinator", phone: "+91 90000 00001" },
  { name: "Coordinator name", role: "Events and registrations", phone: "+91 90000 00002" },
  { name: "Coordinator name", role: "INFUSION26 hackathon", phone: "+91 90000 00003" },
];

// ------------------------------------------------------------------- prices

/** Bundle prices for regular solo and group events (per participant / per team). */
export const TIER_PRICES = {
  solo: { 1: 150, 2: 250 },
  group: { 1: 250, 2: 350 },
};

/** Most events in one solo or group registration. Craft 24 has no limit. */
export const MAX_TIERED_EVENTS = 2;

export const HACKATHON_PRICE = 300;

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
 * mode:     whether one person or a team takes part (solo | group)
 * pricing:  { type: "tiered", tier: "solo" | "group" } priced by how many
 *           events of that tier are picked, or { type: "flat", amount }
 * image:    optional cover image path; without one a card face is drawn
 */
export const EVENTS = [
  // ---------------------------------------------------------------- Day 1
  {
    id: "prompt-to-pixel",
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
    name: "Rubik's Cube",
    day: 1,
    category: "solo",
    mode: "solo",
    blurb: "Solve a scrambled 3×3, fast.",
    description: "A speed-solving round on a scrambled 3×3 cube. Bring your own cube if you have one you trust.",
    pricing: { type: "tiered", tier: "solo" },
  },
  {
    id: "gen-ai-tag-team",
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
    id: "best-shot",
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
    name: "Singing",
    day: 2,
    category: "solo",
    mode: "solo",
    blurb: "A solo vocal performance.",
    description: "Sing a piece of your choice, in any language and any genre. Just you and the stage.",
    pricing: { type: "tiered", tier: "solo" },
  },
  {
    id: "instrumental",
    name: "Instrumental Performance",
    day: 2,
    category: "solo",
    mode: "solo",
    blurb: "Play a solo piece on your instrument.",
    description: "Perform a solo piece on the instrument of your choice. Bring your own instrument.",
    pricing: { type: "tiered", tier: "solo" },
  },
  {
    id: "meme-war",
    name: "Meme War",
    day: 2,
    category: "solo",
    mode: "solo",
    blurb: "Sharpest meme on the prompt wins.",
    description: "Prompts are revealed on the spot. Make the funniest, sharpest meme you can before time is up.",
    pricing: { type: "tiered", tier: "solo" },
  },
  {
    id: "elevator-pitch",
    name: "Elevator Pitch",
    day: 2,
    category: "group",
    mode: "group",
    blurb: "Sell an idea in under a minute.",
    description:
      "Pitch an idea to the judges in the time an elevator ride takes. Clarity and conviction count more than slides.",
    pricing: { type: "tiered", tier: "group" },
  },
  {
    id: "five-word-trap",
    name: "The 5-Word Trap",
    day: 2,
    category: "group",
    mode: "group",
    blurb: "Verbal ping-pong. Don't fall in.",
    description: "Verbal ping-pong between teams. Keep the rally going and stay clear of the trap words.",
    pricing: { type: "tiered", tier: "group" },
  },
  {
    id: "storytelling",
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

/** Payment QR code per amount. Replace the placeholder files in /qr. */
export const QR_BY_AMOUNT = {
  150: "qr/qr-150.svg", // 1 solo event, or Best Shot
  250: "qr/qr-250.svg", // 2 solo events, or 1 group event
  300: "qr/qr-300.svg", // INFUSION26
  350: "qr/qr-350.svg", // 2 group events
  500: "qr/qr-500.svg", // Storytelling
  700: "qr/qr-700.svg", // Short Film
};

/**
 * The account that receives payments. Leave `payeeVpa` empty until the real
 * UPI ID is confirmed: the "Pay with a UPI app" button only appears when set.
 */
export const UPI_PAYEE = { payeeVpa: "", payeeName: "ACM Student Chapter SAHE" };
