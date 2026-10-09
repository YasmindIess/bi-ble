# Visual continuity export: bi-ble to NICE-ROBIN

From the Core palette, add Continuity task objects. In Inspector, give each
one an ASCII slug ID, integer priority (0-100), bounded cost (1-100),
read-only or proposal mode, and comma-separated admissible evidence kinds.
Connect Task outputs to any of four optional Depends on inputs on downstream
tasks. The ports are typed; unrelated formula nodes cannot be exported.

The NICE-ROBIN Continuity panel is below the compiler. Choose a project slug
and select Prepare handoff. The editor recompiles the current document,
checks the structural and domain tribunals, enforces the simulation-only
authority boundary, validates every task edge again and rejects cycles,
then computes the bi-ble-continuity-handoff-v1 JSON with browser WebCrypto.
Changes to the editor document invalidate the existing handoff; async
compilation is rejected if the document changes before completion.

The four-task reference graph must produce the shared digest
76f4c66126a7d9ad15287cfe6d732643cf9f82a8a09098bc40646b3e1499bdcc.
Copy or Save JSON for offline NICE-ROBIN ingestion. No external execution,
AI calls, signature, GitHub write, merge or deployment is permitted by this UI.

Regression: node --test tools/continuity-plan.test.mjs tools/continuity-editor.test.mjs
and pnpm editor:lint; pnpm editor:build.
