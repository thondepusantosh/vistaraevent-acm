import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";

import { EVENTS, HACKATHON_PRICE, PAYEES, QR_CODES } from "../js/config.js";
import { BUCKETS, EVENTS_BY_ID, bucketOf, eventsForDay, payeeOf, priceSelection, qrFor } from "../js/rules.js";

const qrOf = (...ids) => {
  const p = priceSelection(ids);
  assert.equal(p.ok, true, p.error);
  return qrFor(p.kind, p.events, p.amount);
};

/** Every pick of 1 or 2 events within each bucket, per day. */
function* everyPick() {
  for (const day of [1, 2]) {
    for (const bucket of BUCKETS) {
      const list = eventsForDay(day).filter((e) => bucketOf(e) === bucket);
      for (let i = 0; i < list.length; i++) {
        yield [list[i].id];
        for (let j = i + 1; j < list.length; j++) yield [list[i].id, list[j].id];
      }
    }
  }
}

describe("payment QR codes", () => {
  it("technical events, Elevator Pitch and The 5-Word Trap pay Jaya", () => {
    assert.equal(qrOf("prompt-to-pixel"), "qr/jaya-150.jpg");
    assert.equal(qrOf("prompt-to-pixel", "code-migration"), "qr/jaya-250.jpg");
    assert.equal(qrOf("gen-ai-tag-team"), "qr/jaya-250.jpg");
    assert.equal(qrOf("gen-ai-tag-team", "elevator-pitch"), "qr/jaya-350.jpg");
    assert.equal(qrOf("five-word-trap"), "qr/jaya-250.jpg");
  });

  it("Craft 24 pays Jaya", () => {
    assert.equal(qrOf("best-shot"), "qr/jaya-150.jpg");
    assert.equal(qrOf("storytelling"), "qr/jaya-500.jpg");
    assert.equal(qrOf("short-film"), "qr/jaya-700.jpg");
  });

  it("Rubik's Cube, Singing, Instrumental, Meme War and Dancing pay Vinanya", () => {
    assert.equal(qrOf("rubiks-cube"), "qr/vinanya-150.jpg");
    assert.equal(qrOf("singing"), "qr/vinanya-150.jpg");
    assert.equal(qrOf("singing", "instrumental"), "qr/vinanya-300.jpg");
    assert.equal(qrOf("meme-war", "singing"), "qr/vinanya-300.jpg");
    assert.equal(qrOf("dancing"), "qr/vinanya-150.jpg");
    for (const id of ["rubiks-cube", "singing", "instrumental", "meme-war", "dancing"]) {
      assert.equal(EVENTS_BY_ID[id].pay, "vinanya", id);
    }
  });

  it("Elevator Pitch is on Day 1", () => {
    assert.equal(EVENTS_BY_ID["elevator-pitch"].day, 1);
  });

  it("the hackathon has its own QR code", () => {
    assert.equal(qrFor("hackathon", [], HACKATHON_PRICE), QR_CODES.hackathon[HACKATHON_PRICE]);
  });

  it("a pick spanning two accounts has no payee", () => {
    assert.equal(payeeOf("solo", [EVENTS_BY_ID["prompt-to-pixel"], EVENTS_BY_ID["rubiks-cube"]]), null);
  });

  it("every event names a known account", () => {
    for (const e of EVENTS) assert.ok(PAYEES[e.pay], `${e.id} has pay "${e.pay}"`);
  });

  it("every allowed pick has a QR image for its amount, and the file exists", () => {
    let checked = 0;
    for (const ids of everyPick()) {
      const p = priceSelection(ids);
      if (!p.ok) continue; // combinations the site doesn't allow
      const qr = qrFor(p.kind, p.events, p.amount);
      assert.ok(qr, `no QR for ${ids.join(" + ")} (₹${p.amount})`);
      assert.ok(existsSync(new URL(`../${qr}`, import.meta.url)), `missing file ${qr}`);
      checked++;
    }
    assert.ok(checked > 20);
  });
});
