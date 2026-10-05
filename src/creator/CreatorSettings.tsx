import { useState } from "react";
import { Brand } from "./CreatorBrand";
import { readRoomLocale, type RoomLocale } from "./room-presentation";
import { href } from "./studio-utils";
import {
  readQualityPreference,
  readSaverPreference,
  writeQualityPreference,
  writeSaverPreference,
  type QualityPreference,
  type SaverPreference,
} from "../render3d/tiers";

export function CreatorSettings() {
  const [locale, setLocale] = useState<RoomLocale>(readRoomLocale);
  const [quality, setQuality] = useState<QualityPreference>(() => readQualityPreference());
  const [saver, setSaver] = useState<SaverPreference>(() => readSaverPreference());

  function saveLocale(next: RoomLocale) {
    window.localStorage.setItem("godesk-room-locale", next);
    setLocale(next);
  }

  function saveQuality(next: QualityPreference) {
    writeQualityPreference(next);
    setQuality(next);
  }

  function saveSaver(next: SaverPreference) {
    writeSaverPreference(next);
    setSaver(next);
  }

  return (
    <main className="shell-page" id="main">
      <header className="shell-header">
        <Brand />
        <nav aria-label="主导航">
          <a href={href("/")}>创建游戏</a>
          <a href={href("/games")}>我的游戏</a>
          <a aria-current="page" href={href("/settings")}>设置</a>
        </nav>
      </header>
      <div className="shell-content shell-settings">
        <div className="shell-heading"><div><h1>设置</h1></div></div>
        <section className="shell-state">
          <h2>Shared Session 语言</h2>
          <p>选择后立即保存，重新打开游戏时继续使用。</p>
          <fieldset className="settings-choice">
            <legend>会话语言</legend>
            <label><input checked={locale === "zh"} name="room-locale" onChange={() => saveLocale("zh")} type="radio" /> 中文</label>
            <label><input checked={locale === "en"} name="room-locale" onChange={() => saveLocale("en")} type="radio" /> English</label>
          </fieldset>
        </section>
        <section className="shell-state" data-testid="render-quality-settings">
          <h2>画质与省电</h2>
          <p>
            画质影响清晰度与阴影；省电在移动设备上默认开启（30 fps、轻阴影）。更改后进入对局 Room 生效。
            也可用 URL <code>?tier=low|medium|high</code> 强制档位（验收 / 模拟）。
          </p>
          <fieldset className="settings-choice">
            <legend>画质</legend>
            <label>
              <input
                checked={quality === "auto"}
                name="render-quality"
                onChange={() => saveQuality("auto")}
                type="radio"
              />{" "}
              自动（按设备判定）
            </label>
            <label>
              <input
                checked={quality === "high"}
                name="render-quality"
                onChange={() => saveQuality("high")}
                type="radio"
              />{" "}
              清晰 1.5×
            </label>
            <label>
              <input
                checked={quality === "medium"}
                name="render-quality"
                onChange={() => saveQuality("medium")}
                type="radio"
              />{" "}
              标准 1×
            </label>
          </fieldset>
          <fieldset className="settings-choice">
            <legend>省电</legend>
            <label>
              <input
                checked={saver === "auto"}
                name="render-saver"
                onChange={() => saveSaver("auto")}
                type="radio"
              />{" "}
              自动（移动开、桌面关）
            </label>
            <label>
              <input
                checked={saver === "on"}
                name="render-saver"
                onChange={() => saveSaver("on")}
                type="radio"
              />{" "}
              开
            </label>
            <label>
              <input
                checked={saver === "off"}
                name="render-saver"
                onChange={() => saveSaver("off")}
                type="radio"
              />{" "}
              关
            </label>
          </fieldset>
        </section>
      </div>
    </main>
  );
}
