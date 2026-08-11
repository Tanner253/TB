# Platform history backfill (read-only retrieve + optional Mongo import)

One-off ops tools used after the production wipe. Keep here; do not wire into app runtime.

## Retrieve (no DB writes)

```bash
node scripts/backfill/platform-history/retrieve-platform-payout-history.mjs
```

Writes `fixtures/platform-payout-retrieval.json`.

## Import (TB only, upsert by txHash)

```bash
node scripts/backfill/platform-history/import-platform-payout-history.mjs
node scripts/backfill/platform-history/import-platform-payout-history.mjs --execute --allow-db=TB
```

Dry-run by default. `--execute` writes; refuses any DB name other than `--allow-db`.

After import, `payout_timer.currentCycle` is set to the max imported cycle so the next live payout is `max+1` (avoids colliding with backfilled cycle numbers).

## Repair live/backfill cycle collisions

If live payouts ran while timer was still at 0/1 after a backfill into cycles 1…N:

```bash
node scripts/backfill/platform-history/repair-cycle-collisions.mjs
node scripts/backfill/platform-history/repair-cycle-collisions.mjs --execute --allow-db=TB
```
