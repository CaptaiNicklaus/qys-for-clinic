/**
 * Client half —— 「中医典籍科普内容生产」面板（v0.1 骨架）
 *
 * ⚠️ 遵守 DSH 插件规范（`references/practices.md` 原则 6 + `ui-plugin.md`）：
 *   · 用户看到的是**一个**应用 ⇒ **只用宿主 theme tokens，不硬编码颜色**
 *   · ⛔ **不 import 任何 `@deepseek-ai/dsh-client-ui-*` 包**（React 由浏览器模块表提供）
 *   · ⚠️ **需要在本机确认 theme token 的确切名字**（`cordis_inspect_query` 的 Theme）
 *     ⇒ 本轮**故意只使用继承色（inherit / currentColor）**，宁可朴素也不猜错
 *   · 工厂函数**无副作用**；资源注册都在 `apply(ctx)` 里
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-zhongyi-kepu',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // 六步工作流（与方案 §12.1 一致）—— v0.1 先只显示，不真的执行
    const STEPS = [
      { k: 'topic',   zh: '提交主题',       en: 'Topic' },
      { k: 'recall',  zh: '检索典籍',       en: 'Retrieve' },
      { k: 'ask',     zh: '追问补足',       en: 'Clarify' },
      { k: 'produce', zh: '工作流生产',     en: 'Produce' },
      { k: 'comply',  zh: '合规闸',         en: 'Compliance' },
      { k: 'export',  zh: '素材包导出',     en: 'Export' },
    ];

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
    };

    function Panel() {
      const [open, setOpen] = React.useState(false);
      const [topic, setTopic] = React.useState('');
      if (!open) {
        return h('div', { style: S.wrap },
          h('button', {
            type: 'button', style: S.btn, title: '中医典籍科普内容生产',
            onClick: () => setOpen(true),
          }, '📜 典籍科普'));
      }
      return h('div', { style: S.wrap },
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          h('input', {
            value: topic, placeholder: '输入一个主题（例：秋燥 / 失眠 / 脾胃调理）',
            onChange: (e) => setTopic(e.target.value),
            style: {
              font: 'inherit', color: 'inherit', background: 'transparent',
              border: '1px solid currentColor', borderRadius: 6, padding: '2px 8px',
              flex: '1 1 auto', minWidth: 180, opacity: 0.9,
            },
          }),
          h('button', { type: 'button', style: S.btn, disabled: true,
                        title: 'v0.1 骨架：工作流尚未接线' }, '生成'),
          h('button', { type: 'button', style: S.btn, onClick: () => setOpen(false) }, '收起')),
        h('div', { style: S.panel },
          h('div', { style: S.dim }, '六步工作流（v0.1 骨架，尚未接线）'),
          STEPS.map((s, i) => h('div', { key: s.k, style: S.step },
            h('span', { style: S.dim }, String(i + 1) + '.'),
            h('span', null, s.zh),
            h('span', { style: { ...S.dim, marginLeft: 'auto' } }, '未接线'))),
          h('div', { style: { ...S.dim, marginTop: 6 } },
            '下一步：① 接 qys_data 检索 ② 接 LLM ③ 接合规闸')));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'zhongyi-kepu', order: 6,
        }, Panel));
      },
    };
  },
});
