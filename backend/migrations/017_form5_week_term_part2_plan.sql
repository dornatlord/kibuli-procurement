-- The term a request is made in, as the school writes it on FORM 5 ("Week 5,
-- Term 3"; the week goes in week_number). Older requests leave it empty and
-- it's worked out from their date.
ALTER TABLE procurement_requests ADD COLUMN term integer;

-- Part II asks for the names and the justification separately (rows 2 to 4);
-- the justification prints in the Conditions/Justification column.
ALTER TABLE contracts_committee_decisions ADD COLUMN shortlist_justification text;
ALTER TABLE contracts_committee_decisions ADD COLUMN bidding_team_justification text;
ALTER TABLE contracts_committee_decisions ADD COLUMN evaluation_justification text;

-- The school's own reference for each line of its procurement plan
-- ("KSS/SUPLS/26/032"), which FORM 5 page 2 prints.
ALTER TABLE procurement_plan_items ADD COLUMN reference text;
