/**
 * Inter-extension bridge factory for pi-dark-factory.
 * Uses the shared Pi EventBus for request/response between extensions.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";

const BRIDGE_TIMEOUT_MS = 300_000; // 5 min

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
  setProjectState: (params: { ext: string; data: unknown }) => Promise<unknown>;
  provideContract: (params: { item: string; signature?: string }) => Promise<unknown>;
  send: (params: { to: string; message: string }) => Promise<unknown>;
}

interface RolesBridgeClient {
  dispatch: (params: {
    roleId: string;
    task: string;
    mode: string;
    files?: string[];
  }) => Promise<{ handle: string; output?: string; status?: string }>;
  status: (params: { handle: string }) => Promise<{ status: string; output?: string }>;
}

/** Create a callable bridge wrapper using EventBus request/response pattern. */
function createBridgeClient(
  pi: ExtensionAPI,
  service: string,
  methods: string[]
): any {
  const client: Record<string, any> = {};
  for (const method of methods) {
    client[method] = async (params: unknown) => {
      const requestId = randomUUID();
      const responseChannel = `${service}:${method}:response:${requestId}`;
      return new Promise((resolve, reject) => {
        let unsub: (() => void) | undefined;
        let timeout: NodeJS.Timeout;

        const handler = (data: unknown) => {
          clearTimeout(timeout);
          if (unsub) unsub();
          if (data && typeof data === "object" && "error" in data && (data as any).error) {
            reject(new Error(String((data as any).error)));
          } else {
            resolve((data as any)?.result ?? data);
          }
        };

        unsub = pi.events.on(responseChannel, handler);

        timeout = setTimeout(() => {
          if (unsub) unsub();
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

export interface FactoryBridges {
  piWorkflows?: BridgeClient;
  piMesh?: MeshBridgeClient;
  piAgentRoles?: RolesBridgeClient;
}

export function detectSiblings(pi: ExtensionAPI): {
  workflows: boolean;
  mesh: boolean;
  roles: boolean;
} {
  const toolNames = new Set(pi.getAllTools().map((t) => t.name));
  return {
    workflows: toolNames.has("execute_workflow"),
    mesh: toolNames.has("pi_mesh"),
    roles: toolNames.has("pi_roles"),
  };
}

export function createFactoryBridges(pi: ExtensionAPI): FactoryBridges {
  const detected = detectSiblings(pi);
  const bridges: FactoryBridges = {};

  if (detected.workflows) {
    bridges.piWorkflows = createBridgeClient(pi, "workflows", [
      "plan",
      "execute",
    ]) as BridgeClient;
  }

  if (detected.mesh) {
    bridges.piMesh = createBridgeClient(pi, "mesh", [
      "setProjectState",
      "provideContract",
      "send",
    ]) as MeshBridgeClient;
  }

  if (detected.roles) {
    bridges.piAgentRoles = createBridgeClient(pi, "roles", [
      "dispatch",
      "status",
    ]) as RolesBridgeClient;
  }

  return bridges;
}

/** Legacy: convert FactoryBridges to CycleDeps bridge format */
export function bridgesToCycleDeps(bridges: FactoryBridges) {
  return {
    piWorkflows: bridges.piWorkflows,
    piMesh: bridges.piMesh,
    piAgentRoles: bridges.piAgentRoles,
  };
}
