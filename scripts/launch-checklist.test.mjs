import { describe, expect, it } from "vitest";
import {
  decideExit, evaluateAssetLegal, evaluateDrawCalls, evaluateHud, evaluateLighthouse, evaluateSizeBudgets, renderMarkdown,
} from "./launch-checklist.mjs";
import { findRawActionIds } from "./perf/hud-raw-ids.mjs";

describe("G3D-17 launch checklist · evaluators", () => {
  it("asset-legal: pending AI rows warn, zero passes, verify failure fails, no input is missing", () => {
    expect(evaluateAssetLegal({ ok: true, summary: { aiPendingLegalReview: 68 } }).status).toBe("warn");
    expect(evaluateAssetLegal({ ok: true, summary: { aiPendingLegalReview: 0 } }).status).toBe("pass");
    expect(evaluateAssetLegal({ ok: false, errors: ["x"], summary: { aiPendingLegalReview: 0 } }).status).toBe("fail");
    expect(evaluateAssetLegal(null).status).toBe("missing");
  });

  it("size-budgets: parses size-limit JSON and check-size-budgets lines; tight headroom warns, FAIL fails", () => {
    const lines = [
      "homepage index JS: index-a.js=165.03KB total=165.03KB limit=170KB OK",
      "render3d core (excl. assets): r.js=176.34KB total=201.79KB limit=210KB OK",
    ];
    const roomy = evaluateSizeBudgets({ sizeLimit: [{ name: "home", size: 150_000, sizeLimit: 170_000, passed: true }], budgetLines: lines });
    expect(roomy.status).toBe("pass");
    expect(roomy.details.rows).toHaveLength(3);
    expect(evaluateSizeBudgets({ sizeLimit: [{ name: "home", size: 168_678, sizeLimit: 170_000, passed: true }], budgetLines: lines }).status).toBe("warn");
    expect(evaluateSizeBudgets({ sizeLimit: null, budgetLines: ["x: total=220.00KB limit=210KB FAIL"] }).status).toBe("fail");
    expect(evaluateSizeBudgets({ sizeLimit: null, budgetLines: null }).status).toBe("missing");
  });

  const rc = (level) => ({ ci: { assert: { assertMatrix: [
    { matchingUrlPattern: "^http://127\\.0\\.0\\.1:[0-9]+/$", assertions: {
      "categories:performance": ["error", { minScore: 0.81 }],
      "largest-contentful-paint": [level, { maxNumericValue: 2500, aggregationMethod: "median-run" }],
    } },
    { matchingUrlPattern: "/room/", assertions: { "total-blocking-time": [level, { maxNumericValue: 600 }] } },
  ] } } });
  const lhr = (url, lcp, tbt) => ({ requestedUrl: url, audits: { "largest-contentful-paint": { numericValue: lcp }, "total-blocking-time": { numericValue: tbt } } });

  it("lighthouse: warn-level assertions are reported (median-run vs threshold); all error-level passes", () => {
    const noRuns = evaluateLighthouse(rc("warn"), null);
    expect(noRuns.status).toBe("warn");
    expect(noRuns.details.rows.map((row) => row.auditId)).toEqual(["largest-contentful-paint", "total-blocking-time"]);
    const home = "http://127.0.0.1:8790/";
    const room = "http://127.0.0.1:8790/room/r1?share=x";
    const over = evaluateLighthouse(rc("warn"), [lhr(home, 3100, 0), lhr(home, 3200, 0), lhr(home, 2000, 0), lhr(room, 0, 400)]);
    expect(over.status).toBe("fail");
    expect(over.details.rows[0].actual).toBe(3100);
    expect(over.details.rows[1].within).toBe(true);
    expect(evaluateLighthouse(rc("warn"), [lhr(home, 2000, 0), lhr(room, 0, 500)]).status).toBe("warn");
    expect(evaluateLighthouse(rc("error"), null).status).toBe("pass");
    expect(evaluateLighthouse({}, null).status).toBe("missing");
  });

  it("draw-calls: per-tier budget uses max(steady, peak); errors are unmeasured", () => {
    const report = (low) => ({ launchChecklist: { tierDrawCalls: [
      { requestedTier: "high", actualTier: "high", calls: 82, peak: 145 },
      { requestedTier: "medium", actualTier: "medium", calls: 82, peak: 96 },
      { requestedTier: "low", actualTier: "low", ...low },
    ] } });
    expect(evaluateDrawCalls(report({ calls: 50, peak: 58 })).status).toBe("pass");
    const over = evaluateDrawCalls(report({ calls: 55, peak: 126 }));
    expect(over.status).toBe("fail");
    expect(over.summary).toContain("low");
    expect(evaluateDrawCalls(report({ error: "timeout" })).status).toBe("warn");
    expect(evaluateDrawCalls(null).status).toBe("missing");
  });

  it("hud: any raw id warns, clean scans pass", () => {
    const clean = { launchChecklist: { hudRawActionIds: [{ viewport: "desktop", count: 0, samples: [] }, { viewport: "iphone", count: 0, samples: [] }] } };
    expect(evaluateHud(clean).status).toBe("pass");
    const dirty = { launchChecklist: { hudRawActionIds: [{ viewport: "iphone", count: 3, samples: [{ context: "放置道路 · -200:173|-250:87" }] }] } };
    expect(evaluateHud(dirty).status).toBe("warn");
    expect(evaluateHud(dirty).summary).toContain("-200:173|-250:87");
    expect(evaluateHud({}).status).toBe("missing");
  });
});

