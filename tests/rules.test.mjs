// Run with: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TIER_PRICES } from "../js/config.js";
import {
  EVENTS_BY_ID,
  LIMIT_NOTE,
  addState,
  emptySelections,
  normalizePhone,
  priceSelection,
  sanitizeSelections,
  toggleEvent,
  validateDetails,
} from "../js/rules.js";

const ev = (id) => {
  const e = EVENTS_BY_ID[id];
  if (!e) throw new Error(`No event ${id}`);
  return e;
};
const pick = (...ids) => ids.reduce((s, id) => toggleEvent(s, ev(id)), emptySelections());

// Day 1 solo events paid to the same account (Rubik's Cube is paid separately).
const DAY1_SOLO = ["prompt-to-pixel", "code-migration", "no-mouse-race"];

describe("solo selection (Day 1)", () => {
  it("starts empty with every + enabled", () => {
    for (const id of [...DAY1_SOLO, "rubiks-cube"]) assert.equal(addState(ev(id), emptySelections()).kind, "available");
  });

  it("0 → 1 → 2 selected, stored as an array of IDs", () => {
    const one = pick("prompt-to-pixel");
    assert.deepEqual(one.solo, ["prompt-to-pixel"]);
    const two = toggleEvent(one, ev("code-migration"));
    assert.deepEqual(two.solo, ["prompt-to-pixel", "code-migration"]);
  });

  it("keeps the other + buttons enabled while only 1 is picked", () => {
    const one = pick("prompt-to-pixel");
    assert.equal(addState(ev("prompt-to-pixel"), one).kind, "selected");
    for (const id of DAY1_SOLO.slice(1)) assert.equal(addState(ev(id), one).kind, "available");
  });

  it("allows continuing with just 1 event", () => {
    const r = priceSelection(pick("prompt-to-pixel").solo);
    assert.equal(r.ok, true);
    assert.equal(r.amount, TIER_PRICES.solo[1]);
  });

  it("blocks a 3rd event with the limit note and leaves the selection unchanged", () => {
    const two = pick("prompt-to-pixel", "code-migration");
    for (const id of ["no-mouse-race", "rubiks-cube"]) {
      assert.deepEqual(addState(ev(id), two), { kind: "blocked", reason: LIMIT_NOTE });
    }
    assert.equal(LIMIT_NOTE, "You can participate in a maximum of 2 events.");
    const tried = toggleEvent(two, ev("no-mouse-race"));
    assert.equal(tried, two);
    assert.equal(tried.solo.length, 2);
  });

  it("deselecting re-enables the others", () => {
    const back = toggleEvent(pick("prompt-to-pixel", "code-migration"), ev("prompt-to-pixel"));
    assert.deepEqual(back.solo, ["code-migration"]);
    assert.equal(addState(ev("no-mouse-race"), back).kind, "available");
  });

  it("never selects more than 2 even when tapping everything", () => {
    assert.deepEqual(pick(...DAY1_SOLO, "rubiks-cube").solo, ["prompt-to-pixel", "code-migration"]);
  });
});

describe("events paid to different accounts", () => {
  it("Rubik's Cube can't join a technical solo pick, with a note explaining why", () => {
    const s = pick("prompt-to-pixel");
    const state = addState(ev("rubiks-cube"), s);
    assert.equal(state.kind, "blocked");
    assert.match(state.reason, /different UPI account than Prompt to Pixel/);
    assert.equal(toggleEvent(s, ev("rubiks-cube")), s);
  });

  it("and the other way round", () => {
    assert.equal(addState(ev("code-migration"), pick("rubiks-cube")).kind, "blocked");
  });

  it("clearing the pick re-enables it", () => {
    const back = toggleEvent(pick("prompt-to-pixel"), ev("prompt-to-pixel"));
    assert.equal(addState(ev("rubiks-cube"), back).kind, "available");
  });

  it("Rubik's Cube on its own costs ₹150", () => {
    assert.equal(priceSelection(["rubiks-cube"]).amount, 150);
  });

  it("Dancing and The 5-Word Trap can't share a registration", () => {
    assert.equal(addState(ev("dancing"), pick("five-word-trap")).kind, "blocked");
    assert.equal(priceSelection(["dancing", "five-word-trap"]).ok, false);
  });

  it("pricing refuses a mixed pick even if one is sent", () => {
    assert.equal(priceSelection(["prompt-to-pixel", "rubiks-cube"]).ok, false);
  });
});

