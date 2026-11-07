# Test Layout

This repo uses Bun's built-in test runner for every test target.

## Where tests go

- `test/harness/`: direct tests for harness path and repo-local helper behavior.
- `test/setup/`: integration-heavy tests for setup, install, and managed-file flows.
- `test/support/`: shared fixtures plus tests that validate the fixture helpers themselves.
- `test/plugin/`: root plugin instructions, settings, RPC integration, and skill distribution.
- `plugin/*.test.ts` and `plugin/*.test.tsx`: Side chats backend and native component behavior.

Keep new test files in the area that matches the source code they exercise and name them `<subject>.test.ts`.

## Unit vs integration

- Add a unit test when the target behavior lives in one module and can be verified with focused fixtures or mocks.
- Add an integration test when the behavior depends on filesystem state, CLI wiring, or multiple modules working together.
- For filesystem-heavy code, prefer shared helpers from `test/support/fixtures.ts` instead of bespoke temp-directory setup in each test file.

## Common commands

```bash
# full suite
bun run test

# harness scope
bun run test:harness

# setup scope
bun run test:setup

# plugin behavior and production typecheck
bun run test:plugin

# support scope
bun run test:support

# single file
bun run test:file -- test/setup/run.test.ts
```
