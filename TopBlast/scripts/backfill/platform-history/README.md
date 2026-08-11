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