describe("G3D-17 launch checklist · mode switch", () => {
  const items = [{ id: "asset-legal", status: "warn" }, { id: "size-budgets", status: "pass" }, { id: "hud-raw-action-ids", status: "missing" }];

  it("warn mode never blocks unless an id is listed in --block", () => {
    expect(decideExit(items, { mode: "warn" })).toEqual({ exitCode: 0, blocking: [] });
    expect(decideExit(items, { mode: "warn", block: ["size-budgets"] })).toEqual({ exitCode: 0, blocking: [] });
    expect(decideExit(items, { mode: "warn", block: ["asset-legal"] })).toEqual({ exitCode: 1, blocking: ["asset-legal"] });
  });

  it("block mode fails on any non-pass item (missing counts)", () => {
    expect(decideExit(items, { mode: "block" })).toEqual({ exitCode: 1, blocking: ["asset-legal", "hud-raw-action-ids"] });
    expect(decideExit([{ id: "size-budgets", status: "pass" }], { mode: "block" }).exitCode).toBe(0);
  });

  it("markdown marks the mode and blocking rows", () => {
    const md = renderMarkdown([{ id: "asset-legal", title: "AI", status: "warn", summary: "68 | x" }], { mode: "block", blocking: ["asset-legal"] });
    expect(md).toContain("模式：阻断");
    expect(md).toContain("warn · 阻断");
    expect(md).toContain("68 \\| x");
  });
});

describe("G3D-17 launch checklist · raw action id probe", () => {
  it("finds edge / vertex coordinate keys, internal ids and kernel action types", () => {
    const result = findRawActionIds([
      { source: "button", text: "放置道路 · -200:173|-250:87" },
      { source: "button", text: "放置渔村 · 150:-87" },
      { source: "li", text: "action_9f3a2b 已执行；place_road" },
      { source: "p", text: "房间 3f05fabd-fe81-81bf-bb41-e7b538b9fd52" },
    ]);
    expect(result.byRule).toEqual({ "coordinate-edge": 1, "coordinate-vertex": 1, "internal-id": 2, "action-type": 1 });
    expect(result.count).toBe(5);
    expect(result.samples[0]).toMatchObject({ rule: "coordinate-edge", match: "-200:173|-250:87" });
  });

  it("ignores clock times, scores and ordinary Chinese HUD copy", () => {
    const result = findRawActionIds([
      { source: "small", text: "10:42 · 对局开始" },
      { source: "strong", text: "黑 19 · 白 45" },
      { source: "p", text: "当前行动 座位 1 · 白；最近落子 8,8 · 翻子 3" },
      { source: "span", text: "胜利点 3:2 领先" },
    ]);
    expect(result.count).toBe(0);
  });
});
