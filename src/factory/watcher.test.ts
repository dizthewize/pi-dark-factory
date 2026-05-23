import { pollManualQueue, startFileWatcher } from "./watcher.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { describe, it, expect } from "vitest";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "factory-watcher-test-"));
}

describe("pollManualQueue", () => {
  it("returns null when file missing", () => {
    const tmp = tmpDir();
    const result = pollManualQueue(tmp);
    expect(result).toBe(null);
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
    expect(tasks).toBeTruthy();
    expect(tasks!.length).toBe(2);
    expect(tasks![0].title).toBe("Add auth");
    expect(tasks![0].priority).toBe("high");
    expect(tasks![1].roleId).toBe("bug-reproducer");

    // File should be cleared
    const cleared = JSON.parse(fs.readFileSync(queuePath, "utf-8"));
    expect(cleared.append).toStrictEqual([]);
  });

  it("generates ids when missing", () => {
    const tmp = tmpDir();
    fs.writeFileSync(
      path.join(tmp, "queue.manual.json"),
      JSON.stringify({ append: [{ title: "X", description: "d" }] }),
      "utf-8"
    );
    const tasks = pollManualQueue(tmp);
    expect(tasks![0].id.startsWith("MAN-")).toBeTruthy();
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
    expect(captured.length).toBe(0);

    // Write queue file
    fs.writeFileSync(
      path.join(tmp, "queue.manual.json"),
      JSON.stringify({ append: [{ title: "New", description: "task" }] }),
      "utf-8"
    );

    // Wait for next poll
    await new Promise((r) => setTimeout(r, 200));

    stop();
    expect(captured.length).toBe(1);
    expect(captured[0][0].title).toBe("New");
  });
});
