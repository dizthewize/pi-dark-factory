import { describe, it } from "node:test";
import assert from "node:assert";
import { runOneCycle } from "./cycle.js";
import { StateStore } from "./state.js";
import { FactoryTask } from "../types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

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
    assert.strictEqual(didWork, false);
    assert.strictEqual(state.status, "idle");
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
    assert.strictEqual(didWork, true);
    // Task gets a plan from fallback
    const t1 = state.queue.find((t) => t.id === "t1") ?? state.failed.find((t) => t.id === "t1");
    assert.ok(t1, "task should exist in queue or failed");
    // Plan path was written
    assert.ok(t1.planPath);
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
    assert.strictEqual(didWork, false);
    assert.strictEqual(state.status, "cost_exceeded");
  });

  it("respects paused status", async () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const s = store.load();
    s.status = "paused";
    s.queue.push(makeTask("t1", "high"));
    store.save(s);
    const { didWork, state } = await runOneCycle({ stateStore: store, factoryDir: tmp, cwd: "/tmp" });
    assert.strictEqual(didWork, false);
    assert.strictEqual(state.status, "paused");
  });
});
