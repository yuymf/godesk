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
        <a href="/" className="install-brand" aria-label="GoDesk 首页">
          <span>GD</span>
          <strong>GoDesk</strong>
        </a>
        <span>Codex Plugin · 0.2.0</span>
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
      </section>

      <section className="install-contract">
        <div className="contract-heading">
          <p className="install-kicker">给 Codex 的执行契约</p>
          <h2>安装不是一串命令成功，而是五项状态全部成立。</h2>
        </div>

        <ol className="install-steps">
          <li>
            <span>01</span>
            <div>
              <h3>确认当前宿主</h3>
              <p>
                只在 Codex Desktop 继续。定位桌面应用自带的 CLI，并以
                <code>{defaultMacCli}</code> 作为 macOS 首个候选；若不存在，
                从当前 Codex Desktop 应用包定位 Resources/codex。必须对最终绝对路径
                执行 <code>plugin --help</code>，不要使用 PATH 中可能过旧的全局 CLI。
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>安装 Marketplace 与 Plugin</h3>
              <pre>
                <code>{`${resolvedCli} plugin marketplace add yuymf/godesk-plugin --ref main\n${resolvedCli} plugin add godesk@godesk --json`}</code>
              </pre>
              <p>
                若 Marketplace 已存在，先执行 upgrade，再重试 Plugin 安装；不得手改
                Codex 配置冒充安装完成。
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>完成 GoDesk OAuth</h3>
              <pre>
                <code>{`${resolvedCli} mcp login godesk`}</code>
              </pre>
              <p>
                在打开的 Cloudflare Access 登录页用邮箱验证码完成授权。只有 Access
                JWT 能通过发行方、受众、期限和 creator 校验，才算登录完成。
              </p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>验证真实能力</h3>
              <p>
                检查 GoDesk Plugin 已启用、MCP 可发现，并实际调用
                <code>list_projects</code>。还要确认当前任务能打开内置浏览器；只看到
                Plugin 名称或命令退出码不算完成。
              </p>
            </div>
          </li>
          <li>
            <span>05</span>
            <div>
              <h3>自动进入新任务</h3>
              <p>
                使用 Codex 的任务管理能力新建并打开一个任务，发送：
                “使用 GoDesk，根据我的剧本或规则生成一款可玩的规则游戏，尽早打开 Web Studio，
                编译一个不可变 Build，创建可分享的会话，并把邀请链接发给别人联机游玩。”
                必须取得新任务 ID、打开该任务，并在新任务内实际调用
                <code>list_projects</code>；不能只在当前任务里复述这段提示。
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className="install-recovery">
        <p className="install-kicker">恢复规则</p>
        <h2>失败就停在准确的位置。</h2>
        <p>
          报告失败的阶段、实际命令或工具、原始错误和下一步。OAuth
          未配置、远程仓库尚未发布、MCP 不可达或无法新建任务时，都必须明确标记为
          “未安装完成”。若连续重试仍失败，使用任务管理能力新建并打开一个恢复任务，
          写入失败阶段与原始错误；不得降级成一份让用户自己猜的教程。
        </p>
      </section>
    </main>
  );
}
