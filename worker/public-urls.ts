import { mountHref } from "../src/public-mount";
import type {
  PlayableBuild,
  PlaytestLink,
  PlaytestRun,
  SharedSession,
} from "../src/creator/project-contract";
import { publicSeats, type StoredSessionSeat } from "./seat-capability";
import { publicShareUrl, signShareToken, type ShareCapability } from "./share-capability";

export type StoredPlayableBuild = Omit<PlayableBuild, "playableUrl">;
export type StoredPlaytest = Omit<PlaytestRun, "replayUrl">;
export type StoredSharedSession = Omit<SharedSession, "sessionUrl" | "replayUrl" | "seats"> & {
  seats: StoredSessionSeat[];
};
export type StoredPlaytestLink = Omit<PlaytestLink, "url">;

type BuildLike = { id: string };
type PlaytestLike = { replayId: string };
type SessionLike = {
  id: string;
  buildId: string;
  replayId: string;
  seats?: Array<{ seat: number; displayName?: string }>;
};
type PlaytestLinkLike = {
  projectId: string;
  sessionId: string;
  buildId: string;
  replayId: string;
};
type JobLike = {
  id: string;
  projectId: string;
  kind: string;
  result?: Record<string, unknown>;
};

export async function signedShareToken(
  secret: string,
  creatorId: string,
  capability: Omit<ShareCapability, "v" | "c">,
) {
  return signShareToken({ v: 1, c: creatorId, ...capability }, secret);
}

export async function publicBuild<T extends BuildLike>(
  build: T,
  origin: string,
  creatorId?: string,
  secret?: string,
  mount = "/",
): Promise<T & { playableUrl: string }> {
  if ("presentationFloor" in build || "playabilityFloor" in build) {
    if (!("presentationFloor" in build && build.presentationFloor) ||
      !("playabilityFloor" in build && build.playabilityFloor)
    ) {
      throw new Error("unsupported_build_shape");
    }
  }
  const token = creatorId && secret
    ? await signedShareToken(secret, creatorId, { build: build.id })
    : null;
  return {
    ...build,
    playableUrl: token
      ? publicShareUrl(`/play/${build.id}`, origin, token, mount)
      : new URL(mountHref(`/play/${build.id}`, mount), origin).toString(),
  };
}

export async function publicPlaytest<T extends PlaytestLike>(
  playtest: T,
  origin: string,
  creatorId?: string,
  secret?: string,
  mount = "/",
): Promise<T & { replayUrl: string }> {
  const token = creatorId && secret
    ? await signedShareToken(secret, creatorId, { replay: playtest.replayId })
    : null;
  return {
    ...playtest,
    replayUrl: token
      ? publicShareUrl(`/replay/${playtest.replayId}`, origin, token, mount)
      : new URL(mountHref(`/replay/${playtest.replayId}`, mount), origin).toString(),
  };
}

export async function publicSession<T extends SessionLike>(
  session: T,
  origin: string,
  creatorId: string,
  secret: string,
  mount = "/",
): Promise<Omit<T, "seats"> & { seats: ReturnType<typeof publicSeats>; sessionUrl: string; replayUrl: string }> {
  const token = await signedShareToken(secret, creatorId, {
    room: session.id,
    build: session.buildId,
    replay: session.replayId,
  });
  return {
    ...session,
    seats: publicSeats((session.seats ?? []) as StoredSessionSeat[]),
    sessionUrl: publicShareUrl(`/room/${session.id}`, origin, token, mount),
    replayUrl: publicShareUrl(`/replay/${session.replayId}`, origin, token, mount),
  };
}

export async function publicPlaytestLink<T extends PlaytestLinkLike>(
  link: T,
  origin: string,
  creatorId: string,
  secret: string,
  mount = "/",
): Promise<T & { url: string }> {
  const token = await signedShareToken(secret, creatorId, {
    project: link.projectId,
    room: link.sessionId,
    build: link.buildId,
    replay: link.replayId,
  });
  return {
    ...link,
    url: publicShareUrl(`/try/${link.projectId}`, origin, token, mount),
  };
}

export function publicMutation<
  T extends { studioPath: string },
>(value: T, origin: string, mount = "/"): Omit<T, "studioPath"> & { studioUrl: string } {
  const { studioPath, ...rest } = value;
  return {
    ...rest,
    studioUrl: new URL(mountHref(studioPath, mount), origin).toString(),
  };
}

export async function publicJob<T extends JobLike>(
  job: T,
  origin: string,
  creatorId?: string,
  secret?: string,
  mount = "/",
): Promise<T> {
  if (!job.result) return job;
  if (job.kind === "compile-build" && job.result.build && typeof job.result.build === "object") {
    const build = await publicBuild(
      job.result.build as BuildLike,
      origin,
      creatorId,
      secret,
      mount,
    );
    return {
      ...job,
      result: publicMutation({
        ...job.result,
        build,
        warnings: "warnings" in build && Array.isArray(build.warnings)
          ? build.warnings
          : job.result.warnings,
        studioPath: typeof job.result.studioPath === "string"
          ? job.result.studioPath
          : `/studio/${job.projectId}`,
      }, origin, mount),
    };
  }
  if (job.kind === "generate-rule-system" || job.kind === "iterate-rule-system") {
    return {
      ...job,
      result: publicMutation({
        ...job.result,
        studioPath: typeof job.result.studioPath === "string" ? job.result.studioPath : "/",
      }, origin, mount),
    };
  }
  if (job.kind === "bot-playtest" && typeof job.result.replayId === "string") {
    return {
      ...job,
      result: await publicPlaytest(job.result as PlaytestLike, origin, creatorId, secret, mount),
    };
  }
  if (job.kind === "export-build") {
    return {
      ...job,
      result: {
        ...job.result,
        artifactUrl: new URL(`/api/jobs/${job.id}/artifact`, origin).toString(),
      },
    };
  }
  return job;
}
