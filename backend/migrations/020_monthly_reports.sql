-- A month's FORM 2 as saved: filled from the records, then corrected by hand.
CREATE TABLE IF NOT EXISTS monthly_reports (
  id serial PRIMARY KEY,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  parts jsonb NOT NULL,
  declaration jsonb,
  created_by integer REFERENCES users(id),
  updated_by integer REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE (year, month)
);

ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON monthly_reports FROM anon, authenticated;
