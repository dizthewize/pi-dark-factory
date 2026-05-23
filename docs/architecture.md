# Pi Ecosystem Architecture

The full agent mesh system consists of 5 extensions working together:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         pi-dark-factory (Foreman)                           │
│                                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Queue   │  │  Plan    │  │ Dispatch │  │ Review   │  │  Ledger  │     │
│  │          │  │          │  │          │  │          │  │          │     │
│  │ TASK-001 │→ │ spec.md  │→ │ execute  │→ │ gate     │→ │ $0.06    │     │
│  │ TASK-002 │  │          │  │ workflow │  │ pass/fail│  │ cycle 3  │     │
│  │ TASK-003 │  │          │  │          │  │          │  │          │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│         ↑                                          ↓                        │
│         └────────── MESH MESSAGES ←───────────────┘                        │
│                                                                             │
│  Triggers: /factory start  |  cron  |  GitHub labels  |  mesh TASK: msg   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            pi-mesh (Factory Floor)                          │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  Agent Board │    │  Task Board  │    │  Message Bus │                  │
│  │              │    │              │    │              │                  │
│  │ ● swift-fox  │    │ 🔴 TASK-001  │    │ → [swift-fox]                │
│  │   working    │    │    claimed   │    │    started auth-types          │
│  │              │    │              │    │                              │  │
│  │ ● calm-owl   │    │ 🟡 TASK-002  │    │ ✦ [broadcast]                │
│  │   idle       │    │    open      │    │    Standup: 3 active         │
│  │              │    │              │    │                              │  │
│  │ ○ bold-hawk  │    │ ⚪ TASK-003  │    │ ⚡ [challenge]               │
│  │   stale      │    │    done      │    │    File conflict detected    │
│  └──────────────┘    └──────────────┘    └──────────────┘                  │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐                                      │
│  │ Reservations │    │  Contracts   │                                      │
│  │              │    │              │                                      │
│  │ swift-fox →  │    │ auth-types   │                                      │
│  │   types.ts   │    │   v1.2       │                                      │
│  │   auth.ts    │    │              │                                      │
│  │              │    │ service-int  │                                      │
│  │ calm-owl →   │    │   v1.0       │                                      │
│  │   handlers.ts│    │              │                                      │
│  └──────────────┘    └──────────────┘                                      │
│                                                                             │
│  Commands: /mesh join  |  /mesh claim  |  /mesh reserve  |  /mesh status  │
│  Widget: auto-shows when agents working (2s poll, 5m idle dismiss)          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         pi-workflows (Assembly Line)                        │
│                                                                             │
│  Wave 1 (parallel):                      Wave 2 (after deps resolve):        │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   ┌─────────┐ ┌─────────┐            │
│  │ worker-1│ │ worker-2│ │ worker-3│   │ worker-1│ │ worker-2│            │
│  │         │ │         │ │         │   │         │ │         │            │
│  │ types.ts│ │ service ││ midware │   │  tests  │ │  docs   │            │
│  │   ●    │ │   ●    │ │   ○    │   │   ●    │ │   ○    │            │
│  │  45s   │ │  38s   │ │ waiting │   │  12s   │ │ waiting │            │
│  └─────────┘ └─────────┘ └─────────┘   └─────────┘ └─────────┘            │
│                                                                             │
│  TUI Widget: auto-shows during execution, live timer, cost tracking       │
│                                                                             │
│  execute_workflow({ name: "auth-refactor", tasks: [...], options: {...} })  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Extension Roles

| Extension | Role | When Active |
|-----------|------|-------------|
| **pi-dark-factory** | Orchestrator | Always running in continuous mode |
| **pi-mesh** | Coordination layer | Always on — agents come and go |
| **pi-workflows** | Parallel execution | During planned task waves |
| **pi-agent-roles** | Skill dispatch | Per-task role delegation |
| **pi-review** | Quality gate | After code-producing tasks |

## Data Flow

### Factory → Mesh
- `pi_mesh({ action: "claim" })` — factory creates mesh tasks
- `pi_mesh({ action: "broadcast" })` — notify agents of new work
- `pi_mesh({ action: "project_state_set" })` — persist cross-extension state

### Factory → Workflows
- `execute_workflow({ name, tasks, plan, options })` — run planned work
- Reads result artifacts back into factory state

### Workflows → Mesh
- Workers join mesh as agents while executing
- File reservations via `pi_mesh({ action: "reserve" })`
- Progress broadcasts via `pi_mesh({ action: "broadcast" })`

### Mesh → Factory
- Mesh inbox scanner finds `TASK:` messages → converts to factory queue items
- Contract signals (`contract_provide` / `contract_need`) coordinate cross-component work

## Trigger Sources

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   GitHub    │   │    File     │   │    Mesh     │   │   Manual    │
│   Issues    │   │   Watcher   │   │   Inbox     │   │   Add       │
│             │   │             │   │             │   │             │
│ label:      │   │ queue.      │   │ TASK: msg   │   │ pi_factory  │
│ pi-factory   │→  │ manual.json │→  │ from agent  │→  │ queue_add   │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
         │                │                │                │
         └────────────────┴────────────────┴────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Factory Queue  │
                    └─────────────────┘
```

## Dashboard Visibility

| View | Extension | Trigger | Content |
|------|-----------|---------|---------|
| **Widget** | pi-workflows | Auto during `execute_workflow` | Wave progress, agent timers, costs |
| **Widget** | pi-mesh | Auto when agents working | Peer list, claimed tasks, file locks |
| **Dashboard** | pi-workflows | `/workflows dashboard` | Full agent table, event log, scrollable |
| **Dashboard** | pi-mesh | `/mesh status` | All agents, tasks, reservations, messages |
| **Dashboard** | pi-dark-factory | `/factory status` | Queue, current task, blocked, ledger |
