import { describe, it } from "node:test";
import assert from "node:assert";
import { parseMeshTask, scanMeshInbox } from "./mesh-inbox.js";

describe("parseMeshTask", () => {
  it("parses TASK: directive", () => {
    const msg = {
      id: "abc-123",
      from: "swift-raven",
      fromName: "Swift Raven",
      body: "TASK: Add OAuth login\n\nWe need Google and GitHub OAuth for the new landing page.",
      timestamp: "now",
    };
    const task = parseMeshTask(msg);
    assert.ok(task);
    assert.strictEqual(task!.title, "Add OAuth login");
    assert.strictEqual(task!.source, "mesh");
    assert.strictEqual(task!.priority, "medium");
  });

  it("parses FACTORY: directive with priority", () => {
    const msg = {
      id: "def-456",
      from: "x",
      fromName: "X",
      body: "FACTORY: Critical hotfix needed\nThe authentication is broken.",
      timestamp: "now",
    };
    const task = parseMeshTask(msg);
    assert.strictEqual(task!.priority, "critical");
  });

  it("returns null for regular message", () => {
    const msg = {
      id: "a",
      from: "b",
      fromName: "B",
      body: "Hey, how are you?",
      timestamp: "now",
    };
    assert.strictEqual(parseMeshTask(msg), null);
  });
});

describe("scanMeshInbox", () => {
  it("skips already-known tasks", () => {
    const msgs = [
      { id: "msg-001", from: "a", fromName: "A", body: "TASK: Auth", timestamp: "now" },
      { id: "msg-002", from: "b", fromName: "B", body: "Hello", timestamp: "now" },
    ];
    const known = new Set(["MESH-msg-001"]);
    const tasks = scanMeshInbox(msgs as any, known);
    assert.strictEqual(tasks.length, 0);
  });
});
