# Step 4 Verification Note

## Source of this run
`step4-review.json` was present — this is a review-fix iteration.

## Finding addressed
**Partial PATCH time-range bypass** (`fixedEvents.ts` lines 110–117)

The original `&&` guard only validated `endTime > startTime` when *both* fields were supplied in the same PATCH body. A request sending only `endTime` (or only `startTime`) could persist `endTime <= startTime` in the database, which would later cause the scheduler to compute negative durations.

### Fix applied
Changed `&&` → `||` and resolved effective values by falling back to `existing.startTime` / `existing.endTime` before comparing:

```typescript
if (body.startTime !== undefined || body.endTime !== undefined) {
  const effectiveStart = new Date(body.startTime ?? existing.startTime);
  const effectiveEnd   = new Date(body.endTime   ?? existing.endTime);
  if (effectiveEnd <= effectiveStart) {
    res.status(400).json({ error: "endTime must be after startTime" });
    return;
  }
}
```

`existing` is already in scope from the ownership check — no extra DB round-trip required.

## Build result
`npm run build` → **0 errors, 0 warnings** (tsc exit code 0).

## Checklist (unchanged from prior step)
| Check | Result |
|---|---|
| `src/lib/validate.ts` exists and complete | ✅ |
| `src/routes/tasks.ts` all 5 endpoints present | ✅ |
| `src/routes/fixedEvents.ts` all 5 endpoints present | ✅ |
| `app.ts` mounts `/api/tasks` and `/api/fixed-events` | ✅ |
| `authenticate` middleware on every route | ✅ |
| Ownership checks on GET/:id, PATCH/:id, DELETE/:id | ✅ |
| Zod v4 API used (`err.issues`, `.min(1)`) | ✅ |
| ESM `.js` extensions on all relative imports | ✅ |
| No scheduler / schedule_blocks / checkins leaked in | ✅ |
| Partial PATCH time-range bypass fixed | ✅ |
