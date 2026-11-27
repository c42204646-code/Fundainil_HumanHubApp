-- Authenticated read-only bootstrap. Only project metadata and indicator definitions.
grant usage on schema humanhub to authenticated;
grant select(project_id,user_id,role,active) on humanhub.memberships to authenticated;
grant select(id,code,name,active) on humanhub.projects to authenticated;
grant select(project_id,code,label,kind) on humanhub.indicators to authenticated;
create policy own_active_membership on humanhub.memberships for select to authenticated using (active and user_id=(select auth.uid()));
create policy assigned_active_project on humanhub.projects for select to authenticated using (active and exists(select 1 from humanhub.memberships m where m.project_id=projects.id and m.user_id=(select auth.uid()) and m.active));
create policy assigned_indicator_catalog on humanhub.indicators for select to authenticated using (exists(select 1 from humanhub.projects p where p.id=indicators.project_id and p.active));
create function public.hh_my_access()
returns table(project_id uuid,project_code text,project_name text,member_role text,field_access boolean,coord_access boolean,mera_access boolean)
language sql stable security invoker set search_path='' as $$
 select p.id,p.code,p.name,m.role,
 m.role in ('field','coordinator','manager'),
 m.role in ('coordinator','manager','director'),
 m.role in ('monitoring','coordinator','manager','director','auditor')
 from humanhub.memberships m join humanhub.projects p on p.id=m.project_id
 where m.user_id=(select auth.uid()) and m.active and p.active order by p.code;
$$;
create function public.hh_project_catalog(p_project uuid)
returns table(indicator_code text,label text,kind text)
language sql stable security invoker set search_path='' as $$
 select i.code,i.label,i.kind from humanhub.indicators i where i.project_id=p_project
 and exists(select 1 from humanhub.memberships m where m.project_id=p_project and m.user_id=(select auth.uid()) and m.active)
 order by i.code;
$$;
revoke all on function public.hh_my_access() from public,anon,authenticated,service_role;
revoke all on function public.hh_project_catalog(uuid) from public,anon,authenticated,service_role;
grant execute on function public.hh_my_access() to authenticated;
grant execute on function public.hh_project_catalog(uuid) to authenticated;
-- Reference definitions from the versioned catalog; not actual measurements or approved targets.
insert into humanhub.projects(code,name) values('EDUCO-SANDBOX','Educo · entorno de pruebas');
insert into humanhub.indicators(project_id,code,label,kind)
select p.id,v.code,v.label,v.kind from humanhub.projects p cross join (values
('coverage','NNA únicos atendidos (protección, PS o educación)','unique'),
('education','NNA únicos en refuerzo educativo','unique'),
('psychosocial','NNA únicos en apoyo psicosocial','unique'),
('ps_sessions','Sesiones psicosociales individuales y grupales (sin duplicar)','event'),
('ps_group','Sesiones grupales de apoyo psicosocial','event'),
('pap','Atenciones individuales / PAP','event'),
('violence','Talleres de prevención de violencias / crianza','event'),
('caregivers','Madres, padres y cuidadores únicos vinculados','unique'),
('women','Mujeres, madres y cuidadoras orientadas en protección','unique'),
('leaders','Líderes y voluntarios que completan formación','unique'),
('women_leaders','Lideresas fortalecidas (subconjunto de líderes y mujeres)','unique'),
('teachers','Docentes / facilitadores únicos vinculados','unique'),
('facilitators','Facilitadores comunitarios capacitados','unique'),
('selfcare','Docentes / facilitadores en autocuidado','unique'),
('wash_points','Puntos WASH funcionales al cierre','stock'),
('hygiene','Jornadas de promoción de higiene / WASH','event'),
('fixed','Espacios de Apoyo fijos habilitados y operativos','stock'),
('mobile','Rutas móviles de atención implementadas','stock'),
('eta','ETA habilitados y operativos','stock'),
('school_kits','Kits escolares y de aprendizaje entregados','event'),
('menstrual_kits','Kits de higiene menstrual entregados','event'),
('education_sessions','Sesiones de nivelación educativa','event'),
('sel','Actividades de aprendizaje socioemocional','event'),
('protection_routes','Espacios con rutas de protección verificadas y activas','stock'),
('communities','Comunidades priorizadas con intervención verificada','stock'),
('trips','Traslados logísticos ejecutados','event'),
('field_days','Jornadas comunitarias ejecutadas','event'),
('indirect','Beneficiarios indirectos (criterio pendiente de validación)','unique'),
('quality','Asistencia pertinente, accesible, oportuna, segura y participativa','rate'),
('wellbeing','Mejora del bienestar psicosocial de NNA y cuidadores','rate'),
('continuity','Mejor acceso o continuidad educativa de NNA','rate'),
('case_route','Casos de desprotección con ruta activada y seguimiento','rate'),
('risk_knowledge','Capacidad para identificar riesgos y utilizar rutas','rate'),
('safe_water','Hábitos correctos de higiene y agua segura','rate'),
('academic_sel','Avances académicos e integración socioemocional','rate'),
('sio2','NNA consultados que se sienten seguros, respetados y respaldados','rate'),
('sio1','NNA con evaluación inicial y final que mejoran al menos una competencia','rate'),
('route_rate','Espacios fijos con procedimientos de protección y derivación','rate')
) v(code,label,kind) where p.code='EDUCO-SANDBOX';
