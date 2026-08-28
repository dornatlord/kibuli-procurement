-- Adds every table needed for the remaining Quick Actions modules:
-- Suppliers, Purchase Orders, Goods Received, Invoices, Contracts,
-- Procurement Plan, Inventory & Assets, and the Audit Trail.

CREATE TYPE provider_category AS ENUM ('national', 'foreign', 'resident', 'eac');
CREATE TYPE po_status AS ENUM ('draft', 'issued', 'acknowledged', 'completed', 'cancelled');
CREATE TYPE grn_status AS ENUM ('pending_inspection', 'accepted', 'rejected', 'partial');
CREATE TYPE invoice_status AS ENUM ('pending', 'approved', 'paid', 'rejected');
CREATE TYPE contract_status AS ENUM ('draft', 'active', 'completed', 'terminated');
CREATE TYPE asset_condition AS ENUM ('new', 'good', 'fair', 'poor', 'disposed');
CREATE TYPE plan_status AS ENUM ('planned', 'in_progress', 'completed');

CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tin_number TEXT,
  registration_number TEXT,
  category procurement_category,
  provider_category provider_category DEFAULT 'national',
  owner_names TEXT,
  target_group TEXT,
  is_prequalified BOOLEAN DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  procurement_request_id INTEGER REFERENCES procurement_requests(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status po_status NOT NULL DEFAULT 'draft',
  issue_date DATE,
  expected_delivery_date DATE,
  delivery_location TEXT,
  total_amount NUMERIC(15,2),
  terms_and_conditions TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2),
  unit_of_measure TEXT,
  unit_price NUMERIC(15,2),
  total_price NUMERIC(15,2)
);

CREATE TABLE goods_received_notes (
  id SERIAL PRIMARY KEY,
  grn_number TEXT UNIQUE NOT NULL,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  received_date DATE NOT NULL,
  received_by_user_id INTEGER NOT NULL REFERENCES users(id),
  inspected_by_user_id INTEGER REFERENCES users(id),
  status grn_status NOT NULL DEFAULT 'pending_inspection',
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE goods_received_items (
  id SERIAL PRIMARY KEY,
  grn_id INTEGER NOT NULL REFERENCES goods_received_notes(id) ON DELETE CASCADE,
  purchase_order_item_id INTEGER NOT NULL REFERENCES purchase_order_items(id),
  quantity_received NUMERIC(10,2),
  quantity_accepted NUMERIC(10,2),
  condition TEXT,
  remarks TEXT
);

CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  invoice_date DATE NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  status invoice_status NOT NULL DEFAULT 'pending',
  paid_date DATE,
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE contracts (
  id SERIAL PRIMARY KEY,
  contract_number TEXT UNIQUE NOT NULL,
  procurement_request_id INTEGER REFERENCES procurement_requests(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  title TEXT NOT NULL,
  contract_value NUMERIC(15,2),
  start_date DATE,
  end_date DATE,
  signed_date DATE,
  status contract_status NOT NULL DEFAULT 'draft',
  document_reference TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE contract_amendments (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  amendment_date DATE NOT NULL,
  description TEXT NOT NULL,
  value_change NUMERIC(15,2),
  revised_contract_value NUMERIC(15,2),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE procurement_plan_items (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  subject_of_procurement TEXT NOT NULL,
  currency TEXT DEFAULT 'UGX',
  estimated_cost NUMERIC(15,2),
  source_of_funding TEXT,
  procurement_method TEXT,
  procurement_category procurement_category,
  contract_type TEXT,
  is_prequalification_required BOOLEAN DEFAULT false,
  apply_reservation_scheme BOOLEAN DEFAULT false,
  reservation_scheme_type TEXT,
  bid_invitation_date DATE,
  bid_closing_date DATE,
  evaluation_report_date DATE,
  award_notification_date DATE,
  contract_signing_date DATE,
  completion_date DATE,
  linked_request_id INTEGER REFERENCES procurement_requests(id),
  status plan_status NOT NULL DEFAULT 'planned',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE assets (
  id SERIAL PRIMARY KEY,
  asset_tag TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_of_measure TEXT,
  unit_value NUMERIC(15,2),
  total_value NUMERIC(15,2),
  location TEXT,
  condition asset_condition DEFAULT 'new',
  acquisition_date DATE,
  acquisition_source TEXT,
  goods_received_item_id INTEGER REFERENCES goods_received_items(id),
  is_disposed BOOLEAN NOT NULL DEFAULT false,
  disposal_date DATE,
  disposal_reason TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details JSONB,
  created_at TIMESTAMP DEFAULT now()
);
