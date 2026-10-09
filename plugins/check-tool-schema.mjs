#!/usr/bin/env node
/**
 * 静态校验插件里 ctx.tools.register({...}) 的定义是否满足 dsh-tools 的 register 要求。
 *
 * ⚠️ 为什么需要它：外部插件**不能 import `@deepseek-ai/dsh-tools`**（那些包只在 app.asar 里），
 *    所以用不了 `defineTool` —— 而 `defineTool` 原本会替你做三件事，现在都得自己保证：
 *      ① parameters 包成完整 JSON Schema（type:'object' + properties + required）
 *      ② output { schema, render }（register 硬要求）
 *      ③ execute 的返回值形态与 output.schema 匹配
 *    ✅ 这个脚本把 ①②（以及 register 的 timeoutMs 要求）在**提交前**静态验掉。
 *
 * 用法： node plugins/check-tool-schema.mjs plugins/dsh-plugin-zhongyi-kepu
 */
import { readFileSync } from 'node:fs'
import { join, basename } from 'node:path'

const dir = process.argv[2]
if (!dir) { console.error('用法: node plugins/check-tool-schema.mjs <插件目录>'); process.exit(2) }
const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
const src = readFileSync(join(dir, 'index.js'), 'utf8')

let ok = 0, bad = 0
const chk = (name, cond, detail = '') => {
  if (cond) { ok++; console.log('  ✓', name) }
  else { bad++; console.log('  ✗', name, detail ? '→ ' + detail : '') }
}

console.log('校验 ' + basename(dir) + '（包名 ' + pkg.name + '）')

// ⓪ 名字四处对齐
chk('目录名 == 包名', basename(dir) === pkg.name, basename(dir) + ' vs ' + pkg.name)
// ⚠️ patch 里的 name 可能带引号也可能不带（YAML 两种都合法）⇒ 用词边界匹配，别假报警
const patchTxt = readFileSync(join(dir, 'cordis.patch.yml'), 'utf8')
chk('patch 里有 name: 包名（引号可有可无）',
    new RegExp('name:\\s*[\'"]?' + pkg.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]?\\s*$', 'm').test(patchTxt),
    'patch 里没找到 name: ' + pkg.name)

// ① 不 import dsh 内部包（外部插件自足）
const imports = [...src.matchAll(/^import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1])
const dshImports = imports.filter(s => s.startsWith('@deepseek-ai/'))
chk('不 import @deepseek-ai/*（外部插件铁律）', dshImports.length === 0, dshImports.join(', '))
chk('client.js 无静态 import（只该用模块表）',
    [...readFileSync(join(dir, 'client.js'), 'utf8').matchAll(/^import /gm)].length === 0)

// ② 抠出 register 的对象并逐条对 register 要求
const i = src.indexOf('ctx.tools.register(')
if (i < 0) { console.log('  ✗ 找不到 ctx.tools.register('); process.exit(1) }
let depth = 0, start = -1, end = -1
for (let j = i; j < src.length; j++) {
  const c = src[j]
  if (c === '{') { if (depth === 0) start = j; depth++ }
  else if (c === '}') { depth--; if (depth === 0) { end = j; break } }
}
const obj = eval('(' + src.slice(start, end + 1) + ')')   // eslint-disable-line no-eval
chk('有 name', typeof obj.name === 'string' && obj.name.length > 0)
chk('有 description', typeof obj.description === 'string' && obj.description.length > 0)

// ⭐ parameters 必须是完整 JSON Schema（否则模型 API 报 type:"object" 缺失）
const p = obj.parameters
chk('parameters 是对象', p && typeof p === 'object')
chk('parameters.type === "object"', p && p.type === 'object',
    p && JSON.stringify(p.type) + ' —— 扁平写法会报 Invalid schema for function')
chk('parameters.properties 非空', p && p.properties && Object.keys(p.properties).length > 0)
const props = (p && p.properties) || {}
const req = (p && p.required) || []
chk('required 里每个键都在 properties 里', Array.isArray(req) && req.every(k => k in props),
    JSON.stringify(req.filter(k => !(k in props))))
chk('每个 property 都写了 type', Object.values(props).every(v => v && v.type),
    Object.entries(props).filter(([, v]) => !v || !v.type).map(([k]) => k).join(', '))

// ⭐ output 三件（register 硬要求）
const o = obj.output
chk('output 是对象', o && typeof o === 'object')
chk('output.render 是函数', o && typeof o.render === 'function')
chk('output.presentationMeta 省略或是函数',
    !o || o.presentationMeta === undefined || typeof o.presentationMeta === 'function')
chk('output.schema 存在', o && o.schema && typeof o.schema === 'object')

// ⭐ timeoutMs / execute
chk('timeoutMs 是正有限数', Number.isFinite(obj.timeoutMs) && obj.timeoutMs > 0, String(obj.timeoutMs))
chk('execute 是函数', typeof obj.execute === 'function')

console.log('\n  通过 ' + ok + '　失败 ' + bad)
process.exit(bad ? 1 : 0)
