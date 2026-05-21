import { describe, it } from "node:test";
import assert from "node:assert";
import { StateStore } from "./state.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "factory-state-test-"));
}

describe("StateStore", () => {
  it("returns default state when file missing", () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const state = store.load();
    assert.strictEqual(state.status, "idle");
    assert.strictEqual(state.cycle, 0);
    assert.strictEqual(state.queue.length, 0);
  });

  it("saves and reloads state", () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const state = store.load();
    state.status = "working";
    state.cycle = 5;
    store.save(state);
    const reloaded = store.load();
    assert.strictEqual(reloaded.status, "working");
    assert.strictEqual(reloaded.cycle, 5);
  });

  it("resets to default", () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const s = store.load();
    s.cycle = 99;
    store.save(s);
    const reset = store.reset();
    assert.strictEqual(reset.cycle, 0);
    assert.strictEqual(store.load().cycle, 0);
  });
});
