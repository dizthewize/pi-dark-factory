import * as fs from "node:fs";
import * as path from "node:path";
export class StateStore {
    statePath;
    dir;
    constructor(opts) {
        this.dir = opts.factoryDir;
        this.statePath = path.join(this.dir, "state.json");
        fs.mkdirSync(this.dir, { recursive: true });
    }
    load() {
        try {
            const raw = fs.readFileSync(this.statePath, "utf-8");
            return JSON.parse(raw);
        }
        catch {
            return this.defaultState();
        }
    }
    save(state) {
        fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2), "utf-8");
    }
    defaultState() {
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
    reset() {
        const fresh = this.defaultState();
        this.save(fresh);
        return fresh;
    }
}
//# sourceMappingURL=state.js.map