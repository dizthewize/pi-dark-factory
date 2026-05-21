# pi-dark-factory

Self-managing orchestrator for Pi. Reads task queues, plans workflows, dispatches agents, and loops autonomously — with graceful degradation when optional extensions are missing.

## Install

```bash
pi package add pi-dark-factory
```

**Optional dependencies:** `pi-workflows`, `pi-mesh`, `pi-agent-roles`. The factory works standalone but does more with them.

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Cycle** | One pass: pick task → plan → execute → review → update state |
| **Queue** | Task backlog from manual adds, files, GitHub, or mesh |
| **Ledger** | Append-only history of every cycle action |
| **Trigger** | What kickstarts work (oneshot, continuous, file, mesh, GitHub) |

## Trigger Modes

### One-Shot (CI / Cron)

Run a fixed number of cycles then exit. Perfect for cron, GitHub Actions, systemd timers.

```bash
# CLI
pi -p --no-session "pi_factory({ action: 'oneshot', maxCycles: 5, costLimit: 20 })"

# Cron tab
0 */4 * * * cd ~/projects/my-app && pi -p --no-session "pi_factory({ action: 'oneshot', maxCycles: 5 })"
```

### Continuous (Session)

Loop every 30s until paused or stopped. Watches file queue and mesh inbox.

```typescript
pi_factory({ action: "start", costLimit: 50 })
// → loops: pick → plan → execute → sleep → repeat
pi_factory({ action: "pause" })   // graceful pause
pi_factory({ action: "resume" })  // resume from paused
pi_factory({ action: "stop" })    // stop immediately
```

### File Watcher

Write tasks to `~/.pi/agent/factory/queue.manual.json`:

```json
{
  "append": [
    { "title": "Add OAuth", "description": "Google + GitHub", "priority": "high" }
  ]
}
```

The factory reads, clears, and processes.

### GitHub Issues

Label issues `pi-factory`. Configure in `~/.pi/agent/factory/github-config.json`:

```json
{ "repo": "my-org/my-app", "label": "pi-factory", "token": "ghp_..." }
```

Factory polls every cycle and converts issues to tasks.

### Mesh Inbox

Send tasks from mesh agents:

```typescript
pi_mesh({ action: "send", to: "dark-factory", message: "TASK: Add dark mode" })
```

## Quick Start

```typescript
// 1. Add tasks manually
pi_factory({ action: "queue_add", title: "Add auth", description: "JWT auth flow", priority: "high" })

// 2. Run one cycle
pi_factory({ action: "oneshot", maxCycles: 1, costLimit: 15 })

// 3. Start continuous with file watcher
pi_factory({ action: "start", costLimit: 50 })
// → write to queue.manual.json → auto-detected

// 4. Check status
pi_factory({ action: "status" })
```

## All Actions

| Action | Required | Description |
|--------|----------|-------------|
| `oneshot` | `maxCycles`, `costLimit` | Run N cycles, exit |
| `start` | `costLimit` | Begin continuous loop with file watcher |
| `pause` | — | Pause after current cycle, stop watcher |
| `resume` | — | Resume from paused |
| `stop` | — | Immediate stop, clear watcher |
| `status` | — | Show dashboard state |
| `queue_add` | `title`, `description` | Add task to queue |
| `queue_list` | — | Show pending tasks |
| `queue_remove` | `taskId` | Remove from queue |
| `inspect` | `taskId` | Show task details |
| `retry` | `taskId` | Retry a failed task |

## Error Recovery

| Failure | Recovery |
|---------|----------|
| Planning fails | Block task, log reason |
| Executor fails (1st) | Auto-retry same task |
| Executor fails (2nd) | Retry with reviewer role |
| Executor fails (3rd) | Mark failed, human retry |
| Cost limit reached | Graceful stop, finish current |
| Extension unavailable | Fallback to built-in behavior |

## Storage

```
~/.pi/agent/factory/
├── state.json           # Factory state + ledger
├── queue.manual.json    # File watcher input
├── github-config.json   # GitHub source config
├── FACT-001-prd.md     # Per-task PRD
├── FACT-001-spec.md    # Generated TASK-XX spec
└── cron.log            # Optional cron output
```

## Command

```
/factory  # Show status dashboard
```

## Integration Guides

- [Cron / GitHub Actions / Systemd](cron-examples.md)

## Inter-Extension Bridges

The factory auto-detects loaded extensions and communicates via EventBus:

| Extension | Used For | Fallback |
|-----------|----------|----------|
| `pi-workflows` | Planning (`plan_workflow`) + Execution (`execute_workflow`) | Local tool calls |
| `pi-agent-roles` | Planner role for spec generation; Reviewer role for retry | Built-in prompt assembly |
| `pi-mesh` | Project state sync; Contract registration; Broadcast status | Local file log |

Bridges are created via `createFactoryBridges(api)` which checks `pi.getAllTools()` for available extensions, then wires EventBus request/response channels.
