create extension if not exists "pgcrypto";

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  cover_url text,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  idx int not null,
  prompt text not null,
  options jsonb not null,
  correct_index int not null,
  time_limit_sec int not null default 20,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  host_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  status text not null check (status in ('lobby', 'question', 'results', 'ended')),
  current_question_idx int not null default 0,
  question_started_at timestamptz,
  paused_at timestamptz,
  pause_accumulated_ms int not null default 0,
  locked boolean not null default false,
  auto_advance_sec int not null default 0,
  public_question jsonb,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  nickname text not null,
  score int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_index int not null,
  is_correct boolean not null default false,
  awarded_points int not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, participant_id, question_id)
);

create table if not exists session_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  score int not null,
  rank int not null,
  created_at timestamptz not null default now()
);

create unique index if not exists sessions_code_idx on sessions(code);
create index if not exists questions_quiz_idx on questions(quiz_id, idx);
create index if not exists participants_session_idx on participants(session_id);
create unique index if not exists participants_unique_nickname_idx on participants(session_id, lower(nickname));
create index if not exists teams_session_idx on teams(session_id);
create index if not exists session_results_session_idx on session_results(session_id);

alter table quizzes enable row level security;
alter table questions enable row level security;
alter table sessions enable row level security;
alter table teams enable row level security;
alter table participants enable row level security;
alter table answers enable row level security;
alter table session_results enable row level security;

-- Quizzes policies
create policy "quiz_owner_select" on quizzes
  for select using (owner_id = auth.uid());

create policy "quiz_owner_insert" on quizzes
  for insert with check (owner_id = auth.uid());

create policy "quiz_owner_update" on quizzes
  for update using (owner_id = auth.uid());

create policy "quiz_owner_delete" on quizzes
  for delete using (owner_id = auth.uid());

-- Questions policies
create policy "question_owner_select" on questions
  for select using (
    exists (select 1 from quizzes q where q.id = questions.quiz_id and q.owner_id = auth.uid())
  );

create policy "question_owner_insert" on questions
  for insert with check (
    exists (select 1 from quizzes q where q.id = questions.quiz_id and q.owner_id = auth.uid())
  );

create policy "question_owner_update" on questions
  for update using (
    exists (select 1 from quizzes q where q.id = questions.quiz_id and q.owner_id = auth.uid())
  );

create policy "question_owner_delete" on questions
  for delete using (
    exists (select 1 from quizzes q where q.id = questions.quiz_id and q.owner_id = auth.uid())
  );

-- Sessions policies
create policy "session_public_select" on sessions
  for select using (true);

create policy "session_host_insert" on sessions
  for insert with check (host_id = auth.uid());

create policy "session_host_update" on sessions
  for update using (host_id = auth.uid());

create policy "session_host_delete" on sessions
  for delete using (host_id = auth.uid());

-- Teams policies
create policy "teams_public_select" on teams
  for select using (true);

create policy "teams_host_insert" on teams
  for insert with check (
    exists (select 1 from sessions s where s.id = teams.session_id and s.host_id = auth.uid())
  );

create policy "teams_host_update" on teams
  for update using (
    exists (select 1 from sessions s where s.id = teams.session_id and s.host_id = auth.uid())
  );

-- Participants policies
create policy "participant_public_insert" on participants
  for insert with check (
    exists (select 1 from sessions s where s.id = participants.session_id and s.status <> 'ended')
  );

create policy "participant_public_select" on participants
  for select using (
    exists (select 1 from sessions s where s.id = participants.session_id)
  );

create policy "participant_host_select" on participants
  for select using (
    exists (select 1 from sessions s where s.id = participants.session_id and s.host_id = auth.uid())
  );

create policy "participant_host_update" on participants
  for update using (
    exists (select 1 from sessions s where s.id = participants.session_id and s.host_id = auth.uid())
  );

-- Answers policies
create policy "answer_public_insert" on answers
  for insert with check (
    exists (
      select 1 from sessions s
      where s.id = answers.session_id and s.status = 'question' and s.locked = false
    )
    and exists (
      select 1 from participants p
      where p.id = answers.participant_id and p.session_id = answers.session_id
    )
  );

create policy "answer_host_select" on answers
  for select using (
    exists (select 1 from sessions s where s.id = answers.session_id and s.host_id = auth.uid())
  );

create policy "answer_host_update" on answers
  for update using (
    exists (select 1 from sessions s where s.id = answers.session_id and s.host_id = auth.uid())
  );

-- Session results policies
create policy "session_results_host_select" on session_results
  for select using (
    exists (select 1 from sessions s where s.id = session_results.session_id and s.host_id = auth.uid())
  );

create policy "session_results_host_insert" on session_results
  for insert with check (
    exists (select 1 from sessions s where s.id = session_results.session_id and s.host_id = auth.uid())
  );
