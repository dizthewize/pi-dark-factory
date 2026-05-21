import { describe, it } from "node:test";
import assert from "node:assert";
import { pickNextTask, addTask, removeTask } from "./queue.js";
import { FactoryTask } from "../types.js";

function makeTask(id: string, priority: FactoryTask["priority"], status: FactoryTask["status"] = "pending"): FactoryTask {
  return {
    id, source: "manual", title: id, description: "test", priority, status,
    cost: 0, retryCount: 0,
  };
}

describe("Queue", () => {
  it("picks highest priority pending task", () => {
    const q: FactoryTask[] = [];
    q.push(makeTask("a", "low"));
    q.push(makeTask("b", "high"));
    q.push(makeTask("c", "critical"));
    const next = pickNextTask(q);
    assert.strictEqual(next?.id, "c");
  });

  it("skips non-pending tasks", () => {
    const q: FactoryTask[] = [];
    q.push(makeTask("a", "critical", "complete"));
    q.push(makeTask("b", "low", "pending"));
    const next = pickNextTask(q);
    assert.strictEqual(next?.id, "b");
  });

  it("adds task with defaults", () => {
    const q: FactoryTask[] = [];
    const t = addTask(q, { id: "x", source: "manual", title: "X", description: "d", priority: "medium" });
    assert.strictEqual(t.status, "pending");
    assert.strictEqual(t.retryCount, 0);
    assert.strictEqual(q.length, 1);
  });

  it("removes task by id", () => {
    const q: FactoryTask[] = [];
    q.push(makeTask("a", "low"));
    assert.strictEqual(removeTask(q, "a"), true);
    assert.strictEqual(q.length, 0);
    assert.strictEqual(removeTask(q, "ghost"), false);
  });
});
