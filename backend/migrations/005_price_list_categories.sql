-- Which reserve-price categories the New Request item picker suggests when a
-- budget line is chosen in Part III (Fund Availability Check). A budget item's
-- list wins; a sub-programme's list is used when it has no budget items of its
-- own (the vote 2202 Tuition Stores departments). Lines left NULL simply open
-- the picker on the full price list. Category strings must match
-- reserve_price_items.category exactly (note 'STATIONARY' and
-- 'MAINTENANCE &CONSTRUCTION MATERIALS' as spelled in the school's sheet).

ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS price_categories text[];
ALTER TABLE sub_programmes ADD COLUMN IF NOT EXISTS price_categories text[];

UPDATE budget_items bi
SET price_categories = m.categories
FROM (VALUES
  -- 2201 Administrative
  ('2201', 'Annual staff party', ARRAY['FOOD']),
  ('2201', 'Group employee uniforms', ARRAY['UNIFORMS']),
  ('2201', 'Office welfare', ARRAY['FOOD']),
  ('2201', 'Head Teacher''s hospitality', ARRAY['FOOD']),
  ('2201', 'Office stationery', ARRAY['STATIONARY']),
  ('2201', 'Prefects'' uniforms', ARRAY['UNIFORMS']),
  ('2201', 'Internal exams', ARRAY['STATIONARY']),
  ('2201', 'Mocks', ARRAY['STATIONARY']),
  ('2201', 'UNEB practicals', ARRAY['SCIENCE MATERIALS & EQUIPMENT']),
  ('2201', 'Visitation day management', ARRAY['TENTS FOR HIRING']),
  ('2201', 'Tents hire', ARRAY['TENTS FOR HIRING']),
  ('2201', 'Royal dinner', ARRAY['FOOD']),
  ('2201', 'Science fair', ARRAY['SCIENCE MATERIALS & EQUIPMENT']),
  -- 2208 Co-Curricular Activities
  ('2208', 'Games & sports', ARRAY['SPORTS', 'UNIFORMS']),
  ('2208', 'Sports dinner', ARRAY['FOOD']),
  -- 2212 Maintenance and Repair
  ('2212', 'General maintenance and repair', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS', 'ELECTRICAL MATERIALS']),
  ('2212', 'Painting of existing infrastructure', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS']),
  ('2212', 'Electricity repairs', ARRAY['ELECTRICAL MATERIALS']),
  ('2212', 'Water repairs', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS']),
  ('2212', 'Staff quarters', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS', 'ELECTRICAL MATERIALS']),
  ('2212', '"O" & "A" level Boys'' dormitory renovations', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS', 'ELECTRICAL MATERIALS']),
  ('2212', 'Girls'' dormitory renovations', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS', 'ELECTRICAL MATERIALS']),
  ('2212', 'Bed repairs', ARRAY['BEDS', 'MAINTENANCE &CONSTRUCTION MATERIALS']),
  ('2212', 'Kitchen equipment', ARRAY['KITCHEN EQUIP REPAIRS & MAINTENANCE']),
  ('2212', 'Computer maintenance', ARRAY['COMPUTER ACCESSORIES']),
  ('2212', 'Sports field', ARRAY['SPORTS', 'COMPOUND MAINTENANCE']),
  -- 2204 Domestic / Boarding
  ('2204', 'Food expenses', ARRAY['FOOD']),
  ('2204', 'Kitchen equipment / repairs', ARRAY['KITCHEN EQUIP REPAIRS & MAINTENANCE']),
  ('2204', 'Food basket', ARRAY['FOOD']),
  ('2204', 'Staff meals', ARRAY['FOOD']),
  ('2204', 'Students IDD', ARRAY['FOOD']),
  ('2204', 'Ramadan', ARRAY['FOOD']),
  -- 2207 Health and Sanitation
  ('2207', 'Compound maintenance / Garbage collection', ARRAY['COMPOUND MAINTENANCE', 'CLEANING MATERIALS']),
  ('2207', 'Cleaning materials', ARRAY['CLEANING MATERIALS']),
  ('2207', 'Dormitory cleaning', ARRAY['CLEANING MATERIALS']),
  ('2207', 'Fumigation & pest control', ARRAY['CLEANING MATERIALS']),
  ('2207', 'Sickbay supplies', ARRAY['DRUGS / SICKBAY']),
  ('2207', 'Medical emergency', ARRAY['DRUGS / SICKBAY']),
  -- 2211 Transport and Travel
  ('2211', 'Mosque repair', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS', 'ELECTRICAL MATERIALS']),
  ('2211', 'Road & parking', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS']),
  -- 2214 Capital Development Expenses
  ('2214', 'Sangalyambogo Floor 3 completion', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS', 'ELECTRICAL MATERIALS']),
  ('2214', 'Beds in the Sangalyambogo', ARRAY['BEDS']),
  ('2214', 'Roofing of girls'' bathroom', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS']),
  ('2214', 'Boys A-level toilet building', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS', 'ELECTRICAL MATERIALS']),
  ('2214', 'Old girls'' dormitory', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS', 'ELECTRICAL MATERIALS']),
  ('2214', 'Boy''s wall fence', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS']),
  ('2214', 'Class room ceiling', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS']),
  ('2214', 'Girls wall fence', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS']),
  ('2214', 'Computer', ARRAY['COMPUTER ACCESSORIES']),
  ('2214', 'Smoke detectors', ARRAY['ELECTRICAL MATERIALS']),
  ('2214', 'Lightening conductors', ARRAY['ELECTRICAL MATERIALS']),
  ('2214', 'CCTV installation', ARRAY['ELECTRICAL MATERIALS'])
) AS m(vote_code, item_name, categories)
JOIN votes v ON v.code = m.vote_code
WHERE bi.vote_id = v.id AND bi.name = m.item_name;

-- 2202 Tuition Stores: departments are sub-programmes with no budget items.
UPDATE sub_programmes sp
SET price_categories = m.categories
FROM (VALUES
  ('Textbooks', ARRAY['TEXT BOOKS']),
  ('Science materials', ARRAY['SCIENCE MATERIALS & EQUIPMENT']),
  ('Accounts', ARRAY['STATIONARY']),
  ('Class practicals', ARRAY['SCIENCE MATERIALS & EQUIPMENT']),
  ('Wood work', ARRAY['MAINTENANCE &CONSTRUCTION MATERIALS']),
  ('Technical drawing', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Food & Nutrition', ARRAY['FOOD']),
  ('English', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Mathematics', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Geography', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('German', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Swahili', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Arabic', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Physical Education', ARRAY['SPORTS', 'UNIFORMS']),
  ('Economics', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('C.R.E', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('History', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('I.R.E', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('General Paper', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Business Studies', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Luganda', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Agriculture', ARRAY['TEXT BOOKS', 'STATIONARY', 'SCIENCE MATERIALS & EQUIPMENT']),
  ('Computer', ARRAY['COMPUTER ACCESSORIES']),
  ('Literature', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Publication / Library', ARRAY['TEXT BOOKS', 'STATIONARY']),
  ('Typing pool / Toner refilling', ARRAY['STATIONARY']),
  ('Academic dinner', ARRAY['FOOD']),
  ('Director of studies', ARRAY['STATIONARY']),
  ('Fine art', ARRAY['STATIONARY'])
) AS m(sp_name, categories)
JOIN votes v ON v.code = '2202'
WHERE sp.vote_id = v.id AND sp.name = m.sp_name;
