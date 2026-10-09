# qys-for-clinic —— 岐与笙 · 诊所版客户端

**DSH（DeepSeek Harness）的二次开发** ⇒ 面向中医诊所的 toB 桌面客户端。

> ⭐ **本仓库只放"我们自己的东西"**：业务插件 ＋ 构建脚本 ＋ 品牌配置。
> **DSH 上游不在本仓库里**（它 194 MB / 15k 文件）—— 见 `upstream/README.md`。

## 结构

```
qys-for-clinic/
├── plugins/       ⭐ 我们的业务插件（= 不同业务逻辑，预装进 App，闭源）
├── build/         ⭐ 打包脚本：换品牌 · 注入插件 · electron-builder 出海
├── upstream/      DSH 上游检出位置（.gitignore 掉，用脚本拉取）
└── .env.example   签名/公证要填的变量
```

## 现在有哪个插件

| 插件 | 干什么 | 状态 |
|---|---|---|
| `plugins/dsh-plugin-zhongyi-kepu/` | 中医典籍科普内容生产（提交主题 → 检索典籍 → 生成合规文案） | v0.1 骨架，工作流未接线 |

## ⚠️ 一条纪律

**插件是"内置"的** —— 随 App 一起编译打包，**终端用户看不到安装界面**。
⇒ 加功能 = **版本更新**（不是"让用户装插件"）。

## License

MIT（本仓库为自研；DSH 上游亦为 MIT）
