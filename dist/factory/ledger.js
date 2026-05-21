export function appendLedger(state, entry) {
    state.ledger.push({
        cycle: state.cycle,
        timestamp: new Date().toISOString(),
        ...entry,
    });
}
//# sourceMappingURL=ledger.js.map