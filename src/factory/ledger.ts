import { FactoryState, LedgerEntry } from "../types.js";

export function appendLedger(
  state: FactoryState,
  entry: Omit<LedgerEntry, "cycle" | "timestamp">
): void {
  state.ledger.push({
    cycle: state.cycle,
    timestamp: new Date().toISOString(),
    ...entry,
  });
}
