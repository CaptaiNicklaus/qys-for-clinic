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
