-- Names, titles and dates a request's forms print, saved with the request so
-- they're entered once and seen every time; and the Contracts Committee's
-- meeting minutes.

CREATE TABLE IF NOT EXISTS request_form_details (
  procurement_request_id integer PRIMARY KEY REFERENCES procurement_requests(id) ON DELETE CASCADE,
  tform jsonb,
  calloff jsonb,
  updated_by integer REFERENCES users(id),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS committee_meetings (
  id serial PRIMARY KEY,
  reference_number text UNIQUE NOT NULL,
  meeting_type text NOT NULL DEFAULT 'ordinary',
  meeting_date date NOT NULL,
  start_time text,
  end_time text,
  venue text,
  -- [{ name, title, status: present | apology | absent | in_attendance }]
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  opening text,
  previous_minutes text,
  matters_arising text,
  other_business text,
  next_meeting_date date,
  chair_name text,
  secretary_name text,
  status text NOT NULL DEFAULT 'draft',
  finalized_by integer REFERENCES users(id),
  finalized_at timestamp,
  created_by integer REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS committee_meetings_date_idx ON committee_meetings (meeting_date);

CREATE TABLE IF NOT EXISTS committee_meeting_items (
  id serial PRIMARY KEY,
  meeting_id integer NOT NULL REFERENCES committee_meetings(id) ON DELETE CASCADE,
  position integer NOT NULL,
  request_id integer REFERENCES procurement_requests(id) ON DELETE SET NULL,
  title text NOT NULL,
  discussion text,
  decision text,
  resolution text,
  conditions text
);
CREATE INDEX IF NOT EXISTS committee_meeting_items_meeting_idx ON committee_meeting_items (meeting_id);
CREATE INDEX IF NOT EXISTS committee_meeting_items_request_idx ON committee_meeting_items (request_id);

-- Like every table: only the backend (the owner) may reach them.
ALTER TABLE request_form_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_meeting_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON request_form_details, committee_meetings, committee_meeting_items FROM anon, authenticated;
REVOKE ALL ON SEQUENCE committee_meetings_id_seq, committee_meeting_items_id_seq FROM anon, authenticated;
