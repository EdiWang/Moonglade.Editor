# AI 代码审查与改进计划

本文件用于记录当前仍需要处理的代码审查问题和后续执行计划。它是本仓库当前适合长期保留的 AI 记忆文件。

## 1. 分析日期

- 本轮审查日期：2026-07-30
- 本轮验证命令：未运行。按用户要求，本轮不执行测试、构建、lint、安装、格式化或生成文件命令。
- Task 1 执行日期：2026-07-30
- Task 1 验证命令：`npm test -- test/editor.test.ts`、`npm test`、`npm run build`。
- Task 3 / Task 4 执行日期：2026-07-30
- Task 3 / Task 4 验证方式：Markdown / workflow diff review；未重新运行测试或构建，因为本次只修改文档和 CI 配置。

## 2. 分析范围

本轮基于只读命令和代码阅读，覆盖以下主要区域：

- 根目录项目文件：`package.json`、`tsconfig.json`、`tsconfig.build.json`、`vitest.config.ts`、`.gitignore`、`README.md`、`AGENTS.md`。
- CI / 构建脚本：`.github/workflows/build.yml`、`scripts/build.mjs`、`scripts/check-size.mjs`、`scripts/upload-test-server.mjs`。
- 公共入口与模式路由：`src/index.ts`、`src/code-editor-options.ts`、`src/code-languages.ts`。
- 富文本编辑器主流程：`src/editor.ts`、`src/commands.ts`、`src/editor-state.ts`、`src/schema.ts`、`src/html.ts`、`src/safety.ts`。
- CodeMirror 公共模式和 source dialog：`src/code-editor.ts`、`src/source-code-editor.ts`、`src/code-editor-shared.ts`、`src/code-formatter.ts`、`src/code-formatter-runtime.ts`。
- 上传相关模块：`src/image-upload.ts`、`src/markdown-image-upload.ts`、`src/upload-preview.ts`、`src/toolbar/image-files.ts`。
- 工具栏和对话框：`src/toolbar.ts`、`src/toolbar/`、`src/dialogs.ts`。
- 测试覆盖：`test/editor.test.ts`、`test/code-editor.test.ts`、`test/html.test.ts`、`test/safety.test.ts`、`test/commands.test.ts`、`test/unified-editor.test.ts`。
- 既有 AI 记忆：`docs/ai-review-plan.md`、`docs/tasks/task-template.md`。

## 3. 总体结论

- 整体风险等级：中。
- 没有发现 P0/P1 级别的确定性问题。HTML rich mode 的主要 XSS 边界集中在 `parseHtml(...)`、schema 和 `safety.ts`，并已有较多 sanitizer 回归测试。
- 最值得优先处理的问题是：CodeMirror 公共模式自动同步缺少 debounce，以及后续低风险维护性整理。
- 不建议现在做大规模架构重写、替换 ProseMirror / CodeMirror / Prettier、盲目升级依赖或为本地 demo 增加复杂安全策略。

## 4. 问题列表

