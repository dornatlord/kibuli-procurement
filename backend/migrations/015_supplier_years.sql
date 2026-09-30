-- The school keeps a list of suppliers for each year. At the start of a year it
-- carries last year's list forward, picks who to keep, or starts afresh. A
-- supplier is never deleted for it: old LPOs and contracts keep theirs.
CREATE TABLE supplier_years (
  supplier_id integer NOT NULL REFERENCES suppliers(id),
  year integer NOT NULL,
  added_by integer REFERENCES users(id),
  added_at timestamp DEFAULT now(),
  PRIMARY KEY (supplier_id, year)
);

-- Reached only through the API, like every other table (migration 012).
ALTER TABLE supplier_years ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON supplier_years FROM anon, authenticated;

-- Everyone on the register so far is on 2026's list.
INSERT INTO supplier_years (supplier_id, year) SELECT id, 2026 FROM suppliers;
