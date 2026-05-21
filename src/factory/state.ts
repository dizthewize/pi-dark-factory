import * as fs from "node:fs";
import * as path from "node:path";
import { FactoryState, FactoryTask } from "../types.js";

export interface StateStoreOptions {
  factoryDir: string;
}

export class StateStore {
  private statePath: string;
  private dir: string;

  constructor(opts: StateStoreOptions) {
    this.dir = opts.factoryDir;
    this.statePath = path.join(this.dir, "state.json");
    fs.mkdirSync(this.dir, { recursive: true });
  }

  load(): FactoryState {
    try {
      const raw = fs.readFileSync(this.statePath, "utf-8");
      return JSON.parse(raw) as FactoryState;
    } catch {
      return this.defaultState();
    }
  }

  save(state: FactoryState): void {
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), "utf-8");
  }

  private defaultState(): FactoryState {
    return {
      version: "0.1.0",
      status: "idle",
      cycle: 0,
      totalCost: 0,
      costLimit: 50,
      mode: "oneshot",
      queue: [],
      completed: [],
      failed: [],
      blocked: [],
      ledger: [],
    };
  }

  reset(): FactoryState {
    const fresh = this.defaultState();
    this.save(fresh);
    return fresh;
  }
}
