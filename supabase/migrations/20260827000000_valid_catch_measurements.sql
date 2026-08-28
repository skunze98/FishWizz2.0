-- P0 (staging QA, 2026-08-27): "FishWizz accepted and saved a Bluegill
-- measuring -5 in and 9999 lb, labeled it a personal best." Client-side
-- validation (catch-pro.js / catch-history-pro.js, see public/measurement-
-- guard.js) now rejects this at the form -- but the client can be bypassed
-- (devtools, a direct REST call with a valid access token), so the same
-- bounds must be enforced in the database, which is the only boundary an
-- attacker/bug on the client can't route around.
--
-- Bounds mirror the client exactly (public/measurement-guard.js LIMITS):
-- length_in in (0, 100], weight_lb in (0, 200]. NULL is always allowed --
-- both fields are optional.
--
-- NOT VALID + no VALIDATE CONSTRAINT: this enforces the rule for every
-- INSERT and UPDATE from this point forward without validating (or
-- touching) any row that already exists -- including the QA account's
-- existing Bluegill(-5 in, 9999 lb) record, which the instruction requires
-- be preserved exactly as-is, not deleted, reset, or silently rewritten.
-- Postgres's NOT VALID is the standard, non-destructive way to add a CHECK
-- constraint under that constraint: it is real and enforced for new data,
-- while pre-existing rows keep whatever values they already had, valid or
-- not, indefinitely (validating it later, once that row is intentionally
-- fixed or removed by its owner, is a separate future step -- not part of
-- this change).
alter table public.catches
  add constraint catches_length_in_valid
  check (length_in is null or (length_in > 0 and length_in <= 100))
  not valid;

alter table public.catches
  add constraint catches_weight_lb_valid
  check (weight_lb is null or (weight_lb > 0 and weight_lb <= 200))
  not valid;
