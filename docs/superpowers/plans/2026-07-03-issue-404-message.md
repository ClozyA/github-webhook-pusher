# Issue/PR 404 提示优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** GitHub Issue/PR 页面返回 HTTP 404 时，向用户说明资源不存在或当前无法访问，而不是建议稍后重试。

**架构：** 保留现有 `screenshotIssue` 的异常传播与中间件消息包装，仅在 HTTP 状态检查处增加 404 专用分支。其他 4xx/5xx 继续进入原通用分支，避免改变既有错误语义。

**技术栈：** TypeScript、Vitest、Koishi Puppeteer 页面接口

---

## 文件结构

- 修改 `tests/issue-lookup.test.ts`：增加 HTTP 404 回归测试，并保留非 404 错误行为验证。
- 修改 `src/commands/issue-lookup.ts`：在通用 HTTP 错误处理前增加 404 专用提示。

### 任务 1：添加 HTTP 404 回归测试并实施最小修复

**文件：**
- 修改：`tests/issue-lookup.test.ts`
- 修改：`src/commands/issue-lookup.ts`

- [x] **步骤 1：编写失败的测试**

在 `describe('screenshotIssue')` 中新增测试：

```ts
it('reports a missing or inaccessible issue for HTTP 404', async () => {
  const screenshot = vi.fn()
  const close = vi.fn()
  const page = {
    setViewport: vi.fn(),
    goto: vi.fn().mockResolvedValue({status: () => 404}),
    waitForSelector: vi.fn(),
    evaluate: vi.fn(),
    screenshot,
    close,
  }
  const ctx = {puppeteer: {page: vi.fn().mockResolvedValue(page)}}

  await expect(screenshotIssue(ctx as any, 'AUTO-MAS-Project/AUTO-MAS', 999, config))
    .rejects
    .toThrow('该 Issue 或 PR 不存在，或当前无法访问。')
  expect(screenshot).not.toHaveBeenCalled()
  expect(close).toHaveBeenCalledOnce()
})
```

- [x] **步骤 2：运行测试验证正确失败**

运行：`npm test -- tests/issue-lookup.test.ts`

预期：新增测试 FAIL；实际错误仍为 `页面加载失败: HTTP 404。此问题通常是暂时性的，请稍后重试。`。

- [x] **步骤 3：编写最少实现代码**

在读取 `response.status()` 后、通用 `status >= 400` 分支前加入：

```ts
if (status === 404) {
  throw new Error('该 Issue 或 PR 不存在，或当前无法访问。')
}
```

- [x] **步骤 4：运行目标测试验证通过**

运行：`npm test -- tests/issue-lookup.test.ts`

预期：该测试文件全部 PASS，HTTP 504 测试仍通过。

- [x] **步骤 5：运行完整验证**

运行：`npm test`

预期：所有测试 PASS。

运行：`npm run build`

预期：TypeScript 编译成功且退出码为 0。

- [x] **步骤 6：提交修复**

```bash
git add tests/issue-lookup.test.ts src/commands/issue-lookup.ts docs/superpowers/plans/2026-07-03-issue-404-message.md
git commit -m "fix: clarify missing Issue and PR errors"
```
