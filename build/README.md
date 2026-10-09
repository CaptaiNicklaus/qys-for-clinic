# build —— 打包与出海

（待写）这一步要做：

1. 拉上游（见 `../UPSTREAM.md`）
2. ⭐ **换成我们的品牌** —— 依 `BRAND_GUIDELINES.md`：
   产品名**不得含 "DeepSeek Harness"**（注册商标）；关于页写 "built on DSH, MIT" 并保留 MIT 声明
3. ⭐ **把 `../plugins/*` 内置进去**（预装，随版本发布）
4. ⭐ **出海** —— 照上游 `apps/desktop/electron-builder.config.mjs` 与 `.env.*.example`：
   Developer ID 签名 ＋ 公证（notarize+staple）＋ DMG/ZIP ＋ Windows NSIS ＋ electron-updater
