import { useState } from "react";

const mcpUrl =
  "https://godesk.yumengfan220.workers.dev/chatgpt-plugin/mcp";

const installPrompt =
  "在 ChatGPT 打开 Developer Mode → Apps/Connectors，粘贴 GoDesk MCP URL https://godesk.yumengfan220.workers.dev/chatgpt-plugin/mcp，完成 Access 登录后，在新对话启用 GoDesk；用我的最小想法跑到 create_shared_session，向我出示含 share= 的 sessionUrl（或 Playtest Link）。";

const defaultMacCli = "/Applications/ChatGPT.app/Contents/Resources/codex";
const resolvedCli = "<resolved Codex Desktop bundled CLI>";

export function InstallGuide() {
  const [copied, setCopied] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);

  async function copyPrompt() {
    await navigator.clipboard.writeText(installPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copyMcp() {
    await navigator.clipboard.writeText(mcpUrl);
    setCopiedMcp(true);
    window.setTimeout(() => setCopiedMcp(false), 1800);
  }

  return (
    <main className="install-guide">
      <header className="install-nav">
        <a href="/chatgpt-plugin/new" className="install-brand" aria-label="GoDesk 首页">
          <span>GD</span>
          <strong>GoDesk</strong>
        </a>
        <span>ChatGPT Connector · MCP · 0.2.0+codex.20260830</span>
      </header>

      <section className="install-hero">
        <p className="install-kicker">从一个剧本或规则，到可玩可分享的游戏</p>
        <h1>用 ChatGPT Connector 装上 GoDesk。</h1>
        <p className="install-lead">
          对标 ChatCut：装上连接器，上传源材料，得到可直接使用的成品。GoDesk
          把剧本或规则变成别人能立刻打开、立刻玩、还能联机的游戏。ChatGPT（或
          Codex）负责自然语言控制；GoDesk
          负责项目、编译、确定性对局和邀请链接。朋友只打开 URL，不装插件。
        </p>

        <div className="install-prompt" aria-label="一句话安装提示">
          <p>{installPrompt}</p>
          <button type="button" onClick={copyPrompt}>
            {copied ? "已复制" : "复制这一句话"}
          </button>
        </div>

        <p className="install-note">
          只读完本 installer 网页 ≠ 安装成功。Build URL / Studio URL ≠
          邀请链，不算交付。成功必须能调工具，并拿到含{" "}
          <code>share=</code> 的邀请 URL。
        </p>
        <p>
          <a href="/chatgpt-plugin/new">不用 Connector，直接做一局</a>
        </p>
      </section>

      <section className="install-contract">
        <div className="contract-heading">
          <p className="install-kicker">主路径 · 云 / ChatGPT</p>
          <h2>Developer Mode → Connectors → 粘贴 MCP → Access 登录。</h2>
        </div>

        <div className="install-prose">
          <p>
            在<strong>付费 ChatGPT</strong>里打开{" "}
            <strong>Developer Mode</strong>，进入{" "}
            <strong>Apps / Connectors</strong>
            ，创建或添加自定义连接器，粘贴下面的 MCP URL：
          </p>
          <pre>
            <code>{mcpUrl}</code>
          </pre>
          <p>
            <button type="button" className="install-inline-copy" onClick={copyMcp}>
              {copiedMcp ? "MCP URL 已复制" : "复制 MCP URL"}
            </button>
          </p>
          <p>
            完成 Cloudflare Access 登录（邮箱验证码）。回到 ChatGPT，在
            <strong>新对话</strong>里启用 GoDesk。
          </p>
          <p>
            <strong>成功判据</strong>（缺一不可）：
          </p>
          <ul className="install-criteria">
            <li>
              能调用 <code>list_projects</code>
            </li>
            <li>
              对最小想法跑到 <code>create_shared_session</code>
              ，并向用户出示返回的 <code>sessionUrl</code>（URL 须含{" "}
              <code>share=</code>）
            </li>
            <li>
              可选再 <code>publish_shared_session</code>，出示稳定 Playtest Link（
              <code>/chatgpt-plugin/try/…?share=</code>）
            </li>
          </ul>
          <p>
            禁止只交 <code>playableUrl</code> / Studio URL
            就宣称安装或交付成功。朋友只打开邀请 URL，不装 ChatGPT Connector。
          </p>
        </div>
      </section>

      <section className="install-contract install-secondary">
        <div className="contract-heading">
          <p className="install-kicker">旁路 · Codex Desktop</p>
          <h2>Mac / ChatGPT.app 内 Codex 的备选装法。</h2>
        </div>

        <div className="install-prose">
          <p>
            云电脑或仅有 ChatGPT Web 时，请走上面的 Connector
            主路径。本段仅适用于本机已有 Codex Desktop（常捆绑在 ChatGPT.app
            内）的情况。
          </p>
          <p>
            先找到桌面应用自带的 CLI，macOS 第一个候选是{" "}
            <code>{defaultMacCli}</code>
            ；没有的话，从当前应用包里定位 Resources/codex。对这个绝对路径执行{" "}
            <code>plugin --help</code>
            ，不要用 PATH 里可能过旧的全局命令。
          </p>
          <p>加上 Marketplace 和 Plugin：</p>
          <pre>
            <code>{`${resolvedCli} plugin marketplace add yuymf/godesk-plugin --ref main\n${resolvedCli} plugin add godesk@godesk --json`}</code>
          </pre>
          <p>
            若 Marketplace 已经在，先 upgrade 再重试。不要手改 Codex
            配置来冒充装好。
          </p>
          <p>登录 GoDesk：</p>
          <pre>
            <code>{`${resolvedCli} mcp login godesk`}</code>
          </pre>
          <p>
            在打开的 Cloudflare Access 页面用邮箱验证码授权。成功判据与主路径相同：能调{" "}
            <code>list_projects</code>，并最终出示含 <code>share=</code> 的{" "}
            <code>sessionUrl</code> 或 Playtest Link。
          </p>
        </div>
      </section>

      <section className="install-recovery">
        <p className="install-kicker">出问题时</p>
        <h2>失败就停在准确的位置。</h2>
        <p>
          报告失败发生在哪一步、实际命令或工具、原始错误和下一步。Connector
          没加好、Access 没登录、远程还连不上，或没法调用{" "}
          <code>list_projects</code>
          时，都要明确说“还没装好”。若连续重试仍失败，新建一个恢复任务，写上失败位置和原始错误；不要降级成一份让人自己猜的教程。
        </p>
      </section>
    </main>
  );
}
