#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
④ 工作流生产 —— 原型（可本机真跑）
================================================
熏儿 🤍 · 2026-10-10

⭐ 它把 Host 半边那段"检索 → 文案"的链，先在**能在本机验**的形态上跑一遍：
    主题 → 检索典籍（824 部）→ 编号化 → LLM 组织成科普文案（每条论断标 [n]）

⚠️⚠️ **一条架构纪律（写在这儿，免得将来忘）**：
    在**客户的 App** 里，LLM 调用**必须走 App 自己的账号与计费**，
    ⛔ **绝不能硬编码服务方的 key** —— ⭐ 那正是第三步"能收钱"的核心。
    本原型用项目 key 只是为了**验证 prompt 与输出形态**。

跑法：  cd 项目根 && python3 <此文件> 秋燥
"""
import json, os, re, sys, urllib.request
from pathlib import Path

PROJ = Path('/Users/nicklaus/Desktop/100-work_academic/@_中医知识图谱_项目')
sys.path.insert(0, str(PROJ)) if str(PROJ) not in sys.path else None
from qys_data import retrieve as R          # noqa: E402

SYSTEM = """你是「岐与笙」中医典籍库的内容编辑。任务：把**给定的典籍条文**组织成一段**合规的科普文案**。

**只依据给定的条文写**，不得引入条文之外的知识，不得编造。

硬要求：
1. 每一条论断后必须用 [编号] 标注来源（编号即给定条文的序号）。
2. **不做诊断、不推荐方药、不给剂量、不给疗程、不针对个人症状**。
   只讲典籍里怎么记载、历代怎么说。
3. 若条文之间有**分歧**，要点出分歧（谁主张什么）。
4. 若条文**不足以**支撑某个说法，直说「库中未找到直接依据」，不要猜。
5. 输出结构：**① 一句话导语 → ② 典籍怎么说（3–5 点，每点带 [n]）→ ③ 小结**。
6. 简体中文，**不超过 320 字**。
"""


def evidence_block(cites):
    """把检索结果编号化 —— 与 Host 半边 index.js 里的形状一致。"""
    lines = []
    for c in cites:
        src = c.get('source') or '未标'
        lines.append('[%d]（%s）%s' % (c['n'], src, c['text']))
    return '\n'.join(lines)


def _key():
    for line in (Path(os.path.expanduser('~/.qys/env')).read_text(encoding='utf-8', errors='ignore').splitlines()):
        line = line.strip()
        if line.startswith('QYS_LLM_KEY='):
            return line.split('=', 1)[1].strip().strip('"').strip("'")
    return os.environ.get('QYS_LLM_KEY')


def produce(topic, k=12):
    """检索 → 组上下文 → LLM → 科普文案。返回 (文案, 元信息)。"""
    a = R.ask(topic, k=k)
    cites = []
    c = R._conn()
    ids = [x['statement_id'] for x in a.get('cites', []) if x.get('statement_id')]
    smap, wmap = {}, {}
    if ids:
        ph = ','.join('?' * len(ids))
        for r in c.execute('SELECT id, work_id, source_note FROM core_statement WHERE id IN (%s)' % ph, ids):
            smap[r['id']] = r['source_note'] or ''
            if r['work_id']:
                wmap[r['id']] = r['work_id']
        wids = sorted(set(wmap.values()))
        if wids:
            ph2 = ','.join('?' * len(wids))
            nm = {r['id']: r['name_zh'] for r in c.execute('SELECT id, name_zh FROM core_work WHERE id IN (%s)' % ph2, wids)}
            wmap = {s: nm.get(w, '') for s, w in wmap.items()}
    for x in a.get('cites', []):
        sid = x.get('statement_id')
        cites.append({'n': x['n'], 'text': x['content_zh'],
                      'source': smap.get(sid) or wmap.get(sid) or '未标'})

    user = '【典籍条文】\n%s\n\n【主题】%s' % (evidence_block(cites), topic)
    body = json.dumps({'model': 'deepseek-flash', 'temperature': 0.3, 'max_tokens': 3000,
                       'messages': [{'role': 'system', 'content': SYSTEM},
                                    {'role': 'user', 'content': user}]}).encode('utf-8')
    req = urllib.request.Request('https://api.deepseek.com/chat/completions', data=body,
                                 headers={'Content-Type': 'application/json',
                                          'Authorization': 'Bearer ' + _key()})
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.loads(r.read().decode('utf-8'))
    msg = d['choices'][0]['message']
    text = (msg.get('content') or '').strip()
    if not text:
        # ⚠️ 踩过的坑（项目 config.LLM_QA_MAX_TOKENS 的长注释）：deepseek-flash 开思考后
        #    思维链与正文**抢同一个 max_tokens 预算** ⇒ 预算小就**跑满 ⇒ 空回答**。
        #    ⇒ 这里把预算抬到 3000，并把 finish_reason 与是否有 reasoning 打出来便于诊断。
        print('  ⚠️ 空回答 · finish_reason=%s · 有 reasoning=%s · tokens=%s'
              % (d['choices'][0].get('finish_reason'),
                 bool(msg.get('reasoning_content')),
                 d.get('usage', {}).get('completion_tokens')), file=sys.stderr)
    used = sorted({int(x) for x in re.findall(r'\[(\d+)\]', text) if 1 <= int(x) <= len(cites)})
    return text, {'cites': cites, 'used': used, 'usage': d.get('usage', {})}


if __name__ == '__main__':
    topic = sys.argv[1] if len(sys.argv) > 1 else '秋燥'
    text, meta = produce(topic)
    print('═══ 主题「%s」═══' % topic)
    print('  召回 %d 条 · 文案实际引用 %s · tokens %s'
          % (len(meta['cites']), meta['used'], meta['usage'].get('total_tokens')))
    print('─' * 60)
    print(text)
    print('─' * 60)
    print('  ⭐ 输出里 [n] 的条数:', len(re.findall(r'\[\d+\]', text)))
