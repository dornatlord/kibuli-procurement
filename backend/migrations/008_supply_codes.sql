-- Supply codes: every budget line gets its own 3-digit code, which becomes the
-- fourth part of a request's procurement reference number, the way the school
-- writes them on paper — KSS/SUPLS/26/017/00155.

ALTER TABLE budget_items         ADD COLUMN IF NOT EXISTS supply_code text;
ALTER TABLE sub_programmes       ADD COLUMN IF NOT EXISTS supply_code text;
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS supply_code text;

-- Number the lines in the order the fund availability check lists them, but
-- leave 017 free: every food contract the school has issued on paper carries
-- it, so Food expenses keeps that code.
WITH lines AS (
  SELECT 'bi' AS kind, b.id, v.display_order AS v_ord,
         COALESCE(s.display_order, 0) AS s_ord, COALESCE(b.display_order, 0) AS b_ord
  FROM budget_items b
  JOIN votes v ON v.id = b.vote_id
  LEFT JOIN sub_programmes s ON s.id = b.sub_programme_id
  UNION ALL
  -- A sub-programme with no budget items (the vote 2202 departments) is itself a line.
  SELECT 'sp', s.id, v.display_order, COALESCE(s.display_order, 0), 0
  FROM sub_programmes s
  JOIN votes v ON v.id = s.vote_id
  WHERE NOT EXISTS (SELECT 1 FROM budget_items b WHERE b.sub_programme_id = s.id)
),
food AS (
  SELECT b.id FROM budget_items b
  JOIN votes v ON v.id = b.vote_id
  WHERE v.code = '2204' AND b.name = 'Food expenses'
),
numbered AS (
  SELECT l.kind, l.id,
         ROW_NUMBER() OVER (ORDER BY l.v_ord, l.s_ord, l.b_ord, l.kind, l.id) AS n
  FROM lines l
  WHERE NOT (l.kind = 'bi' AND l.id IN (SELECT id FROM food))
),
coded AS (
  SELECT kind, id, LPAD((CASE WHEN n < 17 THEN n ELSE n + 1 END)::text, 3, '0') AS code
  FROM numbered
  UNION ALL
  SELECT 'bi', id, '017' FROM food
)
UPDATE budget_items b SET supply_code = c.code
FROM coded c WHERE c.kind = 'bi' AND c.id = b.id;

WITH lines AS (
  SELECT 'bi' AS kind, b.id, v.display_order AS v_ord,
         COALESCE(s.display_order, 0) AS s_ord, COALESCE(b.display_order, 0) AS b_ord
  FROM budget_items b
  JOIN votes v ON v.id = b.vote_id
  LEFT JOIN sub_programmes s ON s.id = b.sub_programme_id
  UNION ALL
  SELECT 'sp', s.id, v.display_order, COALESCE(s.display_order, 0), 0
  FROM sub_programmes s
  JOIN votes v ON v.id = s.vote_id
  WHERE NOT EXISTS (SELECT 1 FROM budget_items b WHERE b.sub_programme_id = s.id)
),
food AS (
  SELECT b.id FROM budget_items b
  JOIN votes v ON v.id = b.vote_id
  WHERE v.code = '2204' AND b.name = 'Food expenses'
),
numbered AS (
  SELECT l.kind, l.id,
         ROW_NUMBER() OVER (ORDER BY l.v_ord, l.s_ord, l.b_ord, l.kind, l.id) AS n
  FROM lines l
  WHERE NOT (l.kind = 'bi' AND l.id IN (SELECT id FROM food))
),
coded AS (
  SELECT kind, id, LPAD((CASE WHEN n < 17 THEN n ELSE n + 1 END)::text, 3, '0') AS code
  FROM numbered
  UNION ALL
  SELECT 'bi', id, '017' FROM food
)
UPDATE sub_programmes s SET supply_code = c.code
FROM coded c WHERE c.kind = 'sp' AND c.id = s.id;

-- No two lines may share a code.
CREATE UNIQUE INDEX IF NOT EXISTS budget_items_supply_code_key
  ON budget_items (supply_code) WHERE supply_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sub_programmes_supply_code_key
  ON sub_programmes (supply_code) WHERE supply_code IS NOT NULL;
