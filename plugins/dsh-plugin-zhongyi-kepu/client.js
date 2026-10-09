/**
 * Client half —— 「中医典籍科普内容生产」面板（v0.4 已接线）
 *
 * ⚠️ 遵守 DSH 插件规范（`references/practices.md` 原则 6 + `references/ui-plugin.md`）：
 *   · 用户看到的是**一个**应用 ⇒ **只用宿主 theme tokens，不硬编码颜色**
 *   · ⛔ **不 import 任何 `@deepseek-ai/dsh-client-ui-*` 包**（React 由浏览器模块表提供）
 *   · ⛔ **不替换 app root、不往 `document.body` 追加第二个应用**
 *   · 工厂函数**无副作用**；资源注册都在 `apply(ctx)` 里，用 `ctx.effect` 注册
 *   · 组件**看不到 ctx**：调用一律经注册项的 `inject` 面（在 `apply` 闭包里造）传进去
 *
 * ⭐ v0.4 接线（上游 `references/user-actions.md`「One operation, two callers」）：
 *   · 可见文案**全部走 Client locale service** —— `ctx.locale.register(NS, {zh, en})`
 *     注册字典，注册项声明 `locale: NS` ⇒ 框架把 `t` 席注入组件 props，语言切换即时生效
 *   · 「生成」按钮 ⇒ `ctx.remote.commands.execute(sessionId, '/kepu <主题>', [])`
 *     ⇒ Host 侧**同一个操作**（`index.js` 的 `retrieveText()`，智能体工具 `zhongyi_retrieve` 也用它）
 *   · ⭐ **失败把原因显示出来**（网关错码 / 命令未接纳 / 抛错原文）
 *
 * ⚠️ 运行时字典**内联在本文件**，这是 DSH 的既有惯例（对照已装的 `dsh-plugin-whale-pet`
 *    与官方模板 `templates/decoration/`）：`locale/*.json` 只承载 Plugin Manager 读的
 *    `meta.title` / `meta.description`，**不重复**运行时文案。
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-zhongyi-kepu',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** 本插件拥有的 locale 命名空间（注册项上用 `locale: NS` ⇒ 组件拿到 `t` 席）。 */
    const NS = 'zhongyi-kepu';
    /** Host 侧（index.js）注册的会话命令名 —— 与智能体工具是同一个操作。 */
    const COMMAND = 'kepu';

    /**
     * 六步工作流（与方案 §12.1 一致）。
     * `wired: true` = 这一步真能跑；其余仍是占位。
     */
    const STEPS = [
      { k: 'topic', key: 'stepTopic', wired: true },
      { k: 'recall', key: 'stepRecall', wired: true },
      { k: 'ask', key: 'stepAsk', wired: false },
      { k: 'produce', key: 'stepProduce', wired: false },
      { k: 'comply', key: 'stepComply', wired: false },
      { k: 'export', key: 'stepExport', wired: false },
    ];

    /** zh 字典。 */
    const ZH = {
      title: '📜 典籍科普',
      tooltip: '中医典籍科普内容生产',
      lead: '六步工作流',
      topicPlaceholder: '输入一个主题（例：秋燥 / 失眠 / 脾胃调理）',
      generate: '生成',
      generating: '检索中…',
      collapse: '收起',
      emptyTopic: '请先输入一个主题。',
      unknownCommand: '未知命令：/{name}',
      failed: '检索失败：',
      resultTitle: '检索结果（库中原句，引用请保留 [编号] 与出处）',
      stepTopic: '提交主题',
      stepRecall: '检索典籍',
      stepAsk: '追问补足',
      stepProduce: '工作流生产',
      stepComply: '合规闸',
      stepExport: '素材包导出',
      wired: '已接线',
      notWired: '未接线',
      next: '下一步：③ 追问补足 ④ 工作流生产 ⑤ 合规闸 ⑥ 素材包导出',
    };

    /** en 字典（键集合必须与 zh 完全一致）。 */
    const EN = {
      title: '📜 Classics Explainer',
      tooltip: 'Chinese-medicine classics explainer content production',
      lead: 'Six-step workflow',
      topicPlaceholder: 'Enter a topic (e.g. autumn dryness / insomnia)',
      generate: 'Generate',
      generating: 'Retrieving…',
      collapse: 'Collapse',
      emptyTopic: 'Enter a topic first.',
      unknownCommand: 'unknown command: /{name}',
      failed: 'Retrieval failed: ',
      resultTitle: 'Result (verbatim clauses; keep the [n] and the source when quoting)',
      stepTopic: 'Topic',
      stepRecall: 'Retrieve',
      stepAsk: 'Clarify',
      stepProduce: 'Produce',
      stepComply: 'Compliance',
      stepExport: 'Export',
      wired: 'wired',
      notWired: 'not wired',
      next: 'Next: ③ clarify ④ produce ⑤ compliance ⑥ export',
    };

    /** ⚠️ 只用继承色（`inherit` / `currentColor`），不猜 theme token 名。 */
    const S = {
      wrap: { font: 'inherit', fontSize: 12, lineHeight: 1.6, color: 'inherit' },
      btn: {
        font: 'inherit', cursor: 'pointer', border: '1px solid currentColor',
        background: 'transparent', color: 'inherit', borderRadius: 6,
        padding: '2px 8px', opacity: 0.85,
      },
      panel: {
        border: '1px solid currentColor', borderRadius: 8, padding: '8px 10px',
        marginTop: 6, opacity: 0.95, maxWidth: 460,
      },
      step: { display: 'flex', gap: 6, alignItems: 'baseline' },
      dim: { opacity: 0.6 },
      result: {
        marginTop: 4, padding: '6px 8px', border: '1px solid currentColor',
        borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: 220, overflowY: 'auto',
      },
    };

    /**
     * 面板组件。props = 框架五份分享：运行时席（`sessionId` 等）+ 注册项 `inject` 面
     * （`retrieve`）+ locale 席（`t`）。**组件不碰 ctx。**
     */
    function Panel(props) {
      const t = props.t;
      const retrieve = props.retrieve;
      const [open, setOpen] = React.useState(false);
      const [topic, setTopic] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      // `null` = 还没跑过；否则 `{ ok, text }` —— 失败也走这条路，**原因照样显示**。
      const [result, setResult] = React.useState(null);

      const generate = async () => {
        if (busy) return;
        const asking = topic.trim();
        if (!asking) {
          // 这不是「检索失败」，是输入没给全 ⇒ 只显示一行提示，不套失败标题。
          setResult({ ok: false, title: null, text: t('emptyTopic') });
          return;
        }
        setBusy(true);
        setResult(null);
        try {
          setResult(await retrieve(asking));
        } catch (e) {
          setResult({ ok: false, title: 'failed', text: (e && e.message) || String(e) });
        } finally {
          setBusy(false);
        }
      };

      if (!open) {
        return h('div', { style: S.wrap },
          h('button', {
            type: 'button', style: S.btn, title: t('tooltip'),
            onClick: () => setOpen(true),
          }, t('title')));
      }
      return h('div', { style: S.wrap },
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h('input', {
            value: topic, placeholder: t('topicPlaceholder'),
            onChange: (e) => setTopic(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter') void generate(); },
            style: {
              font: 'inherit', color: 'inherit', background: 'transparent',
              border: '1px solid currentColor', borderRadius: 6, padding: '2px 8px',
              flex: '1 1 auto', minWidth: 180, opacity: 0.9,
            },
          }),
          h('button', {
            type: 'button', style: S.btn, disabled: busy,
            title: t('tooltip'), onClick: () => { void generate(); },
          }, busy ? t('generating') : t('generate')),
          h('button', { type: 'button', style: S.btn, onClick: () => setOpen(false) }, t('collapse'))),
        h('div', { style: S.panel },
          h('div', { style: S.dim }, t('lead')),
          STEPS.map((s, i) => h('div', { key: s.k, style: S.step },
            h('span', { style: S.dim }, String(i + 1) + '.'),
            h('span', null, t(s.key)),
            h('span', { style: { ...S.dim, marginLeft: 'auto' } },
              busy && s.k === 'recall' ? t('generating') : t(s.wired ? 'wired' : 'notWired')))),
          result === null ? null : h('div', { style: { marginTop: 6 } },
            result.title === null ? null : h('div', { style: S.dim }, t(result.title)),
            result.text ? h('div', { style: S.result }, (result.ok ? '' : '⚠️ ') + result.text) : null),
          h('div', { style: { ...S.dim, marginTop: 6 } }, t('next'))));
    }

    return {
      // `remote.commands` = 网关挂载的 commands 命名空间服务；`remote` = 网关本体。
      inject: ['slots', 'locale', 'remote', 'remote.commands'],
      apply(ctx) {
        // 可见文案的所有权：字典注册在插件的 effect 上，卸载即撤销。
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'zhongyi-kepu: dictionaries');
        // `bind` 返回按**当前**语言取词的 `t`（身份稳定，随时可调）。
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          // 注册项声明 `locale: NS` ⇒ 框架给组件注入 `t` 席（语言切换即时生效）。
          name: 'conversation.composer.dock', id: 'zhongyi-kepu', order: 6, locale: NS,
          // 注册项 `inject` 面：**唯一的 ctx 出口**，组件只拿到这个回调。
          inject: (sessionId) => ({
            /**
             * 跑一次检索：经 Host 的会话命令执行**与智能体工具同一个操作**。
             * @param {string} subject - 主题。
             * @returns {Promise<{ ok: boolean, text: string }>} 失败带原因（网关码 / 未接纳 / 抛错）。
             */
            retrieve: async (subject) => {
              const r = await ctx.remote.commands.execute(sessionId, `/${COMMAND} ${subject}`, []);
              if (!r.ok) return { ok: false, title: 'failed', text: `${r.error.message} (${r.error.code})` };
              if (r.value === undefined) {
                // 命令未被接纳（语法不合法 / 名字不认识）。
                return { ok: false, title: 'failed', text: t('unknownCommand', { name: COMMAND }) };
              }
              const outcome = r.value.result;
              return {
                ok: outcome.kind === 'success',
                title: outcome.kind === 'success' ? 'resultTitle' : 'failed',
                text: outcome.text === undefined ? '' : outcome.text,
              };
            },
          }),
        }, Panel));
      },
    };
  },
});
