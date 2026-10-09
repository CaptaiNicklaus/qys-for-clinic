# 接线报告 ＋ 安装记录

> **本文件由 DSH 桌面 GUI 会话（preset-standard，无 `cordis_*` / `plugin_manager` 工具）写出。**
> `HANDOVER-TO-DSH.md` 要的三件事都在这里：**改了哪些文件**（§7）、**查到的确切接口**（§2）、
> **验证结果**（§3 离线全通、§5.3 真机待点）。
>
> **状态（2026-10-10 00:35）**：代码 ✅ 接线完毕 · ✅ 已装进 desktop profile（§5.1）
> · ⚠️ **待 captain 两步**：① 让 App 重组 profile（§5.2）② 真机点一次按钮（§5.3）

---

## 1. 任务状态

| 事项 | 状态 |
|---|---|
| ① 硬编码中文 ⇒ 走 Client locale service | ✅ 完成 |
| ②「生成」按钮接线（Client ⇒ Host ⇒ 渲染条文） | ✅ 完成 |
| ③ `apply` 里的资源用 effect 注册 | ✅ 完成（`ctx.effect`） |
| ④ 验证：**点一次按钮，确认真出结果、真报错** | 🟡 **离线全通**（§3）；**真机点击待 captain 点一下**（§5.3） |
| ⑤ 装进 desktop profile | ✅ **已装**（§5.1，官方 `dsh plugin` CLI）；⚠️ **运行中的 app 还没重组 ⇒ 需重启/切换才生效**（§5.2） |

改动文件（工作区已改，**未提交**）：

```
plugins/dsh-plugin-zhongyi-kepu/index.js        +87 -?
plugins/dsh-plugin-zhongyi-kepu/client.js      +186
plugins/dsh-plugin-zhongyi-kepu/package.json
plugins/dsh-plugin-zhongyi-kepu/locale/{zh,en}.json
plugins/dsh-plugin-zhongyi-kepu/README.md
```

---

## 2. ⭐ 查到的接口（HANDOVER §七.2 要的那份）

> ⚠️ **诚实说明**：本会话**没有 `cordis_inspect_query`**（原因见 §4），所以下面不是 inspection 输出，
> 而是**对着实机安装的包源码核出来的**——`/Applications/DeepSeek Harness.app/.../app.asar` 里
> 的 **v0.2.0-rc.2** 实体（`dsh-client-locale/lib/client.js`、`dsh-commands/lib/typert.remote-client.js`、
> `dsh-client-ui-conversation/lib/client.js`），并与上游生成的 inspection 目录
> （`packages/extensions/cordis-client-runner/src/client/{slot-catalog,api-catalog}.ts`）交叉核对一致。
> **下次请用 `cordis_inspect_query` 再确认一遍**（`Service` / `Event` / `Slots` / `Theme`）。

### 2.1 Client locale service（`ctx.locale`）

```js
ctx.locale.register(ns, { zh: {...}, en: {...} })   // → disposer；重复注册同 ns+locale 会抛
ctx.locale.bind(ns)                                 // → t(key, params?)；同 ns 身份稳定
ctx.locale.addLanguage({ id, label, fallback })     // 语言包用
ctx.locale.resolveText(text)                        // 解析 LocalizedText（插件标题/描述）
```

- 出处：`dsh-client-locale/lib/client.js:1387`（register）、`:1414`（bind）、`:1423`（translate）；
  `README.md`「Registering a dictionary」。
- **注册项声明 `locale: <ns>` ⇒ 框架把 `t` 席注入该组件 props**（`PropsLocale<N>` = `{ t: TranslateNS<N> }`）：
  `dsh-client-ui-slots/src/index.ts:93-98`、`:831`；
  renderer 侧按 (face, ns, revision) 缓存：`ui-renderer/src/client/scoped-slots.tsx:300-318`。
- ⚠️ 字典键查找链：本 ns → `common` ns → 直接显示 key。`{name}` 占位符会插值。

### 2.2 ⭐ Client 可调用的 Host 入口（正确的那一个）

```js
const r = await ctx.remote.commands.execute(sessionId, '/kepu 秋燥', [])
// r = { ok: true, value: { commandId, result: { kind:'success'|'error', text? } } | undefined }
//   | { ok: false, error: RemoteError { code, message, details } }
// r.value === undefined ⇒ 语法不合法 / 命令名不认识（**未被接纳**）
```

- 出处：`dsh-commands/lib/typert.remote-client.js` 的 descriptor
  `@deepseek-ai/dsh-commands#commands/execute`（`service:'commands'`、`namespace:'commands'`、
  `method:'execute'`、参数 `agent`(wire `agentId`) / `line` / `submittedAttachments`、`cancellation.parameter:'signal'`）。
