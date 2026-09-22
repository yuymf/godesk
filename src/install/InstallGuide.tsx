import { useState } from "react";

const installPrompt =
  "阅读 https://godesk.yumengfan220.workers.dev/chatgpt-plugin，帮我安装 GoDesk；完成登录后，自动新建一个 Codex 任务，根据我的剧本或规则生成一款别人能立刻打开、立刻玩、还能联机的游戏。";

const defaultMacCli = "/Applications/ChatGPT.app/Contents/Resources/codex";
const resolvedCli = "<resolved Codex Desktop bundled CLI>";

export function InstallGuide() {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(installPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <main className="install-guide">
      <header className="install-nav">
        <a href="/chatgpt-plugin/new" className="install-brand" aria-label="GoDesk 首页">
          <span>GD</span>
          <strong>GoDesk</strong>
        </a>
        <span>Codex Plugin · 0.2.0+codex.20260830</span>
      </header>

      <section className="install-hero">
        <p className="install-kicker">从一个剧本或规则，到可玩可分享的游戏</p>
        <h1>让 Codex 直接使用 GoDesk。</h1>
        <p className="install-lead">
          对标 ChatCut：安装 Plugin，上传源材料，得到可直接使用的成品。GoDesk
          把剧本或规则变成别人能立刻打开、立刻玩、还能联机的游戏。Codex
          负责自然语言控制；GoDesk 负责项目、编译、确定性对局和邀请链接。朋友只打开 URL，不装 Codex。
        </p>

        <div className="install-prompt" aria-label="一句话安装提示">
          <p>{installPrompt}</p>
          <button type="button" onClick={copyPrompt}>
            {copied ? "已复制" : "复制这一句话"}
          </button>
        </div>

        <p className="install-note">
          需要 Codex Desktop。Web 对话不能改动本机插件安装，因此不得把 Web
          环境里的阅读成功称为安装成功。
        </p>
        <p>
          <a href="/chatgpt-plugin/new">不用 Codex，直接做一局</a>
        </p>
      </section>

      <section className="install-contract">
        <div className="contract-heading">
          <p className="install-kicker">怎么开始</p>
          <h2>装进 Codex，上传剧本或规则，得到别人能一起玩的游戏。</h2>
        </div>

        <div className="install-prose">
          <p>
            只在 Codex Desktop 里继续。先找到桌面应用自带的 CLI，macOS 第一个候选是
            {" "}<code>{defaultMacCli}</code>
            ；没有的话，从当前应用包里定位 Resources/codex。对这个绝对路径执行
            {" "}<code>plugin --help</code>
            ，不要用 PATH 里可能过旧的全局命令。
          </p>
          <p>加上 Marketplace 和 Plugin：</p>
          <pre>
            <code>{`${resolvedCli} plugin marketplace add yuymf/godesk-plugin --ref main\n${resolvedCli} plugin add godesk@godesk --json`}</code>
          </pre>
          <p>
            若 Marketplace 已经在，先 upgrade 再重试。不要手改 Codex 配置来冒充装好。
          </p>
          <p>登录 GoDesk：</p>
          <pre>
            <code>{`${resolvedCli} mcp login godesk`}</code>
          </pre>
          <p>
            在打开的 Cloudflare Access 页面用邮箱验证码授权。只有登录成功，并且当前任务真的能调用
            {" "}<code>list_projects</code>
            、能打开内置浏览器，才算可用。
          </p>
          <p>
            然后新建一个 Codex 任务，让它根据你的剧本或规则生成一款别人能立刻打开、立刻玩、还能联机的游戏。尽早打开网站创作台，发出邀请链接。朋友只打开 URL，不装 Codex。
          </p>
        </div>
      </section>

      <section className="install-recovery">
        <p className="install-kicker">出问题时</p>
        <h2>失败就停在准确的位置。</h2>
        <p>
          报告失败发生在哪一步、实际命令或工具、原始错误和下一步。登录没配好、远程仓库还没发布、连不上
          GoDesk，或没法新建任务时，都要明确说“还没装好”。若连续重试仍失败，新建一个恢复任务，写上失败位置和原始错误；不要降级成一份让人自己猜的教程。
        </p>
      </section>
    </main>
  );
}
