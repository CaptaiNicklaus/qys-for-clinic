# 交接给咏儿：**问岐 App 的"LLM 网关"接口契约 v0.1**

> 熏儿 🤍 · 2026-10-10 · 依据 captain 第 264–266 轮令
> ⭐ **本契约的每个字段都是从你的库里查出来的，不是我编的**（依据附在每节末尾）。

---

## 〇、为什么需要这个（一句话）

> ⭐ captain 要的 App 是「**能登录我网站账号、扣我网站余额**的 DSH 克隆版」。
> ⇒ ⚠️ **所以 App 绝不能直连 DeepSeek 的账号**（那样钱进的是 DeepSeek 的口袋）。
> ⇒ ⭐ **App 必须调一个【你网站上的】网关端点**，由你转发、由你记账。

```
App ──①登录──▶ /api/auth/*          （你的账号）
    ──②调LLM─▶ ⭐ /api/app/llm/*     （本契约）  ← 你转发 DeepSeek + 按 token 扣余额
    ──③看余额─▶ /api/app/wallet      （本契约）
```

⚠️ **我的立场**：⭐ **我不想另造一套计费** ——
**你 `server/qa.py` 里已经有完整的 LLM 调用链（`llm.chat()` ＋ `billing` ＋ `ledger`）**，
⭐ **所以本契约的设计原则是「薄封装、复用你的」**：**新端点只做"鉴权 + 转发 + 记账"，不重写计价。**

---

## 一、⭐ 契约（三条）

### ① `POST /api/app/llm/chat` —— 生成

**请求头**：`Cookie: <会话令牌>`（⭐ 复用你现有的会话机制，不另造）
**请求体**：
```json
{
  "messages": [{ "role": "user", "content": "…" }],
  "system": "…（可选）",
  "model": "deepseek-flash（可选，缺省用服务端默认）",
  "maxTokens": 8000,
  "kind": "app-produce（可选，用于 ledger.kind 归类）"
}
```
**响应 200**：
```json
{
  "text": "…生成的正文…",
  "usage": { "t_miss": 0, "t_hit": 0, "t_out": 0, "peak": 0 },
  "charged_uw": 1234,          // ⭐ 本次实扣（微元）
  "balance_uw": 987654,        // ⭐ 扣后余额（微元）
  "ledger_id": "…"
}
```
**响应 402（余额不足）**：
```json
{ "error": "ACCOUNT_QUOTA", "balance_uw": 0, "need_uw": 1234 }
```
⇒ ⭐ **这个 402 语义与 DSH 的 `ACCOUNT_QUOTA` 对齐**（我在 DSH 的 `llm-deepseek-account` README 里核过）。

### ② `GET /api/app/wallet` —— 看余额
```json
{ "paid_uw": 0, "gift_uw": 0, "frozen_uw": 0, "total_uw": 0 }
```

### ③ ⭐ 登录：**不用新造** —— 直接复用你现有的
| 端点 | 用途 |
|---|---|
| `POST /api/auth/login` | ⭐ **邮箱验证码登录** |
| `GET /api/me` | ⭐ **当前用户身份** |

⇒ ⭐ **App 的登录流程就照这两条走**（App 里输入邮箱 → 收码 → login → 存会话令牌）。

---

## 二、⚠️ 我**没有**替你决定的三件（要你 review）

| # | 问题 | 我的建议 | 为什么留给你 |
|---|---|---|---|
| **1** | **鉴权头用什么** | ⭐ **复用现有会话 Cookie** | ⚠️ 你说过 `/api/me` 走的是会话；⭐ 但也可能你想给 App 单发"设备令牌"（我更倾向后者，更干净） |
| **2** | **`kind` 怎么归类** | ⭐ **`'app-produce'`**（与现有 `'qa'`/`'butler'` 并列） | ⚠️ `ledger.kind` 是**你**的口径，我不该定 |
| **3** | ⭐ **免费额度/熔断怎么算** | ⚠️ **复用你 `quota.py` 的 `check()`/`settle()`** | ⚠️ 你今晚刚建好它，**我不清楚 App 这条路要不要算进"每天免费 3 次"** |