- **照抄的现成用例**：`packages/client/ui-plan/src/client/index.ts:122`
  → `const result = await ctx.remote.commands.execute(sessionId, '/plan off', [])`，
  失败写成 `` `${result.error.message} (${result.error.code})` ``。
- `RemoteResult` 形状：`packages/typert/protocol/src/types.ts:76`；`RemoteError`：`.../remote-error.ts`。
- 注入名：UI 侧两者都要写 —— `inject: ['slots','locale','remote','remote.commands']`
  （`remote.commands` 是网关挂载的命名空间服务，key = `remote.<namespace>`，见
  `api/gateway/src/client/index.ts:752`）。

### 2.3 Host 命令注册（`ctx.commands`）

```js
ctx.commands.register({
  name: 'kepu',                       // 小写，执行时写 /kepu
  description: '…',                   // 发现界面用
  input: { hint: '<主题>（例：秋燥）' },
  handler: ({ commandId, agent, rawInput, attachments, signal }) =>
    ({ kind: 'success', text }) | ({ kind: 'error', text }),
})                                    // → disposer（内部已是 context effect）
```

- 出处：`dsh-commands/README.md`「Registering a command」；类型 `CommandDefinition`
  （`src/index.ts:61`）、`CommandInvocation`、`CommandResult`（`src/types.ts:31-39`）；
  注册实现 `src/index.ts:285`。
- ⚠️ `inject = ['tools','commands']` 会把**整个插件**卡成 pending（没命令面的 profile 里连工具都不注册）。
  ⇒ 本项目改为 **`inject = ['tools']` + `ctx.inject(['commands'], child => …)`**（可选服务，见 `practices.md`）。

### 2.4 挂载点 `conversation.composer.dock`

- kind `list`、scope `session`；注册项 options：`id`（必填）、`order`、`label`（可选，thunk 可跟随语言）。
- 组件 props = 五份分享：运行时会话标准席（`sessionId`、`useSession`、`useChat`…）+ 注册项 `inject` 面 +
  `locale` 席 `t`。**owner props 为空**（父级 `renderSlot('conversation.composer.dock', {})`）。
- 出处：`dsh-client-ui-conversation/lib/client.js:18329`；目录
  `cordis-client-runner/src/client/slot-catalog.ts:537-591`（该 slot 的完整 `standardProps` 列表）。
- ⚠️ 组件**看不到 ctx**；所有调用经注册项 `inject: (sessionId) => ({ … })` 的返回值进 props。

---

## 3. 离线验证结果（**真跑过**，可复现）

### 3.1 Host 半边 —— 真调取数层（Python 子进程）

用桩替换 `@deepseek-ai/dsh-tools`，加载 `index.js`，捕获工具定义与命令定义后真调用：

```
name       = zhongyi-kepu
inject     = ["tools"]
tool       = 1 zhongyi_retrieve
commands   = kepu | input.hint = <主题>（例：秋燥 / 失眠 / 脾胃调理）

工具 execute({topic:'秋燥',k:3}) → 主题「秋燥」—— 库里找到 3 条条文：…（带出处）
命令 handler({rawInput:' 秋燥 '}) → kind: success，同格式文本（默认 12 条）
命令 handler({rawInput:'   '})    → kind: error  「请给一个主题。」
QYS_PROJECT 指向坏路径（取数层挂）：
  工具      → 「检索失败：调取数层失败: spawnSync python3 ENOENT」
  命令      → kind: error，「检索失败：调取数层失败: spawnSync python3 ENOENT」  ⭐ 原因带出来了
```

### 3.2 Client 半边 —— 用迷你 React 驱动组件、**真点按钮**

（无浏览器，按 `references/verification.md` 的允许范围做行为验证）

```
inject       = ["slots","locale","remote","remote.commands"]
slot         = conversation.composer.dock | id = zhongyi-kepu | order = 6 | locale = zhongyi-kepu
dict keys    = 20 | zh/en 键集合完全一致: true

[1] 收起态            = 📜 典籍科普
[2] 展开后按钮        = 生成 / 收起
[3] 「生成」disabled    = false            ← v0.1 骨架是 true
[4] 六步状态          = 已接线,已接线,未接线,未接线,未接线,未接线
[5] 点「生成」实际调用 = ["session-1","/kepu 秋燥",[]]
[6] 成功结果          = HOST-TEXT 已渲染 ✓
[8] Host 报错         = 「⚠️ 检索失败：取数层退出码 1: boom」✓
[10] 命令未被接纳     = 未知命令：/kepu ✓
[11] 网关失败         = carrier stopped (gateway/carrier) ✓
[12] 空主题           = 请先输入一个主题。✓（没打网关）
[13] 切 en            = Generate / Collapse / Six-step workflow / Topic / wired / Retrieve / not wired … ✓
```

