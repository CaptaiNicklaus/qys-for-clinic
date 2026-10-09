/**
 * Host half —— 「中医典籍科普」的检索工具与会话命令（v0.4）
 *
 * ⭐ 写法照抄上游 `packages/experimental/tool-ralph/src/index.ts`。
 *
 * ⭐ v0.3 修了一个**实测验出来的真问题**：
 *    `core_statement.source_note`（细出处）**为空率 64.4%**，
 *    而 `work_id` **只有 1 条为空**（覆盖率 ~100%）。
 *    ⇒ 所以出处必须**两级取**：先 `source_note`，空则用 `work_id` 反查 `core_work.name_zh`。
 *    ⚠️ 不这样做，工具返回的条文有 2/3 **没有出处** ⇒ 而"可溯源"是我们的硬要求。
 *
 * ⭐ v0.4 按 `references/user-actions.md`「**One operation, two callers**」接线：
 *    同一个操作（`retrieveText()`）由**两个调用方**共用 ——
 *      ① 智能体工具 `zhongyi_retrieve`（模型用）
 *      ② 会话命令 `kepu`（面板的「生成」按钮走 `ctx.remote.commands.execute()`）
 *    ⇒ **操作的实现只有一份**，失败也由它一处给出原因，两边共享同一套结果文本。
 *    ⚠️ `retrieve()` 的检索逻辑一行未动（那是唯一实测过的部分）。
 */
import { spawnSync } from 'node:child_process'   // ⚠️ 只用 Node 内建模块；⛔ 绝不 import @deepseek-ai/*

export const name = 'zhongyi-kepu'
/**
 * ⚠️ 只硬依赖 `tools`：工具是已实测的核心，**没有命令面的 profile 也必须注册**。
 * `commands` 是可选服务，见下面 `ctx.inject(['commands'], …)`。
 */
export const inject = ['tools']

const PROJECT = process.env.QYS_PROJECT
  || '/Users/nicklaus/Desktop/100-work_academic/@_中医知识图谱_项目'

function retrieve(topic, k) {
  const py = `
import json, sys
sys.path.insert(0, ${JSON.stringify(PROJECT)})
from qys_data import retrieve as R

a = R.ask(sys.argv[1], k=int(sys.argv[2]))
cites = a.get('cites', [])
c = R._conn()

# ⭐ 出处两级取：source_note 优先；空则用 work_id 反查书名（覆盖率 ~100%）
ids = [x['statement_id'] for x in cites if x.get('statement_id')]
wmap, smap = {}, {}
if ids:
    ph = ','.join('?' * len(ids))
    for r in c.execute('SELECT id, work_id, source_note FROM core_statement WHERE id IN (%s)' % ph, ids):
        smap[r['id']] = r['source_note'] or ''
        if r['work_id']: wmap[r['id']] = r['work_id']
    wids = sorted(set(wmap.values()))
    if wids:
        ph2 = ','.join('?' * len(wids))
        names = {r['id']: r['name_zh'] for r in
                 c.execute('SELECT id, name_zh FROM core_work WHERE id IN (%s)' % ph2, wids)}
        wmap = {sid: names.get(wid, '') for sid, wid in wmap.items()}

out = []
for x in cites:
    sid = x.get('statement_id')
    note = smap.get(sid) or wmap.get(sid) or ''
    lvl = '细' if smap.get(sid) else ('书' if wmap.get(sid) else '无')
    out.append({'n': x['n'], 'text': x['content_zh'], 'source': note, 'level': lvl})

print(json.dumps({'q': a['q'], 'entities': [e['name'] for e in a.get('entities', [])],
                  'cites': out, 'anchors': a.get('anchors', [])}, ensure_ascii=False))
`
  const r = spawnSync('python3', ['-c', py, String(topic), String(k)], {
    cwd: PROJECT, timeout: 30000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8',
  })
  if (r.error) throw new Error('调取数层失败: ' + r.error.message)
  if (r.status !== 0) throw new Error('取数层退出码 ' + r.status + ': ' + String(r.stderr || '').slice(0, 400))
  return JSON.parse(r.stdout)
}