⚠️ **第 3 条最重要**：⭐ **App 的调用要不要占用"每天免费 3 次"？**
- ⭐ **若"要"** ⇒ 复用 `quota.check()` 即可
- ⭐ **若"不要"**（App 是付费产品，另算）⇒ 我照你的口径改

---

## 三、⭐ 我这边不动 `server/` —— 把活压到最小

⭐ 我会**先读你的 `qa.py` / `llm.py` / `billing.py` / `quota.py`**，
⭐ **然后在本文件后面追加"可直接落地的补丁草案"**（标明插在哪个文件哪一段），
⭐ **你 review + 应用即可。**

⚠️ **在读到你的代码之前，我不写补丁草案** —— ⚠️ **免得写出跟你设计冲突的东西**（今晚我已经因为"没查就下结论"错过两次）。

---

## 四、依据（都是从你的库里/代码里查出来的）

| 字段 | 依据 |
|---|---|
| ⭐ **微元（µ¥）· 1 微元 = 1e-6 元 · 全整数** | `server/billing.py:16` 原文 |
| `wallet.paid_uw / gift_uw / frozen_uw` | `app.db` 的 `wallet` 表（2 行） |
| `ledger` 有 `kind / model / think / fallback` | `app.db` 的 `ledger` 表（6 行） |
| `charge` 有 `t_miss / t_hit / t_out / peak / cost_uw / charged_uw / markup_ppm` | `app.db` 的 `charge` 表（3 行） |
| `price` 有 `p_miss_ppm / p_hit_ppm / p_out_ppm / out_uw_per_mtok / markup_ppm / peak_x` | `app.db` 的 `price` 表（8 行） |
| `P_MISS_PPM = 1_000_000` | `server/billing.py:41` |
| ⭐ `/api/auth/login` · `/api/me` · `/api/admin/me` | `server/app.py` 里 grep 到的端点 |
| ⭐ **登录＝邮箱验证码**（`verify_code()` ＋ `create_session()`） | `server/auth.py:10` 等 |
| ⭐ **402 → `ACCOUNT_QUOTA`** 是 DSH 侧的既有语义 | DSH `llm-deepseek-account` README（我核过） |

---

## 五、⚠️ 诚实标注

1. ⚠️ **我还没读你的 `qa.py`/`llm.py`/`billing.py`** ⇒ **补丁草案待补**
2. ⚠️ **"App 要不要占用每天免费 3 次"这个口径我不替你定**
3. ⚠️ **契约里的字段名（`t_miss` 等）是我照你 `charge` 表的列名抄的** —— ⭐ **如果你内部用的是别的名字，以你的为准**

---

## 六、⭐ 咏儿回执（2026-10-10 第 262 轮 · 已实现，未部署）

> 💜 **咏儿** · 承接 captain 令「熏儿给你留言了，还安排了任务，你去看看是什么。然后执行一下」
> ⚠️ **下面只写你 §二 三问的答复 ＋ 与你契约的差异**；施工细节与尺子见
> `100-work_academic/@_中医知识图谱_项目/规划方案/CC_20261005021500_方案18_问岐问答系统_业务逻辑_v1.md` §App 网关族。

### 6.1 ⭐ 你三问的答复

| # | 你的问题 | 我的答复 |
|---|---|---|
| **1** | 鉴权头用什么 | ⚠️ **先更正一个事实**：你契约 §一 ① 写的是 `Cookie: <会话令牌>` —— **不对**。现有会话是 **`Authorization: Bearer <token>`**（`app.py:878` 的 `self._user()` **只认 Bearer**，整站没有 Cookie 会话）。⇒ **App 请发 Bearer**。⭐ **设备令牌留 v0.2**（我同意"更干净"，但那要动 `auth.py` 的会话表，不属这次薄封装的范围） |
| **2** | `kind` 怎么归类 | ⭐ **采纳你的 `'app-produce'`**。⚠️ 但**你只提了归类这一件事，实际连带有四处**（都在报表/判定链上，见 6.3） |
| **3** | ⭐ App 要不要占「每天免费 3 次」 | ⭐ **不占，也不给**（作为**默认**）。做成 policy 键 **`app_free_per_day`**，**默认 0**；captain 一句「App 也送 N 次」→ `db.set_policy(conn,'app_free_per_day',N)` **即刻生效、不改一行代码**。⚠️ 理由：网页那 3 次是**给读者的试用甜头**，App 是**付费产品**，绑一起不显然 ⇒ 按最保守默认走，**口径留给 captain 拍**（承你 §五.2 的诚实标注） |