⇒ **四条失败路径 + 成功路径 + 中英切换全通**。**没验的**：真机 slot 渲染、真机点击、
light/dark 主题下的观感（无浏览器控制，`verification.md` 明确不许拿 mock 截图充当验证）。

复现脚本（临时目录，未入库）：`/tmp/kepu-verify/host-test.mjs`、`/tmp/kepu-verify/client-test.mjs`
（`node --import ./register.mjs host-test.mjs`）。

---

## 4. ⛔ 为什么本会话拿不到 inspection / plugin_manager（安装已改走 CLI，见 §5.1）

1. **原 HANDOVER 说「面板已渲染出来」不成立**：我刚接手时 `~/.dsh/profiles/desktop/cordis.yml` 里
   没有 `zhongyi-kepu` 行，`package.json` 的 `dsh.profile.bundles` 只有 `…dsh-base / dsh-web-app / dsh-plugin-whale-pet`。
   ⇒ 那句指的应是先前那个 `dsh-plugin-zhongyi-hello`（已卸），**不是本插件**。**现已装好（§5.1）。**
2. **本会话没有 `plugin_manager` / `cordis_inspect_query`**，查清了原因（`cordis.yml`）：

   | 预设 | `tool-cordis` | `tool-plugin-manager` |
   |---|---|---|
   | `preset-standard`（profile 默认） | ❌ 没有这一行 | `disabled: true` |
   | `preset-ptc` | ❌ | 启用 |
   | `preset-minimal` | ❌ | ❌ |
   | **`preset-cordis`** | ✅ 启用（`cordis.yml:1231`） | ✅ 启用（`:1244`，`disabled: !!js '!ctx.get(''profileContext'')'`） |

   ⇒ 缺工具**不是配置坏了**，是**预设不对**。
3. **已有会话不能换预设**：`ui-agent-preset` README 明写
   *"Existing sessions keep their selected mode; New Session uses the current default."*，
   Creator 入口也是 `uiWorkspace.startSession`（或复用一个 **blank** Session）。
   ⇒ 必须**开一个 Creator 任务**，在本会话里换不过去。

---

## 5. ⭐ 安装与真机验证

> **2026-10-10 00:35 更新：安装已完成**，由 `preset-standard` 的会话用**官方 `dsh plugin` CLI** 做的
> （本会话仍无 `plugin_manager`，详见 §4）。**剩下两步要 captain 动手**：激活 ＋ 点一次按钮。

### 5.1 已做：装进 desktop profile

```console
$ dsh plugin --profile desktop add \
    /Users/nicklaus/Desktop/600-work_programme/qys-for-clinic/plugins/dsh-plugin-zhongyi-kepu
dependencies:
+ dsh-plugin-zhongyi-kepu link:/Users/nicklaus/Desktop/600-work_programme/qys-for-clinic/plugins/dsh-plugin-zhongyi-kepu
Done in 232ms using pnpm v11.7.0
```

⚠️ **为什么这不是「绕过官方路径」**：`dsh plugin` 走的是 `@deepseek-ai/dsh-plugin-manager/operations`
的 `runProfilePnpm` —— **和 `plugin_manager` 工具同一套实现**（连 bundle selection 都一起做了，
不用手改 profile 的 `package.json`）。我核过 CLI 源码 `dsh/lib/plugin-BGnVfe_D.js` 才用的它。

装完的效果（三处都核过）：

| 位置 | 结果 |
|---|---|
| `~/.dsh/profiles/desktop/package.json` → `dependencies` | `"dsh-plugin-zhongyi-kepu": "link:/Users/…/plugins/dsh-plugin-zhongyi-kepu"` |
| 同上 → `dsh.profile.bundles` | 已追加 `"dsh-plugin-zhongyi-kepu"`（**pnpm 步骤自己加的**，不是手写的） |
| `~/.dsh/profiles/desktop/node_modules/dsh-plugin-zhongyi-kepu` | 软链 → 仓库里的插件目录（**改代码即时可见**，无需重装） |

**组合预检**（怕重启把 App 弄挂，先用一次性的 `DSH_HOME` 跑了一遍真组合）：

```console
$ DSH_HOME=/tmp/kepu-verify/home dsh plugin --profile preflight add <同一个绝对目录>
dsh: initialized profile preflight at /tmp/kepu-verify/home/profiles/preflight
$ DSH_HOME=/tmp/kepu-verify/home dsh --profile preflight --dump-config | grep -A1 zhongyi
# == dsh-plugin-zhongyi-kepu
- id: zhongyi-kepu
  name: dsh-plugin-zhongyi-kepu
```

⇒ bundle patch **能干净地插入一行**，没有 id 冲突、没有配置错误。
（`dsh --profile desktop --dump-config` 被拒：*profile "desktop" is managed exclusively by the Electron application* —— 所以才用临时 profile 验。）

