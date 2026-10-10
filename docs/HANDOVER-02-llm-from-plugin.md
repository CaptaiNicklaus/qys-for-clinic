# 交接 ②：**外部插件怎么调 LLM？**（只问一件事）

> **给有 `cordis_inspect_query` 的 DSH 会话。**
> 上一个 agent 能写代码但**查不到运行期接口**，卡在这一条上。

## 一、只要一个答案

> ### **一个外部 DSH 插件（`link:` 装进 profile 的那种），要怎么调用 LLM？**

具体要三样：
1. ⭐ **`export const inject = [...]` 里写什么**（我查到 `'llm'` 是真实服务名，但需确认）
2. ⭐ **调用方法的确切签名**（`.chat()`？`.complete()`？`.stream()`？参数是什么？）
3. ⭐⭐ **怎么让它走「App 自己的账号/计费」那个 provider**（profile 里配的是 `provider: deepseek-account`，见 `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `agent-default-model`）
   —— ⚠️ 这一点是**产品的命门**：客户 App 里的 LLM 调用**必须走 App 自己的账号**，绝不能硬编码服务方 key（那是"能收钱"的核心）。

## 二、我已经查到的（别重查）

| 查到的 | 出处 |
|---|---|
| ⭐ **`inject = ['llm']` 是真实服务名** | `packages/experimental/session-title-all-prompts-llm/src/index.ts:24`、`packages/llm/llm-deepseek-account/src/index.ts:13` 等多处 |
| ⭐ **`ctx.llm.registerAdapter(...)` 是"注册适配器"**，不是"调用" | `packages/experimental/*/tests/*.spec.ts` 多处 |
| ⭐ **App 的默认 provider 名是 `deepseek-account`** | `~/.dsh/profiles/desktop/cordis.patch.yml` 的 `agent-default-model` 配置 |
| ⭐ **`packages/llm/llm-deepseek-account`** 就是这个 provider 的实现 | 目录名 |
| ⚠️ **没查到**：真正的调用方法名（只搜到一个 `stream(`，但不确定是不是它） | — |

## 三、⚠️ 三条铁律（这个项目的插件必须守，已用四次报错换来）

1. ⛔ **不 import `@deepseek-ai/*`**（那些包只在 `app.asar` 里，profile 的 node_modules 没有 ⇒ MODULE_NOT_FOUND）
2. ⭐ **`ctx.tools.register({...})` 硬要求 `output { schema, render }`**，且 **`parameters` 必须是自己包好的完整 JSON Schema**（`type:'object'` + properties + required）
3. ⭐ **四处名字必须对齐**：目录名 = `package.json.name` = `cordis.patch.yml` 的 `name` = `client.js` 里 `__ModuleLoader__.load({id})` 的 `id`
   —— ✅ **已固化成脚本**：`plugins/check-tool-schema.mjs`（17 项，改完先跑它）

✅ **相对 import 可行**（活样板：`dsh-plugin-whale-pet/lib/typert.host.js` 里有 `from './remote.js'`）
⇒ 所以可以直接 `import { check } from './compliance.js'`。

## 四、拿到答案后要做什么（不用你做，回报即可）

我会把这条链接上：
```
用户输入主题
  → ① zhongyi_retrieve（已通）：检索 824 部典籍 → 带出处的条文
  → ② ⬅ 卡在这里：把条文交给 LLM → 生成科普文案（每条论断标 [n]）
  → ③ compliance.js（已建并验，8/8）：过合规闸 → 命中即拦/改写，返回规则名
  → ④ 返回「文案 + 合规报告」
```

## 五、旁证：我已经在本机把这些**单独验过**了（所以只差"在插件里串起来"）

| 件 | 状态 |
|---|---|
| 检索（824 部典籍 + 两级出处） | ✅ **真机跑通**（captain 亲手点过） |
| LLM 生成科普文案 | ✅ `prototype/produce.py` 跑通，实跑「秋燥」出 12 条引用、结构合规、主动指出分歧、主动守边界 |
| 合规闸引擎 `compliance.js` | ✅ 8 个正反例全过（含抖音案例 6 那个句式） |

⚠️ **一个已验证的坑**：`max_tokens` 太小会**空回答**（deepseek-flash 开思考后思维链与正文抢预算；实测 900 空、3000 出）。
