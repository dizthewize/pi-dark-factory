import { FactoryState } from "../types.js";
import { StateStore } from "./state.js";
export interface CycleDeps {
    stateStore: StateStore;
    factoryDir: string;
    cwd: string;
    piWorkflows?: {
        plan?: (params: {
            input: string;
            output: string;
            name?: string;
        }) => Promise<unknown>;
        execute?: (params: {
            name: string;
            tasks?: unknown[];
            plan?: string;
            options?: unknown;
        }) => Promise<unknown>;
    };
    piMesh?: {
        setProjectState?: (params: {
            ext: string;
            data: unknown;
        }) => Promise<unknown>;
        provideContract?: (params: {
            item: string;
            signature?: string;
        }) => Promise<unknown>;
        send?: (params: {
            to: string;
            message: string;
        }) => Promise<unknown>;
    };
    piAgentRoles?: {
        dispatch?: (params: {
            roleId: string;
            task: string;
            mode: string;
            files?: string[];
        }) => Promise<{
            handle: string;
            output?: string;
            status?: string;
        }>;
        status?: (params: {
            handle: string;
        }) => Promise<{
            status: string;
            output?: string;
        }>;
    };
}
export declare function runOneCycle(deps: CycleDeps): Promise<{
    state: FactoryState;
    didWork: boolean;
}>;
//# sourceMappingURL=cycle.d.ts.map