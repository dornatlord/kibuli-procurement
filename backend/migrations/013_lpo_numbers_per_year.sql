-- LPO numbers start again at 1 each year, like the school's LPO books. The
-- year keeps LPO 1 of 2025 apart from LPO 1 of 2026, so a number is unique
-- within its year rather than for ever.
--
-- The default (this year in Kampala) lets LPOs still be saved by a server that
-- predates this change, between the migration and the deploy that uses it.
ALTER TABLE purchase_orders
  ADD COLUMN year integer NOT NULL
  DEFAULT EXTRACT(YEAR FROM (now() AT TIME ZONE 'Africa/Kampala'))::integer;

UPDATE purchase_orders
   SET year = EXTRACT(YEAR FROM (COALESCE(created_at, now()) AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Kampala'))::integer;

ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_po_number_key;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_year_po_number_key UNIQUE (year, po_number);
