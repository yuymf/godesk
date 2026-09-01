const origin = (process.env.GODESK_PUBLIC_URL ?? "https://godesk.yumengfan220.workers.dev").replace(
  /\/$/,
  "",
);

const ACCESS_HINT =
  "Cloudflare Access is wrapping the public plugin mount. Friends need /chatgpt-plugin/new, /chatgpt-plugin/api/*, /chatgpt-plugin/try/*, and /chatgpt-plugin/mcp open. In the Worker Access tab, keep the /chatgpt-plugin* bypass or add a Worker-level bypass (decision: bypass, include everyone).";

async function fetchPage(url, init = {}) {
  const deadline = Date.now() + 60_000;
  let last = { status: 0, text: "", location: "", authenticate: "", headers: new Headers() };
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual", ...init });
      last = {
        status: response.status,
        text: await response.text(),
        location: response.headers.get("location") ?? "",
        authenticate: response.headers.get("www-authenticate") ?? "",
        headers: response.headers,
      };
      if ([200, 201, 302, 303, 401, 405, 503].includes(last.status)) return last;
    } catch (error) {
      last = {
        status: 0,
        text: String(error),
        location: "",
        authenticate: "",
        headers: new Headers(),
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  return last;
}

function accessWrapped(result) {
  return (
    result.status === 401 &&
    (result.authenticate.includes("cloudflare-access-protected-resource") ||
      result.text.includes("cloudflare-access-protected-resource"))
  );
}

function requireOpen(result, path) {
  if (accessWrapped(result)) {
    throw new Error(`${origin}${path}: ${ACCESS_HINT}\n${result.text.slice(0, 300)}`);
  }
}

function cookieHeader(result) {
  const cookies = typeof result.headers.getSetCookie === "function"
    ? result.headers.getSetCookie()
    : result.headers.get("set-cookie")
      ? [result.headers.get("set-cookie")]
      : [];
  return cookies
    .filter(Boolean)
    .map((value) => value.split(";")[0])
    .join("; ");
}

async function withBundles(result) {
  const scripts = [...result.text.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((match) => match[1]);
  let text = result.text;
  for (const src of scripts) {
    const bundle = await fetchPage(`${origin}${src}`);
    if (bundle.status === 200) text += `\n${bundle.text}`;
  }
  return text;
}

const home = await fetchPage(`${origin}/chatgpt-plugin/new`);
requireOpen(home, "/chatgpt-plugin/new");
if (home.status !== 200) {
  throw new Error(`${origin}/chatgpt-plugin/new: expected 200, got ${home.status}`);
}
if (home.text.includes("给规则，就开玩")) {
  throw new Error(
    `${origin}/chatgpt-plugin/new: deploy the current Worker; this is still the old shell.`,
  );
}
if (!home.text.includes("写想法，就开玩")) {
  throw new Error(
    `${origin}/chatgpt-plugin/new: expected the current composer document title.`,
  );
}
const homeSource = await withBundles(home);
if (!homeSource.includes("今天要做一款什么游戏？")) {
  throw new Error(
    `${origin}/chatgpt-plugin/new: composer heading missing from the shipped bundle.`,
  );
}
console.log("ok /chatgpt-plugin/new composer");

const install = await fetchPage(`${origin}/chatgpt-plugin`);
if (install.status !== 200) {
  throw new Error(`${origin}/chatgpt-plugin: expected 200, got ${install.status}`);
}
if (install.text.includes("给规则，就开玩")) {
  throw new Error(
    `${origin}/chatgpt-plugin: deploy the current Worker; this is still the old shell.`,
  );
}
const installSource = await withBundles(install);
if (!installSource.includes("不用 Codex，直接做一局")) {
  throw new Error(
    `${origin}/chatgpt-plugin: friends still cannot skip Codex.`,
  );
}
console.log("ok /chatgpt-plugin install");

const login = await fetchPage(`${origin}/chatgpt-plugin/login`);
requireOpen(login, "/chatgpt-plugin/login");
if (![302, 303, 503].includes(login.status)) {
  throw new Error(
    `${origin}/chatgpt-plugin/login: expected 302 or 503 from the Worker, got ${login.status}`,
  );
}
console.log(`ok /chatgpt-plugin/login ${login.status}`);

const api = await fetchPage(`${origin}/chatgpt-plugin/api/projects`);
requireOpen(api, "/chatgpt-plugin/api/projects");
if (api.status !== 200) {
  throw new Error(
    `${origin}/chatgpt-plugin/api/projects: expected 200 visitor list, got ${api.status}\n${api.text.slice(0, 300)}`,
  );
}
console.log("ok /chatgpt-plugin/api/projects 200");

const mcp = await fetchPage(`${origin}/chatgpt-plugin/mcp`);
requireOpen(mcp, "/chatgpt-plugin/mcp");
if (mcp.status !== 401 || !mcp.authenticate.includes("oauth-protected-resource/chatgpt-plugin/mcp")) {
  throw new Error(
    `${origin}/chatgpt-plugin/mcp: expected Worker OAuth challenge, got ${mcp.status} ${mcp.authenticate}`,
  );
}
console.log("ok /chatgpt-plugin/mcp OAuth challenge");

const created = await fetchPage(`${origin}/chatgpt-plugin/api/projects`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ name: "生产邀请冒烟", templateId: "idea-relay" }),
});
requireOpen(created, "/chatgpt-plugin/api/projects");
if (created.status !== 201) {
  throw new Error(
    `${origin}/chatgpt-plugin/api/projects POST: expected 201, got ${created.status}\n${created.text.slice(0, 300)}`,
  );
}
const cookie = cookieHeader(created);
if (!cookie.includes("GODESK_ANON")) {
  throw new Error("public mount did not issue an anonymous creator cookie");
}
const createdBody = JSON.parse(created.text);
const projectId = createdBody.project.id;
const headers = { "content-type": "application/json", cookie };

