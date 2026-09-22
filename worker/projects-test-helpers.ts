import { SELF } from "cloudflare:test";
import { expect } from "vitest";

export async function mcpPayload<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (response.headers.get("content-type")?.includes("application/json")) {
    return JSON.parse(text) as T;
  }
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "));
  if (!data) throw new Error(`MCP response had no data event: ${text}`);
  return JSON.parse(data.slice("data: ".length)) as T;
}

export async function callMcpTool<T>(
  id: number,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const response = await SELF.fetch("https://godesk.test/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  expect(response.status).toBe(200);
  const payload = await mcpPayload<{
    result: { isError?: boolean; structuredContent?: T; content: unknown[] };
  }>(response);
  expect(
    payload.result.isError,
    JSON.stringify(payload.result.content),
  ).not.toBe(true);
  expect(payload.result.structuredContent).toBeTruthy();
  return payload.result.structuredContent as T;
}

export async function waitForJob(id: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const job = await SELF.fetch(`https://godesk.test/api/jobs/${id}`).then(
      (response) =>
        response.json<{
          id: string;
          status: string;
          result?: Record<string, unknown>;
          error?: string;
        }>(),
    );
    if (job.status === "succeeded" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`job ${id} did not finish`);
}

export function shareApi(shareUrl: string, pathname: string) {
  const url = new URL(shareUrl);
  url.pathname = pathname;
  return url.toString();
}

export async function claimSeat(
  roomId: string,
  seat: number,
  shareUrl?: string,
  extras?: { seatToken?: string; displayName?: string },
) {
  const pathname = `/api/sessions/${roomId}/seats`;
  const response = await SELF.fetch(
    shareUrl ? shareApi(shareUrl, pathname) : `https://godesk.test${pathname}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seat, ...extras }),
    },
  );
  const body = await response.json<{
    session?: {
      id: string;
      seats: Array<{ seat: number; displayName?: string }>;
    };
    seatToken?: string;
    error?: string;
    seat?: number;
  }>();
  return {
    status: response.status,
    session: body.session,
    seatToken: body.seatToken,
    error: body.error,
    claimedSeat: body.seat,
  };
}

export function nextSocketSnapshot(socket: WebSocket, label = "Room snapshot") {
  return new Promise<{
    type: string;
    session: {
      id: string;
      seats: Array<{ seat: number; displayName?: string }>;
      acceptedActions: Array<{ actionId: string }>;
    };
  }>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${label} was not received`)),
      1_000,
    );
    socket.addEventListener("message", (event) => {
      try {
        clearTimeout(timeout);
        resolve(JSON.parse(String(event.data)));
      } catch (reason) {
        clearTimeout(timeout);
        reject(reason);
      }
    }, { once: true });
  });
}

export async function applyKitPresentation(
  projectId: string,
  expectedVersion: number,
  idempotencyKey: string,
  theme = "idea-relay",
) {
  const response = await SELF.fetch(
    `https://godesk.test/api/projects/${projectId}/changes`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion,
        idempotencyKey,
        operations: [{
          op: "update_rule_system",
          fields: {
            presentation: {
              theme,
              visuals: [{ provenance: "kit", label: "程序化主题 kit" }],
            },
          },
        }],
      }),
    },
  );
  expect(response.status).toBe(200);
  return response.json<{ project: { version: number } }>();
}

export async function approveGenerationPlan(
  projectId: string,
  expectedVersion: number,
  idempotencyKey: string,
) {
  const planView = await SELF.fetch(
    `https://godesk.test/api/projects/${projectId}?view=generation-plan`,
  ).then((response) => response.json<{
    generationPlan: { id: string; status: string } | null;
  }>());
  expect(planView.generationPlan?.status).toBe("pending");
  const response = await SELF.fetch(
    `https://godesk.test/api/projects/${projectId}/changes`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        expectedVersion,
        idempotencyKey,
        operations: [{
          op: "approve_generation_plan",
          planId: planView.generationPlan?.id,
        }],
      }),
    },
  );
  expect(response.status).toBe(200);
  return response.json<{
    project: { version: number };
    generationPlan: { status: string; ruleSystemVersion: number } | null;
  }>();
}

