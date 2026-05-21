import { describe, it } from "node:test";
import assert from "node:assert";
import { pollManualQueue, startFileWatcher } from "./watcher.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "factory-watcher-test-"));
}

describe("pollManualQueue", () => {
  it("returns null when file missing", () => {
    const tmp = tmpDir();
    const result = pollManualQueue(tmp);
    assert.strictEqual(result, null);
  });

  it("reads tasks and clears file", () => {
    const tmp = tmpDir();
    const queuePath = path.join(tmp, "queue.manual.json");
    fs.writeFileSync(
      queuePath,
      JSON.stringify({
        append: [
          { title: "Add auth", description: "OAuth", priority: "high" },
          { title: "Fix bug", description: "#123", priority: "critical", roleId: "bug-reproducer" },
        ],
      }),
      "utf-8"
    );

    const tasks = pollManualQueue(tmp);
    assert.ok(tasks);
    assert.strictEqual(tasks!.length, 2);
    assert.strictEqual(tasks![0].title, "Add auth");
    assert.strictEqual(tasks![0].priority, "high");
    assert.strictEqual(tasks![1].roleId, "bug-reproducer");

    // File should be cleared
    const cleared = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
    assert.deepStrictEqual(cleared.append, []);
  });

  it("generates ids when missing", () => {
    const tmp = tmpDir();
    fs.writeFileSync(
      path.join(tmp, "queue.manual.json"),
      JSON.stringify({ append: [{ title: "X", description: "d" }] }),
      "utf-8"
    );
    const tasks = pollManualQueue(tmp);
    assert.ok(tasks![0].id.startsWith("MAN-"));
  });
});

describe("startFileWatcher", () => {
  it("detects new tasks on poll", async () => {
    const tmp = tmpDir();
    const captured: import("../types.js").FactoryTask[][] = [];

    const { stop } = startFileWatcher(
      tmp,
      (tasks) => captured.push(tasks),
      100
    );

    // Wait first poll
    await new Promise((r) => setTimeout(r, 150));
    assert.strictEqual(captured.length, 0);

    // Write queue file
    fs.writeFileSync(
      path.join(tmp, "queue.manual.json"),
      JSON.stringify({ append: [{ title: "New", description: "task" }] }),
      "utf-8"
    );

    // Wait for next poll
    await new Promise((r) => setTimeout(r, 200));

    stop();
    assert.strictEqual(captured.length, 1);
    assert.strictEqual(captured[0][0].title, "New");
  });
});
