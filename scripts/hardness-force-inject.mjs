/**
 * Generic Room force helpers for hardness evidence (T049/T053+).
 * Mutates via real session intents after claiming seats — no sample-pack hardcodes.
 */
import { mkdirSync } from "node:fs";

export function normalizeRoomUrl(sessionUrl, base = "http://127.0.0.1:8799") {
  let url = sessionUrl;
  if (!url) return null;
  if (!url.startsWith("http")) url = base + (url.startsWith("/") ? url : `/${url}`);
  if (url.includes("/room/") && !url.includes("/chatgpt-plugin/")) {
    url = url.replace("/room/", "/chatgpt-plugin/room/");
  }
  return url;
}

/** Claim seats 0..n-1; returns { "0": token, ... }. Stores seat 0 in sessionStorage. */
export async function claimAllSeats(page, seatCount) {
  return page.evaluate(async ({ n }) => {
    const m = location.pathname.match(/room\/([^/?]+)/);
    const sid = m?.[1];
    const share = new URLSearchParams(location.search).get("share");
    const q = share ? `?share=${encodeURIComponent(share)}` : "";
    // T143 · parallel seat claim; T146 · restore tokens across reload
    const bagKey = `godesk-seats:${sid}`;
    let tokens = {};
    try { tokens = JSON.parse(sessionStorage.getItem(bagKey) || "{}") || {}; } catch { tokens = {}; }
    await Promise.all([...Array(n).keys()].map(async (seat) => {
      const prior = tokens[String(seat)];
      const r = await fetch(`/chatgpt-plugin/api/sessions/${sid}/seats${q}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          seat,
          displayName: `p${seat}`,
          ...(prior ? { seatToken: prior } : {}),
        }),
      });
      const j = await r.json();
      if (j.seatToken) {
        tokens[String(seat)] = j.seatToken;
        if (seat === 0) {
          sessionStorage.setItem(
            `godesk-seat:${sid}`,
            JSON.stringify({ seat: 0, seatToken: j.seatToken }),
          );
        }
      }
    }));
    sessionStorage.setItem(bagKey, JSON.stringify(tokens));
    return tokens;
  }, { n: seatCount });
}

export async function shotSeatPair(page, dir) {
  mkdirSync(dir, { recursive: true });
  await page.waitForSelector("canvas", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${dir}/15-room-stage-wide.png` });
  const box = await page.locator("canvas").first().boundingBox();
  if (!box) return;
  await page.screenshot({
    path: `${dir}/15-room-stage-close.png`,
    clip: {
      x: box.x + box.width * 0.05,
      y: box.y + box.height * 0.25,
      width: box.width * 0.9,
      height: box.height * 0.65,
    },
  });
  await page.screenshot({
    path: `${dir}/15-room-seat-close.png`,
    clip: {
      x: box.x + box.width * 0.1,
      y: box.y + box.height * 0.5,
      width: box.width * 0.8,
      height: box.height * 0.45,
    },
  });
}


/** Tighter seat-front crop (felt band above wood rim) — for pixel gates on owned pieces. */
export async function shotSeatFrontClose(page, path, { leftBias = false } = {}) {
  const box = await page.locator("canvas").first().boundingBox();
  if (!box) return;
  const x = leftBias ? box.x + box.width * 0.05 : box.x + box.width * 0.08;
  const w = leftBias ? box.width * 0.55 : box.width * 0.84;
  await page.screenshot({
    path,
    clip: {
      x,
      y: box.y + box.height * 0.38,
      width: w,
      height: box.height * 0.42,
    },
  });
}

/**
 * Force-buy ≥ minCards development cards onto seat 0 (gem-engine-v1).
 * Other seats reserve-from-deck to advance turns without draining the color bank.
 */
export async function forceBuyGemCards(page, tokens, { minCards = 2, maxSteps = 120 } = {}) {
  return page.evaluate(async ({ tokens, minCards, maxSteps }) => {
    const m = location.pathname.match(/room\/([^/?]+)/);
    const sid = m?.[1];
    const share = new URLSearchParams(location.search).get("share");
    const q = share ? `?share=${encodeURIComponent(share)}` : "";
    const tok = (seat) => tokens[String(seat)];
    const intent = async (seat, actionId, payload) => {
      const seatToken = await ensureSeat(seat);
      const r = await fetch(`/chatgpt-plugin/api/sessions/${sid}/intents${q}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: crypto.randomUUID(),
          seat,
          seatToken,
          actionId,
          ...(payload ? { payload } : {}),
        }),
      });
      const text = await r.text();
      let j = null;
      try { j = JSON.parse(text); } catch {}
      return {
        status: r.status,
        ok: r.ok,
        err: j?.error,
        active: j?.state?.activeSeat,
        cards0: j?.state?.gemEngine?.seats?.[0]?.cards?.length,
      };
    };
    const get = async () => {
      const j = await (await fetch(`/chatgpt-plugin/api/sessions/${sid}${q}`)).json();
      const s = j.session || j;
      return s.state || s;
    };
    const canAfford = (seat, card) => {
      const discounts = {};
      for (const c of seat.cards || []) discounts[c.discount] = (discounts[c.discount] || 0) + 1;
      let gold = seat.gems.gold || 0;
      for (const [color, need] of Object.entries(card.cost || {})) {
        const have = (seat.gems[color] || 0) + (discounts[color] || 0);
        if (have < need) {
          const miss = need - have;
          if (gold < miss) return false;
          gold -= miss;
        }
      }
      return true;
    };
    const missingColors = (seat, card) => {
      const discounts = {};
      for (const c of seat.cards || []) discounts[c.discount] = (discounts[c.discount] || 0) + 1;
      const miss = [];
      for (const [color, need] of Object.entries(card.cost || {})) {
        const have = (seat.gems[color] || 0) + (discounts[color] || 0);
        for (let i = have; i < need; i++) miss.push(color);
      }
      return miss;
    };
    const cheapest = (ge, seat) => {
      let best = null;
      for (let tier = 0; tier < 3; tier++) {
        (ge.market[tier] || []).forEach((card, index) => {
          const costN = Object.values(card.cost || {}).reduce((a, b) => a + b, 0);
          const miss = missingColors(seat, card).length;
          const score = miss * 10 + costN;
          if (!best || score < best.score) best = { card, tier: tier + 1, index, score };
        });
      }
      return best;
    };
    const log = [];
    for (let step = 0; step < maxSteps; step++) {
      const st = await get();
      if (st.status !== "active") return { ok: false, err: "dead", status: st.status, log };
      const ge = st.gemEngine;
      const cards0 = (ge.seats[0].cards || []).length;
      if (cards0 >= minCards) {
        return {
          ok: true,
          cards: ge.seats[0].cards.map((c) => ({ id: c.id, discount: c.discount, prestige: c.prestige })),
          gems: ge.seats[0].gems,
          steps: step,
          log,
        };
      }
      const active = st.activeSeat;
      const seat = ge.seats[active];
      if (ge.pendingDiscardSeat === active) {
        const color = ["white", "blue", "green", "red", "black", "gold"].find((c) => (seat.gems[c] || 0) > 0);
        const acted = await intent(active, "discard_gems", { color, count: 1 });
        log.push({ step, discard: color, seat: active, ...acted });
        if (!acted.ok) return { ok: false, err: "discard", acted, log };
        continue;
      }
      let acted = null;
      if (active === 0) {
        const target = cheapest(ge, seat);
        if (target && canAfford(seat, target.card)) {
          acted = await intent(0, "buy", { tier: target.tier, index: target.index });
          log.push({ step, buy: target.card.id, ...acted });
        } else if (target) {
          const miss = missingColors(seat, target.card);
          const want = miss.find((c) => ge.bank[c] >= 4) || miss.find((c) => ge.bank[c] > 0);
          if (want && ge.bank[want] >= 4) {
            acted = await intent(0, "take_pair", { color: want });
            log.push({ step, take_pair: want, seat: 0, ...acted });
          } else {
            const colors = ["white", "blue", "green", "red", "black"];
            const pick = [];
            for (const c of miss) if (ge.bank[c] > 0 && !pick.includes(c)) pick.push(c);
            for (const c of colors) if (pick.length < 3 && ge.bank[c] > 0 && !pick.includes(c)) pick.push(c);
            if (pick.length === 3) {
              acted = await intent(0, "take_diverse", { colors: pick });
              log.push({ step, take_diverse: pick, seat: 0, ...acted });
            }
          }
        }
      } else if ((seat.reserved || []).length < 3 && (ge.decks?.[0]?.length || 0) > 0) {
        acted = await intent(active, "reserve", { tier: 1, fromDeck: true });
        log.push({ step, reserve_deck: 1, seat: active, ...acted });
      } else if ((seat.reserved || []).length < 3) {
        acted = await intent(active, "reserve", { tier: 1, index: 0 });
        log.push({ step, reserve_mkt: true, seat: active, ...acted });
      }
      if (!acted) {
        const colors = ["white", "blue", "green", "red", "black"];
        const pair = colors.find((c) => ge.bank[c] >= 4);
        if (pair) {
          acted = await intent(active, "take_pair", { color: pair });
          log.push({ step, take_pair: pair, seat: active, fallback: true, ...acted });
        } else {
          const pick = colors.filter((c) => ge.bank[c] > 0).slice(0, 3);
          if (pick.length === 3) {
            acted = await intent(active, "take_diverse", { colors: pick });
            log.push({ step, take_diverse: pick, seat: active, fallback: true, ...acted });
          } else {
            return { ok: false, err: "stuck", bank: ge.bank, gems0: ge.seats[0].gems, cards0, log };
          }
        }
      }
      if (acted && !acted.ok) return { ok: false, err: "intent", acted, log };
    }
    const st = await get();
    const cards = st.gemEngine.seats[0].cards || [];
    return { ok: cards.length >= minCards, cards, gems: st.gemEngine.seats[0].gems, log };
  }, { tokens, minCards, maxSteps });
}

/**
 * Force-own ≥ minLots into seat 0 collection (auction-bidding-v1 gallery).
 * Prefer fixed-price: auctioneer-0 buy_own; otherwise seat 0 buy_fixed.
 */
export async function forceOwnAuctionLots(page, tokens, { minLots = 2, maxSteps = 100 } = {}) {
  return page.evaluate(async ({ tokens, minLots, maxSteps }) => {
    const m = location.pathname.match(/room\/([^/?]+)/);
    const sid = m?.[1];
    const share = new URLSearchParams(location.search).get("share");
    const q = share ? `?share=${encodeURIComponent(share)}` : "";
    const tok = (s) => tokens[String(s)];
    const intent = async (seat, actionId, payload) => {
      const r = await fetch(`/chatgpt-plugin/api/sessions/${sid}/intents${q}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: crypto.randomUUID(),
          seat,
          seatToken: tok(seat),
          actionId,
          ...(payload ? { payload } : {}),
        }),
      });
      const text = await r.text();
      let j = null;
      try { j = JSON.parse(text); } catch {}
      const ab = j?.state?.auctionBidding;
      const g = ab?.gallery;
      return {
        status: r.status,
        ok: r.ok,
        err: j?.error,
        phase: ab?.phase,
        active: j?.state?.activeSeat,
        auctioneer: g?.auctioneer,
        coll0: g?.collection?.[0]?.length,
        mode: g?.currentMode,
      };
    };
    const get = async () => {
      const j = await (await fetch(`/chatgpt-plugin/api/sessions/${sid}${q}`)).json();
      const s = j.session || j;
      return s.state || s;
    };
    const log = [];
    for (let step = 0; step < maxSteps; step++) {
      const st = await get();
      if (st.status !== "active") return { ok: false, err: "dead", log };
      const ab = st.auctionBidding;
      const g = ab.gallery;
      const coll0 = (g.collection?.[0] || []).length;
      if (coll0 >= minLots) {
        return {
          ok: true,
          lots: g.collection[0].map((p) => ({ id: p.id, name: p.name, artistId: p.artistId })),
          steps: step,
          log,
        };
      }
      const phase = ab.phase;
      const active = st.activeSeat;
      let acted = null;
      if (phase === "offer") {
        if (active !== g.auctioneer) return { ok: false, err: "offer-desync", active, auctioneer: g.auctioneer, log };
        const hand = g.auctionHand[active] || [];
        const painting = hand[0];
        if (!painting) return { ok: false, err: "empty-hand", log };
        const mode = (g.modes || []).includes("fixed") ? "fixed" : (g.modes || ["open"])[0];
        acted = await intent(active, "play_painting", { instanceId: painting.instanceId, mode });
        log.push({ step, play: painting.name, mode, seat: active, ...acted });
      } else if (phase === "fixed") {
        if (active === g.auctioneer) {
          if (g.auctioneer === 0) {
            acted = await intent(0, "buy_own");
            log.push({ step, buy_own: true, ...acted });
            if (!acted.ok) acted = await intent(0, "decline_own");
          } else {
            acted = await intent(active, "decline_own");
            log.push({ step, decline_own: active, ...acted });
          }
        } else if (active === 0) {
          acted = await intent(0, "buy_fixed");
          log.push({ step, buy_fixed: true, ...acted });
          if (!acted.ok) {
            acted = await intent(0, "pass_fixed");
            log.push({ step, pass_fixed: 0, ...acted });
          }
        } else {
          acted = await intent(active, "pass_fixed");
          log.push({ step, pass_fixed: active, ...acted });
        }
      } else if (phase === "market") {
        acted = await intent(active, "pass_market");
        log.push({ step, pass_market: active, ...acted });
      } else if (phase === "open") {
        if (active === 0) {
          const amount = Math.max(g.currentLot?.reserve ?? 1, (ab.currentBid || 0) + 1);
          acted = await intent(0, "bid", { amount });
          log.push({ step, bid: amount, ...acted });
          if (!acted.ok) acted = await intent(0, "pass");
        } else {
          acted = await intent(active, "pass");
          log.push({ step, pass: active, ...acted });
        }
      } else if (phase === "sealed") {
        if (g.sealedBids?.[active] == null) {
          acted = active === 0
            ? await intent(0, "sealed_bid", { amount: g.currentLot?.reserve ?? 1 })
            : await intent(active, "sealed_pass");
          log.push({ step, sealed: active, ...acted });
        } else {
          return { ok: false, err: "sealed-stuck", log };
        }
      } else {
        acted = await intent(active, "pass");
        log.push({ step, pass_phase: phase, ...acted });
      }
      if (acted && !acted.ok) return { ok: false, err: "intent", acted, phase, log };
    }
    const st = await get();
    const lots = st.auctionBidding.gallery.collection[0] || [];
    return { ok: lots.length >= minLots, lots, log };
  }, { tokens, minLots, maxSteps });
}

/**
 * Force hex-settlement setup until seat 0 has ≥ minSettlements + minRoads.
 * Probes place_settlement / place_road via real intents over the fixed radius-2 graph.
 */
/** T133 · shared readiness: canvas + room chrome before force / seat-close audits. */
export async function waitRoomCanvasReady(page, { timeoutMs = 20000 } = {}) {
  await page.waitForSelector("canvas", { timeout: timeoutMs });
  await page.waitForFunction(() => {
    const c = document.querySelector("canvas");
    if (!c) return false;
    const b = c.getBoundingClientRect();
    return b.width > 200 && b.height > 200;
  }, { timeout: timeoutMs });
  return { ok: true };
}

/**
 * T133 · hex force with wall-clock budget + reliability metrics (shared tooling).
 * Prefer this over bare forceBuildHexSetup + outer withTimeout.
 */
export async function runHexForceWithBudget(page, tokens, opts = {}) {
  // T143 · sub-40s: canvas ready outside force clock
  // T146/T149 · chainSetup intents; default budget 10s
  const budgetMs = opts.budgetMs ?? 10000;
  await waitRoomCanvasReady(page, { timeoutMs: Math.min(12000, budgetMs) });
  const started = Date.now();
  const remaining = () => Math.max(1000, budgetMs - (Date.now() - started));
  let result;
  try {
    result = await Promise.race([
      forceBuildHexSetup(page, tokens, {
        // T136 · full setup ≥2 via listLegalActions; override opts for lighter audits
        minSettlements: opts.minSettlements ?? 2,
        minRoads: opts.minRoads ?? 2,
        maxSteps: opts.maxSteps ?? 48,
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`budget ${budgetMs}ms`)), remaining())),
    ]);
  } catch (e) {
    result = { ok: false, err: String(e?.message || e), timedOut: true };
  }
  const elapsedMs = Date.now() - started;
  // Always allow a fresh glyph readiness window (budget may be exhausted)
  const glyph = await awaitSeatCloseGlyphReady(page, { timeoutMs: opts.glyphTimeoutMs ?? 8000 }).catch((e) => ({
    ok: false, err: String(e?.message || e),
  }));
  return {
    ok: Boolean(result?.ok),
    force: result,
    glyph,
    reliability: {
      elapsedMs,
      budgetMs,
      forceOk: Boolean(result?.ok),
      forceErr: result?.err || null,
      forceSteps: result?.steps ?? result?.log?.length ?? null,
      glyphOk: Boolean(glyph?.ok),
      canvasReady: true,
    },
  };
}

