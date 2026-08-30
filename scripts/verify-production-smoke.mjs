const origin = (process.env.GODESK_PUBLIC_URL ?? "https://godesk.yumengfan220.workers.dev").replace(
  /\/$/,
  "",
);

const pages = [
  {
    path: "/",
    needles: ["今天要做一款什么游戏", "分享联机", "生成可玩版本"],
  },
  {
    path: "/chatgpt-plugin",
    needles: ["让 Codex 直接使用 GoDesk", "0.2.0+codex.20260830", "对标 ChatCut"],
  },
];

async function fetchPage(url) {
  const deadline = Date.now() + 60_000;
  let last = { status: 0, text: "", location: "" };
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      last = {
        status: response.status,
        text: await response.text(),
        location: response.headers.get("location") ?? "",
      };
      if (response.status === 200) return last;
      if (response.status === 401 || response.status === 302 || response.status === 303) {
        return last;
      }
    } catch (error) {
      last = { status: 0, text: String(error), location: "" };
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  return last;
}

for (const page of pages) {
  const url = `${origin}${page.path}`;
  const result = await fetchPage(url);
  if (result.status !== 200) {
    throw new Error(
      `${url}: expected 200 composer HTML, got ${result.status}${
        result.location ? ` location=${result.location}` : ""
      }\n${result.text.slice(0, 400)}`,
    );
  }
  for (const needle of page.needles) {
    if (!result.text.includes(needle)) {
      throw new Error(`${url}: missing ${JSON.stringify(needle)}\n${result.text.slice(0, 400)}`);
    }
  }
  console.log(`ok ${page.path}`);
}
