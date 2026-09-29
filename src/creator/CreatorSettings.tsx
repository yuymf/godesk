import { useState } from "react";
import { Brand } from "./CreatorBrand";
import { readRoomLocale, type RoomLocale } from "./room-presentation";
import { href } from "./studio-utils";

export function CreatorSettings() {
  const [locale, setLocale] = useState<RoomLocale>(readRoomLocale);

  function saveLocale(next: RoomLocale) {
    window.localStorage.setItem("godesk-room-locale", next);
    setLocale(next);
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
        <div className="shell-heading"><div><span>偏好设置</span><h1>设置</h1></div></div>
        <section className="shell-state">
          <h2>Shared Session 语言</h2>
          <p>选择后立即保存，重新打开游戏时继续使用。</p>
          <fieldset className="settings-choice">
            <legend>会话语言</legend>
            <label><input checked={locale === "zh"} name="room-locale" onChange={() => saveLocale("zh")} type="radio" /> 中文</label>
            <label><input checked={locale === "en"} name="room-locale" onChange={() => saveLocale("en")} type="radio" /> English</label>
          </fieldset>
        </section>
      </div>
    </main>
  );
}