/** T133 · seat-close glyph audit readiness (shared; not sample-specific). */
export async function awaitSeatCloseGlyphReady(page, { timeoutMs = 10000 } = {}) {
  const started = Date.now();
  await waitRoomCanvasReady(page, { timeoutMs });
  // Poll scene for number-token nodes / atlas paint via canvas still alive
  const ok = await page.waitForFunction(() => {
    const c = document.querySelector("canvas");
    if (!c) return false;
    const b = c.getBoundingClientRect();
    if (b.width < 200 || b.height < 200) return false;
    // Prefer live scene graph if exposed; else canvas presence is enough for shot
    const host = document.querySelector("[data-kernel], .g3d-stage, .tabletop-stage, .tabletop-scene");
    return Boolean(host);
  }, { timeout: timeoutMs }).then(() => true).catch(() => false);
  return { ok, elapsedMs: Date.now() - started };
}

export async function forceBuildHexSetup(page, tokens, { minSettlements = 2, minRoads = 2, maxSteps = 48 } = {}) {
  // T136 · drive placements from GET …/legal-actions (listLegalActions authority).
  // T140 · budget trim: prefetch seats, reuse intent state, first legal only.
  // T143 · consume nextLegalActions piped from intent.
  // T146 · chainSetup:true so server applies settle+road hop in one RTT.
  return page.evaluate(async ({ tokens, minSettlements, minRoads, maxSteps }) => {
    const m = location.pathname.match(/room\/([^/?]+)/);
    const sid = m?.[1];
    const share = new URLSearchParams(location.search).get("share");
    const q = share ? `?share=${encodeURIComponent(share)}` : "";
    const tok = (s) => tokens[String(s)];
    const ensureSeat = async (seat) => {
      if (tok(seat)) return tok(seat);
      const r = await fetch(`/chatgpt-plugin/api/sessions/${sid}/seats${q}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seat, displayName: `p${seat}` }),
      });
      const j = await r.json();
      if (j.seatToken) tokens[String(seat)] = j.seatToken;
      return tokens[String(seat)];
    };
    const get = async () => {
      const j = await (await fetch(`/chatgpt-plugin/api/sessions/${sid}${q}`)).json();
      const s = j.session || j;
      return s.state || s;
    };
    const legal = async (seat) => {
      const url = `/chatgpt-plugin/api/sessions/${sid}/legal-actions${q}${q ? "&" : "?"}seat=${encodeURIComponent(seat)}`;
      const r = await fetch(url);
      if (!r.ok) return { ok: false, status: r.status, actions: [] };
      const j = await r.json();
      return { ok: true, ...j };
    };
    const intent = async (seat, actionId, payload) => {
      const seatToken = await ensureSeat(seat);
      if (!seatToken) return { status: 409, ok: false, err: "seat_claim_failed" };
      const r = await fetch(`/chatgpt-plugin/api/sessions/${sid}/intents${q}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: crypto.randomUUID(),
          seat,
          seatToken,
          actionId,
          chainSetup: true, // T146/T149 · batch setup hops per RTT
          ...(payload ? { payload } : {}),
        }),
      });
      const text = await r.text();
      let j = null;
      try { j = JSON.parse(text); } catch {}
      return {
        status: r.status,
        ok: r.ok,
        err: j?.error,
        state: j?.state || j?.session?.state,
        nextLegalActions: j?.nextLegalActions,
        nextLegalSeat: j?.nextLegalSeat,
        chained: j?.chained ?? 0,
        raw: j,
      };
    };
    let st = await get();
    const seatN = Math.max(st.scores?.length || 2, st.hexIsland?.playerCount || 2);
    await Promise.all([...Array(seatN).keys()].map((s) => ensureSeat(s)));
    const log = [];
    let viaLegal = 0;
    let pipedLegal = null; // { seat, actions } from prior intent
    for (let step = 0; step < maxSteps; step++) {
      if (st.status !== "active") return { ok: false, err: "dead", log, steps: step, viaLegal };
      const hi = st.hexIsland;
      if (!hi) return { ok: false, err: "no-hexIsland", log, steps: step, viaLegal };
      const p0 = hi.players[0];
      const settle0 = (p0.settlements || []).length;
      const roads0 = (p0.roads || []).length;
      if (settle0 >= minSettlements && roads0 >= minRoads) {
        return {
          ok: true,
          settlements: [...p0.settlements],
          roads: [...p0.roads],
          steps: step,
          phase: hi.phase,
          log,
          viaLegal,
          via: "listLegalActions",
        };
      }
      const active = st.activeSeat;
      let actions = null;
      if (pipedLegal && pipedLegal.seat === active && Array.isArray(pipedLegal.actions) && pipedLegal.actions.length) {
        actions = pipedLegal.actions;
        viaLegal += 1;
      } else {
        const la = await legal(active);
        if (!la.ok || !Array.isArray(la.actions) || la.actions.length === 0) {
          log.push({ step, stuck: true, active, phase: hi.phase, legalStatus: la.status, settle0, roads0 });
          return { ok: false, err: "no-legal", settle0, roads0, log, steps: step, viaLegal };
        }
        actions = la.actions;
        viaLegal += 1;
      }
      const prefer = actions.find((a) => a.type === "place_settlement" || a.type === "place_road")
        || actions[0];
      const r = await intent(active, prefer.type, prefer.payload || undefined);
      log.push({
        step,
        active,
        acted: { type: prefer.type, ok: r.ok, payload: prefer.payload || null, err: r.err || null },
        legalCount: actions.length,
        piped: Boolean(pipedLegal && pipedLegal.seat === active),
      });
      if (!r.ok) {
        return { ok: false, err: "intent_rejected", settle0, roads0, log, steps: step, viaLegal };
      }
      if (r.state) st = r.state;
      else st = await get();
      // T143 · pipe next legal from intent (listLegalActions on server)
      if (Array.isArray(r.nextLegalActions) && r.nextLegalSeat != null) {
        pipedLegal = { seat: r.nextLegalSeat, actions: r.nextLegalActions };
      } else {
        pipedLegal = null;
      }
    }
    const final = st?.hexIsland ? st : await get();
    const p0 = final.hexIsland?.players?.[0];
    return {
      ok: ((p0?.settlements || []).length >= minSettlements && (p0?.roads || []).length >= minRoads),
      settlements: p0?.settlements,
      roads: p0?.roads,
      log,
      steps: maxSteps,
      viaLegal,
      via: "listLegalActions",
    };
  }, { tokens, minSettlements, minRoads, maxSteps });
}



