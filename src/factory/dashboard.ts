/**
 * Factory Dashboard — formatted status output for /factory command.
 *
 * Produces a compact markdown block showing:
 *   - Factory state, cycle, cost
 *   - Current task
 *   - Queue (next 5)
 *   - Blocked items
 *   - Recent ledger entries
 */

import type { FactoryState, FactoryTask, LedgerEntry } from "../types.js";

const PRIORITY_ICON: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "⚪",
};

const STATUS_ICON: Record<string, string> = {
  pending: "○",
  planning: "◐",
  executing: "●",
  reviewing: "◑",
  complete: "✓",
  failed: "✗",
  blocked: "⛔",
};

function fmtDur(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h${String(m % 60).padStart(2, "0")}m`;
  if (m > 0) return `${m}m${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}

function fmtRel(ts: string): string {
  const d = Date.now() - new Date(ts).getTime();
  return fmtDur(d);
}

function pad(s: string, w: number): string {
  return s + " ".repeat(Math.max(0, w - s.length));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function truncateDesc(s: string, max: number): string {
  const firstLine = s.split("\n")[0] ?? "";
  return truncate(firstLine, max);
}

export function formatFactoryDashboard(state: FactoryState): string {
  const lines: string[] = [];

  // ── Header ──
  const statusColor = state.status === "working" ? "●"
    : state.status === "complete" ? "✓"
    : state.status === "failed" || state.status === "cost_exceeded" ? "✗"
    : state.status === "blocked" ? "⛔"
    : state.status === "paused" ? "⏸"
    : "○";

  const elapsed = state.lastRunAt ? fmtRel(state.lastRunAt) : "never";
  const cost = `$${state.totalCost.toFixed(2)}`;
  const limit = `$${state.costLimit}`;
  const pct = ((state.totalCost / state.costLimit) * 100).toFixed(0);

  lines.push(`${statusColor} Factory ${state.status} │ cycle ${state.cycle} │ cost ${cost} / ${limit} (${pct}%) │ last ${elapsed}`);
  lines.push("─".repeat(64));

  // ── Current Task ──
  if (state.currentTaskId) {
    const current = [...state.queue, ...state.completed, ...state.failed, ...state.blocked]
      .find((t) => t.id === state.currentTaskId);
    if (current) {
      const icon = STATUS_ICON[current.status] ?? "○";
      const dur = current.startedAt ? fmtRel(current.startedAt) : "";
      const costStr = current.cost > 0 ? `$${current.cost.toFixed(2)}` : "";
      const taskLine = `${icon} ${current.id}  ${truncate(current.title, 30)}  ${current.status}  ${dur}  ${costStr}`;
      lines.push(taskLine);
      lines.push("─".repeat(64));
    }
  }

  // ── Queue (next 5) ──
  const pending = state.queue.filter((t) => t.status === "pending").slice(0, 5);
  if (pending.length > 0) {
    lines.push(`Queue (${state.queue.length} total):`);
    for (const t of pending) {
      const icon = PRIORITY_ICON[t.priority] ?? "⚪";
      const id = pad(t.id, 10);
      const title = truncate(t.title, 28);
      const priority = t.priority;
      const source = t.source;
      lines.push(`  ${icon} ${id} ${title}  ${priority}  ${source}`);
    }
    if (state.queue.length > 5) {
      lines.push(`  ... and ${state.queue.length - 5} more`);
    }
    lines.push("─".repeat(64));
  }

  // ── Blocked ──
  if (state.blocked.length > 0) {
    lines.push(`Blocked (${state.blocked.length}):`);
    for (const t of state.blocked.slice(0, 3)) {
      const reason = t.blockReason ? truncateDesc(t.blockReason, 40) : "(no reason)";
      lines.push(`  ⛔ ${pad(t.id, 10)} ${truncate(t.title, 20)}  → ${reason}`);
    }
    if (state.blocked.length > 3) {
      lines.push(`  ... and ${state.blocked.length - 3} more`);
    }
    lines.push("─".repeat(64));
  }

  // ── Completed / Failed summary ──
  const done = state.completed.length;
  const failed = state.failed.length;
  if (done > 0 || failed > 0) {
    const parts: string[] = [];
    if (done > 0) parts.push(`✓ ${done} done`);
    if (failed > 0) parts.push(`✗ ${failed} failed`);
    lines.push(`History: ${parts.join("  |  ")}`);
    lines.push("─".repeat(64));
  }

  // ── Recent Ledger ──
  if (state.ledger.length > 0) {
    lines.push("Recent activity:");
    const recent = state.ledger.slice(-5).reverse();
    for (const entry of recent) {
      const icon = entry.action === "complete" ? "✓"
        : entry.action === "fail" || entry.action === "block" ? "✗"
        : entry.action === "retry" ? "↻"
        : entry.action === "plan" ? "📋"
        : entry.action === "execute" ? "▶"
        : entry.action === "review" ? "👁"
        : entry.action === "fix" ? "🔧"
        : "•";
      const costStr = entry.cost > 0 ? `$${entry.cost.toFixed(2)}` : "";
      const note = entry.notes ? `  → ${truncate(entry.notes, 30)}` : "";
      lines.push(`  ${icon} ${pad(entry.taskId, 10)} ${entry.action}  ${costStr}${note}`);
    }
  }

  // ── Footer ──
  lines.push("");
  lines.push("Commands: /factory status  |  /factory queue_list  |  /factory pause");

  return lines.join("\n");
}

export function formatFactoryCompact(state: FactoryState): string {
  const statusIcon = state.status === "working" ? "●"
    : state.status === "complete" ? "✓"
    : state.status === "failed" || state.status === "cost_exceeded" ? "✗"
    : "○";
  const queue = state.queue.filter((t) => t.status === "pending").length;
  const done = state.completed.length;
  const failed = state.failed.length;
  const blocked = state.blocked.length;
  const cost = `$${state.totalCost.toFixed(2)}`;
  return `${statusIcon} Factory ${state.status} │ ${queue} queued │ ${done}✓ ${failed}✗ ${blocked}⛔ │ ${cost}`;
}
