/**
 * Pi Dark Factory Extension
 *
 * Self-managing orchestrator. Reads task queues, plans workflows,
 * dispatches agents, and loops autonomously.
 *
 * Triggers:
 *  - One-shot:   pi -p --no-session "pi_factory({ action: 'oneshot' })"
 *  - Continuous: /factory start (session mode with file watcher)
 *  - Cron:       External scheduler calls one-shot
 *  - File:       Write to ~/.pi/agent/factory/queue.manual.json
 *  - Mesh:       Send DM with "TASK: description"
 *  - GitHub:     Label issues 'pi-factory', factory polls them
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function piDarkFactoryExtension(pi: ExtensionAPI): void;
//# sourceMappingURL=index.d.ts.map