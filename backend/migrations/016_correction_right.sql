-- Records aren't locked, but only chosen people may correct a saved request or
-- LPO: administrators, and anyone given this on Users & Roles.
ALTER TABLE users ADD COLUMN can_correct_records boolean NOT NULL DEFAULT false;
