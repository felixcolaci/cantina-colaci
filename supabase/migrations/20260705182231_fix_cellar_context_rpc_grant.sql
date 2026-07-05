-- Reconciles migration history with a corrective grant change that was
-- applied directly to the remote database in commit 2acf80d ("fix: revoke
-- authenticated execute grant on get_cellar_context RPC") but never had a
-- corresponding migration file committed to this directory. Editing
-- 014_cellar_context_rpc.sql alone did not retroactively change grants
-- already applied to the remote project, so this file exists purely to
-- keep local migration history in sync with what is already live
-- (idempotent no-op against the current remote state).
revoke execute on function public.get_cellar_context(uuid) from authenticated;
grant execute on function public.get_cellar_context(uuid) to service_role;
