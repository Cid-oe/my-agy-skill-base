---
name: am-delegate
description: '|'
kind: local
model: inherit
agy:
  version: 1.0.0
  category: ai
  tags: []
  compatibility:
    status: fully-compatible
    score: 100
    notes: Converted directly; no manual steps required.
  validation: passed
  imported: '2026-08-26T09:07:01+00:00'
  sources:
  - repo: AgentsMesh/AgentsMesh
    author: AgentsMesh
    license: NOASSERTION
    url: https://github.com/AgentsMesh/AgentsMesh
    path: backend/internal/service/agent/builtin_skills/am-delegate.md
    format: markdown-frontmatter
---

# 任务委派协议

你可以通过 MCP 工具将任务委派给其他 Agent Pod。

## 可用工具

- `list_available_pods` - 列出可用的 Pod
- `create_pod` - 创建新的 Agent Pod
- `bind_pod` - 绑定到目标 Pod（获取终端权限）
- `send_pod_input` - 向 Pod 发送输入（文本和/或特殊键）
- `send_channel_message` - 通过 Channel 发送消息
- `list_loops` - 列出组织中的自动化 Loop
- `trigger_loop` - 手动触发 Loop 运行

## 委派流程

### 1. 检查现有 Pod

首先检查是否有自己创建的空闲 Pod 可以复用：

```
list_available_pods()
```

如果有空闲 Pod 且适合当前任务，直接复用；否则创建新 Pod。

### 2. 创建新 Pod（如需要）

```
create_pod(
  prompt="你是负责 [具体职责] 的 Agent...",
  ticket_id=123  // 可选，关联到 Ticket
)
```

创建后会自动获得对新 Pod 的绑定权限。

### 3. 分配任务

方式一：通过终端直接发送指令
```
send_pod_input(
  pod_key="target-pod-key",
  text="请实现用户登录功能，完成后通过 Channel 通知我"
)
```

方式二：通过 Channel 分配（推荐用于异步任务）
```
send_channel_message(
  channel_id=456,
  content="@target-pod 请实现用户登录功能"
)
```

### 4. 建立通信

确保与目标 Pod 有共同的 Channel 用于后续沟通：
- 告知目标 Pod 完成后通过 Channel 汇报
- 指定使用哪个 Channel 进行沟通

## 注意事项

- 优先创建新 Pod，除非自己创建的 Pod 正在空闲
- 委派时说明清楚任务目标和完成标准
- 指定通信方式（Channel）以便接收完成通知