### 6.2 ✅ 契约三条的落地（逐条）

| 你的契约 | 状态 | 落在哪 |
|---|---|---|
| ① `POST /api/app/llm/chat` | ✅ 已实现 | `server/appapi.py`（**新文件**）+ `app.py` 一条路由 |
| ② `GET /api/app/wallet` | ✅ 已实现 | 同上 |
| ③ 登录**复用** `/api/auth/login` ＋ `/api/me` | ✅ **一行没动**（承你的"不另造"） | — |

**尺子**：`server/_selftest/test_appgw.py`（**55 项全绿**）—— ⚠️ 它把 `llm.chat` 整个换成桩，
⇒ **跑一次真正烧掉的钱 = 0**；且它自己开沙盒库（**不碰真库**，因为要写 `policy` 行测免费额度）。
⚠️ 该文件在 `_selftest/` 下，而 `deploy.sh` 第 1 步 `--exclude '_selftest/'` ⇒ **不会上生产**。

### 6.3 ⚠️ 与你契约的**差异**（四处，请核）

| # | 差异 | 说明 |
|---|---|---|
| 1 | **请求体的 `model` 被忽略** | 服务端用 `config.LLM_MODEL`；**响应**里回 `model` 字段告知实际用了哪个。⚠️ 多模型是 captain 的档（`model` 档案表），**不在这条薄封装里开** |
| 2 | ⭐ **加了幂等**（你契约没提） | 请求体可选 `requestId` ⇒ `ledger_id` = `'app:'+requestId`；**重放 ⇒ 409 `duplicate_request`、不重复扣费**。⚠️ App 断网重试**必须**带它，否则会扣两次 |
| 3 | ⭐ **加了三个只读字段**（契约之外的加法，可忽略） | 响应 `free`（本次是否走的免费额度）；`/api/app/wallet` 多 `need_uw`（≈还要不要充值）、`app_free_left`（还剩几次免费） |
| 4 | **`ledger_id` 的形态** | 回的是 `msg_id` 字符串（`'app:<requestId>'` 或 `'app:<uuid24>'`），**不是** `ledger.id` 整数。⚠️ 拿它**幂等/对账**用是对的；**但要 JOIN `charge` 表必须先经 `ledger.msg_id → ledger.id`**（中间隔一层，别直接 `WHERE charge.ledger_id=<它>`） |

### 6.4 ⭐ 你没提、我补上的**四处连带动作**（否则"加了 kind"是半截的）

`ledger.kind` 不只是个字符串 —— 它同时决定三件事，而这三处**都必须显式加**：

1. `quota.settle()` 的判定分支（**不加 ⇒ 走到 `skip:'not_qa'` ⇒ 一分钱不扣、也不记成本**）
2. `db.FREE_KINDS`（**不加 ⇒ 报表里 `app-produce` 混进 `other`，看不出它花了多少**）
3. `db._FREE_NOTE`（**不加 ⇒ 免费那笔的单子写一句没有由头的「（免费）」**）
4. `selfcheck.py` 里那条钉 `db.FREE_KINDS` 的断言（**不改 ⇒ 自检变红**）

⭐ 这四处正是 `db.py:1850` 那句「**若要加第三族，加在这里**」**预留的位置** —— 你我不知道对方会先写，**结果是你我在同一天想到了同一个族名**，落点也是同一个。

### 6.5 ⚠️ 两件要告诉你的

1. ⚠️ **`xuner/gateway-preview.html` 不在目录里** —— 你的 `README.md` 列了它（「双击即开」），
   但 `ls xuner/` 只有 `README.md` + `GATEWAY-CONTRACT.md` 两个文件。**是不是没保存/没同步过来？**
2. ⛔ **本次未部署** —— 推站点归 **captain 持牌**（我只把代码与尺子备好）。

— 咏儿 💪

