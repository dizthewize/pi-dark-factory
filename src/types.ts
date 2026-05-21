/**
 * Core types for pi-dark-factory.
 */

export type FactoryStatus =
  | "idle"
  | "working"
  | "blocked"
  | "paused"
  | "complete"
  | "cost_exceeded"
  | "failed";

export type FactoryMode = "oneshot" | "continuous" | "cron";

export type TaskSource = "github-issue" | "manual" | "mesh" | "file";

export interface FactoryTask {
  id: string;
  source: TaskSource;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  status:
    | "pending"
    | "planning"
    | "executing"
    | "reviewing"
    | "complete"
    | "failed"
    | "blocked";
  roleId?: string;
  planPath?: string;
  workflowResult?: unknown;
  meshTaskId?: string;
  cost: number;
  startedAt?: string;
  finishedAt?: string;
  retryCount: number;
  blockReason?: string;
}

export interface FactoryState {
  version: string;
  status: FactoryStatus;
  cycle: number;
  currentTaskId?: string;
  totalCost: number;
  costLimit: number;
  lastRunAt?: string;
  nextCheckAt?: string;
  mode: FactoryMode;
  queue: FactoryTask[];
  completed: FactoryTask[];
  failed: FactoryTask[];
  blocked: FactoryTask[];
  ledger: LedgerEntry[];
}

export interface LedgerEntry {
  cycle: number;
  timestamp: string;
  action:
    | "plan"
    | "execute"
    | "review"
    | "fix"
    | "block"
    | "complete"
    | "fail"
    | "retry";
  taskId: string;
  cost: number;
  notes?: string;
}

export type FactoryAction =
  | "oneshot"
  | "start"
  | "pause"
  | "resume"
  | "stop"
  | "status"
  | "queue_add"
  | "queue_list"
  | "queue_remove"
  | "inspect"
  | "retry";

export interface PiFactoryParams {
  action: FactoryAction;
  maxCycles?: number;
  costLimit?: number;
  mode?: FactoryMode;
  title?: string;
  description?: string;
  priority?: FactoryTask["priority"];
  source?: TaskSource;
  taskId?: string;
  data?: unknown;
}

export interface PiFactoryResult {
  status: "ok" | "error";
  message?: string;
  data?: unknown;
}
