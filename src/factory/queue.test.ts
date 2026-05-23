import { pickNextTask, addTask, removeTask } from "./queue.js";
import { FactoryTask } from "../types.js";
import { describe, it, expect } from "vitest";

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
    expect(next?.id).toBe("c");
  });

  it("skips non-pending tasks", () => {
    const q: FactoryTask[] = [];
    q.push(makeTask("a", "critical", "complete"));
    q.push(makeTask("b", "low", "pending"));
    const next = pickNextTask(q);
    expect(next?.id).toBe("b");
  });

  it("adds task with defaults", () => {
    const q: FactoryTask[] = [];
    const t = addTask(q, { id: "x", source: "manual", title: "X", description: "d", priority: "medium" });
    expect(t.status).toBe("pending");
    expect(t.retryCount).toBe(0);
    expect(q.length).toBe(1);
  });

  it("removes task by id", () => {
    const q: FactoryTask[] = [];
    q.push(makeTask("a", "low"));
    expect(removeTask(q, "a")).toBe(true);
    expect(q.length).toBe(0);
    expect(removeTask(q, "ghost")).toBe(false);
  });
});
