/**
 * Host half —— 「中医典籍科普」的检索工具（v0.3）
 *
 * ⭐ 写法照抄上游 `packages/experimental/tool-ralph/src/index.ts`。
 *
 * ⭐ v0.3 修了一个**实测验出来的真问题**：
 *    `core_statement.source_note`（细出处）**为空率 64.4%**，
 *    而 `work_id` **只有 1 条为空**（覆盖率 ~100%）。
 *    ⇒ 所以出处必须**两级取**：先 `source_note`，空则用 `work_id` 反查 `core_work.name_zh`。
 *    ⚠️ 不这样做，工具返回的条文有 2/3 **没有出处** ⇒ 而"可溯源"是我们的硬要求。
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { spawnSync } from 'node:child_process'

export const name = 'zhongyi-kepu'
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

export function apply(ctx) {
  ctx.tools.register(defineTool({
    name: 'zhongyi_retrieve',
    description:
      '从中医典籍库检索与一个主题相关的原文条文，每条都带出处（细到篇名，或至少到书名）。' +
      '⚠️ 只返回库里真实存在的条文；库中没有就说没有，绝不编造。' +
      '这是科普内容生产的第一步：先看"库里有什么"，再决定讲什么。',
    parameters: {
      topic: { type: 'string', required: true, description: '主题或问题，例如「秋燥」「失眠」「脾胃调理」' },
      k: { type: 'number', required: false, description: '返回条数上限，默认 12' },
    },
    timeoutMs: 60000,
    execute: (args) => {
      const topic = String((args && args.topic) || '').trim()
      if (!topic) return { text: '请给一个主题。' }
      const k = Math.min(Math.max(Number((args && args.k) || 12), 1), 30)
      try {
        const d = retrieve(topic, k)
        if (!d.cites || !d.cites.length) {
          return { text: `库中未找到与「${topic}」直接相关的条文。⚠️ 不要编造；换个说法或换主题再试。` }
        }
        const lines = [`主题「${d.q}」—— 库里找到 ${d.cites.length} 条条文`
          + (d.entities.length ? `，涉及 ${d.entities.join('、')}` : '') + '：', '']
        for (const c of d.cites) {
          const tag = c.level === '细' ? '' : (c.level === '书' ? '（仅到书名）' : '（⚠️ 无出处）')
          lines.push(`[${c.n}] ${c.text}　—— ${c.source || '未标'}${tag}`)
        }
        lines.push('', '⚠️ 以上为库中原句。引用时请保留 [编号] 与出处。')
        return { text: lines.join('\n') }
      } catch (e) {
        return { text: '检索失败：' + ((e && e.message) || String(e)) }
      }
    },
  }))
}