| ID | 优先级 | 类型 | 位置 | 问题描述 | 影响 | 证据 | 建议方向 |
|---|---|---|---|---|---|---|---|
| R1 | Done | 稳定性 / 上传边界 | `src/toolbar/image-files.ts` `getFirstImageFile(...)`、`getFirstImageFileFromItems(...)`；`test/editor.test.ts` | 已完成。富文本图片选择阶段现在复用 `hasAllowedImageUploadExtension(...)`，不再先接受任意 `image/*`。新增多文件顺序测试，覆盖不允许 GIF 在前、允许 PNG 在后时仍上传 PNG。 | 默认不允许的图片不会阻断同一批文件里的允许图片；上传前最终校验仍保留。 | 2026-07-30 执行 Task 1：更新 `src/toolbar/image-files.ts`，调整默认不支持 GIF 测试，并新增 “uploads the first allowed image when earlier files are unsupported”。验证 `npm test -- test/editor.test.ts`、`npm test`、`npm run build` 均通过。 | 无后续待办。 |
| R2 | P2 | 性能 / 集成行为 | `src/code-editor.ts` CodeMirror `onDocChanged` | CodeMirror 公共模式每次 `docChanged` 都立即 `update.state.doc.toString()`、写入 textarea 并触发 `onChange`。富文本模式已有 200ms 自动同步 debounce，两套模式同步时序不一致。 | 长 Markdown/HTML/CSS 文档连续输入时可能频繁读取完整 buffer 并通知宿主。引入 debounce 会改变自动 `onChange` 时机，需要测试锁定显式 API 仍立即。 | `src/code-editor.ts:242-244` 每次变化立即 `writeEditorValue(update.state.doc.toString(), true)`；富文本模式有 `TEXTAREA_SYNC_DEBOUNCE_MS = 200`、`scheduleTextareaSync()` 和 destroy flush，见 `src/editor.ts:36`、`src/editor.ts:250-258`、`src/editor.ts:270-278`、`src/editor.ts:395-399`。 | 为 CodeMirror 公共模式增加短 debounce；保留 `getValue()`、显式 `syncToTextarea()` 和 `destroy()` flush 的立即/最终一致语义。 |
| R3 | Done | 测试 / 上线保障 | `.github/workflows/build.yml` | 已完成。GitHub Actions 现在覆盖 `main` / `release` push 和 pull request，并在 `npm run build` 前运行 `npm test`。 | release 和 PR 自动化能覆盖 Vitest 回归。 | 2026-07-30 执行 Task 4：workflow 增加 `main` push、`pull_request` 触发，以及 `Test` step。 | 无后续待办。 |
| R4 | P3 | 安全 / 集成边界（已确认） | `src/index.ts`、`src/code-editor.ts`、README / AGENTS raw HTML 说明 | `mode: 'html'` 是 raw HTML 代码模式，按设计保留文本 buffer，不经过 rich HTML schema 和 sanitizer。维护者已确认不需要在本仓对 raw HTML mode 增加“仅受信任管理员”限制。 | 本仓后续不应把 raw HTML mode 改成 sanitizer-backed rich HTML，也不应新增权限限制。raw HTML 渲染安全由主应用业务边界承担。 | `src/index.ts:38-44` 将 `mode: 'html'` 路由到 `createMoongladeCodeEditor(...)`；`src/code-editor.ts:88-109` 直接 `getValue()` / `setValue()` 文本 buffer；AGENTS 明确 “Code-like raw HTML mode ... must preserve the text buffer instead of routing content through the rich HTML schema”。维护者于 2026-07-30 确认“不用做这个限制”。 | 保持 raw HTML code mode 文本保留设计；文档只需说明它与 rich HTML mode 的 sanitizer 边界不同，不要提出权限限制作为待办。 |
| R5 | P3 | 安全 / 集成边界（已确认） | `src/image-upload.ts`、README image upload 说明 | 默认允许 `.svg` 上传扩展名。维护者已确认允许上传 SVG。客户端仍只做扩展名/MIME 初筛，服务端仍需负责文件内容和响应策略。 | 不应移除 `.svg` 默认支持；后续只可强化服务端责任说明或测试，不应把禁用 SVG 作为默认改进方向。 | `src/image-upload.ts:9` 默认值包含 `.svg`；`src/image-upload.ts:14-18` 将 `image/svg+xml` 映射到 `.svg`；`README.md:167` 说明服务端仍需验证文件内容。维护者于 2026-07-30 确认“允许上传SVG”。 | 保留 `.svg` 默认支持；如更新文档，应强调服务端校验和安全响应仍是 host responsibility。 |
| R6 | Done | 文档 / 可维护性 | `README.md` “For AI continuation” | 已完成。README 不再指向不存在的 `docs/CODEX_HANDOFF.md` 和旧 task 文件，改为引用 `AGENTS.md` 和 `docs/ai-review-plan.md`。 | 后续维护者或 AI 有可用的续接入口。 | 2026-07-30 执行 Task 3：删除缺失文档引用，并补充当前同步语义说明。 | 无后续待办。 |
| R7 | P3 | 结构 / 可维护性 | `src/editor.ts`、`src/code-editor.ts` option validators | 富文本和代码模式各自复制了相似的 DOM / textarea / string / boolean / function option 校验函数。 | 当前不影响行为，但后续新增公共选项时容易出现错误信息或校验规则漂移。 | `src/editor.ts:669-720` 与 `src/code-editor.ts:367-420` 都定义 `assertHTMLElement`、`assertOptionalTextArea`、`assertOptionalString`、`assertBoolean`、`assertOptionalBoolean`、`assertOptionalFunction` 等。 | 在不改变错误语义的前提下抽出小型内部校验 helper；先加/保留现有无效选项测试。 |
| R8 | P3 | 结构 / 测试维护性 | `src/editor.ts`、`test/editor.test.ts` | `src/editor.ts` 和 `test/editor.test.ts` 都偏大。当前职责基本符合 AGENTS 中的模块划分，但继续增长会增加定位和 review 成本。 | 长期维护成本上升；大规模拆分本身有回归风险，不宜优先处理。 | 行数统计：`src/editor.ts` 约 662 行，`test/editor.test.ts` 约 1158 行；测试文件同时覆盖 toolbar、同步、source dialog、上传、销毁等多类行为。 | 仅在触及相关区域时小步拆分，例如按 sync / upload / dialog 切分测试文件；暂不做纯结构性大重构。 |