describe("group selection", () => {
  it("allows 1 or 2 group events with tier prices", () => {
    const one = pick("elevator-pitch");
    assert.equal(priceSelection(one.group).amount, TIER_PRICES.group[1]);
    const two = toggleEvent(one, ev("gen-ai-tag-team"));
    assert.equal(priceSelection(two.group).amount, TIER_PRICES.group[2]);
  });

  it("rejects 3 group events in pricing too", () => {
    assert.equal(priceSelection(["gen-ai-tag-team", "domain-word-sprint", "elevator-pitch"]).ok, false);
  });
});

describe("categories are independent", () => {
  it("filling solo never locks group or Craft 24", () => {
    const s = pick("prompt-to-pixel", "code-migration");
    assert.equal(addState(ev("gen-ai-tag-team"), s).kind, "available");
    assert.equal(addState(ev("best-shot"), s).kind, "available");
  });

  it("keeps every category's picks when picking in another", () => {
    const s = pick("prompt-to-pixel", "gen-ai-tag-team", "best-shot");
    assert.deepEqual(s.solo, ["prompt-to-pixel"]);
    assert.deepEqual(s.group, ["gen-ai-tag-team"]);
    assert.deepEqual(s["craft24-solo"], ["best-shot"]);
  });
});

describe("Craft 24", () => {
  it("has no limit: + is never disabled", () => {
    assert.equal(addState(ev("short-film"), pick("storytelling")).kind, "available");
    const both = pick("storytelling", "short-film");
    assert.deepEqual(both["craft24-solo"], ["storytelling"]);
    assert.deepEqual(both["craft24-group"], ["short-film"]);
  });

  it("adds solo Craft 24 prices together", () => {
    assert.equal(priceSelection(["storytelling"]).amount, 500);
    assert.equal(priceSelection(["best-shot"]).amount, 150);
  });

  it("registers Short Film separately from solo Craft 24 events", () => {
    const film = priceSelection(["short-film"]);
    assert.equal(film.amount, 700);
    assert.equal(film.bucket, "craft24-group");
    assert.equal(priceSelection(["storytelling", "short-film"]).ok, false);
  });
});

describe("price matches the count", () => {
  for (const [ids, amount] of [
    [["prompt-to-pixel"], 150],
    [["prompt-to-pixel", "no-mouse-race"], 250],
    [["singing"], 150],
    [["singing", "meme-war"], 300],
    [["instrumental", "meme-war"], 300],
    [["elevator-pitch"], 250],
    [["elevator-pitch", "domain-word-sprint"], 350],
    [["five-word-trap"], 250],
    [["dancing"], 150],
  ]) {
    it(`${ids.join(" + ")} costs ${amount}`, () => assert.equal(priceSelection(ids).amount, amount));
  }

  it("rejects an empty selection and mixed days", () => {
    assert.equal(priceSelection([]).ok, false);
    assert.equal(priceSelection(["prompt-to-pixel", "singing"]).ok, false);
  });
});

describe("sanitizeSelections", () => {
  it("drops other days, wrong buckets, unknown IDs and anything past the limit", () => {
    const s = sanitizeSelections(
      {
        solo: ["prompt-to-pixel", "singing", "nope", "code-migration", "rubiks-cube"],
        group: ["best-shot"],
        "craft24-solo": ["best-shot"],
      },
      1,
    );
    assert.deepEqual(s.solo, ["prompt-to-pixel", "code-migration"]);
    assert.deepEqual(s.group, []);
    assert.deepEqual(s["craft24-solo"], ["best-shot"]);
  });
});

describe("validation", () => {
  it("normalizes Indian phone numbers", () => {
    assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
    assert.equal(normalizePhone("098765-43210"), "9876543210");
  });

  it("requires teammate names for the team size", () => {
    const base = { name: "Asha Rao", phone: "9876543210", email: "a@example.com", college: "SAHE", teamName: "Byte" };
    assert.equal(validateDetails({ ...base, teamSize: 3, teammates: ["Ravi", ""] }, "team").ok, false);
    const ok = validateDetails({ ...base, teamSize: 2, teammates: ["Ravi", ""] }, "team");
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.data.teammates, ["Ravi"]);
  });

  it("leader form asks for no team fields", () => {
    const r = validateDetails({ name: "Asha Rao", phone: "9876543210", email: "a@example.com", college: "SAHE" }, "leader");
    assert.equal(r.ok, true);
    assert.equal(r.data.teamName, undefined);
  });
});
