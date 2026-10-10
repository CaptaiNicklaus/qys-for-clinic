#!/usr/bin/env node
/**
 * 换品牌：把 DSH 上游改成「QYS」。
 * 熏儿 🤍 · 2026-10-10 · captain 第 273 轮令：「用 QYS for mac 吧」
 *
 * ⚠️ 为什么要有这个脚本：`upstream/` 不进 git（194 MB），别人 clone 我们仓库后
 *    拿到的是一份干净的上游 ⇒ 这些改动会丢。**跑一次这个脚本就能复原。**
 *
 * 用法： node build/rebrand.mjs        （在仓库根跑）
 *
 * ⭐ 只改【用户可见的品牌】，⛔ 不动内部身份：
 *    · productName / artifactName / protocols.name / 麦克风用途说明  ⇒ 改成 QYS
 *    · ⛔ `dsh` URL scheme **保留** —— 内部 CLI 与 `~/.dsh` 都依赖它，改了会断
 *    · ⛔ `~/.dsh`、`DSH_*` 环境变量、`@deepseek-ai/*` 包名 一律不动
 *      （换了数据目录会让现有 profile 变孤儿）
 *    · ⭐ bundle id 走环境变量 `DSH_DESKTOP_APP_ID`（见下），**不改源码**
 *
 * ⚠️ 依 `BRAND_GUIDELINES.md`：产品名不得含 "DeepSeek Harness"（注册商标）；
 *    关于页须写 "built on DSH, MIT" 并保留 MIT 声明（⛔ 本脚本没动关于页，待办）。
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const TARGET = join(ROOT, 'upstream/apps/desktop/scripts/electron-builder-config.mjs')
/** ⚠️ 第二个必改处：unsigned 打包路径【写死】了 appId，env 改不动它 ⇒ 必须改源码。 */
const TARGET_ENV = join(ROOT, 'upstream/apps/desktop/scripts/desktop-package-environment.mjs')

/** bundle id —— 必须与已装的 DSH 不同，否则 macOS 报"冲突"（captain 第 273 轮亲验）。 */
export const APP_ID = 'com.qiyusheng.qys'
export const PRODUCT_NAME = 'QYS'
export const ARTIFACT_PREFIX = 'QYS-for-mac'

const EDITS_ENV = [
  // ⚠️ 不改这里，unsigned 打出来的 App 的 bundle id 会一直是 com.deepseek.harness
  ["DSH_DESKTOP_APP_ID: 'com.deepseek.harness',", "DSH_DESKTOP_APP_ID: 'com.qiyusheng.qys',"],
]

const EDITS = [
  ["protocols: [{ name: 'DeepSeek Harness', schemes: ['dsh'] }],",
   "protocols: [{ name: 'QYS', schemes: ['dsh'] }],   // ⭐ 换品牌；⚠️ scheme 保留 dsh"],
  ["productName: 'DeepSeek Harness',", "productName: 'QYS',"],
  // ⚠️ 这行的模板串里有转义，字符串字面量匹配不到 ⇒ 用前缀替换
  ['artifactName: `deepseek-harness-', 'artifactName: `QYS-for-mac-'],
  ["NSMicrophoneUsageDescription: 'DeepSeek Harness uses your microphone to transcribe speech into message drafts.'",
   "NSMicrophoneUsageDescription: 'QYS uses your microphone to transcribe speech into message drafts.'"],
]

if (process.argv.includes('--check')) {
  const done = existsSync(TARGET) && readFileSync(TARGET, 'utf8').includes("productName: 'QYS'")
    && existsSync(TARGET_ENV) && readFileSync(TARGET_ENV, 'utf8').includes("'com.qiyusheng.qys'")
  console.log(done ? '✅ 已换品牌（QYS）' : '⚠️ 还没换品牌')
  process.exit(done ? 0 : 1)
}
if (!existsSync(TARGET)) { console.error('⚠️ 找不到 ' + TARGET + '（upstream 还没拉？）'); process.exit(2) }
copyFileSync(TARGET, TARGET + '.bak_rebrand')
let s = readFileSync(TARGET, 'utf8'); const before = s.length
let n = 0
for (const [a, b] of EDITS) { if (s.includes(a)) { s = s.replace(a, b); n++ } else console.warn('  ⚠️ 没匹配:', a.slice(0, 50)) }
writeFileSync(TARGET, s)

// ⭐ 第二处：unsigned 路径写死的 appId
let n2 = 0
if (existsSync(TARGET_ENV)) {
  copyFileSync(TARGET_ENV, TARGET_ENV + '.bak_rebrand')
  let e = readFileSync(TARGET_ENV, 'utf8')
  for (const [a, b] of EDITS_ENV) { if (e.includes(a)) { e = e.replace(a, b); n2++ } else console.warn('  ⚠️ appId 没匹配') }
  writeFileSync(TARGET_ENV, e)
}
console.log(`✅ 换品牌完成：品牌 ${n}/${EDITS.length} 处 · appId ${n2}/${EDITS_ENV.length} 处（${before} → ${s.length} 字节）`)
console.log(`   ⭐ 打包时记得：DSH_DESKTOP_APP_ID=${APP_ID}`)
