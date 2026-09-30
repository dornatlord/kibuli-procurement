-- A budget is set for a year. Each year keeps its own amounts, so entering
-- 2027's budget never overwrites 2026's, and a report on 2026 still reads
-- 2026's figures years later.
CREATE TABLE budget_amounts (
  budget_item_id integer NOT NULL REFERENCES budget_items(id),
  year integer NOT NULL,
  amount numeric(15, 2) NOT NULL,
  updated_by integer REFERENCES users(id),
  updated_at timestamp DEFAULT now(),
  PRIMARY KEY (budget_item_id, year)
);

-- Reached only through the API, like every other table (migration 012).
ALTER TABLE budget_amounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON budget_amounts FROM anon, authenticated;

-- Amounts set before this change were 2026's.
INSERT INTO budget_amounts (budget_item_id, year, amount)
SELECT id, 2026, budgeted_amount FROM budget_items WHERE budgeted_amount IS NOT NULL;
