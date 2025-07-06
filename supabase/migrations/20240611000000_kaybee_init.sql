-- Users
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Funding Organizations
create table funding_organizations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text
);

-- Grants
create table grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  funding_organization_id uuid references funding_organizations(id),
  title text not null,
  description text,
  status text,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- Grant Versions
create table grant_versions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid references grants(id) on delete cascade,
  version_number int not null,
  file_url text,
  summary text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Call for Proposal
create table call_for_proposal (
  id uuid primary key default gen_random_uuid(),
  grant_version_id uuid references grant_versions(id) on delete cascade,
  description_markdown text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Reviewer Feedback
create table reviewer_feedback (
  id uuid primary key default gen_random_uuid(),
  grant_version_id uuid references grant_versions(id) on delete cascade,
  reviewer_name text,
  feedback_text text,
  created_at timestamp with time zone default timezone('utc', now()),
  priority text,
  flagged_by_user boolean default false
); 
