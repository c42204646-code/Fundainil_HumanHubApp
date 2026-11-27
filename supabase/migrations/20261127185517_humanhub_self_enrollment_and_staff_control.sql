-- Verified email + automatic least-privilege access for the synthetic Educo pilot only.
alter table humanhub.staff_profiles drop constraint staff_profiles_review_provenance;
alter table humanhub.staff_profiles drop constraint staff_profiles_approval_source_check;
alter table humanhub.staff_profiles add constraint staff_profiles_approval_source_check check(approval_source in ('manager','bootstrap','automatic'));
alter table humanhub.staff_profiles add constraint staff_profiles_review_provenance check(
 (approval_source='manager' and ((state='pending' and reviewed_by is null and reviewed_at is null) or (state<>'pending' and reviewed_by is not null and reviewed_at is not null and reviewed_by<>user_id)))
 or (approval_source in ('bootstrap','automatic') and state='approved' and reviewed_by is null and reviewed_at is not null)
);
create or replace function humanhub.request_staff_access(p_name text,p_specialty text,p_title text)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p uuid; st text;
begin
 if u is null or not exists(select 1 from auth.users a where a.id=u and a.email_confirmed_at is not null and a.email is not null) then raise exception 'verified email required'; end if;
 select id into strict p from humanhub.projects where code='EDUCO-SANDBOX' and active;
 insert into humanhub.staff_profiles(user_id,full_name,specialty,job_title) values(u,trim(p_name),trim(p_specialty),trim(p_title)) on conflict(user_id) do nothing;
 select state into strict st from humanhub.staff_profiles where user_id=u for update;
 if st='rejected' then raise exception 'access blocked'; end if;
 if exists(select 1 from humanhub.memberships where project_id=p and user_id=u) then return true; end if;
 if st<>'pending' then raise exception 'access requires administrator'; end if;
 update humanhub.staff_profiles set state='approved',approval_source='automatic',reviewed_at=clock_timestamp(),reviewed_by=null where user_id=u;
 insert into humanhub.memberships(project_id,user_id,role,active) values(p,u,'field',true);
 insert into humanhub.audit(project_id,actor_id,event,object_id) values(p,u,'verified_field_self_enrollment',u);
 return true;
end $$;
-- Existing profiles can only be activated through the same verified-account rule.
create function humanhub.manage_staff_list(p_project uuid)
returns table(user_id uuid,full_name text,specialty text,job_title text,email text,member_role text,active boolean,profile_state text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from humanhub.memberships m join humanhub.projects p on p.id=m.project_id where m.user_id=auth.uid() and m.project_id=p_project and m.active and m.role='manager' and p.active and p.code='EDUCO-SANDBOX') then raise exception 'not authorized';end if;
 return query select s.user_id,s.full_name,s.specialty,s.job_title,a.email::text,m.role,coalesce(m.active,false),s.state
 from humanhub.staff_profiles s join auth.users a on a.id=s.user_id
 left join humanhub.memberships m on m.project_id=p_project and m.user_id=s.user_id
 where s.user_id<>auth.uid() and (m.user_id is not null or s.state in ('pending','rejected')) order by s.full_name,s.user_id limit 500;
end $$;
create function humanhub.manage_staff_access(p_project uuid,p_user uuid,p_role text,p_active boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); changed integer; old_role text;
begin
 if actor is null or p_user is null or actor=p_user or p_active is null or p_role is null or p_role not in ('field','coordinator','monitoring') or not exists(select 1 from humanhub.memberships m join humanhub.projects p on p.id=m.project_id where m.user_id=actor and m.project_id=p_project and m.active and m.role='manager' and p.active and p.code='EDUCO-SANDBOX') then raise exception 'not authorized';end if;
 select role into old_role from humanhub.memberships where project_id=p_project and user_id=p_user for update;
 if old_role is null or old_role not in ('field','coordinator','monitoring') then raise exception 'account not manageable';end if;
 update humanhub.memberships set role=p_role,active=p_active where project_id=p_project and user_id=p_user;
 insert into humanhub.audit(project_id,actor_id,event,object_id) values(p_project,actor,case when p_active then 'staff_access_updated' else 'staff_access_suspended' end,p_user);
 return true;
end $$;
revoke all on function humanhub.manage_staff_list(uuid),humanhub.manage_staff_access(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function humanhub.manage_staff_list(uuid),humanhub.manage_staff_access(uuid,uuid,text,boolean) to authenticated;
create function public.hh_staff_directory(p_project uuid) returns table(user_id uuid,full_name text,specialty text,job_title text,email text,member_role text,active boolean,profile_state text) language sql stable security invoker set search_path='' as $$select * from humanhub.manage_staff_list(p_project)$$;
create function public.hh_manage_staff_access(p_project uuid,p_user uuid,p_role text,p_active boolean) returns boolean language sql security invoker set search_path='' as $$select humanhub.manage_staff_access(p_project,p_user,p_role,p_active)$$;
revoke all on function public.hh_staff_directory(uuid),public.hh_manage_staff_access(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.hh_staff_directory(uuid),public.hh_manage_staff_access(uuid,uuid,text,boolean) to authenticated;