/**
 * ⭐ 本插件的**唯一操作**：按主题取条文，渲染成带出处的文本。
 *
 * 工具与会话命令**共用这一份**（规范：*Implement the operation once*）。
 *
 * @param {string} topic - 主题或问题。
 * @param {number} k - 条数上限。
 * @returns {{ ok: boolean, text: string }} `ok:false` 表示操作失败（文本即失败原因）；
 *   成功后 `ok:true`，文本是条文集（"库里没有"也是一种成功的结果）。
 */
function retrieveText(topic, k) {
  const q = String(topic || '').trim()
  if (!q) return { ok: false, text: '请给一个主题。' }
  let d
  try {
    d = retrieve(q, k)
  } catch (e) {
    return { ok: false, text: '检索失败：' + ((e && e.message) || String(e)) }
  }
  if (!d.cites || !d.cites.length) {
    return { ok: true, text: `库中未找到与「${q}」直接相关的条文。⚠️ 不要编造；换个说法或换主题再试。` }
  }
  const lines = [`主题「${d.q}」—— 库里找到 ${d.cites.length} 条条文`
    + (d.entities.length ? `，涉及 ${d.entities.join('、')}` : '') + '：', '']
  for (const c of d.cites) {
    const tag = c.level === '细' ? '' : (c.level === '书' ? '（仅到书名）' : '（⚠️ 无出处）')
    lines.push(`[${c.n}] ${c.text}　—— ${c.source || '未标'}${tag}`)
  }
  lines.push('', '⚠️ 以上为库中原句。引用时请保留 [编号] 与出处。')
  return { ok: true, text: lines.join('\n') }
}

/**
 * v0.4 新增：把同一个操作挂到**会话命令**上，供 Client 半边的「生成」按钮调用
 * （Client 侧经 `ctx.remote.commands.execute(sessionId, '/kepu <主题>', [])`）。
 *
 * @param ctx - Host 插件上下文。
 */
function applyCommand(ctx) {
  ctx.inject(['commands'], (child) => {
    child.commands.register({
      name: 'kepu',
      description: '从中医典籍库检索一个主题的条文（带出处），结果渲染进「典籍科普」面板',
      input: { hint: '<主题>（例：秋燥 / 失眠 / 脾胃调理）' },
      handler: ({ rawInput }) => {
        const r = retrieveText(rawInput, 12)
        // ⚠️ 失败必须带原因回给界面（规范：*shows the returned failure*）。
        return r.ok ? { kind: 'success', text: r.text } : { kind: 'error', text: r.text }
      },
    })
  })
}

export function apply(ctx) {
  applyCommand(ctx)
  ctx.tools.register({
    name: 'zhongyi_retrieve',
    description:
      '从中医典籍库检索与一个主题相关的原文条文，每条都带出处（细到篇名，或至少到书名）。' +
      '⚠️ 只返回库里真实存在的条文；库中没有就说没有，绝不编造。' +
      '这是科普内容生产的第一步：先看"库里有什么"，再决定讲什么。',
    // ⚠️⚠️ 必须是**完整 JSON Schema**（type:'object' + properties + required）。
    //    扁平写法（{topic:{...}, k:{...}}）只有 defineTool 会替你包 —— 我们不用它，就得自己包。
    //    ⚠️ 不包的话模型 API 会报：schema must be a JSON Schema of 'type:"object"', got 'type: null'
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: '主题或问题，例如「秋燥」「失眠」「脾胃调理」' },
        k: { type: 'number', description: '返回条数上限，默认 12' },
      },
      required: ['topic'],
      additionalProperties: false,
    },
    timeoutMs: 60000,
    // ⭐ register 硬要求 output { schema, render }
    //    形状照抄上游 packages/experimental/tool-session-query/src/index.ts:46 的 TEXT_OUTPUT
    //    ⚠️ execute 返回**字符串**，由 render 包成 text 块
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value == null ? '' : value) }],
    },
    execute: (args) => {
      const k = Math.min(Math.max(Number((args && args.k) || 12), 1), 30)
      // ⭐ 工具只负责把同一操作的结果包成工具结果文本（失败原因也照原样给模型看）。
      return retrieveText(String((args && args.topic) || ''), k).text
    },
  })
}
