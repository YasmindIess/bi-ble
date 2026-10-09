# bi-ble / NICE-ROBIN continuity handoff v1

Experimental portable planning bridge. Inputs contain only public, synthetic planning metadata. This is a deterministic task-dependency manifest, not a wire format for executing commands or authorizing external actions.

- Exact schemas: `bi-ble-continuity-plan-v1` and `bi-ble-continuity-handoff-v1`.
- Strict fixed boundary: simulation only, no signing, no external execution.
- All task IDs, dependency IDs and evidence labels are ASCII slugs; tasks and dependency lists are sorted; unknown fields, cycles and privilege elevation fail closed.
- The plan digest is SHA-256 of recursively key-sorted JSON serialized without spaces as UTF-8. No floating-point values, timestamps or secrets are included.
- The handoff contains a recomputable digest plus task IDs divided into initially ready and blocked groups. No task is run.

Run `node --test tools/continuity-plan.test.mjs` and `node tools/continuity-plan.mjs examples/nice-robin-continuity-plan.json --output /tmp/handoff.json`. The CLI refuses overwriting an existing file. Consumer: NICE-ROBIN's `nice_robin.integrations.bible_continuity` module.

Current integration is a neutral bridge module; the graphical bi-ble compiler and AEL tribunals are not yet wired to it. An admitted formula must not be treated as permission to execute. The public bi-ble repo must never receive private NICE-ROBIN credentials, sensitive repository state, keys or unredacted receipts.
