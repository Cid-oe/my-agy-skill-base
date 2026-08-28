---
name: bus-messaging
description: Sprout can run child agents in separate processes coordinated by a WebSocket
kind: local
model: inherit
agy:
  version: 1.0.0
  category: ai
  tags: []
  compatibility:
    status: requires-manual-conversion
    score: 50
    notes: No frontmatter/metadata detected; prompt extracted from raw text.
  validation: passed
  imported: '2026-08-26T09:10:40+00:00'
  sources:
  - repo: prime-radiant-inc/sprout
    author: prime-radiant-inc
    license: ''
    url: https://github.com/prime-radiant-inc/sprout
    path: root/agents/quartermaster/resources/sprout-architecture/bus-messaging.md
    format: markdown-frontmatter
---

# Bus Messaging

Sprout can run child agents in separate processes coordinated by a WebSocket
bus. This keeps long-running or async subagents isolated while preserving one
session-wide event stream.

## Components

Bus server: local WebSocket pub/sub server.

Bus client: connects runtime processes to the server.

Spawner: starts or coordinates agent processes, tracks handles, and supports
blocking, non-blocking, and shared-agent workflows.

Agent process: receives a start message, constructs an agent, runs it, and sends
events/results back over the bus.

Source of truth:
- `src/bus/server.ts`
- `src/bus/client.ts`
- `src/bus/spawner.ts`
- `src/bus/agent-process.ts`
- `src/bus/types.ts`

## Why WebSocket

The bus is bidirectional. The host sends commands down to child processes and
receives events/results back. WebSocket fits this better than one-way SSE.

The server binds locally on a runtime-selected port. The CLI starts bus
infrastructure before constructing the session runtime.

Source of truth:
- `src/host/cli-shared.ts:startBusInfrastructure()`

## Session-Wide Events

The session controller subscribes once to session events and relays child
process events to the UI bus. This avoids per-child subscriptions and lets the
TUI/web client show a single event stream.

Source of truth:
- `src/host/session-controller.ts`
- `src/bus/spawner.ts:subscribeSessionEvents()`

## Handles

Non-blocking delegates return handles. The caller can wait for a handle or send
messages to a shared handle. Resume can pre-register completed handles from
previous logs so an agent can continue without rerunning completed work.

Source of truth:
- `src/bus/resume.ts`
- `src/host/cli-resume.ts`
- `src/agents/plan.ts:buildWaitAgentTool()` and `buildMessageAgentTool()`

## Memory Surface Propagation

Child agents receive the root surfaced memory block so repeated subagents do not
each redo recall. Archivist is intentionally excluded so it investigates memory
from a clean context.

Source of truth:
- `src/agents/agent.ts:childSurfacedMemoryBlock()`
- `src/bus/types.ts`
- `src/bus/agent-process.ts`
