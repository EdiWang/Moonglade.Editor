# AI 代码审查待办计划

本文件用于记录当前仍需要处理的代码审查问题和后续执行计划。已完成任务、历史执行记录和不再需要处理的事项已移除，避免后续 AI 或维护者误读。

## 1. 分析日期

- 初始审查日期：2026-07-18
- 最近整理日期：2026-07-30

## 2. 当前分析范围

当前待办来自前几轮对以下模块的审查和改进执行记录：

- `src/editor.ts`：富文本编辑器生命周期、textarea 同步、HTML 序列化。
- `src/code-editor.ts`：Markdown/HTML/CSS 代码模式、CodeMirror 同步、搜索与格式化。
- `src/source-code-editor.ts`：富文本 HTML source dialog 内部 CodeMirror 编辑器。
- `src/markdown-image-upload.ts`：Markdown 图片 paste/drop 上传。
- `src/image-upload.ts`、`src/safety.ts`：图片上传扩展名与 URL 安全边界。
- `README.md`、`docs/`：集成文档和长期任务记录。
- `test/`：Vitest/jsdom 回归测试。

## 3. 总体结论

- 整体风险等级：低。
- 当前代码已完成主要安全、生命周期、运行时校验和 CodeMirror 重复逻辑整理。
- 目前最值得继续处理的问题是：是否对 CodeMirror 公共模式的自动 `textarea` / `onChange` 同步引入短 debounce，并同步 README 中的同步语义说明。
- 不建议继续保留已完成任务的长篇执行记录；如需查看具体实现，可通过 Git 历史或相关测试追踪。

## 4. 当前仍需处理的问题

| ID | 优先级 | 类型 | 位置 | 问题描述 | 影响 | 证据 | 建议方向 |
|---|---|---|---|---|---|---|---|
| O1 | P2 | 性能 / 集成行为 | `src/code-editor.ts` CodeMirror `updateListener`、`syncToTextarea()`、`onChange` | CodeMirror 公共模式当前在每次 `docChanged` 后同步写入 textarea 并立即触发 `onChange`。维护者已确认允许短 debounce，但尚未实现。 | 长 Markdown/HTML/CSS 文档连续输入时，仍可能频繁读取完整文本并通知宿主。若改为 debounce，会改变宿主收到自动同步通知的时机。 | 当前 `updateListener` 在每次文档变化后调用 `writeEditorValue(update.state.doc.toString(), true)`；富文本模式已存在自动同步 debounce。 | 在不改变 `getValue()` 和显式 `syncToTextarea()` 立即语义的前提下，为自动同步增加短 debounce，并在 destroy / 显式同步时 flush。 |
| O2 | P3 | 文档 / 集成说明 | `README.md`、必要时 `docs/` | 文档需要准确说明富文本模式和代码模式的同步语义：哪些 API 立即返回，哪些自动通知可能 debounce。 | 集成方可能误解 `textarea` 和 `onChange` 的时序保证。 | 代码中富文本自动同步已有 debounce；代码模式是否 debounce 取决于 O1。README 仍需要按最终行为同步。 | O1 完成后更新 README：`getHTML()` / `getValue()` / 显式 `syncToTextarea()` 立即；自动 `onChange` / textarea 同步按对应模式说明。 |

## 5. 分批次改进计划

### Task 1：为 CodeMirror 公共模式增加自动同步 debounce

- **优先级**：P2
- **关联问题**：O1
- **目标**：减少长文档编辑时每次按键后的同步写入和宿主通知频率，同时保留显式读取 / 显式同步的立即语义。
- **改动范围**：`src/code-editor.ts`，必要的测试文件。
- **不包含的内容**：不改变 `getValue()`；不改变显式 `syncToTextarea()` 的立即行为；不改变 formatter、Markdown 图片上传、搜索面板或 public API 名称。
- **预期结果**：连续编辑时自动 `textarea` / `onChange` 同步被短 debounce 合并；调用 `syncToTextarea()` 或 `destroy()` 时会 flush 未完成同步。
- **验证方式**：`npm test`；新增或调整 CodeMirror 同步测试，使用 fake timers 覆盖 debounce、显式 sync 和 destroy flush；`npm run build`。
- **上线风险**：中。自动 `onChange` 触发时机改变，但维护者已确认允许短 debounce。
- **回滚方案**：恢复为 `updateListener` 中每次 `docChanged` 立即调用 `writeEditorValue(..., true)`。
- **是否需要维护者确认**：否。
- **需要确认的问题**：无。

### Task 2：同步 README 中的编辑器同步语义

- **优先级**：P3
- **关联问题**：O2
- **目标**：让集成文档准确描述富文本模式和代码模式的内容读取、textarea 同步、`onChange` 时序。
- **改动范围**：`README.md`，必要时补充 `docs/` 中的简短说明。
- **不包含的内容**：不改运行时代码；不重新设计同步 API。
- **预期结果**：文档明确说明 `getHTML()`、`getValue()`、显式 `syncToTextarea()` 是立即的；自动同步和 `onChange` 可能 debounce，并说明各模式最终行为。
- **验证方式**：Markdown diff review；如 Task 1 改动已完成，配合 `npm test` / `npm run build` 的结果一起记录。
- **上线风险**：低。
- **回滚方案**：回退 README 文档变更。
- **是否需要维护者确认**：否。
- **需要确认的问题**：无。
- **依赖关系**：建议在 Task 1 完成后执行，避免文档描述和代码行为不一致。

## 6. 建议执行顺序

1. Task 1：先实现 CodeMirror 公共模式自动同步 debounce，并用测试固定时序。
2. Task 2：再更新 README 的同步语义说明，确保文档匹配最终代码行为。

## 7. 暂不建议处理的事项

- 不建议重新拆分或大规模重构 `MoongladeEditor` / `MoongladeCodeEditor`；当前剩余问题不需要架构级改造。
- 不建议替换 ProseMirror、CodeMirror 或 Prettier；当前问题可在现有技术栈内解决。
- 不建议为本地 demo 补 SRI/CSP；维护者已确认 `demo/index.html` 不会公开部署。
- 不建议收紧任意 class passthrough；维护者已确认这是设计选择。
- 不建议盲目升级依赖；没有基于安全公告或明确收益的升级任务。

## 8. 当前未确认问题

暂无。

已确认的长期上下文：

- 允许运行 `npm test`、`npm run build` 做验证。
- Markdown 图片上传 URL 策略应与富文本图片 URL 策略保持一致。
- Markdown 图片默认允许扩展名应与富文本默认值保持一致。
- CodeMirror 公共模式允许引入短 debounce。
- `demo/index.html` 不会公开部署。

## 9. 后续执行注意事项

- 不要编辑 `dist/`；如需验证 build，可以运行构建，但不要手工修改生成产物。
- 每个任务应单独提交、单独验证、可独立回滚。
- 改变 `onChange` 或 textarea 自动同步时序时，必须保留显式 `syncToTextarea()` 的立即语义。
- 文档更新应跟随最终代码行为，不要提前记录尚未实现的同步策略。
- 安全边界优先复用 `safety.ts` 和现有上传校验工具，不引入不必要的新依赖。
