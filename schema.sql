-- LTV ICT Workflow: initial database schema
-- Run in Supabase Dashboard > SQL Editor.
-- This policy design assumes only authorized ICT personnel are created in Supabase Auth.
-- Disable public sign-ups in Supabase Auth settings and invite/create accounts administratively.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  description text,
  status text not null default 'Active'
    check (status in ('Planning', 'Active', 'On Hold', 'Completed')),
  due_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  status text not null default 'To Do'
    check (status in ('To Do', 'In Progress', 'Blocked', 'Completed')),
  due_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_project_id_idx on public.tasks(project_id);
create index if not exists tasks_assignee_id_idx on public.tasks(assignee_id);
create index if not exists tasks_status_idx on public.tasks(status);
create index if not exists tasks_due_date_idx on public.tasks(due_date);

-- Automatically create a profile whenever an authorized Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;

-- Remove default access for unauthenticated visitors.
revoke all on public.profiles from anon;
revoke all on public.projects from anon;
revoke all on public.tasks from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

-- Profiles: all authenticated ICT members can see the team directory;
-- users can edit only their own profile. Profile creation is handled by the trigger.
drop policy if exists "ICT members can view profiles" on public.profiles;
create policy "ICT members can view profiles"
on public.profiles for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Shared ICT workspace: every authenticated account can collaborate on projects/tasks.
-- Keep account creation restricted to ICT staff in Supabase Auth settings.
drop policy if exists "ICT members read projects" on public.projects;
create policy "ICT members read projects"
on public.projects for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "ICT members create projects" on public.projects;
create policy "ICT members create projects"
on public.projects for insert to authenticated
with check ((select auth.uid()) = created_by);

drop policy if exists "ICT members update projects" on public.projects;
create policy "ICT members update projects"
on public.projects for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "ICT members delete projects" on public.projects;
create policy "ICT members delete projects"
on public.projects for delete to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "ICT members read tasks" on public.tasks;
create policy "ICT members read tasks"
on public.tasks for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "ICT members create tasks" on public.tasks;
create policy "ICT members create tasks"
on public.tasks for insert to authenticated
with check ((select auth.uid()) = created_by);

drop policy if exists "ICT members update tasks" on public.tasks;
create policy "ICT members update tasks"
on public.tasks for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "ICT members delete tasks" on public.tasks;
create policy "ICT members delete tasks"
on public.tasks for delete to authenticated
using ((select auth.uid()) is not null);

-- Updated timestamps.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute procedure public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute procedure public.set_updated_at();
