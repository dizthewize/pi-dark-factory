import { StateStore } from "./state.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { describe, it, expect } from "vitest";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "factory-state-test-"));
}

describe("StateStore", () => {
  it("returns default state when file missing", () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const state = store.load();
    expect(state.status).toBe("idle");
    expect(state.cycle).toBe(0);
    expect(state.queue.length).toBe(0);
  });

  it("saves and reloads state", () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const state = store.load();
    state.status = "working";
    state.cycle = 5;
    store.save(state);
    const reloaded = store.load();
    expect(reloaded.status).toBe("working");
    expect(reloaded.cycle).toBe(5);
  });

  it("resets to default", () => {
    const tmp = tmpDir();
    const store = new StateStore({ factoryDir: tmp });
    const s = store.load();
    s.cycle = 99;
    store.save(s);
    const reset = store.reset();
    expect(reset.cycle).toBe(0);
    expect(store.load().cycle).toBe(0);
  });
});
