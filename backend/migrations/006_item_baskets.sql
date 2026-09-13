-- Saved baskets: reusable lists of items (staff meals, weekly posho...) that
-- load into a procurement request in one click. A basket can be tied to the
-- budget line it is usually bought under, so the request item picker offers it
-- when that line is chosen in Part III. Tuition Stores departments have no
-- budget items, so those baskets link to the sub-programme instead.

CREATE TABLE IF NOT EXISTS item_baskets (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT,
  budget_item_id   INTEGER REFERENCES budget_items(id),
  sub_programme_id INTEGER REFERENCES sub_programmes(id),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_by       INTEGER REFERENCES users(id),
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

-- Items linked to the price list take their name, unit and price from it when
-- loaded; the copies here cover hand-typed items or a deactivated price entry.
CREATE TABLE IF NOT EXISTS item_basket_items (
  id                    SERIAL PRIMARY KEY,
  basket_id             INTEGER NOT NULL REFERENCES item_baskets(id) ON DELETE CASCADE,
  item_no               INTEGER NOT NULL,
  reserve_price_item_id INTEGER REFERENCES reserve_price_items(id),
  description           TEXT NOT NULL,
  unit_of_measure       TEXT,
  default_quantity      NUMERIC(10, 2),
  unit_cost             NUMERIC(15, 2)
);

CREATE INDEX IF NOT EXISTS item_basket_items_basket_id_idx ON item_basket_items (basket_id);
