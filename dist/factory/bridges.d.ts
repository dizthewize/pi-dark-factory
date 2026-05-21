/**
 * Inter-extension bridge factory for pi-dark-factory.
 * Uses the shared Pi EventBus for request/response between extensions.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
interface BridgeClient {
    plan: (params: {
        input: string;
        output: string;
        name?: string;
    }) => Promise<unknown>;
    execute: (params: {
        name: string;
        tasks?: unknown[];
        plan?: string;
        options?: unknown;
    }) => Promise<unknown>;
}
interface MeshBridgeClient {
    setProjectState: (params: {
        ext: string;
        data: unknown;
    }) => Promise<unknown>;
    provideContract: (params: {
        item: string;
        signature?: string;
    }) => Promise<unknown>;
    send: (params: {
        to: string;
        message: string;
    }) => Promise<unknown>;
}
interface RolesBridgeClient {
    dispatch: (params: {
        roleId: string;
        task: string;
        mode: string;
        files?: string[];
    }) => Promise<{
        handle: string;
        output?: string;
        status?: string;
    }>;
    status: (params: {
        handle: string;
    }) => Promise<{
        status: string;
        output?: string;
    }>;
}
export interface FactoryBridges {
    piWorkflows?: BridgeClient;
    piMesh?: MeshBridgeClient;
    piAgentRoles?: RolesBridgeClient;
}
export declare function detectSiblings(pi: ExtensionAPI): {
    workflows: boolean;
    mesh: boolean;
    roles: boolean;
};
export declare function createFactoryBridges(pi: ExtensionAPI): FactoryBridges;
/** Legacy: convert FactoryBridges to CycleDeps bridge format */
export declare function bridgesToCycleDeps(bridges: FactoryBridges): {
    piWorkflows: BridgeClient | undefined;
    piMesh: MeshBridgeClient | undefined;
    piAgentRoles: RolesBridgeClient | undefined;
};
export {};
//# sourceMappingURL=bridges.d.ts.map