### 5.2 ⚠️ 还差一步：让运行中的 App 重组 profile

`desktop` profile **没有任何文件监听**（`dsh-desktop-host` / `plugin-manager` 里查不到 `fs.watch`），
且 `~/.dsh/profiles/desktop/cordis.yml` 的 mtime 仍是 **22:29**（我 00:30 装的）⇒
**插件的行还没进内存里的 Loader 树**，界面自然也还没有按钮。

任选一条（captain 操作，我做不到：重启 App 会杀掉我自己的会话）：

1. **设置 → 插件**：找到 `dsh-plugin-zhongyi-kepu`，**关一次再开**（这条走 Loader 的热更新，不用重启）；
2. 或**完全退出 DeepSeek Harness 再打开**（最稳）。

### 5.3 最后：真机点一次按钮（HANDOVER §四.4 的唯一硬要求）

- ✅ **成功路径**：输入框下方点「📜 典籍科普」→ 输入「秋燥」→ 点「生成」
  ⇒ 面板出现「检索结果（库中原句，引用请保留 [编号] 与出处）」+ 带出处的条文。
- ⚠️ **失败路径**（要证「真报错」）：把取数层指到坏路径再点一次
  ⇒ 面板应显示「⚠️ 检索失败：…」**带原因**。两种做法：
  - 让插件进程读到坏路径：`QYS_PROJECT=/tmp/definitely-missing`（需在**启动 App 的环境变量**里设，改了要重启）；
  - 或临时把 `~/.dsh/profiles/desktop/node_modules` 里那份 `qys_data` 挪走 —— 不推荐，动真库。
- 再切一次语言（设置 → 通用 → 语言）确认文案跟着变（`t` 席是活的）。

⚠️ 若激活后**收起态的按钮没出现**：先看 devtools console 有没有
`slot entry crashed in 'conversation.composer.dock'`（本插件只用继承色，不该是样式问题）。

### 5.4 回退（一条命令）

```console
$ dsh plugin --profile desktop remove dsh-plugin-zhongyi-kepu
```

（或手删 `~/.dsh/profiles/desktop/package.json` 里 `bundles` 的 `dsh-plugin-zhongyi-kepu`
那一行 + `dependencies` 里的 link；再重启 App。）

---

## 6. 顺手修掉的两个显示清单问题（不只是接线）

| 问题 | 处置 | 依据 |
|---|---|---|
| `locale/*.json` 里只有运行时文案，**没有 `meta.title` / `meta.description`** ⇒ Plugin Manager 只能回落到 `package.json` 的 name 与描述 | 改成 `{"meta":{"title":…,"description":…}}`，运行时文案**内联进 `client.js`** | `host-plugin.md`「Display metadata and icon」；对照已装的 `dsh-plugin-whale-pet/locale/*.json`（也只有 `meta`）与官方模板 `templates/decoration/` |
| `exports` 里写的是 `./icon.svg`，**不是规范认的 `./icon`** ⇒ 面板显示不到自家图标 | 改为 `"./icon": "./icon.svg"` | `host-plugin.md`：*Export `./locale/*.json` and `./icon`* |

---

## 7. 改了哪几个文件（关键 diff 摘要）

- **`index.js`**：新增 `retrieveText()` = 本插件的**唯一操作**（工具与命令共用，失败也由它一处给原因）；
  新增 `applyCommand(ctx)`（`ctx.inject(['commands'], …)` 里注册 `/kepu`）；
  `apply()` = `applyCommand(ctx)` + 原来那份 `ctx.tools.register(defineTool({…}))`，
  其 `execute` 改为 `return { text: retrieveText(...).text }`。
  ⚠️ **`retrieve()` 一行未动**（HANDOVER 硬约束 ④）。
- **`client.js`**：`inject` 加 `locale` / `remote` / `remote.commands`；
  `ctx.effect(() => ctx.locale.register(NS, {zh, en}))` 注册 20 键字典；
  注册项加 `locale: NS` 与 `inject: (sessionId) => ({ retrieve })`；
  组件 `Panel` 改为从 props 取 `t` 与 `retrieve`，六步状态区分「已接线/未接线」，
  新增结果区（`whiteSpace:'pre-wrap'` + `maxHeight` 滚动），失败走 ⚠️ 行；**无新增硬编码颜色**。
- **`package.json`**：`version 0.1.0 → 0.4.0`；`./icon`；`dsh.client.inject` 补
  `@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-api-remotes`（信息性依赖边，对照 whale-pet）。
- **`locale/{zh,en}.json`**、**`README.md`**：见 §6 与插件 README。
- **未提交**：本仓库工作区留着改动（`git status` 6 个 M），由 captain 决定何时提交。
