import { withTempWorker } from "./local-worker.mjs";

await withTempWorker("route-check", async (origin) => {
  for (const path of [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
  ]) {
    const response = await fetch(`${origin}${path}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("application/json")) {
      throw new Error(`${path}: expected JSON 200, got ${response.status} ${contentType}`);
    }
    const body = await response.json();
    if (body.resource !== `${origin}/mcp`) {
      throw new Error(`${path}: unexpected resource ${body.resource}`);
    }
  }

  const mcp = await fetch(`${origin}/mcp`);
  const mcpType = mcp.headers.get("content-type") ?? "";
  if (mcp.status !== 405 || mcpType.includes("text/html")) {
    throw new Error(`/mcp expected JSON 405, got ${mcp.status} ${mcpType}`);
  }

  const login = await fetch(`${origin}/login`);
  if (login.status !== 503 || (login.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error(`/login expected local 503 plaintext, got ${login.status}`);
  }

  const callback = await fetch(`${origin}/oauth/callback`);
  if (callback.status !== 400 || (callback.headers.get("content-type") ?? "").includes("text/html")) {
    throw new Error(`/oauth/callback expected 400 plaintext, got ${callback.status}`);
  }

  console.log("Local Worker route verification passed.");
});
