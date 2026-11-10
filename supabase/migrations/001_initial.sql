create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'member' check (role in ('admin','member')),
  active boolean not null default true,
  language text not null default 'en' check (language in ('en','te')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  profile_code text unique not null default ('MM-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,8))),
  gender text not null check (gender in ('Male','Female')),
  full_name text,
  age int check (age is null or age between 18 and 100),
  location text,
  gothram text,
  star text,
  education text,
  job text,
  salary_lpa numeric(12,2) check (salary_lpa is null or salary_lpa >= 0),
  phone text,
  source_group text,
  source_sender text,
  source_date date,
  notes text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  marriage_status text not null default 'available' check (marriage_status in ('available','on_hold','married','closed')),
  first_submitted_by uuid references public.user_profiles(id),
  first_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_gender_idx on public.profiles(gender);
create index if not exists profiles_name_idx on public.profiles using gin (to_tsvector('simple',coalesce(full_name,'')));
create index if not exists profiles_phone_idx on public.profiles(phone);
create index if not exists profiles_code_idx on public.profiles(profile_code);

create table if not exists public.profile_submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id),
  submitted_at timestamptz not null default now(),
  source_group text,
  source_sender text,
  is_first boolean not null default false
);

create table if not exists public.profile_images (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  original_filename text,
  uploaded_by uuid not null references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.shortlists (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.user_profiles(id),
  notes text default '',
  created_at timestamptz not null default now(),
  unique(profile_id,created_by)
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  owner_id uuid not null references public.user_profiles(id),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  notes text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.user_profiles(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_events (
  id bigint generated always as identity primary key,
  payload jsonb not null,
  status text not null default 'needs_review',
  created_at timestamptz not null default now()
);

-- Create a user profile after an Auth user is created. Role remains member unless admin assigns it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.user_profiles(id,full_name,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'member')
  on conflict(id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS is enabled. The backend uses the service-role key only server-side and enforces app roles.
alter table public.user_profiles enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_submissions enable row level security;
alter table public.profile_images enable row level security;
alter table public.shortlists enable row level security;
alter table public.commissions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.whatsapp_events enable row level security;

-- No anon/public policies. Client-side direct table access is intentionally denied.
-- All data access passes through the FastAPI backend after validating the Supabase JWT.
-- Service role bypasses RLS and MUST never be shipped to the browser.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-images','profile-images',false,12582912,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=12582912;
