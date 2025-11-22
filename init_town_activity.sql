-- 우리동네 활동 랭킹 테이블 생성

-- 1. 동네별 활동 점수 테이블
CREATE TABLE IF NOT EXISTS town_activity (
  id SERIAL PRIMARY KEY,
  town_name TEXT UNIQUE NOT NULL,
  raw_score INTEGER NOT NULL DEFAULT 0,
  score_normalized DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. 동네별 인구 데이터 테이블
CREATE TABLE IF NOT EXISTS town_population (
  id SERIAL PRIMARY KEY,
  town_name TEXT UNIQUE NOT NULL,
  population INTEGER NOT NULL DEFAULT 1000
);

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_town_activity_normalized ON town_activity(score_normalized DESC);
CREATE INDEX IF NOT EXISTS idx_town_activity_name ON town_activity(town_name);
CREATE INDEX IF NOT EXISTS idx_town_population_name ON town_population(town_name);

-- 4. 초기 샘플 데이터 (의정부시 동네들)
INSERT INTO town_population (town_name, population) VALUES
  ('경기 의정부시 가능동', 25000),
  ('경기 의정부시 녹양동', 18000),
  ('경기 의정부시 의정부동', 32000),
  ('경기 의정부시 호원동', 28000),
  ('경기 의정부시 민락동', 22000)
ON CONFLICT (town_name) DO NOTHING;