## 5. 分批次改进计划

### Task 1：修正富文本图片选择的 allowlist 边界（已完成）

- **优先级**：P2
- **关联问题**：R1
- **目标**：让文件选择阶段只选择当前配置允许的图片，避免多文件场景中不支持图片阻断后续允许图片。
- **改动范围**：`src/toolbar/image-files.ts`、`test/editor.test.ts` 或新增上传相关测试文件。
- **不包含的内容**：不改变 `allowedImageExtensions` 默认值；不改变 `uploadImage` / `uploadUrl` API；不引入服务端校验逻辑。
- **预期结果**：已完成。默认配置下 GIF 不会被选为待上传文件；同一批文件中后续 `.jpg` / `.png` / `.webp` / `.svg` 仍可被选择并上传；无文件名但 MIME 可映射到允许扩展名的剪贴板图片仍可工作。
- **验证方式**：已执行 `npm test -- test/editor.test.ts`、`npm test`、`npm run build`，均通过。
- **上线风险**：低。
- **回滚方案**：恢复 `getFirstImageFile(...)` / `getFirstImageFileFromItems(...)` 当前的 `image/* || allowlist` 判断。
- **是否需要我确认**：否。
- **需要确认的问题**：无。

### Task 2：为 CodeMirror 公共模式增加自动同步 debounce

- **优先级**：P2
- **关联问题**：R2
- **目标**：减少长文档连续输入时的完整 buffer 读取和宿主通知频率，同时保持显式读取与提交路径可靠。
- **改动范围**：`src/code-editor.ts`、`test/code-editor.test.ts`，必要时复用或抽出同步 helper。
- **不包含的内容**：不改变 public API 名称；不改变 `getValue()` 的立即读取；不改变 formatter、搜索、Markdown 图片上传逻辑。
- **预期结果**：自动 textarea / `onChange` 通知被短 debounce 合并；`syncToTextarea()` 立即写入 textarea；`destroy()` flush 未完成同步。
- **验证方式**：使用 fake timers 覆盖连续编辑合并、显式 sync 立即、destroy flush、formatter/setValue 后最终同步。执行 `npm test` 和 `npm run build`。
- **上线风险**：中。自动 `onChange` 触发时机改变，但既有 AI 记忆记录维护者已确认允许短 debounce。
- **回滚方案**：恢复 `onDocChanged` 中每次变化立即 `writeEditorValue(update.state.doc.toString(), true)`。
- **是否需要我确认**：否。
- **需要确认的问题**：无。

### Task 3：同步 README 的同步语义和续接文档引用（已完成）

- **优先级**：P3
- **关联问题**：R2、R6
- **目标**：让文档准确说明 rich HTML 和 code-like modes 的 `getHTML()` / `getValue()` / `syncToTextarea()` / `onChange` 时序，并移除或修正不存在的续接文档路径。
- **改动范围**：`README.md`，必要时 `docs/ai-review-plan.md` 或新增 `docs/tasks/...` 任务记录。
- **不包含的内容**：不改运行时代码；不重新设计同步 API；不编辑 AGENTS.md，除非后续用户明确允许。
- **预期结果**：已完成。README 不再指向不存在的文档；集成方知道 `getHTML()` / `getValue()` 和显式 `syncToTextarea()` 立即，rich HTML 自动同步 debounced，code-like modes 当前仍每次 CodeMirror 文档变化自动同步。
- **验证方式**：Markdown diff review。
- **上线风险**：低。
- **回滚方案**：回退 README 文档变更。
- **是否需要我确认**：否。
- **需要确认的问题**：无。维护者已确认删除 README 中缺失的 `docs/CODEX_HANDOFF.md` / `docs/tasks/task-moonglade-editor-implementation.md` 引用。
- **依赖关系**：Task 2 尚未完成；README 当前按现有代码行为记录。Task 2 完成后如 code-like modes 自动同步改为 debounce，需要再次同步 README。

### Task 4：让 CI 覆盖单元测试（已完成）

