# 交接：给 DSH 会话 —— 把「中医典籍科普」插件的 Client 半边接上线

> **给读这份文件的 DSH 会话**：你和写这份文件的那个 agent 不是同一个会话。
> 它**能写代码但拿不到 `cordis_inspect_query` / `plugin_manager`**，
> 所以**需要 inspection 的那部分（Client↔Host 桥、locale service、slot props）交给有工具的你来做**。

## 一、任务一句话

**把一个已写好的本地插件的「生成」按钮接上线** —— 让面板能真调 Host 工具、把检索结果显示出来。

## 二、插件在哪

```
/Users/nicklaus/Desktop/600-work_programme/qys-for-clinic/plugins/dsh-plugin-zhongyi-kepu/
├── package.json          # name=dsh-plugin-zhongyi-kepu · dsh.bundle.patch + dsh.client(platform=web, immediately, inject=[@deepseek-ai/dsh-client-ui-conversation])
├── cordis.patch.yml      # insert 一行 id=zhongyi-kepu name=dsh-plugin-zhongyi-kepu
├── index.js              # ⭐ Host 半边：已注册工具 zhongyi_retrieve（**已验内核，别改它的检索逻辑**）
├── client.js             # ⚠️ Client 半边：**面板已渲染，但「生成」按钮 disabled，要接的就是这里**
├── icon.svg
├── locale/zh.json · locale/en.json   # ⚠️ 有 locale 但 **client.js 里硬编码了中文**，要改成走 locale service
└── README.md
```

## 三、已经做完的（不要重做）

1. ⭐ **Host 半边已注册工具**（写法照抄上游 `packages/experimental/tool-ralph/src/index.ts`）：
   `export const name = 'zhongyi-kepu'` · `export const inject = ['tools']` · `apply(ctx)` 里 `ctx.tools.register(defineTool({...}))`
   工具名 **`zhongyi_retrieve`**，参数 `{topic: string(required), k: number}`，
   返回：主题 → 调 **Python 子进程**跑取数层 → **带出处的条文**。
2. ⭐ **检索内核已实测**：「秋燥」「失眠」「脾胃调理」「人参」四组主题共 48 条，**出处缺失率 0%**
   （出处两级取：`core_statement.source_note` 优先，空则反查 `core_work.name_zh` —— ⚠️ 因为 `source_note` 实测为空率 64.4%）。
   ⚠️ **这段逻辑在 `index.js` 的 `retrieve()` 里，已经验过，除非有明确理由，别改。**
3. ✅ **面板已渲染出来**（slot `conversation.composer.dock`，id `zhongyi-kepu`，order 6），
   收起态是一个按钮「📜 典籍科普」，展开是一条输入框 ＋ 六步工作流列表 ＋ 禁用状态的「生成」。

## 四、要你做的（**都要先用 inspection 确认接口，别猜**）

按 `references/user-actions.md` 的「**One operation, two callers**」：

1. ⚠️ **`client.js` 里硬编码的中文 ⇒ 改走 Client locale service**
   （规范原文：*Route visible UI text through the Client locale service*；`locale/zh.json` `locale/en.json` 已备好）
   → 用 `cordis_inspect_query` 查 **locale 服务的确切方法名**再改。
2. ⭐ **把「生成」按钮接上线**：
   → 用 `cordis_inspect_query` 查 **Client-callable 的 Host 入口**（规范举的例子是 session command 经 `ctx.remote.commands.execute()`）
   → 查到后，按钮点击 ⇒ 调它 ⇒ 把返回的条文渲染进面板
   → ⚠️ **失败要把原因显示出来**（规范：*shows the returned failure*）
3. ⚠️ **`apply(ctx)` 里若加了 styles / timers / listeners，必须用 `ctx.effect` / `ctx.on` 注册并返回 cleanup**
4. ✅ **验证**（规范 `references/verification.md`）：**点一次按钮，确认真出结果、真报错**

## 五、⚠️ 四条硬约束（来自 `references/ui-plugin.md` / `practices.md`）

1. ⛔ **不 import 任何 `@deepseek-ai/dsh-client-ui-*` 包**（React 由浏览器模块表提供）
2. ⛔ **不硬编码颜色** —— 容器与控件**继承宿主 theme**（现版本只用 `inherit`/`currentColor`，可保持）
3. ⛔ **不替换 app root、不往 `document.body` 追加第二个应用**
4. ⛔ **不改 `index.js` 的检索逻辑**（那是唯一已实测过的部分）

## 六、规范原文在哪（就在本机）

```
upstream/packages/preset/agent-preset/skills/cordis-plugin-development/
├── SKILL.md                    # 主流程
└── references/
    ├── host-plugin.md          # Host 导出形态（apply/inject/Config）
    ├── ui-plugin.md            # ⭐ Client 半边规则
    ├── user-actions.md         # ⭐⭐ One operation, two callers（本任务的核心）
    ├── practices.md            # 6 条原则
    └── verification.md         # 无浏览器控制时怎么验
```
（`upstream/` = DSH 上游浅克隆，194 MB，**不进 git**）

## 七、做完请回报

1. **改了哪几个文件**（贴关键 diff）
2. **`cordis_inspect_query` 查到的接口是什么**（locale 方法名 / Client-callable 入口）—— ⭐ **这份信息对写文件的那个人很值钱**
3. **验证结果**：点按钮有没有真出条文、报错路径通不通
