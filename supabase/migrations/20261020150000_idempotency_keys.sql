-- Idempotency-key dedup guard for client-side retries (review-results.md
-- finding 2.1, BLOCKER).
--
-- lib/hooks/use-server-action.ts's withRetry automatically re-invokes a
-- mutating server action up to 3 times on a detected network-level error,
-- replaying the same FormData unchanged. A network error only tells the
-- client it didn't see the response -- the server may already have
-- committed the mutation before the connection dropped. This table lets an
-- action atomically "claim" a client-generated key (one per submission
-- attempt, reused across withRetry's internal retries, see
-- use-server-action.ts#run) via an insert + unique-violation check, so a
-- replay of an already-applied attempt can be detected and the mutation
-- skipped. See lib/idempotency.ts#claimIdempotencyKey for the helper that
-- uses this table.
--
-- Only ever written/read via createAdminClient() (service_role) -- every
-- action in this codebase that would use this goes through the admin
-- client. The plain session client never touches this table, so no RLS
-- policies are needed.
--
-- Known, accepted tradeoff: rows accumulate here forever (no TTL/cleanup
-- job). Out of scope for this change -- a periodic cleanup can be added
-- later if row count ever becomes a real concern.
create table public.idempotency_keys (
  key text primary key,
  created_at timestamptz not null default now()
);

-- Enabled with zero policies, matching this codebase's blanket RLS posture
-- (e.g. 011_api_usage_logs.sql): service_role bypasses RLS entirely, so this
-- is pure defense-in-depth against a future accidental grant to
-- authenticated/anon, not something this table's actual access pattern
-- depends on.
alter table public.idempotency_keys enable row level security;

revoke all on public.idempotency_keys from authenticated, anon;
grant insert, select on public.idempotency_keys to service_role;
