const encoder = new TextEncoder();

export type ShareResourceKind = "room" | "build" | "replay" | "try";

export interface ShareCapability {
  v: 1;
  c: string;
  room?: string;
  build?: string;
  replay?: string;
  project?: string;
}

export function shareSecret(env: Env) {
  const configured = (env as Env & { GODESK_SHARE_SECRET?: string })
    .GODESK_SHARE_SECRET?.trim();
  return configured || "godesk-local-share-secret";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signShareToken(
  capability: ShareCapability,
  secret: string,
) {
  const body = bytesToBase64Url(encoder.encode(JSON.stringify(capability)));
  const signature = bytesToBase64Url(new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body)),
  ));
  return `${body}.${signature}`;
}

export async function verifyShareToken(
  token: string,
  secret: string,
): Promise<ShareCapability | null> {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    base64UrlToBytes(signature),
    encoder.encode(body),
  );
  if (!valid) return null;
  try {
    const capability = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(body)),
    ) as ShareCapability;
    if (capability.v !== 1 || typeof capability.c !== "string" || !capability.c) {
      return null;
    }
    return capability;
  } catch {
    return null;
  }
}

export function publicShareUrl(
  pathname: string,
  origin: string,
  token: string,
) {
  const url = new URL(pathname, origin);
  url.searchParams.set("share", token);
  return url.toString();
}

export function shareTokenFromUrl(url: URL) {
  const token = url.searchParams.get("share")?.trim();
  return token && token.length <= 2_000 ? token : null;
}

export function capabilityMatches(
  capability: ShareCapability,
  kind: ShareResourceKind,
  resourceId: string,
) {
  if (kind === "room") return capability.room === resourceId;
  if (kind === "build") return capability.build === resourceId;
  if (kind === "replay") return capability.replay === resourceId;
  return capability.project === resourceId;
}

export function resourceKindFromPath(pathname: string): {
  kind: ShareResourceKind;
  resourceId: string;
} | null {
  const room = pathname.match(/^\/(?:room|api\/sessions)\/([^/]+)(?:\/.*)?$/);
  if (room) return { kind: "room", resourceId: room[1] };
  const build = pathname.match(/^\/(?:play|api\/builds)\/([^/]+)$/);
  if (build) return { kind: "build", resourceId: build[1] };
  const replay = pathname.match(/^\/(?:replay|api\/replays)\/([^/]+)$/);
  if (replay) return { kind: "replay", resourceId: replay[1] };
  const project = pathname.match(/^\/try\/([^/]+)$/);
  if (project) return { kind: "try", resourceId: project[1] };
  return null;
}
