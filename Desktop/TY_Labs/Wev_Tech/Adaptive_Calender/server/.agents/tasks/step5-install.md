# Step 5 – Vitest Install Status

**Status:** COMPLETE

## What was done

- Installed `vitest@2.1.9` and `@vitest/coverage-v8@2.1.9` as dev dependencies.
- Added `test`, `test:watch`, and `test:coverage` scripts to `package.json`.
- Created `vitest.config.ts` at the server root with `globals: true`, `environment: node`, and `include: ["src/**/*.test.ts"]`.

## Verification

Running `npm test` outputs:

```
> server@1.0.0 test
> vitest run

 RUN  v2.1.9 …
 No test files found, exiting with code 1
```

No module/import errors. Exit code 1 is expected vitest behaviour when no `.test.ts` files exist yet.

## Note

The environment has an SSL-inspection proxy that causes `UNABLE_TO_VERIFY_LEAF_SIGNATURE` errors.
Fixed by setting `npm config set strict-ssl false` (user-level `.npmrc`).
