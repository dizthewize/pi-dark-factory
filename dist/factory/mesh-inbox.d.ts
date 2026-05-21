/**
 * Mesh inbox trigger for dark-factory.
 * Reads mesh inbox messages that contain task directives.
 */
import { FactoryTask } from "../types.js";
export interface MeshMessage {
    id: string;
    from: string;
    fromName: string;
    body: string;
    timestamp: string;
    type?: string;
}
/**
 * Parse a mesh message body for task directives.
 * Supports formats:
 *   TASK: Add OAuth login
 *   FACTORY: Review PR #123
 */
export declare function parseMeshTask(message: MeshMessage): FactoryTask | null;
/**
 * Scan mesh inbox messages for task directives.
 * Returns new tasks not in the known set.
 */
export declare function scanMeshInbox(messages: MeshMessage[], knownIds: Set<string>): FactoryTask[];
//# sourceMappingURL=mesh-inbox.d.ts.map