const compiled = await fetchPage(`${origin}/chatgpt-plugin/api/projects/${projectId}/builds`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    expectedVersion: createdBody.project.version,
    idempotencyKey: "production-smoke-build",
  }),
});
if (compiled.status !== 201) {
  throw new Error(
    `compile: expected 201, got ${compiled.status}\n${compiled.text.slice(0, 300)}`,
  );
}
const compiledBody = JSON.parse(compiled.text);

const room = await fetchPage(
  `${origin}/chatgpt-plugin/api/builds/${compiledBody.build.id}/sessions`,
  {
    method: "POST",
    headers,
    body: JSON.stringify({ seed: 42, idempotencyKey: "production-smoke-room" }),
  },
);
if (room.status !== 201) {
  throw new Error(`room: expected 201, got ${room.status}\n${room.text.slice(0, 300)}`);
}
const roomBody = JSON.parse(room.text);
if (!new URL(roomBody.sessionUrl).pathname.startsWith("/chatgpt-plugin/room/")) {
  throw new Error(`room URL left the open prefix: ${roomBody.sessionUrl}`);
}

const published = await fetchPage(`${origin}/chatgpt-plugin/api/projects/${projectId}/changes`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    expectedVersion: compiledBody.project.version,
    idempotencyKey: "production-smoke-publish",
    operations: [{ op: "publish_shared_session", sessionId: roomBody.id }],
  }),
});
if (published.status !== 200) {
  throw new Error(
    `publish: expected 200, got ${published.status}\n${published.text.slice(0, 300)}`,
  );
}

const link = await fetchPage(
  `${origin}/chatgpt-plugin/api/projects/${projectId}?view=playtest-link`,
  { headers },
);
const tryUrl = JSON.parse(link.text).playtestLink?.url;
if (!tryUrl || !new URL(tryUrl).pathname.startsWith("/chatgpt-plugin/try/")) {
  throw new Error(`playtest link left the open prefix: ${tryUrl}`);
}

const redirect = await fetchPage(tryUrl);
if (redirect.status !== 302 || !new URL(redirect.location, origin).pathname.startsWith("/chatgpt-plugin/room/")) {
  throw new Error(`try redirect: expected prefixed room, got ${redirect.status} ${redirect.location}`);
}
const share = new URL(redirect.location, origin).searchParams.get("share");
if (!share) {
  throw new Error("try redirect is missing the share token a friend needs");
}

const friend = await fetchPage(
  `${origin}/chatgpt-plugin/api/sessions/${roomBody.id}/seats?share=${encodeURIComponent(share)}`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seat: 0, displayName: "朋友" }),
  },
);
if (friend.status !== 200) {
  throw new Error(
    `friend seat: expected 200, got ${friend.status}\n${friend.text.slice(0, 300)}`,
  );
}
const seated = JSON.parse(friend.text);
const played = await fetchPage(
  `${origin}/chatgpt-plugin/api/sessions/${roomBody.id}/intents?share=${encodeURIComponent(share)}`,
  {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      intentId: "production-smoke-friend-turn",
      seat: 0,
      seatToken: seated.seatToken,
      actionId: "extend",
      payload: { text: "朋友接上一句共同创意。" },
    }),
  },
);
if (played.status !== 200) {
  throw new Error(
    `friend turn: expected 200, got ${played.status}\n${played.text.slice(0, 300)}`,
  );
}
console.log(`ok friend played through ${tryUrl}`);
