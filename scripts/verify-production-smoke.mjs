const origin = (process.env.GODESK_PUBLIC_URL ?? "https://godesk.yumengfan220.workers.dev").replace(
  /\/$/,
  "",
);

const ACCESS_HINT =
  "Cloudflare Access is wrapping the Worker. Friends cannot open the composer or a /try/ link. In the Worker Access tab, add a Worker-level bypass (decision: bypass, include everyone). App OAuth still protects /studio and /api/projects.";

const pages = [
  {
    path: "/",
    allow: [200],
    needles: ["今天要做一款什么游戏", "分享联机", "生成可玩版本"],
  },
  {
    path: "/chatgpt-plugin",
    allow: [200],
    needles: ["让 Codex 直接使用 GoDesk", "0.2.0+codex.20260830", "对标 ChatCut"],
  },
  {
    path: "/login",
    allow: [302, 303],
    needles: [],
  },
  {
    path: "/room/public-play?share=smoke",
    allow: [200],
    needles: [],
  },
];

async function fetchPage(url) {
  const deadline = Date.now() + 60_000;
  let last = { status: 0, text: "", location: "", authenticate: "" };
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      last = {
        status: response.status,
        text: await response.text(),
        location: response.headers.get("location") ?? "",
        authenticate: response.headers.get("www-authenticate") ?? "",
      };
      if (last.status === 200 || last.status === 302 || last.status === 303 || last.status === 401) {
        return last;
      }
    } catch (error) {
      last = { status: 0, text: String(error), location: "", authenticate: "" };
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

for (const page of pages) {
  const url = `${origin}${page.path}`;
  const result = await fetchPage(url);
  if (accessWrapped(result)) {
    throw new Error(`${url}: ${ACCESS_HINT}\n${result.text.slice(0, 300)}`);
  }
  if (!page.allow.includes(result.status)) {
    throw new Error(
      `${url}: expected ${page.allow.join("|")}, got ${result.status}${
        result.location ? ` location=${result.location}` : ""
      }\n${result.text.slice(0, 400)}`,
    );
  }
  for (const needle of page.needles) {
    if (!result.text.includes(needle)) {
      throw new Error(`${url}: missing ${JSON.stringify(needle)}\n${result.text.slice(0, 400)}`);
    }
  }
  console.log(`ok ${page.path} ${result.status}`);
}
