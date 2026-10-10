#!/usr/bin/env node
/**
 * A-3：把我们的业务插件【内置】进 QYS（随 App 一起编译打包，终端用户看不到安装界面）。
 * 熏儿 🤍 · 2026-10-10
 *
 * ⚠️ 为什么要有这个脚本：`upstream/` 不进 git ⇒ 别人 clone 后是干净上游 ⇒ 这些改动会丢。
 *    跑一次这个脚本就能复原。
 *
 * 它做三件事（都可重复跑，幂等）：
 *   ① 把 `plugins/dsh-plugin-zhongyi-kepu` 复制进 `upstream/packages/zhongyi-kepu`
 *   ② 在 `upstream/packages/bundle/web-app/package.json` 的 dependencies 里加 workspace 依赖
 *   ③ 在 `upstream/packages/bundle/web-app/presets/standard.patch.yml` 的
 *      `preset-standard.config.presets` 列表末尾加一行 `- id: zhongyi-kepu`
 *      （⚠️ 桌面 profile 默认用的就是 standard 这个 preset）
 *
 * 用法： node build/embed-plugin.mjs [--check]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SRC = join(ROOT, 'plugins/dsh-plugin-zhongyi-kepu')
const DEST = join(ROOT, 'upstream/packages/zhongyi-kepu')
const WEB_PKG = join(ROOT, 'upstream/packages/bundle/web-app/package.json')
const PRESET = join(ROOT, 'upstream/packages/bundle/web-app/presets/standard.patch.yml')

const ID = 'zhongyi-kepu'
const PKG = 'dsh-plugin-zhongyi-kepu'
const ROW = `          - id: ${ID}\n            name: '${PKG}'\n`

if (process.argv.includes('--check')) {
  const ok = existsSync(DEST) && readFileSync(WEB_PKG, 'utf8').includes(PKG) && readFileSync(PRESET, 'utf8').includes(ID)
  console.log(ok ? '✅ 插件已内置' : '⚠️ 还没内置')
  process.exit(ok ? 0 : 1)
}

if (!existsSync(SRC)) { console.error('⚠️ 找不到插件源: ' + SRC); process.exit(2) }
for (const f of [WEB_PKG, PRESET]) if (!existsSync(f)) { console.error('⚠️ 找不到上游文件: ' + f); process.exit(2) }

// ① 复制插件进 upstream
rmSync(DEST, { recursive: true, force: true })
mkdirSync(DEST, { recursive: true })
cpSync(SRC, DEST, { recursive: true, filter: (s) => !s.includes('node_modules') && !s.includes('prototype') })
console.log('  ✅ ① 插件已复制 → upstream/packages/zhongyi-kepu')

// ② 加 workspace 依赖
{
  copyFileSync(WEB_PKG, WEB_PKG + '.bak_embed')
  const d = JSON.parse(readFileSync(WEB_PKG, 'utf8'))
  d.dependencies = d.dependencies || {}
  if (d.dependencies[PKG]) console.log('  ✅ ② 依赖已在（跳过）')
  else { d.dependencies[PKG] = 'workspace:*'; writeFileSync(WEB_PKG, JSON.stringify(d, null, 2) + '\n'); console.log('  ✅ ② 已加 workspace 依赖') }
}

// ③ 在 standard preset 的 presets 列表末尾加一行
{
  copyFileSync(PRESET, PRESET + '.bak_embed')
  let s = readFileSync(PRESET, 'utf8')
  if (s.includes(`- id: ${ID}\n`)) console.log('  ✅ ③ preset 行已在（跳过）')
  else { if (!s.endsWith('\n')) s += '\n'; writeFileSync(PRESET, s + ROW); console.log('  ✅ ③ 已加 preset 行') }
}

console.log('\n⭐ 内置完成。重打 App：')
console.log('   cd upstream && pnpm install && pnpm run build && DSH_RESOURCE_DOWNLOAD_TIMEOUT_MS=3600000 pnpm run package:desktop:mac:arm64:unsigned')