- **优先级**：P2
- **关联问题**：R3
- **目标**：让 release 自动化同时覆盖 Vitest 回归，降低发布时 sanitizer、上传和同步行为退化风险。
- **改动范围**：`.github/workflows/build.yml`。
- **不包含的内容**：不引入新的测试框架；不升级依赖；不改变 npm scripts。
- **预期结果**：已完成。CI 在 `npm ci` 后运行 `npm test`，再运行 `npm run build`；覆盖 `main` / `release` push 和 pull request。
- **验证方式**：workflow diff review；合并后观察 GitHub Actions。
- **上线风险**：低到中。可能暴露已有 flaky 测试或增加 CI 时间。
- **回滚方案**：移除新增 test step 或恢复原 workflow。
- **是否需要我确认**：否。
- **需要确认的问题**：无。

### Task 5：记录 raw HTML code mode 的非限制决策

- **优先级**：P3
- **关联问题**：R4
- **目标**：记录 raw HTML mode 按文本保留且不在本仓增加权限限制的产品决策，避免后续 AI 或维护者误提 sanitizer/权限限制改造。
- **改动范围**：README / docs；如主 Moonglade 仓库有对应集成文档，则另起任务处理主仓。
- **不包含的内容**：不在本仓直接为 `mode: 'html'` 增加 sanitizer；不改变 raw HTML mode 存储文本的设计；不新增“仅受信任管理员”限制。
- **预期结果**：集成方清楚 rich HTML mode 和 raw HTML code mode 的 sanitizer 差异，同时知道本仓不负责新增 raw HTML 权限限制。
- **验证方式**：文档 review。
- **上线风险**：低。
- **回滚方案**：回退文档变更。
- **是否需要我确认**：否。
- **需要确认的问题**：无。

### Task 6：保留 SVG 默认支持并强化服务端责任说明

- **优先级**：P3
- **关联问题**：R5
- **目标**：保留 `.svg` 默认允许上传的产品约束，同时确保文档继续强调服务端必须验证文件内容和安全响应策略。
- **改动范围**：README / docs；如仅保持当前说明充分，可不执行代码改动。
- **不包含的内容**：不移除 `.svg` 默认支持；不在前端尝试解析或净化 SVG 内容。
- **预期结果**：后续任务不会把禁用 SVG 当成默认改进方向；文档对服务端责任说明清楚。
- **验证方式**：Markdown review；如未来仅改文档，无需运行完整构建。
- **上线风险**：低。
- **回滚方案**：回退文档变更。
- **是否需要我确认**：否。
- **需要确认的问题**：无。

### Task 7：抽取共享 option 校验 helper

- **优先级**：P3
- **关联问题**：R7
- **目标**：降低 rich HTML 和 code-like mode option runtime validation 的重复，避免未来公共选项校验漂移。
- **改动范围**：新增内部 helper（例如 `src/options-validation.ts`）或合适的现有模块；更新 `src/editor.ts`、`src/code-editor.ts`；保留现有错误消息语义。
- **不包含的内容**：不改变 public API；不改变错误类型；不扩大选项集合。
- **预期结果**：公共 DOM/string/boolean/function/textarea 校验只有一处实现；现有无效选项测试继续通过。
- **验证方式**：`npm test`、`npm run build`。
- **上线风险**：低。
- **回滚方案**：恢复两个 editor 文件内的本地 validator。
- **是否需要我确认**：否。
- **需要确认的问题**：无。

### Task 8：按触达区域小步拆分大型测试文件

- **优先级**：P3
- **关联问题**：R8
- **目标**：降低 `test/editor.test.ts` 的维护成本，让同步、上传、dialog、toolbar 行为更容易定位。
- **改动范围**：测试文件组织，必要时抽出测试 helper。
- **不包含的内容**：不改生产代码；不改变测试语义；不追求一次性重排所有测试。
- **预期结果**：后续改上传或同步时，只需阅读相应测试文件；review diff 更小。
- **验证方式**：拆分前后运行 `npm test`；确认测试名称和覆盖场景保留。
- **上线风险**：低。
- **回滚方案**：恢复原测试文件组织。
- **是否需要我确认**：否。
- **需要确认的问题**：无。

## 6. 建议执行顺序

1. Task 1：先修正富文本图片选择 allowlist 边界，改动小、行为清晰、可快速测试。
2. Task 2：再处理 CodeMirror 公共模式 debounce，用测试固定时序。
3. Task 3：已完成，README 同步语义和续接文档引用已更新。
4. Task 4：已完成，CI 已覆盖 tests + build 以及 main/release PR。
5. Task 5：记录 raw HTML code mode 不做权限限制的决策。
6. Task 6：保留 SVG 默认支持，并视需要强化服务端责任说明。
7. Task 7：抽取共享 option validation，作为低风险维护性改进。
8. Task 8：后续按触达区域拆分测试，避免纯重排造成 review 噪音。

