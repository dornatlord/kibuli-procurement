-- PPDA FORM 5 Part II is a six-row table: the Procurement and Disposal
-- Unit's submission, and for every row the Contracts Committee's decision and
-- conditions. The shortlist, bidding-document team and evaluation committee
-- are written as free text (names, positions and justification), as on the
-- paper form. No committee records existed when this ran, so changing the
-- column types lost nothing.

ALTER TABLE contracts_committee_decisions
  ALTER COLUMN shortlisted_providers TYPE text USING shortlisted_providers #>> '{}',
  ALTER COLUMN evaluation_committee TYPE text USING evaluation_committee #>> '{}',
  ALTER COLUMN bidding_document_team TYPE text USING bidding_document_team #>> '{}',
  ADD COLUMN IF NOT EXISTS other_information text,
  ADD COLUMN IF NOT EXISTS row_decisions jsonb;
