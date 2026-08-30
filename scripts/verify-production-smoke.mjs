const origin = (process.env.GODESK_PUBLIC_URL ?? "https://godesk.yumengfan220.workers.dev").replace(
  /\/$/,
  "",
);

const ACCESS_HINT =
  "Cloudflare Access is wrapping the public plugin mount. Friends need /chatgpt-plugin/new and /chatgpt-plugin/api/* open. In the Worker Access tab, keep the /chatgpt-plugin* bypass or add a Worker-level bypass (decision: bypass, include everyone).";

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
      if ([200, 201, 302, 303, 401, 503].includes(last.status)) return last;
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

const home = await fetchPage(`${origin}/chatgpt-plugin/new`);
if (accessWrapped(home) || home.status !== 200) {
  throw new Error(`${origin}/chatgpt-plugin/new: ${ACCESS_HINT}\n${home.text.slice(0, 300)}`);
}
console.log("ok /chatgpt-plugin/new 200");

const install = await fetchPage(`${origin}/chatgpt-plugin`);
if (install.status !== 200) {
  throw new Error(`${origin}/chatgpt-plugin: expected 200, got ${install.status}`);
}
console.log("ok /chatgpt-plugin 200");

const login = await fetchPage(`${origin}/chatgpt-plugin/login`);
if (accessWrapped(login)) {
  throw new Error(`${origin}/chatgpt-plugin/login: ${ACCESS_HINT}\n${login.text.slice(0, 300)}`);
}
if (![302, 303, 503].includes(login.status)) {
  throw new Error(
    `${origin}/chatgpt-plugin/login: expected 302 or 503 from the Worker, got ${login.status}`,
  );
}
console.log(`ok /chatgpt-plugin/login ${login.status}`);

const api = await fetchPage(`${origin}/chatgpt-plugin/api/projects`);
if (accessWrapped(api)) {
  throw new Error(`${origin}/chatgpt-plugin/api/projects: ${ACCESS_HINT}\n${api.text.slice(0, 300)}`);
}
if (api.status !== 200) {
  throw new Error(`${origin}/chatgpt-plugin/api/projects: expected 200 visitor list, got ${api.status}\n${api.text.slice(0, 300)}`);
}
console.log("ok /chatgpt-plugin/api/projects 200");
