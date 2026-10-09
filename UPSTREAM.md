# UPSTREAM —— DSH 上游怎么拉

⚠️ **本目录内容不进仓库**（见根 `.gitignore` 的 `upstream/`）。
DSH 有 194 MB / 近 15,000 个文件 —— 塞进本仓库既臃肿、又会让"我们改了什么"看不清楚。

## 拉取

```bash
cd upstream
git clone --depth 1 --single-branch --branch master \
  https://github.com/deepseek-ai/deepseek-harness.git .
```

⚠️ **网络提示**：`github.com` 直连不稳定（实测首连 75s 超时）。
备用：`https://codeload.github.com/deepseek-ai/deepseek-harness/tar.gz/refs/heads/master`（该域名实测通）。

## 为什么不用 submodule

也可以，但对我们这种"**只读上游、只改自己的插件**"的用法，**脚本拉取更简单**：
- 上游更新就是 `git pull`（不会有 submodule 的指针冲突）
- 克隆本仓库的人**不会被强制拉 194 MB**

## 出海要用到的上游文件

| 路径 | 用途 |
|---|---|
| `apps/desktop/README.zh.md` | ⭐ 打包/签名/公证/更新/**预装运行时**的完整说明（中文） |
| `apps/desktop/electron-builder.config.mjs` | 打包配置本体 |
| `apps/desktop/.env.macos.example` · `.env.windows.example` | 签名与公证的变量模板 |
| `packages/preset/agent-preset/skills/cordis-plugin-development/` | ⭐ 插件开发规范与模板 |
