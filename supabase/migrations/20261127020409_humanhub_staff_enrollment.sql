-- Institutional staff enrollment: one identity, no self-selected project or role.
create table humanhub.staff_profiles(
 user_id uuid primary key references auth.users(id),
 full_name text not null check(length(trim(full_name)) between 3 and 160),
 specialty text not null check(length(trim(specialty)) between 2 and 120),
 job_title text not null check(length(trim(job_title)) between 2 and 120),
 state text not null default 'pending' check(state in ('pending','approved','rejected')),
 requested_at timestamptz not null default now(), reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 check((state='pending' and reviewed_by is null and reviewed_at is null) or (state<>'pending' and reviewed_by is not null and reviewed_at is not null and reviewed_by<>user_id))
);
alter table humanhub.staff_profiles enable row level security;
revoke all on humanhub.staff_profiles from public,anon,authenticated,service_role;
grant select on humanhub.staff_profiles to authenticated;
create policy staff_own_read on humanhub.staff_profiles for select to authenticated using(user_id=(select auth.uid()));
create function humanhub.request_staff_access(p_name text,p_specialty text,p_title text)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not exists(select 1 from auth.users a where a.id=u and a.email_confirmed_at is not null and a.email is not null) then raise exception 'verified email required'; end if;
 insert into humanhub.staff_profiles(user_id,full_name,specialty,job_title) values(u,trim(p_name),trim(p_specialty),trim(p_title));
 return true;
end $$;
create function humanhub.staff_requests(p_project uuid)
returns table(user_id uuid,full_name text,specialty text,job_title text,email text,requested_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from humanhub.memberships m join humanhub.projects p on p.id=m.project_id where m.user_id=auth.uid() and m.project_id=p_project and m.active and m.role='manager' and p.active and p.code='EDUCO-SANDBOX') then raise exception 'not authorized'; end if;
 return query select s.user_id,s.full_name,s.specialty,s.job_title,a.email::text,s.requested_at from humanhub.staff_profiles s join auth.users a on a.id=s.user_id where s.state='pending' and a.email_confirmed_at is not null and s.user_id<>auth.uid() order by s.requested_at limit 100;
end $$;
create function humanhub.review_staff_request(p_project uuid,p_user uuid,p_role text,p_approve boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); changed integer;
begin
 if actor is null or actor=p_user or p_approve is null or p_role is null or p_role not in ('field','coordinator','monitoring') or not exists(select 1 from humanhub.memberships m join humanhub.projects p on p.id=m.project_id where m.user_id=actor and m.project_id=p_project and m.active and m.role='manager' and p.active and p.code='EDUCO-SANDBOX') then raise exception 'not authorized'; end if;
 if not exists(select 1 from auth.users a where a.id=p_user and a.email_confirmed_at is not null and a.email is not null) then raise exception 'verified email required'; end if;
 update humanhub.staff_profiles set state=case when p_approve then 'approved' else 'rejected' end,reviewed_by=actor,reviewed_at=clock_timestamp() where user_id=p_user and state='pending';
 get diagnostics changed=row_count;if changed<>1 then raise exception 'request not pending';end if;
 if p_approve then insert into humanhub.memberships(project_id,user_id,role,active) values(p_project,p_user,p_role,true);end if;
 insert into humanhub.audit(project_id,actor_id,event,object_id) values(p_project,actor,case when p_approve then 'staff_request_approved' else 'staff_request_rejected' end,p_user);
 return true;
end $$;
revoke all on function humanhub.request_staff_access(text,text,text),humanhub.staff_requests(uuid),humanhub.review_staff_request(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function humanhub.request_staff_access(text,text,text),humanhub.staff_requests(uuid),humanhub.review_staff_request(uuid,uuid,text,boolean) to authenticated;
create function public.hh_request_staff_access(p_name text,p_specialty text,p_title text) returns boolean language sql security invoker set search_path='' as $$select humanhub.request_staff_access(p_name,p_specialty,p_title)$$;
create function public.hh_my_staff_profile() returns table(full_name text,specialty text,job_title text,state text) language sql stable security invoker set search_path='' as $$select s.full_name,s.specialty,s.job_title,s.state from humanhub.staff_profiles s where s.user_id=auth.uid()$$;
create function public.hh_staff_requests(p_project uuid) returns table(user_id uuid,full_name text,specialty text,job_title text,email text,requested_at timestamptz) language sql stable security invoker set search_path='' as $$select * from humanhub.staff_requests(p_project)$$;
create function public.hh_review_staff_request(p_project uuid,p_user uuid,p_role text,p_approve boolean) returns boolean language sql security invoker set search_path='' as $$select humanhub.review_staff_request(p_project,p_user,p_role,p_approve)$$;
revoke all on function public.hh_request_staff_access(text,text,text),public.hh_my_staff_profile(),public.hh_staff_requests(uuid),public.hh_review_staff_request(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.hh_request_staff_access(text,text,text),public.hh_my_staff_profile(),public.hh_staff_requests(uuid),public.hh_review_staff_request(uuid,uuid,text,boolean) to authenticated;
