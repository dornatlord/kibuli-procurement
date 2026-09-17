-- Requests filled in without internet are sent later, and a send can reach the
-- server even when its reply is lost. The browser gives each request its own
-- id, so sending it again returns the request already saved instead of a copy.
ALTER TABLE procurement_requests ADD COLUMN IF NOT EXISTS client_ref uuid;
CREATE UNIQUE INDEX IF NOT EXISTS procurement_requests_client_ref_key
  ON procurement_requests (client_ref)
  WHERE client_ref IS NOT NULL;
