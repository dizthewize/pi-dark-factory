/**
 * Pi Dark Factory Extension
 *
 * Self-managing orchestrator. Reads task queues, plans workflows,
 * dispatches agents, and loops autonomously.
 *
 * Triggers:
 *  - One-shot:   pi -p --no-session "pi_factory({ action: 'oneshot' })"
 *  - Continuous: /factory start (session mode with file watcher)
 *  - Cron:       External scheduler calls one-shot
 *  - File:       Write to ~/.pi/agent/factory/queue.manual.json
 *  - Mesh:       Send DM with "TASK: description"
 *  - GitHub:     Label issues 'pi-factory', factory polls them
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { FactoryTask, FactoryAction, PiFactoryParams, PiFactoryResult, FactoryMode, TaskSource } from "../types.js";
import { StateStore } from "../factory/state.js";
import { runOneCycle, CycleDeps } from "../factory/cycle.js";
import { addTask, pickNextTask } from "../factory/queue.js";
import { startFileWatcher, pollManualQueue } from "../factory/watcher.js";
import { pollGitHubIssues } from "../factory/github-source.js";
import { scanMeshInbox } from "../factory/mesh-inbox.js";
import { createFactoryBridges, bridgesToCycleDeps } from "../factory/bridges.js";

const FACTORY_DIR = path.join(os.homedir(), ".pi", "agent", "factory");
const GITHUB_CONFIG_PATH = path.join(FACTORY_DIR, "github-config.json");

const FactoryActionEnum = Type.String({
  description:
    "Action: oneshot, start, pause, resume, stop, status, queue_add, queue_list, queue_remove, inspect, retry",
});

const PiFactorySchema = Type.Object({
  action: FactoryActionEnum,
  maxCycles: Type.Optional(Type.Number()),
  costLimit: Type.Optional(Type.Number()),
  mode: Type.Optional(Type.String({ enum: ["oneshot", "continuous", "cron"] })),
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  priority: Type.Optional(Type.String({ enum: ["critical", "high", "medium", "low"] })),
  source: Type.Optional(Type.String({ enum: ["github-issue", "manual", "mesh", "file"] })),
  taskId: Type.Optional(Type.String()),
  data: Type.Optional(Type.Any()),
});

type PiFactoryType = Static<typeof PiFactorySchema>;

export default function piDarkFactoryExtension(pi: ExtensionAPI) {
  const stateStore = new StateStore({ factoryDir: FACTORY_DIR });
  let isRunning = false;
  let fileWatcher: { stop: () => void } | null = null;

  function makeDeps(ctx: ExtensionContext): CycleDeps {
    const bridges = createFactoryBridges(pi);
    return {
      stateStore,
      factoryDir: FACTORY_DIR,
      cwd: ctx.cwd ?? process.cwd(),
      ...bridgesToCycleDeps(bridges),
    };
  }

  // ── Trigger: File Watcher ──
  function startFileWatch(ctx: ExtensionContext) {
    if (fileWatcher) return;
    fileWatcher = startFileWatcher(FACTORY_DIR, (tasks) => {
      const state = stateStore.load();
      for (const t of tasks) {
        state.queue.push(t);
      }
      stateStore.save(state);
      // Notify
      if ((ctx as any).ui?.notify) {
        (ctx as any).ui.notify(`${tasks.length} tasks added from file watcher`, "info");
      }
    }, 5000);
  }

  function stopFileWatch() {
    if (fileWatcher) {
      fileWatcher.stop();
      fileWatcher = null;
    }
  }

  // ── Trigger: GitHub Source ──
  async function ingestGitHubTasks(): Promise<number> {
    try {
      if (!fs.existsSync(GITHUB_CONFIG_PATH)) return 0;
      const config = JSON.parse(fs.readFileSync(GITHUB_CONFIG_PATH, "utf-8")) as {
        repo: string;
        label: string;
        token?: string;
      };
      if (!config.repo || !config.label) return 0;

      const state = stateStore.load();
      const knownIds = new Set([
        ...state.queue.map((t) => t.id),
        ...state.completed.map((t) => t.id),
        ...state.failed.map((t) => t.id),
        ...state.blocked.map((t) => t.id),
      ]);

      const tasks = await pollGitHubIssues(config, knownIds);
      for (const t of tasks) {
        state.queue.push(t);
      }
      stateStore.save(state);
      return tasks.length;
    } catch {
      return 0;
    }
  }

  // ── Trigger: Mesh Inbox ──
  async function ingestMeshInbox(): Promise<number> {
    try {
      const inboxDir = path.join(os.homedir(), ".pi", "agent", "mesh", "inbox");
      if (!fs.existsSync(inboxDir)) return 0;

      const files = fs.readdirSync(inboxDir).filter((f) => f.endsWith(".json"));
      const messages = files
        .map((f) => {
          try {
            return JSON.parse(fs.readFileSync(path.join(inboxDir, f), "utf-8"));
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      const state = stateStore.load();
      const knownIds = new Set([
        ...state.queue.map((t) => t.id),
        ...state.completed.map((t) => t.id),
        ...state.failed.map((t) => t.id),
        ...state.blocked.map((t) => t.id),
      ]);

      const tasks = scanMeshInbox(messages, knownIds);
      for (const t of tasks) {
        state.queue.push(t);
      }
      stateStore.save(state);
      return tasks.length;
    } catch {
      return 0;
    }
  }

  // ── Core Loop ──
  async function runContinuous(ctx: ExtensionContext) {
    if (isRunning) return;
    isRunning = true;
    const deps = makeDeps(ctx);

    while (isRunning) {
      const state = stateStore.load();
      if (state.status === "paused" || state.status === "complete" || state.status === "cost_exceeded") {
        break;
      }

      // ── Pre-cycle: ingest from triggers ──
      // File watcher auto-ingests via callback. Also do a manual poll here.
      const fileTasks = pollManualQueue(FACTORY_DIR);
      if (fileTasks && fileTasks.length > 0) {
        for (const t of fileTasks) state.queue.push(t);
      }

      // GitHub source
      const ghCount = await ingestGitHubTasks();
      if (ghCount > 0) {
        // no-op; tasks added to queue
      }

      // Mesh inbox
      const meshCount = await ingestMeshInbox();
      if (meshCount > 0) {
        // no-op; tasks added to queue
      }

      // Save if tasks were added
      if ((fileTasks?.length ?? 0) + ghCount + meshCount > 0) {
        stateStore.save(state);
      }

      // ── Execute cycle ──
      const { didWork } = await runOneCycle(deps);
      if (!didWork) break;

      // Wait between cycles
      await new Promise((r) => setTimeout(r, 30000));
    }

    isRunning = false;
  }

  pi.registerTool({
    name: "pi_factory",
    label: "Pi Dark Factory",
    description: `Self-managing orchestrator for autonomous agent execution.

Usage:
  pi_factory({ action: "oneshot", maxCycles: 1, costLimit: 20 })
  pi_factory({ action: "start", costLimit: 50, mode: "continuous" })
  pi_factory({ action: "pause" })
  pi_factory({ action: "resume" })
  pi_factory({ action: "stop" })
  pi_factory({ action: "status" })
  pi_factory({ action: "queue_add", title: "Add auth", description: "...", priority: "high" })
  pi_factory({ action: "queue_list" })
  pi_factory({ action: "queue_remove", taskId: "FACT-001" })
  pi_factory({ action: "inspect", taskId: "FACT-001" })
  pi_factory({ action: "retry", taskId: "FACT-001" })`,
    parameters: PiFactorySchema,

    async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
      const params = rawParams as PiFactoryType;
      const result = await handleFactoryAction(params, ctx, {
        stateStore,
        runContinuous: () => runContinuous(ctx),
        isRunning: () => isRunning,
        stopRunning: () => { isRunning = false; },
        makeDeps: () => makeDeps(ctx),
        startFileWatch: () => startFileWatch(ctx),
        stopFileWatch,
      });
      return {
        content: [{ type: "text", text: result.message ?? JSON.stringify(result.data, null, 2) }],
        details: result,
      };
    },
  });

  pi.registerCommand("factory", {
    description: "Open dark factory dashboard",
    handler: async (_args, ctx) => {
      const state = stateStore.load();
      const next = pickNextTask(state.queue);
      const watcherStatus = fileWatcher ? "ON" : "OFF";
      const msg = `Factory: ${state.status} | cycle ${state.cycle} | cost $${state.totalCost.toFixed(2)} / $${state.costLimit} | queue ${state.queue.length} | done ${state.completed.length} | blocked ${state.blocked.length} | watcher ${watcherStatus}`;
      ctx.ui.notify(msg, "info");
    },
  });

  pi.on("session_shutdown", async () => {
    if (isRunning) {
      isRunning = false;
      stopFileWatch();
      const state = stateStore.load();
      if (state.status === "working") {
        state.status = "paused";
        stateStore.save(state);
      }
    }
  });
}

interface FactoryDeps {
  stateStore: StateStore;
  runContinuous: () => Promise<void>;
  isRunning: () => boolean;
  stopRunning: () => void;
  makeDeps: () => CycleDeps;
  startFileWatch: () => void;
  stopFileWatch: () => void;
}

async function handleFactoryAction(
  params: PiFactoryType,
  ctx: ExtensionContext,
  deps: FactoryDeps
): Promise<{ status: "ok" | "error"; message?: string; data?: unknown; isError?: boolean }> {
  const { stateStore, runContinuous, isRunning, stopRunning, startFileWatch, stopFileWatch, makeDeps } = deps;

  switch (params.action) {
    case "oneshot": {
      const state = stateStore.load();
      state.mode = (params.mode ?? "oneshot") as FactoryMode;
      if (params.costLimit) state.costLimit = params.costLimit;
      stateStore.save(state);

      const results: unknown[] = [];
      const maxCycles = params.maxCycles ?? 1;
      for (let i = 0; i < maxCycles; i++) {
        const { didWork, state: after } = await runOneCycle(makeDeps());
        results.push({ cycle: after.cycle, didWork, status: after.status });
        if (!didWork) break;
      }
      return { status: "ok", data: results };
    }

    case "start": {
      const state = stateStore.load();
      state.mode = (params.mode ?? "continuous") as FactoryMode;
      if (params.costLimit) state.costLimit = params.costLimit;
      state.status = "working";
      stateStore.save(state);

      startFileWatch();
      runContinuous().catch(() => {});
      return { status: "ok", message: `Factory started in ${state.mode} mode (watcher ON)` };
    }

    case "pause": {
      const state = stateStore.load();
      state.status = "paused";
      stateStore.save(state);
      stopRunning();
      stopFileWatch();
      return { status: "ok", message: "Factory paused, watcher stopped" };
    }

    case "resume": {
      const state = stateStore.load();
      if (state.status !== "paused") return { status: "error", message: "Not paused" };
      state.status = "working";
      stateStore.save(state);
      startFileWatch();
      runContinuous().catch(() => {});
      return { status: "ok", message: "Factory resumed" };
    }

    case "stop": {
      stopRunning();
      stopFileWatch();
      const state = stateStore.load();
      state.status = "idle";
      stateStore.save(state);
      return { status: "ok", message: "Factory stopped" };
    }

    case "status": {
      const state = stateStore.load();
      const next = pickNextTask(state.queue);
      return {
        status: "ok",
        data: {
          status: state.status,
          cycle: state.cycle,
          cost: `${state.totalCost.toFixed(2)} / ${state.costLimit}`,
          queue: state.queue.length,
          completed: state.completed.length,
          failed: state.failed.length,
          blocked: state.blocked.length,
          nextTask: next?.id ?? null,
        },
        message: `Factory ${state.status} | cycle ${state.cycle} | cost $${state.totalCost.toFixed(2)} / $${state.costLimit} | queue ${state.queue.length} | done ${state.completed.length} | blocked ${state.blocked.length}`,
      };
    }

    case "queue_add": {
      if (!params.title || !params.description) {
        return { status: "error", message: "title and description required" };
      }
      const state = stateStore.load();
      const task = addTask(state.queue, {
        id: `FACT-${String(state.queue.length + state.completed.length + state.failed.length + state.blocked.length + 1).padStart(3, "0")}`,
        source: (params.source ?? "manual") as TaskSource,
        title: params.title,
        description: params.description,
        priority: (params.priority ?? "medium") as "critical" | "high" | "medium" | "low",
        roleId: (params.data as any)?.roleId,
      });
      stateStore.save(state);
      return { status: "ok", message: `Added ${task.id}: ${task.title}`, data: task };
    }

    case "queue_list": {
      const state = stateStore.load();
      const pending = state.queue.filter((t) => t.status === "pending");
      return { status: "ok", data: pending, message: `${pending.length} pending tasks` };
    }

    case "queue_remove": {
      if (!params.taskId) return { status: "error", message: "taskId required" };
      const state = stateStore.load();
      const ok = state.queue.find((t) => t.id === params.taskId);
      if (!ok) return { status: "error", message: `Task not found: ${params.taskId}` };
      state.queue = state.queue.filter((t) => t.id !== params.taskId);
      stateStore.save(state);
      return { status: "ok", message: `Removed ${params.taskId}` };
    }

    case "inspect": {
      if (!params.taskId) return { status: "error", message: "taskId required" };
      const state = stateStore.load();
      const task =
        state.queue.find((t) => t.id === params.taskId) ??
        state.completed.find((t) => t.id === params.taskId) ??
        state.failed.find((t) => t.id === params.taskId) ??
        state.blocked.find((t) => t.id === params.taskId);
      if (!task) return { status: "error", message: `Task not found: ${params.taskId}` };
      return { status: "ok", data: task };
    }

    case "retry": {
      if (!params.taskId) return { status: "error", message: "taskId required" };
      const state = stateStore.load();
      const idx = state.failed.findIndex((t) => t.id === params.taskId);
      if (idx === -1) return { status: "error", message: `Task not in failed: ${params.taskId}` };
      const task = state.failed[idx];
      task.status = "pending";
      task.retryCount = 0;
      task.blockReason = undefined;
      state.failed.splice(idx, 1);
      state.queue.push(task);
      stateStore.save(state);
      return { status: "ok", message: `Retried ${params.taskId}` };
    }

    default:
      return { status: "error", message: `Unknown action: ${params.action}` };
  }
}
