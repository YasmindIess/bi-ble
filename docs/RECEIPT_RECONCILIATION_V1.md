# Receipt reconciliation: NICE-ROBIN → bi-ble

The existing visual Continuity inspector imports **unaltered canonical JSON** from NICE-ROBIN's bounded local worker, with its optional matching proposal. It never dispatches, executes, approves, or publishes anything.

Browser WebCrypto independently recalculates receipt, embedded preflight, normalized plan, and proposal digests. Strict schema-boundary validation refuses unknown keys, unsupported worker capability, forged authority, contradictions between check results and outcomes, manipulated budgets, claimed predecessor completions, and mismatched plan/proposal references.

Evidence is stored separately from document history in bounded local browser storage (16 artifacts). Changing the graph detaches previous observations rather than rewriting them. Re-importing the same hash is refused. Distinct reports for the same task/plan result in **unresolved** conflict.

Task nodes receive a small header indicator and the existing Inspector explains what each observation establishes. A missing plan or proposal leaves the receipt **unresolved**, even if hash integrity is confirmed. A failing report is **blocked**. A passing, matched report reaches **content integrity verified**, never **independently witnessed**. No receipt automatically satisfies dependencies or creates execution/approval authority.

Tests: \`node --test tools/receipt-reconcile.test.mjs\` and the original editor/handoff tests. Editor lint and production build are required CI gates. A synthetic receipt is test input, not independently witnessed production evidence; full browser walkthrough and an independently performed local worker audit remain unverified.


## Verified controlled Python → browser reproduction (2026-10-09)

NICE-ROBIN PR #7 at `f3cbe483efe55c0d062190071319e0f931caf818` executed the **actual** fixed publication-source worker via `scripts/worker_roundtrip_fixture.py` on a temporary synthetic public subtree. Its worker reads only the controlled source fixture. The script invokes the worker with the explicit local-read flag and write-once files outside the inspected tree. It produces a passing receipt and, after deliberately removing `SECURITY.md`, a blocked receipt. The Python implementation independently rechecks both receipts.

Source: https://github.com/YasmindIess/nice-robin/actions/runs/37928595879 (Python 3.12 job and uploaded `nice-robin-worker-interop` artifact). bi-ble preserves these exact canonical JSON bytes under `examples/worker-interop-v1/` for independent WebCrypto/schema/proposal verification, plus a headless Chromium UI walkaround.

Pinned plan: `6763acdeb2e384facf1d18b91d771a75cfe586d9726a2bf94b13e850ca2f92b2`
Passing receipt: `821462ec39a8ee16424d2355d5cdc38591208df8595d9e18af38ebe36c56c633`
Blocked receipt: `694d196b02c6aad7d37240ab27d9d372f6a1949f9ba91846d0812cb4a7d5ba06`

This is a repeatable **controlled-fixture** loop. It is not an audit of NICE-ROBIN's live release candidate, operator authentication, independent third-party witnessing, R₃ independence, execution authorization, or approval to publish. The source-tree checks are local to the temporary test fixture.
