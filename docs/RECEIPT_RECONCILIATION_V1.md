# Receipt reconciliation: NICE-ROBIN → bi-ble

The existing visual Continuity inspector imports **unaltered canonical JSON** from NICE-ROBIN's bounded local worker, with its optional matching proposal. It never dispatches, executes, approves, or publishes anything.

Browser WebCrypto independently recalculates receipt, embedded preflight, normalized plan, and proposal digests. Strict schema-boundary validation refuses unknown keys, unsupported worker capability, forged authority, contradictions between check results and outcomes, manipulated budgets, claimed predecessor completions, and mismatched plan/proposal references.

Evidence is stored separately from document history in bounded local browser storage (16 artifacts). Changing the graph detaches previous observations rather than rewriting them. Re-importing the same hash is refused. Distinct reports for the same task/plan result in **unresolved** conflict.

Task nodes receive a small header indicator and the existing Inspector explains what each observation establishes. A missing plan or proposal leaves the receipt **unresolved**, even if hash integrity is confirmed. A failing report is **blocked**. A passing, matched report reaches **content integrity verified**, never **independently witnessed**. No receipt automatically satisfies dependencies or creates execution/approval authority.

Tests: \`node --test tools/receipt-reconcile.test.mjs\` and the original editor/handoff tests. Editor lint and production build are required CI gates. A synthetic receipt is test input, not independently witnessed production evidence; full browser walkthrough and an independently performed local worker audit remain unverified.
