// Checks apps-script/Code.gs agrees with the website on every price, so a
// registration the site allows is never rejected by the Sheet (or the other
// way round). Code.gs runs in a sandbox; it only touches Google services
// inside functions these tests don't call.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import vm from "node:vm";

import { EVENTS, HACKATHON_PRICE } from "../js/config.js";
import { BUCKETS, bucketOf, eventsForDay, priceSelection } from "../js/rules.js";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");
const gs = vm.createContext({});
vm.runInContext(`${source}\nthis.api = { computeAmount_, EVENTS, UserError };`, gs);
const { computeAmount_, EVENTS: GS_EVENTS } = gs.api;

/** The backend's answer: an amount, or null if it refuses. */
function backendPrice(kind, ids, day) {
  try {
    return computeAmount_(kind, ids, day);
  } catch {
    return null;
  }
}

describe("Code.gs matches the website", () => {
  it("has the same events, days, kinds and payees", () => {
    assert.deepEqual(Object.keys(GS_EVENTS).sort(), EVENTS.map((e) => e.id).sort());
    for (const e of EVENTS) {
      const g = GS_EVENTS[e.id];
      assert.equal(g.day, e.day, `${e.id} day`);
      assert.equal(g.kind, e.category, `${e.id} kind`);
      assert.equal(g.pay, e.pay, `${e.id} pay`);
    }
  });

  it("prices every pair of events on a day the same way", () => {
    let compared = 0;
    for (const day of [1, 2]) {
      const list = eventsForDay(day);
      for (const a of list) {
        for (const b of [null, ...list]) {
          if (b === a) continue;
          const ids = b ? [a.id, b.id] : [a.id];
          const site = priceSelection(ids);
          const kind = a.category;
          const backend = backendPrice(kind, ids, day);
          if (site.ok && site.kind === kind) {
            assert.equal(backend, site.amount, `${ids.join(" + ")}: site ₹${site.amount}, Code.gs ${backend}`);
          } else {
            assert.equal(backend, null, `${ids.join(" + ")}: site refuses it but Code.gs charges ${backend}`);
          }
          compared++;
        }
      }
    }
    assert.ok(compared > 50);
  });

  it("charges the same hackathon fee", () => {
    assert.equal(backendPrice("hackathon", [], null), HACKATHON_PRICE);
  });

  it("lists every bucket's events under the right kind", () => {
    for (const e of EVENTS) assert.ok(BUCKETS.includes(bucketOf(e)));
  });
});
