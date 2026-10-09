# dsh-plugin-zhongyi-kepu

中医典籍科普内容生产（岐与笙 toB）。**v0.4：Client 半边已接线** —— 面板能真调 Host 操作、把条文渲染出来。

六步：提交主题 → **检索典籍（已接线）** → 追问补足 → 工作流生产 → 合规闸 → 素材包导出

## 接线结构（`references/user-actions.md`「One operation, two callers」）

```
                     ┌──────────────────────────────┐
   智能体工具 ───────▶│  retrieveText()  ← 唯一实现  │◀─────── 会话命令 /kepu
   zhongyi_retrieve   │  (index.js，出处两级取)      │        （Host 注册）
                     └──────────────────────────────┘
                                    ▲
                                    │ ctx.remote.commands.execute(sessionId, '/kepu <主题>', [])
                     ┌──────────────┴───────────────┐
                     │  「生成」按钮（client.js）    │
                     └──────────────────────────────┘
```

- **操作的实现只有一份**（`index.js` 的 `retrieveText()`）：工具与命令共用，失败原因也由它一处给出。
- ⚠️ `retrieve()` 的检索逻辑一行未动（出处两级取：`core_statement.source_note` 优先，
  空则反查 `core_work.name_zh` —— 实测 `source_note` 空率 64.4%）。
- Client 半边**不碰 ctx**：调用经注册项 `inject` 面（在 `apply` 闭包里造）传给组件。

## 遵守的 DSH 插件规范

- `references/practices.md` 原则 6：插件 UI 是 Harness UI 的一部分 ⇒ **只用宿主 theme tokens**、不硬编码颜色
  （本版仍只用 `inherit` / `currentColor`）
- `references/ui-plugin.md`：**可见文案全部走 Client locale service**
  （`ctx.locale.register(NS, {zh, en})` + 注册项 `locale: NS` ⇒ 框架注入 `t` 席）
- ⛔ 不 import 任何 `@deepseek-ai/dsh-client-ui-*` 包（React 由浏览器模块表提供）
- ⛔ 不替换 app root、不往 `document.body` 追加第二个应用
- 工厂无副作用；字典注册在 `ctx.effect` 上（卸载即撤销）
- 失败**带原因**显示：操作失败 / 网关错码 / 命令未被接纳

## locale 资源的归属

| 文件 | 谁读 | 内容 |
|---|---|---|
| `locale/zh.json` · `locale/en.json` | Plugin Manager（不激活插件也读） | 只有 `meta.title` / `meta.description` |
| `client.js` 里的 `ZH` / `EN` | 运行时的 `t` 席 | 面板所有可见文案 |

⚠️ 运行时字典**内联在 client.js**，这是 DSH 的既有惯例（对照已装的 `dsh-plugin-whale-pet`
与官方模板 `templates/decoration/`，两者的 `locale/*.json` 也都只有 `meta`）。

## 会话命令

| 命令 | 输入 | 结果 |
|---|---|---|
| `/kepu <主题>` | 主题原文（`input.hint` 已声明） | `{kind:'success', text}` = 带出处的条文集；失败 `{kind:'error', text}` 带原因 |

## 接口出处（对着 v0.2.0-rc.2 实机核对）

| 面 | 签名 | 出处 |
|---|---|---|
| Host 命令注册 | `ctx.commands.register({name, description, input, handler})` → disposer | `@deepseek-ai/dsh-commands` README / `src/index.ts:285` |
| 命令 handler | `({commandId, agent, rawInput, attachments, signal}) => {kind:'success'\|'error', text?}` | `dsh-commands/src/index.ts` `CommandInvocation` |
| Client 调 Host | `ctx.remote.commands.execute(sessionId, line, attachments)` → `{ok:true,value:{commandId,result}}` \| `{ok:false,error}` | `dsh-commands/lib/typert.remote-client.js`；用例 `client/ui-plan/src/client/index.ts:122` |
| Client 字典 | `ctx.locale.register(ns, {zh, en})` / `ctx.locale.bind(ns)` | `dsh-client-locale/lib/client.js:1387,1414` |
| 注册项 `locale:` | 声明后组件 props 得 `t` 席（语言切换即时生效） | `dsh-client-ui-slots/src/index.ts:831` / `ui-renderer/src/client/scoped-slots.tsx:318` |
| 挂载点 | `conversation.composer.dock`（kind `list`，scope `session`，options `id`/`order`/`label`） | `dsh-client-ui-conversation/lib/client.js:18329`；props 由会话标准席提供（`sessionId` 等） |

## License

MIT（本包为自研；DSH 本体亦为 MIT）
