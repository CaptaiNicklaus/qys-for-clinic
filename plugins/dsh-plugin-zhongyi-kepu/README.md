# dsh-plugin-zhongyi-kepu

中医典籍科普内容生产（岐与笙 toB）。**v0.1 骨架**：UI 占位，工作流尚未接线。

六步：提交主题 → 检索典籍 → 追问补足 → 工作流生产 → 合规闸 → 素材包导出

## 遵守的 DSH 插件规范

- `references/practices.md` 原则 6：插件 UI 是 Harness UI 的一部分 ⇒ **只用宿主 theme tokens**、不硬编码颜色
- ⛔ 不 import 任何 `@deepseek-ai/dsh-client-ui-*` 包（React 由浏览器模块表提供）
- 工厂无副作用；资源注册都在 `apply(ctx)` 里
- ⚠️ v0.1 故意只用继承色（`inherit`/`currentColor`）—— 待用 `cordis_inspect_query` 确认 theme token 名后再上色

## License

MIT（本包为自研；DSH 本体亦为 MIT）
