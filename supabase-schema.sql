-- ============================================================
-- QUIZOUT — run this entire file in Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- 1. ROOMS
create table if not exists rooms (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  host_id               uuid not null,          -- references players.id (set after player created)
  category              text not null default '',
  status                text not null default 'waiting'
                          check (status in ('waiting','questions','reveal','sudden_death','results')),
  current_question_index int  not null default 0,
  created_at            timestamptz not null default now()
);

-- 2. PLAYERS
create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references rooms(id) on delete cascade,
  name       text not null,
  is_host    boolean not null default false,
  score      int not null default 0,
  created_at timestamptz not null default now()
);

-- 3. QUESTIONS
create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  question      text not null,
  options       jsonb not null,   -- array of 4 strings
  correct_index int not null,     -- 0-3
  created_at    timestamptz not null default now()
);

-- 4. ANSWERS
create table if not exists answers (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references rooms(id) on delete cascade,
  player_id       uuid not null references players(id) on delete cascade,
  question_id     uuid not null references questions(id),
  question_index  int not null,
  chosen_index    int not null,   -- -1 = no answer (timed out)
  created_at      timestamptz not null default now(),
  unique (room_id, player_id, question_index)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- For MVP we allow all reads and writes. Tighten before going public.

alter table rooms     enable row level security;
alter table players   enable row level security;
alter table questions enable row level security;
alter table answers   enable row level security;

create policy "public read rooms"     on rooms     for select using (true);
create policy "public insert rooms"   on rooms     for insert with check (true);
create policy "public update rooms"   on rooms     for update using (true);

create policy "public read players"   on players   for select using (true);
create policy "public insert players" on players   for insert with check (true);
create policy "public update players" on players   for update using (true);

create policy "public read questions" on questions for select using (true);
create policy "public insert questions" on questions for insert with check (true);

create policy "public read answers"   on answers   for select using (true);
create policy "public insert answers" on answers   for insert with check (true);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Enable Realtime for the tables that change during a game

alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table answers;

-- ─── Seed questions ───────────────────────────────────────────────────────────

insert into questions (category, question, options, correct_index) values

-- Premier League
('premier_league', 'Who holds the record for most Premier League goals?',
 '["Andrew Cole","Alan Shearer","Wayne Rooney","Frank Lampard"]', 1),

('premier_league', 'Which club has won the most Premier League titles?',
 '["Liverpool","Arsenal","Chelsea","Manchester United"]', 3),

('premier_league', 'In what year was the Premier League founded?',
 '["1988","1990","1992","1995"]', 2),

('premier_league', 'Which goalkeeper has kept the most Premier League clean sheets?',
 '["David Seaman","Pepe Reina","David James","Peter Schmeichel"]', 2),

('premier_league', 'Which team went an entire Premier League season unbeaten?',
 '["Manchester United","Chelsea","Arsenal","Liverpool"]', 2),

('premier_league', 'Who scored the fastest Premier League hat-trick (in 4 min 33 sec)?',
 '["Robbie Fowler","Michael Owen","Alan Shearer","Sadio Mané"]', 0),

('premier_league', 'Which stadium has the largest capacity in the Premier League?',
 '["Tottenham Hotspur Stadium","Old Trafford","Anfield","Emirates Stadium"]', 1),

('premier_league', 'How many clubs have won the Premier League title?',
 '["4","5","6","7"]', 2),

-- World Cup
('world_cup', 'Which country has won the most FIFA World Cups?',
 '["Germany","Argentina","Italy","Brazil"]', 3),

('world_cup', 'Who is the all-time top scorer in World Cup history?',
 '["Pelé","Ronaldo (Brazil)","Just Fontaine","Miroslav Klose"]', 3),

('world_cup', 'In which country was the first World Cup held in 1930?',
 '["Brazil","Italy","Uruguay","France"]', 2),

('world_cup', 'Which team won the 2022 FIFA World Cup?',
 '["France","Brazil","Argentina","Croatia"]', 2),

('world_cup', 'England''s only World Cup win came in which year?',
 '["1962","1966","1970","1974"]', 1),

('world_cup', 'Who scored the "Hand of God" goal?',
 '["Pelé","Ronaldo","Diego Maradona","Zinedine Zidane"]', 2),

('world_cup', 'Which country hosted the 2018 FIFA World Cup?',
 '["Qatar","Russia","South Africa","Brazil"]', 1),

('world_cup', 'How many players are on a football pitch per team?',
 '["9","10","11","12"]', 2),

-- Champions League
('champions_league', 'Which club has won the most UEFA Champions League titles?',
 '["Barcelona","Bayern Munich","AC Milan","Real Madrid"]', 3),

('champions_league', 'Who is the all-time top scorer in the Champions League?',
 '["Lionel Messi","Karim Benzema","Raúl","Cristiano Ronaldo"]', 3),

('champions_league', 'In which city was the first European Cup final held in 1956?',
 '["Madrid","Paris","London","Rome"]', 1),

('champions_league', 'Which English club won the Champions League in 2019?',
 '["Manchester City","Arsenal","Liverpool","Chelsea"]', 2),

('champions_league', 'The Champions League anthem was composed by whom?',
 '["Andrew Lloyd Webber","Tony Britten","Hans Zimmer","John Williams"]', 1),

('champions_league', 'Which team completed a comeback from 3-0 down to win in the 2005 final?',
 '["Barcelona","Chelsea","Liverpool","Arsenal"]', 2),

-- Football Legends
('legends', 'Pelé played for which Brazilian club for most of his career?',
 '["Flamengo","Corinthians","Santos","Cruzeiro"]', 2),

('legends', 'Who is known as "The King of Football"?',
 '["Diego Maradona","Pelé","Ronaldo","Johan Cruyff"]', 1),

('legends', 'Which country did Johan Cruyff represent internationally?',
 '["Belgium","Netherlands","Denmark","Germany"]', 1),

('legends', 'How many Ballon d''Or awards has Lionel Messi won?',
 '["6","7","8","9"]', 2),

('legends', 'Zinedine Zidane was famously born in which French city?',
 '["Paris","Marseille","Lyon","Nice"]', 1),

('legends', 'Which club did Diego Maradona help win the Serie A title in 1987?',
 '["Roma","Inter Milan","Napoli","Juventus"]', 2),

-- Mixed Bag
('mixed', 'How long is a standard football match (not including extra time)?',
 '["80 minutes","85 minutes","90 minutes","95 minutes"]', 2),

('mixed', 'What colour card is used to give a player a warning?',
 '["Blue","Orange","Yellow","Red"]', 2),

('mixed', 'What is the diameter of a standard football goal in metres?',
 '["6.4m","7.32m","8.0m","8.5m"]', 1),

('mixed', 'From how many yards is a penalty kick taken?',
 '["10","12","14","16"]', 1),

('mixed', 'Which country invented the game of football?',
 '["Scotland","Brazil","England","Spain"]', 2),

('mixed', 'What shape is a standard football made from?',
 '["Sphere of hexagons only","Combination of hexagons and pentagons","Perfect sphere","Icosahedron"]', 1),

('mixed', 'How many substitutes are allowed in a standard professional match?',
 '["3","4","5","6"]', 2),

('mixed', 'What does VAR stand for?',
 '["Video Assisted Referee","Visual Assistance Review","Video Analysis Recording","Verified Assist Ruling"]', 0);
