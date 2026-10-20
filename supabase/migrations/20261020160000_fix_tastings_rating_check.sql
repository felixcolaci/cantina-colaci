-- The tastings.rating check constraint allowed 1-10, but the only UI that
-- writes it (components/ui/rating-input.tsx) only ever offers 1-5, and the
-- only UI that displays it (app/(app)/wine/[id]/page.tsx) hardcodes a "/5"
-- suffix. Tighten the constraint to match the real 1-5 invariant.
alter table public.tastings drop constraint tastings_rating_check;
alter table public.tastings add constraint tastings_rating_check check (rating >= 1 and rating <= 5);
