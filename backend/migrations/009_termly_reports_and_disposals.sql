-- Termly (FORM 27) reporting and the disposal register.

-- Settings the school changes without a code release. First use: the months
-- each school term covers, which FORM 27 reports as its quarter.
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by integer REFERENCES users(id),
  updated_at timestamp DEFAULT now()
);

-- Kibuli's filled Term 1 2026 return covers January to April.
INSERT INTO app_settings (key, value) VALUES (
  'school_terms',
  '[{"term":1,"startMonth":1,"endMonth":4},{"term":2,"startMonth":5,"endMonth":8},{"term":3,"startMonth":9,"endMonth":12}]'
) ON CONFLICT (key) DO NOTHING;

-- Disposals of public assets, reported in FORM 27 Part V.
CREATE TABLE IF NOT EXISTS disposals (
  id serial PRIMARY KEY,
  reference_number text UNIQUE NOT NULL,
  subject text NOT NULL,
  method text,
  buyer_name text,
  award_date date,
  reserve_price numeric(15, 2),
  contract_price numeric(15, 2),
  notes text,
  created_by integer REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS disposals_award_date_idx ON disposals (award_date);

-- A term's FORM 27 as saved: filled from the system's records, then
-- corrected by hand before it is printed and signed.
CREATE TABLE IF NOT EXISTS termly_reports (
  id serial PRIMARY KEY,
  year integer NOT NULL,
  term integer NOT NULL CHECK (term BETWEEN 1 AND 3),
  parts jsonb NOT NULL,
  declaration jsonb,
  created_by integer REFERENCES users(id),
  updated_by integer REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE (year, term)
);
