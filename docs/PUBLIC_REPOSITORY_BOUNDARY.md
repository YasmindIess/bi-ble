# Public Repository Boundary

This repository is public.

## Allowed

- Public network identifiers
- Public protocol metadata
- Simulated addresses
- Test fixtures
- Unsigned execution previews
- Validation reports
- Audit receipts without private information
- Testnet-only examples

## Forbidden

- Private keys
- Seed phrases
- Wallet export files
- Signing credentials
- Private RPC credentials
- Live authorization tokens
- Unredacted personal or customer data
- Automatic mainnet execution

## Current execution boundary

- execution_mode = simulation_only
- external_execution_authorized = false
- live_signing_enabled = false

Compiled plans are descriptions and simulations. They are not permission to perform an external effect.
