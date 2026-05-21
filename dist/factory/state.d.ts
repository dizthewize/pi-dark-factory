import { FactoryState } from "../types.js";
export interface StateStoreOptions {
    factoryDir: string;
}
export declare class StateStore {
    private statePath;
    private dir;
    constructor(opts: StateStoreOptions);
    load(): FactoryState;
    save(state: FactoryState): void;
    private defaultState;
    reset(): FactoryState;
}
//# sourceMappingURL=state.d.ts.map