## 7. 暂不建议处理的事项

- 不建议大规模拆分 `MoongladeEditor` 或重写 toolbar 架构；当前模块职责基本符合 AGENTS，主要问题可以小步修复。
- 不建议替换 ProseMirror、CodeMirror 或 Prettier；现有需求和测试都围绕这些库建立。
- 不建议盲目升级依赖；本轮未查询安全公告，也没有发现必须通过升级解决的问题。
- 不建议把 raw HTML code mode 改成 sanitizer-backed rich HTML mode，也不建议新增 raw HTML mode 权限限制；维护者已确认不做该限制。
- 不建议仅为本地 `demo/` 增加复杂 CSP/SRI 工作；既有记忆记录 `demo/index.html` 不公开部署。
- 不建议在本仓实现服务端级别 SVG 内容净化或禁用 SVG 默认支持；维护者已确认允许上传 SVG，前端只能做初筛，真正安全边界在上传服务和静态文件响应策略。

## 8. 当前未确认问题

暂无。

已确认的长期上下文（来自既有记忆和 AGENTS）：

- `dist/` 是生成物，日常开发不应手工编辑或提交。
- Moonglade 主仓应消费预构建静态资源，不应新增前端构建流水线。
- Markdown 图片上传 URL 策略应与富文本图片 URL 策略保持一致。
- Markdown 图片默认允许扩展名应与富文本默认值保持一致。
- CodeMirror 公共模式允许引入短 debounce。
- `demo/index.html` 不会公开部署。
- README 中缺失的旧续接文档引用应删除，而不是重新创建。
- CI 测试覆盖应包含 PR / main 分支，不仅限 `release` 分支。
- Raw HTML code mode 不需要新增“仅受信任管理员”限制。
- `.svg` 默认允许上传应保留。
- Task 1 已完成：富文本图片选择阶段应继续复用 `hasAllowedImageUploadExtension(...)`，不要恢复为任意 `image/*` 先选中再上传前拒绝。
- Task 3 已完成：README 当前记录的是现有同步行为；Task 2 改变 code-like modes 同步时序后需要再次更新 README。
- Task 4 已完成：workflow 应继续在 build 前运行 `npm test`，并覆盖 `main` / `release` push 和 pull request。

## 9. 执行记录

| 日期 | 任务 | 改动 | 验证 | 结果 |
|---|---|---|---|---|
| 2026-07-30 | Task 1：修正富文本图片选择的 allowlist 边界 | `src/toolbar/image-files.ts` 改为选择阶段只接受 `hasAllowedImageUploadExtension(...)` 通过的文件；`test/editor.test.ts` 更新默认 GIF 行为测试并新增多文件顺序测试。 | `npm test -- test/editor.test.ts`；`npm test`；`npm run build`。 | 通过。完整测试 6 个测试文件、115 个用例通过；构建和 size budget 通过。 |
| 2026-07-30 | Task 3：同步 README 的同步语义和续接文档引用 | `README.md` 删除不存在的续接文档引用，改为 `AGENTS.md` 和 `docs/ai-review-plan.md`；补充 rich HTML / code-like modes 当前同步语义。 | Markdown diff review。 | 完成。 |
| 2026-07-30 | Task 4：让 CI 覆盖单元测试 | `.github/workflows/build.yml` 增加 `main` push、`pull_request` 触发，并在 build 前运行 `npm test`。 | Workflow diff review；等待合并后 GitHub Actions 验证。 | 完成。 |

## 10. 后续执行注意事项

- 本轮只完成分析和计划。后续执行任何代码、配置、测试或依赖修改前，应按任务独立处理。
- 不要编辑 `dist/`；需要验证 release 产物时运行构建，但不要手工改生成文件。
- 涉及同步时序的改动必须保留 `getHTML()` / `getValue()` 的立即读取语义，并清楚区分自动通知与显式 `syncToTextarea()`。
- 涉及上传的改动必须同时考虑富文本和 Markdown 模式，避免两个上传入口规则漂移。
- 涉及 raw HTML 和 SVG 的安全建议必须先确认主 Moonglade 的权限、上传和渲染策略，不要把未确认推测当成漏洞事实。
- 每个任务应单独提交、单独验证、可独立回滚。
