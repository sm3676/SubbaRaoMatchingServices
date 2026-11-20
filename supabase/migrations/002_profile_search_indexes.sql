-- Optional performance indexes for large profile directories. Run once in Supabase SQL Editor.
create extension if not exists pg_trgm;
create index if not exists profiles_created_at_id_idx on public.profiles (created_at desc, id desc);
create index if not exists profiles_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);
create index if not exists profiles_location_trgm_idx on public.profiles using gin (location gin_trgm_ops);
create index if not exists profiles_job_trgm_idx on public.profiles using gin (job gin_trgm_ops);
create index if not exists profiles_code_trgm_idx on public.profiles using gin (profile_code gin_trgm_ops);
