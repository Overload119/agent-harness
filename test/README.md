# Test Layout

This repo uses Bun's built-in test runner for every test target.

## Where tests go

- `test/harness/`: direct tests for harness path and repo-local helper behavior.
- `test/loop/`: direct tests for loop state, locks, and PRD execution behavior.
- `test/run-state/`: direct tests for `ah-run-state` CLI parsing and persisted updates.
- `test/setup/`: integration-heavy tests for setup, install, and managed-file flows.
- `test/visualizer/`: unit and integration coverage for visualizer helpers, routes, and snapshot loading.
- `test/support/`: shared fixtures plus tests that validate the fixture helpers themselves.

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

# loop scope
bun run test:loop

# run-state scope
bun run test:run-state

# setup scope
bun run test:setup

# support scope
bun run test:support

# visualizer scope
bun run test:visualizer

# single file
bun run test:file -- test/visualizer/prd-server.test.ts
```