export async function forceDraftPattern(page, tokens, { minLineTiles = 2, minFloor = 1, maxSteps = 80 } = {}) {
  return page.evaluate(async ({ tokens, minLineTiles, minFloor, maxSteps }) => {
    const m = location.pathname.match(/room\/([^/?]+)/);
    const sid = m?.[1];
    const share = new URLSearchParams(location.search).get("share");
    const q = share ? `?share=${encodeURIComponent(share)}` : "";
    const tok = (s) => tokens[String(s)];
    const intent = async (seat, actionId, payload) => {
      const r = await fetch(`/chatgpt-plugin/api/sessions/${sid}/intents${q}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: crypto.randomUUID(),
          seat,
          seatToken: tok(seat),
          actionId,
          ...(payload ? { payload } : {}),
        }),
      });
      const text = await r.text();
      let j = null;
      try { j = JSON.parse(text); } catch {}
      return { status: r.status, ok: r.ok, err: j?.error, state: j?.state || j?.session?.state };
    };
    const get = async () => {
      const j = await (await fetch(`/chatgpt-plugin/api/sessions/${sid}${q}`)).json();
      const s = j.session || j;
      return s.state || s;
    };
    const seat0Stats = (pd) => {
      const seat = pd.seats?.[0];
      if (!seat) return { lineTiles: 0, floor: 0, linesFilled: 0 };
      const lineTiles = (seat.lines || []).reduce((n, l) => n + (l.tiles?.length || 0), 0);
      const linesFilled = (seat.lines || []).filter((l) => (l.tiles?.length || 0) > 0).length;
      return { lineTiles, floor: (seat.floor || []).length, linesFilled };
    };
    const log = [];
    for (let step = 0; step < maxSteps; step++) {
      const st = await get();
      if (st.status !== "active") return { ok: false, err: "dead", log };
      const pd = st.patternDraft;
      if (!pd) return { ok: false, err: "no-patternDraft", log };
      const stats = seat0Stats(pd);
      if (stats.lineTiles >= minLineTiles && stats.floor >= minFloor && stats.linesFilled >= 1) {
        return { ok: true, ...stats, steps: step, phase: pd.phase, seat0: pd.seats[0], log };
      }
      const active = st.activeSeat;
      // Enumerate factories/center colors like listLegalActions
      const candidates = [];
      (pd.factories || []).forEach((factory, factoryId) => {
        const colors = [...new Set(factory)];
        for (const color of colors) {
          for (let line = 0; line < 5; line++) candidates.push({ source: "factory", factoryId, color, line });
          candidates.push({ source: "factory", factoryId, color, line: "floor" });
        }
      });
      for (const color of [...new Set(pd.center || [])]) {
        for (let line = 0; line < 5; line++) candidates.push({ source: "center", color, line });
        candidates.push({ source: "center", color, line: "floor" });
      }
      // Prefer: seat0 → line fills; others → floor to advance quickly
      const preferLine = active === 0 && stats.lineTiles < minLineTiles;
      const preferFloor = active === 0 && stats.lineTiles >= minLineTiles && stats.floor < minFloor;
      const ordered = [...candidates].sort((a, b) => {
        const score = (c) => {
          let s = 0;
          if (preferLine && c.line !== "floor") s += 10;
          if (preferFloor && c.line === "floor") s += 10;
          if (active !== 0 && c.line === "floor") s += 5;
          if (typeof c.line === "number") s += (4 - c.line); // shorter lines first
          return -s;
        };
        return score(a) - score(b);
      });
      let acted = null;
      for (const c of ordered) {
        const payload = { source: c.source, color: c.color, line: c.line };
        if (c.source === "factory") payload.factoryId = c.factoryId;
        const r = await intent(active, "draft", payload);
        if (r.ok) { acted = { ...c, status: r.status }; break; }
      }
      if (!acted) {
        log.push({ step, stuck: true, active, stats, phase: pd.phase });
        return { ok: false, err: "stuck", ...stats, log };
      }
      log.push({ step, active, acted });
    }
    const st = await get();
    const stats = seat0Stats(st.patternDraft);
    return { ok: stats.lineTiles >= minLineTiles && stats.floor >= minFloor, ...stats, log };
  }, { tokens, minLineTiles, minFloor, maxSteps });
}

/**
 * Force ≥1 claimed colored train route on network-route-v1 via draw_trains + claim.
 * Generic intents — no pack / city-name hardcodes.
 */
export async function forceClaimNetwork(page, tokens, { minClaims = 1, maxRounds = 12 } = {}) {
  return page.evaluate(async ({ tokens, minClaims, maxRounds }) => {
    const m = location.pathname.match(/room\/([^/?]+)/);
    const sid = m?.[1];
    const share = new URLSearchParams(location.search).get("share");
    const q = share ? `?share=${encodeURIComponent(share)}` : "";
    const tok = (s) => tokens[String(s)];
    const intent = async (seat, actionId, payload) => {
      const r = await fetch(`/chatgpt-plugin/api/sessions/${sid}/intents${q}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intentId: crypto.randomUUID(),
          seat,
          seatToken: tok(seat),
          actionId,
          ...(payload ? { payload } : {}),
        }),
      });
      const text = await r.text();
      let j = null;
      try { j = JSON.parse(text); } catch {}
      return { status: r.status, ok: r.ok, err: j?.error, state: j?.state };
    };
    const get = async () => {
      const j = await (await fetch(`/chatgpt-plugin/api/sessions/${sid}${q}`)).json();
      const s = j.session || j;
      return s.state || s;
    };
    const countClaims = (nr) => Object.values(nr.claims || {}).filter((v) => v != null).length;
    const log = [];
    for (let round = 0; round < maxRounds; round++) {
      const st = await get();
      if (st.status !== "active") return { ok: false, err: "dead", log };
      const nr = st.networkRoute;
      if (!nr) return { ok: false, err: "no-networkRoute", log };
      const claimed = countClaims(nr);
      if (claimed >= minClaims) {
        return { ok: true, claimed, claims: nr.claims, steps: round, log };
      }
      const active = st.activeSeat;
      // Try claim any legal edge for active seat
      const tickets = nr.tickets;
      let claimedNow = false;
      if (tickets) {
        const hand = tickets.trainHand?.[active] || {};
        const colors = ["red","orange","yellow","green","blue","purple","black","white"];
        for (const edge of nr.edges || []) {
          if (nr.claims[edge.id] != null) continue;
          const meta = tickets.edgeMeta?.[edge.id];
          if (!meta) continue;
          if ((tickets.trainsLeft?.[active] ?? 0) < meta.length) continue;
          const payColors = meta.color === "gray" ? colors : [meta.color];
          for (const c of payColors) {
            const colored = hand[c] ?? 0;
            const wild = hand.wild ?? 0;
            if (colored + wild >= meta.length) {
              const r = await intent(active, "claim", { edgeId: edge.id, payColor: c });
              log.push({ round, try: "claim", edgeId: edge.id, payColor: c, ok: r.ok, err: r.err });
              if (r.ok) { claimedNow = true; break; }
            }
          }
          if (claimedNow) break;
        }
      } else {
        for (const edge of nr.edges || []) {
          if (nr.claims[edge.id] != null) continue;
          const r = await intent(active, "claim", { edgeId: edge.id });
          log.push({ round, try: "claim", edgeId: edge.id, ok: r.ok, err: r.err });
          if (r.ok) { claimedNow = true; break; }
        }
      }
      if (claimedNow) continue;
      // Draw trains to build hand
      const draw = await intent(active, "draw_trains", {
        picks: [{ source: "deck" }, { source: "deck" }],
      });
      log.push({ round, try: "draw_trains", ok: draw.ok, err: draw.err });
      if (!draw.ok) {
        // try draw_tickets or skip by drawing one
        const d2 = await intent(active, "draw_tickets", {});
        log.push({ round, try: "draw_tickets", ok: d2.ok, err: d2.err });
        if (!d2.ok) {
          return { ok: false, err: "stuck", claimed: countClaims((await get()).networkRoute), log };
        }
      }
    }
    const st = await get();
    const claimed = countClaims(st.networkRoute || {});
    return { ok: claimed >= minClaims, claimed, claims: st.networkRoute?.claims, log };
  }, { tokens, minClaims, maxRounds });
}
