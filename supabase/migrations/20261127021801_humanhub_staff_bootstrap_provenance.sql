-- An initial administrator can be authorized by database administration, not self-review.
-- Existing user-facing review routines continue to require a distinct active manager.
alter table humanhub.staff_profiles add column approval_source text not null default 'manager' check(approval_source in ('manager','bootstrap'));
alter table humanhub.staff_profiles drop constraint staff_profiles_check;
alter table humanhub.staff_profiles add constraint staff_profiles_review_provenance check(
 (approval_source='manager' and ((state='pending' and reviewed_by is null and reviewed_at is null) or (state<>'pending' and reviewed_by is not null and reviewed_at is not null and reviewed_by<>user_id)))
 or (approval_source='bootstrap' and state='approved' and reviewed_by is null and reviewed_at is not null)
);
-- No direct writes to staff profiles by client roles.
revoke insert,update,delete on humanhub.staff_profiles from public,anon,authenticated,service_role;
