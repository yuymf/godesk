import { describe, expect, it } from "vitest";
import {
  INSTALL_PATH,
  PUBLIC_HOME_PATH,
  isPublicMount,
  logicalPathname,
  mountHref,
  workerMountPath,
} from "./public-mount";

describe("public plugin mount", () => {
  it("keeps the install page at the plugin path", () => {
    expect(logicalPathname(INSTALL_PATH)).toBe(INSTALL_PATH);
    expect(logicalPathname(`${INSTALL_PATH}/`)).toBe(INSTALL_PATH);
  });

  it("treats /chatgpt-plugin/new as the hobbyist composer", () => {
    expect(logicalPathname(PUBLIC_HOME_PATH)).toBe("/");
    expect(mountHref("/", INSTALL_PATH)).toBe(PUBLIC_HOME_PATH);
    expect(mountHref("/", PUBLIC_HOME_PATH)).toBe(PUBLIC_HOME_PATH);
  });

  it("rewrites rooms, try links, and APIs through the open prefix", () => {
    expect(logicalPathname(`${INSTALL_PATH}/room/room_1`)).toBe("/room/room_1");
    expect(mountHref("/room/room_1?share=tok", PUBLIC_HOME_PATH)).toBe(
      `${INSTALL_PATH}/room/room_1?share=tok`,
    );
    expect(workerMountPath(`${INSTALL_PATH}/api/projects`)).toBe("/api/projects");
    expect(workerMountPath(`${INSTALL_PATH}/try/project_1`)).toBe("/try/project_1");
    expect(workerMountPath(`${INSTALL_PATH}/login`)).toBe("/login");
  });

  it("leaves the unprefixed local studio alone", () => {
    expect(isPublicMount("/")).toBe(false);
    expect(mountHref("/room/room_1", "/")).toBe("/room/room_1");
    expect(workerMountPath("/api/projects")).toBe("/api/projects");
  });
});
