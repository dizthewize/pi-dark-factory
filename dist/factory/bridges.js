/**
 * Inter-extension bridge factory for pi-dark-factory.
 * Uses the shared Pi EventBus for request/response between extensions.
 */
import { randomUUID } from "node:crypto";
const BRIDGE_TIMEOUT_MS = 300_000; // 5 min
/** Create a callable bridge wrapper using EventBus request/response pattern. */
function createBridgeClient(pi, service, methods) {
    const client = {};
    for (const method of methods) {
        client[method] = async (params) => {
            const requestId = randomUUID();
            const responseChannel = `${service}:${method}:response:${requestId}`;
            return new Promise((resolve, reject) => {
                let unsub;
                let timeout;
                const handler = (data) => {
                    clearTimeout(timeout);
                    if (unsub)
                        unsub();
                    if (data && typeof data === "object" && "error" in data && data.error) {
                        reject(new Error(String(data.error)));
                    }
                    else {
                        resolve(data?.result ?? data);
                    }
                };
                unsub = pi.events.on(responseChannel, handler);
                timeout = setTimeout(() => {
                    if (unsub)
                        unsub();
                    reject(new Error(`Bridge timeout: ${service}:${method}`));
                }, BRIDGE_TIMEOUT_MS);
                pi.events.emit(`${service}:${method}:request`, {
                    requestId,
                    params,
                    responseChannel,
                });
            });
        };
    }
    return client;
}
export function detectSiblings(pi) {
    const toolNames = new Set(pi.getAllTools().map((t) => t.name));
    return {
        workflows: toolNames.has("execute_workflow"),
        mesh: toolNames.has("pi_mesh"),
        roles: toolNames.has("pi_roles"),
    };
}
export function createFactoryBridges(pi) {
    const detected = detectSiblings(pi);
    const bridges = {};
    if (detected.workflows) {
        bridges.piWorkflows = createBridgeClient(pi, "workflows", [
            "plan",
            "execute",
        ]);
    }
    if (detected.mesh) {
        bridges.piMesh = createBridgeClient(pi, "mesh", [
            "setProjectState",
            "provideContract",
            "send",
        ]);
    }
    if (detected.roles) {
        bridges.piAgentRoles = createBridgeClient(pi, "roles", [
            "dispatch",
            "status",
        ]);
    }
    return bridges;
}
/** Legacy: convert FactoryBridges to CycleDeps bridge format */
export function bridgesToCycleDeps(bridges) {
    return {
        piWorkflows: bridges.piWorkflows,
        piMesh: bridges.piMesh,
        piAgentRoles: bridges.piAgentRoles,
    };
}
//# sourceMappingURL=bridges.js.map