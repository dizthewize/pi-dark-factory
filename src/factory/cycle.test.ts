import { runOneCycle } from "./cycle.js";
import { StateStore } from "./state.js";
import { FactoryTask } from "../types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { describe, it, expect } from "vitest";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "factory-cycle-test-"));
}

function makeTask(id: string, priority: FactoryTask["priority"]): FactoryTask {
  return {
    id, source: "manual", title: id, description: "d", priority,
    status: "pending", cost: 0, retryCount: 0,
  };
}

describe("runOneCycle", () => {
  it("does nothing when queue empty", async () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    store.save(store.load());
    const { didWork, state } = await runOneCycle({ stateStore: store, factoryDir: tmp, cwd: "/tmp" });
    expect(didWork).toBe(false);
    expect(state.status).toBe("idle");
  });

  it("planning fallback works when no bridges available", async () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const s = store.load();
    s.queue.push(makeTask("t1", "high"));
    store.save(s);

    // With no piWorkflows or piAgentRoles bridges, fallback planner generates minimal spec
    // Then executor fails (no piWorkflows.execute), first retry queues it back
    const { didWork, state } = await runOneCycle({ stateStore: store, factoryDir: tmp, cwd: "/tmp" });
    expect(didWork).toBeTruthy();
    // Task gets a plan from fallback
    const t1 = state.queue.find((t) => t.id === "t1") ?? state.failed.find((t) => t.id === "t1");
    expect(t1).toBeTruthy();
    // Plan path was written
    expect(t1.planPath).toBeTruthy();
  });

  it("respects cost cap", async () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const s = store.load();
    s.totalCost = 100;
    s.costLimit = 50;
    s.queue.push(makeTask("t1", "high"));
    store.save(s);
    const { didWork, state } = await runOneCycle({ stateStore: store, factoryDir: tmp, cwd: "/tmp" });
    expect(didWork).toBe(false);
    expect(state.status).toBe("cost_exceeded");
  });

  it("respects paused status", async () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const s = store.load();
    s.status = "paused";
    s.queue.push(makeTask("t1", "high"));
    store.save(s);
    const { didWork, state } = await runOneCycle({ stateStore: store, factoryDir: tmp, cwd: "/tmp" });
    expect(didWork).toBe(false);
    expect(state.status).toBe("paused");
  });
});
