create extension if not exists "pgcrypto";

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "userId" uuid not null references auth.users(id) on delete cascade,
  "imageId" text,
  "inviteCode" text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  "workspaceId" uuid not null references public.workspaces(id) on delete cascade,
  "userId" uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  "workspaceId" uuid not null references public.workspaces(id) on delete cascade,
  "imageId" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  summary text not null default '',
  status text not null,
  "workType" text not null default 'TASK',
  "workspaceId" uuid not null references public.workspaces(id) on delete cascade,
  "projectId" uuid not null references public.projects(id) on delete cascade,
  "reporterId" uuid references public.members(id) on delete set null,
  "assigneeId" uuid references public.members(id) on delete set null,
  position integer not null default 1000,
  description text,
  attachments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  "taskId" uuid not null references public.tasks(id) on delete cascade,
  "memberId" uuid not null references public.members(id) on delete cascade,
  body text not null,
  attachments text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_history (
  id uuid primary key default gen_random_uuid(),
  "taskId" uuid not null references public.tasks(id) on delete cascade,
  "memberId" uuid not null references public.members(id) on delete cascade,
  field text not null,
  "fromValue" text,
  "toValue" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task on public.task_comments ("taskId");
create index if not exists idx_task_comments_member on public.task_comments ("memberId");
create index if not exists idx_task_history_task on public.task_history ("taskId");
create index if not exists idx_task_history_member on public.task_history ("memberId");

create index if not exists idx_members_workspace on public.members ("workspaceId");
create index if not exists idx_members_user on public.members ("userId");
create index if not exists idx_projects_workspace on public.projects ("workspaceId");
create index if not exists idx_tasks_workspace on public.tasks ("workspaceId");
create index if not exists idx_tasks_project on public.tasks ("projectId");
create index if not exists idx_tasks_assignee on public.tasks ("assigneeId");
create index if not exists idx_tasks_status on public.tasks (status);
