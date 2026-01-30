# koishi-plugin-github-webhook-pusher

[![npm](https://img.shields.io/npm/v/koishi-plugin-github-webhook-pusher?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-github-webhook-pusher)

Koishi 机器人框架的 GitHub Webhook 推送插件，支持将 GitHub 仓库事件推送到 QQ 群聊或私聊。

## 功能特性

- 🔐 **安全验证** - 支持 HMAC SHA256 签名验证，确保 Webhook 请求来源可信
- 📋 **信任仓库管理** - 管理员可控制哪些仓库的事件可以被处理
- 🔔 **灵活订阅** - 用户可自由订阅感兴趣的仓库和事件类型
- 📨 **多事件支持** - 支持 Issues、Issue Comment、Pull Request、Review、Release、Push、Star、Fork 等常用事件
- 🚀 **并发推送** - 支持并发推送到多个订阅目标，可配置并发数
- 💾 **数据持久化** - 订阅和信任仓库数据持久化存储

## 安装

### 通过 Koishi 插件市场安装

在 Koishi 控制台的插件市场中搜索 `github-webhook-pusher` 并安装。

### 通过 npm 安装

```bash
npm install koishi-plugin-github-webhook-pusher
```

## 配置说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `path` | string | `/github/webhook` | Webhook 接收路径 |
| `secret` | string | (必填) | GitHub Webhook Secret，用于签名验证 |
| `defaultEvents` | string[] | `['issues', 'release', 'push']` | 新订阅的默认事件类型 |
| `debug` | boolean | `false` | 启用调试模式，输出详细日志 |
| `allowUntrusted` | boolean | `false` | 是否允许处理非信任仓库的事件 |
| `concurrency` | number | `5` | 消息推送并发数 |
| `deliveryRetentionDays` | number | `30` | 投递记录保留天数（<=0 表示不清理） |
| `deliveryCleanupIntervalHours` | number | `24` | 投递记录清理间隔（小时） |

### 配置示例

```yaml
plugins:
  github-webhook-pusher:
    path: /github/webhook
    secret: your-webhook-secret-here
    defaultEvents:
      - issues
      - release
      - push
    debug: false
    allowUntrusted: false
    concurrency: 5
    deliveryRetentionDays: 30
    deliveryCleanupIntervalHours: 24
```

## GitHub Webhook 设置指南

### 1. 获取 Webhook URL

你的 Webhook URL 格式为：
```
https://your-koishi-server.com/github/webhook
```

其中 `/github/webhook` 是默认路径，可通过 `path` 配置项修改。

### 2. 在 GitHub 仓库中配置 Webhook

1. 进入你的 GitHub 仓库
2. 点击 **Settings** → **Webhooks** → **Add webhook**
3. 填写以下信息：
   - **Payload URL**: 你的 Webhook URL
   - **Content type**: `application/json`
   - **Secret**: 与插件配置中的 `secret` 保持一致
   - **Which events would you like to trigger this webhook?**: 选择需要的事件
     - Issues
     - Issue comments
     - Pull requests
     - Pull request reviews
     - Pull request review comments
     - Releases
     - Pushes
     - Stars (Watch)
     - Forks
     - Create
     - Delete
     - Workflow runs
4. 点击 **Add webhook** 保存

### 3. 验证配置

配置完成后，GitHub 会发送一个 ping 事件。你可以在 Webhook 设置页面查看投递记录，确认是否收到 200 响应。


## 命令使用说明

### 信任仓库管理（管理员）

信任仓库是可以被订阅的仓库白名单，只有管理员可以管理。

| 命令 | 说明 | 示例 |
|------|------|------|
| `gh.trust.add <repo>` | 添加信任仓库 | `gh.trust.add koishijs/koishi` |
| `gh.trust.remove <repo>` | 移除信任仓库 | `gh.trust.remove koishijs/koishi` |
| `gh.trust.list` | 列出所有信任仓库 | `gh.trust.list` |
| `gh.trust.enable <repo>` | 启用信任仓库 | `gh.trust.enable koishijs/koishi` |
| `gh.trust.disable <repo>` | 禁用信任仓库 | `gh.trust.disable koishijs/koishi` |

### 订阅管理

用户可以订阅信任列表中的仓库，接收事件通知。

| 命令 | 说明 | 示例 |
|------|------|------|
| `gh.sub <repo>` | 订阅仓库 | `gh.sub koishijs/koishi` |
| `gh.unsub <repo>` | 取消订阅 | `gh.unsub koishijs/koishi` |
| `gh.list` | 列出当前会话的所有订阅 | `gh.list` |
| `gh.events [repo]` | 查看订阅的事件类型（无 repo 时列出所有可用事件） | `gh.events koishijs/koishi` |
| `gh.on <repo> [...events]` | 快捷启用订阅事件 | `gh.on koishijs/koishi issues pull_request` |
| `gh.off <repo> [...events]` | 快捷禁用订阅事件 | `gh.off koishijs/koishi issues pull_request` |

### 工具命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `gh.ping` | 查看插件状态 | `gh.ping` |
| `gh.test <repo> <event>` | 生成测试消息（管理员） | `gh.test koishijs/koishi push` |

## 支持的事件类型

| 事件类型 | 显示名称 | Emoji | 说明 |
|----------|----------|-------|------|
| `issues` | Issue | 📌 | Issue 的创建、关闭、重新打开、编辑 |
| `issue_comment` | Issue Comment | 💬 | Issue 评论的创建、编辑、删除 |
| `pull_request` | PR | 🔀 | Pull Request 的创建、关闭、合并 |
| `pull_request_review` | PR Review | 🧪 | PR Review 的提交、编辑、撤销 |
| `pull_request_review_comment` | PR Review Comment | 💬 | PR Review 评论的创建、编辑、删除 |
| `release` | Release | 🚀 | 版本发布 |
| `push` | Commit | ⬆️ | 代码推送（最多显示 3 条提交） |
| `star` | Star | ⭐ | Star 操作 |
| `fork` | Fork | 🍴 | Fork 操作 |
| `create` | Create | ✨ | 分支/标签创建 |
| `delete` | Delete | 🗑️ | 分支/标签删除 |
| `workflow_run` | Workflow | 🧩 | Workflow 运行 |

## 消息格式示例

### Issues 事件
```
📌 [owner/repo] Issue
user opened #123: Issue 标题
https://github.com/owner/repo/issues/123
```

### Push 事件
```
⬆️ [owner/repo] Commit
user 推送了 3 个提交到 main

• abc1234 - 提交消息1
• def5678 - 提交消息2
• ghi9012 - 提交消息3

https://github.com/owner/repo/compare/...
```

### Release 事件
```
🚀 [owner/repo] Release
user 发布了 v1.0.0
https://github.com/owner/repo/releases/tag/v1.0.0
```

## 常见问题解答

### Q: Webhook 返回 401 错误？

**A:** 签名验证失败。请检查：
1. GitHub Webhook 设置中的 Secret 与插件配置的 `secret` 是否一致
2. Content type 是否设置为 `application/json`
3. 如果服务器未保留 raw body，插件会使用解析后的 body 回退验签，可能导致签名不一致；建议配置保留原始请求体

### Q: 收不到 Webhook 事件？

**A:** 请检查：
1. Koishi 服务器是否可以从公网访问
2. Webhook URL 是否正确（包括端口号）
3. 防火墙是否允许 GitHub 的 IP 访问
4. 在 GitHub Webhook 设置页面查看投递记录，确认请求是否发送成功

### Q: 订阅仓库时提示"不在信任列表中"？

**A:** 需要管理员先使用 `gh.trust.add owner/repo` 将仓库添加到信任列表。

### Q: 如何修改订阅的事件类型？

**A:** 使用 `gh.on` / `gh.off` 命令：
- 启用事件：`gh.on owner/repo issues release`
- 禁用事件：`gh.off owner/repo star push`

### Q: 如何查看当前订阅了哪些仓库？

**A:** 使用 `gh.list` 命令查看当前会话的所有订阅。

### Q: 消息推送失败会影响其他订阅者吗？

**A:** 不会。插件使用错误隔离机制，单个目标的推送失败不会影响其他目标。

### Q: 如何测试消息格式？

**A:** 管理员可以使用 `gh.test owner/repo event` 命令生成测试消息，例如：
```
gh.test koishijs/koishi issues
gh.test koishijs/koishi push
```

## 依赖

- Koishi 4.x
- 需要 `server` 服务（提供 HTTP 路由）
- 需要 `database` 服务（数据持久化）

## 许可证

MIT License
