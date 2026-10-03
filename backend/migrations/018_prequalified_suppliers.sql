-- The school's pre-qualified list of suppliers, service providers and works:
-- one list a year, as the Contracts Committee approves it. Categories are
-- numbered 1, 2, 3 … straight through Supplies, Services and Works, and each
-- keeps its reference from the list (KSS/SUPLS/25/00002). Lines on paper that
-- share one reference are one category, with their headings kept as groups
-- ("Maize flour", "Beans" … under Food).
CREATE TABLE supplier_categories (
  id serial PRIMARY KEY,
  year integer NOT NULL,
  number integer NOT NULL,
  section procurement_category NOT NULL,
  reference text,
  name text NOT NULL,
  groups text[] NOT NULL DEFAULT '{}',
  created_by integer REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  UNIQUE (year, number)
);

-- Who is on a category, in the list's order. `groups` are the category's
-- headings the supplier is listed under (1 is its first heading), empty when
-- the category has none. `printed_name` keeps the list's spelling where the
-- register spells the supplier differently.
CREATE TABLE supplier_category_members (
  category_id integer NOT NULL REFERENCES supplier_categories(id) ON DELETE CASCADE,
  supplier_id integer NOT NULL REFERENCES suppliers(id),
  position integer NOT NULL,
  groups integer[] NOT NULL DEFAULT '{}',
  printed_name text,
  added_by integer REFERENCES users(id),
  added_at timestamp DEFAULT now(),
  PRIMARY KEY (category_id, supplier_id)
);

-- The budget lines ("votes") whose providers come from a category: a request
-- on such a line offers the category's suppliers wherever a provider is
-- asked for. `groups` narrows a line to some of the category's headings (the
-- Generator line to Plant maintenance (A)); empty means the whole category.
-- A line is a budget item, or a sub-programme with no items of its own (the
-- vote 2202 departments).
CREATE TABLE supplier_category_lines (
  id serial PRIMARY KEY,
  category_id integer NOT NULL REFERENCES supplier_categories(id) ON DELETE CASCADE,
  budget_item_id integer REFERENCES budget_items(id),
  sub_programme_id integer REFERENCES sub_programmes(id),
  groups integer[] NOT NULL DEFAULT '{}',
  CHECK ((budget_item_id IS NULL) <> (sub_programme_id IS NULL))
);
CREATE UNIQUE INDEX supplier_category_lines_item
  ON supplier_category_lines (category_id, budget_item_id) WHERE budget_item_id IS NOT NULL;
CREATE UNIQUE INDEX supplier_category_lines_sub
  ON supplier_category_lines (category_id, sub_programme_id) WHERE sub_programme_id IS NOT NULL;

-- Reached only through the API, like every other table (migration 012).
ALTER TABLE supplier_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_category_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_category_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON supplier_categories, supplier_category_members, supplier_category_lines FROM anon, authenticated;
REVOKE ALL ON SEQUENCE supplier_categories_id_seq, supplier_category_lines_id_seq FROM anon, authenticated;
