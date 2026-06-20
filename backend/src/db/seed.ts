import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { votes, subProgrammes, budgetItems, users } from "./schema.js";
import bcrypt from "bcryptjs";

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

async function seed() {
  console.log("Seeding database...");

  // Admin user
  const hash = await bcrypt.hash("admin1234", 10);
  await db
    .insert(users)
    .values({
      email: "admin@kibulisss.local",
      passwordHash: hash,
      name: "System Administrator",
      role: "accounting_officer",
      department: "Administration",
    })
    .onConflictDoNothing();

  // ── Votes ──────────────────────────────────────────────────────────────
  const [v2103] = await db
    .insert(votes)
    .values({ code: "2103", name: "Staff costs", displayOrder: 1 })
    .returning();
  const [v2201] = await db
    .insert(votes)
    .values({ code: "2201", name: "Administrative", displayOrder: 2 })
    .returning();
  const [v2208] = await db
    .insert(votes)
    .values({ code: "2208", name: "Co-Curricular Activities", displayOrder: 3 })
    .returning();
  const [v2212] = await db
    .insert(votes)
    .values({ code: "2212", name: "Maintenance and Repair", displayOrder: 4 })
    .returning();
  const [v2202] = await db
    .insert(votes)
    .values({ code: "2202", name: "Tuition Stores", displayOrder: 5 })
    .returning();
  const [v2204] = await db
    .insert(votes)
    .values({ code: "2204", name: "Domestic / Boarding", displayOrder: 6 })
    .returning();
  const [v2205] = await db
    .insert(votes)
    .values({ code: "2205", name: "Utility", displayOrder: 7 })
    .returning();
  const [v2206] = await db
    .insert(votes)
    .values({ code: "2206", name: "Finance", displayOrder: 8 })
    .returning();
  const [v2207] = await db
    .insert(votes)
    .values({ code: "2207", name: "Health and Sanitation", displayOrder: 9 })
    .returning();
  const [v2209] = await db
    .insert(votes)
    .values({ code: "2209", name: "Careers' Development", displayOrder: 10 })
    .returning();
  const [v2211] = await db
    .insert(votes)
    .values({ code: "2211", name: "Transport and Travel", displayOrder: 11 })
    .returning();
  const [v2214] = await db
    .insert(votes)
    .values({
      code: "2214",
      name: "Capital Development Expenses",
      displayOrder: 12,
    })
    .returning();
  const [v2215] = await db
    .insert(votes)
    .values({ code: "2215", name: "Other Recurrent", displayOrder: 13 })
    .returning();

  // ── 2103 Staff costs ───────────────────────────────────────────────────
  const [sp2103Payroll] = await db
    .insert(subProgrammes)
    .values({ voteId: v2103.id, romanNumeral: null, name: "Payroll", displayOrder: 1 })
    .returning();
  const [sp2103NonPayroll] = await db
    .insert(subProgrammes)
    .values({ voteId: v2103.id, romanNumeral: null, name: "Non-Payroll", displayOrder: 2 })
    .returning();

  await db.insert(budgetItems).values([
    { voteId: v2103.id, subProgrammeId: sp2103Payroll.id, name: "Staff consolidated allowances", displayOrder: 1 },
    { voteId: v2103.id, subProgrammeId: sp2103Payroll.id, name: "Exit costs / Retirement package", displayOrder: 2 },
    { voteId: v2103.id, subProgrammeId: sp2103NonPayroll.id, name: "Government salaries", displayOrder: 1 },
  ]);

  // ── 2201 Administrative ────────────────────────────────────────────────
  const adminSubs = await db.insert(subProgrammes).values([
    { voteId: v2201.id, romanNumeral: "(i)", name: "Professional fees", displayOrder: 1 },
    { voteId: v2201.id, romanNumeral: "(ii)", name: "Board", displayOrder: 2 },
    { voteId: v2201.id, romanNumeral: "(iii)", name: "Monitoring and evaluation", displayOrder: 3 },
    { voteId: v2201.id, romanNumeral: "(iv)", name: "Communication", displayOrder: 4 },
    { voteId: v2201.id, romanNumeral: "(v)", name: "Training and development", displayOrder: 5 },
    { voteId: v2201.id, romanNumeral: "(vi)", name: "Subscriptions & membership", displayOrder: 6 },
    { voteId: v2201.id, romanNumeral: "(vii)", name: "Staff welfare", displayOrder: 7 },
    { voteId: v2201.id, romanNumeral: "(viii)", name: "General office", displayOrder: 8 },
    { voteId: v2201.id, romanNumeral: "(ix)", name: "Prefect's expenses", displayOrder: 9 },
    { voteId: v2201.id, romanNumeral: "(x)", name: "Advertising & publicity", displayOrder: 10 },
    { voteId: v2201.id, romanNumeral: "(xi)", name: "Insurance", displayOrder: 11 },
    { voteId: v2201.id, romanNumeral: "(xii)", name: "Procurement", displayOrder: 12 },
    { voteId: v2201.id, romanNumeral: "(xiii)", name: "Information Technology", displayOrder: 13 },
    { voteId: v2201.id, romanNumeral: "(xiv)", name: "Examinations", displayOrder: 14 },
    { voteId: v2201.id, romanNumeral: "(xv)", name: "Facilitation", displayOrder: 15 },
    { voteId: v2201.id, romanNumeral: "(xvi)", name: "Direct student", displayOrder: 16 },
    { voteId: v2201.id, romanNumeral: "(xvii)", name: "Tax", displayOrder: 17 },
    { voteId: v2201.id, romanNumeral: "(xviii)", name: "Other administrative", displayOrder: 18 },
  ]).returning();

  const [
    spProfFees, spBoard, spMnE, spComm, spTraining, spSubs, spStaffWelfare,
    spGenOffice, spPrefect, spAdvert, spInsurance, spProcurement, spIT,
    spExams, spFacilitation, spDirectStudent, spTax, spOtherAdmin,
  ] = adminSubs;

  await db.insert(budgetItems).values([
    // (i) Professional fees
    { voteId: v2201.id, subProgrammeId: spProfFees.id, name: "Legal fees / Disciplinary", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spProfFees.id, name: "Internal auditors", displayOrder: 2 },
    // (ii) Board
    { voteId: v2201.id, subProgrammeId: spBoard.id, name: "BOG meetings", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spBoard.id, name: "BOG facilitation", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spBoard.id, name: "BOG training & development", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spBoard.id, name: "PTA meeting", displayOrder: 4 },
    { voteId: v2201.id, subProgrammeId: spBoard.id, name: "PTA facilitation", displayOrder: 5 },
    // (iii) M&E
    { voteId: v2201.id, subProgrammeId: spMnE.id, name: "Monitoring and evaluation", displayOrder: 1 },
    // (iv) Communication
    { voteId: v2201.id, subProgrammeId: spComm.id, name: "Telephone charges / Airtime", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spComm.id, name: "Postage charges", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spComm.id, name: "Internet and email", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spComm.id, name: "SMS charges", displayOrder: 4 },
    // (v) Training and development
    { voteId: v2201.id, subProgrammeId: spTraining.id, name: "Leadership workshop", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spTraining.id, name: "Teachers & staff workshop", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spTraining.id, name: "Administrative staff development", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spTraining.id, name: "Science teachers in-service training", displayOrder: 4 },
    // (vi) Subscriptions
    { voteId: v2201.id, subProgrammeId: spSubs.id, name: "YMMA", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spSubs.id, name: "UNSA", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spSubs.id, name: "ASSHU", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spSubs.id, name: "SESEMAT", displayOrder: 4 },
    { voteId: v2201.id, subProgrammeId: spSubs.id, name: "KOSA", displayOrder: 5 },
    { voteId: v2201.id, subProgrammeId: spSubs.id, name: "UMEA", displayOrder: 6 },
    { voteId: v2201.id, subProgrammeId: spSubs.id, name: "UMTA", displayOrder: 7 },
    { voteId: v2201.id, subProgrammeId: spSubs.id, name: "UMEA Waquaf", displayOrder: 8 },
    { voteId: v2201.id, subProgrammeId: spSubs.id, name: "Kibuli Corporate Social Responsibility", displayOrder: 9 },
    // (vii) Staff welfare
    { voteId: v2201.id, subProgrammeId: spStaffWelfare.id, name: "Annual staff party", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spStaffWelfare.id, name: "Staff welfare equipment", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spStaffWelfare.id, name: "Group employee uniforms", displayOrder: 3 },
    // (viii) General office
    { voteId: v2201.id, subProgrammeId: spGenOffice.id, name: "Office welfare", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spGenOffice.id, name: "Head Teacher's hospitality", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spGenOffice.id, name: "Office stationery", displayOrder: 3 },
    // (ix) Prefects
    { voteId: v2201.id, subProgrammeId: spPrefect.id, name: "Prefects' uniforms", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spPrefect.id, name: "Prefects' welfare", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spPrefect.id, name: "Prefects' elections", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spPrefect.id, name: "Prefects' handover", displayOrder: 4 },
    // (x) Advertising
    { voteId: v2201.id, subProgrammeId: spAdvert.id, name: "Radio / TV announcements", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spAdvert.id, name: "Magazine / Calendar", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spAdvert.id, name: "Candidates Year Book", displayOrder: 3 },
    // (xi) Insurance
    { voteId: v2201.id, subProgrammeId: spInsurance.id, name: "Insurance premiums for motor comprehensive", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spInsurance.id, name: "Insurance for fire and allied perils", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spInsurance.id, name: "Insurance for money policy", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spInsurance.id, name: "Insurance for motor private", displayOrder: 4 },
    { voteId: v2201.id, subProgrammeId: spInsurance.id, name: "Insurance for all risks", displayOrder: 5 },
    { voteId: v2201.id, subProgrammeId: spInsurance.id, name: "Insurance for new bus", displayOrder: 6 },
    { voteId: v2201.id, subProgrammeId: spInsurance.id, name: "Other insurance", displayOrder: 7 },
    // (xii) Procurement
    { voteId: v2201.id, subProgrammeId: spProcurement.id, name: "Bids", displayOrder: 1 },
    // (xiii) IT
    { voteId: v2201.id, subProgrammeId: spIT.id, name: "School / Student Management System", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spIT.id, name: "Cyber School Program", displayOrder: 2 },
    // (xiv) Examinations
    { voteId: v2201.id, subProgrammeId: spExams.id, name: "PUJAB forms", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spExams.id, name: "Internal exams", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spExams.id, name: "Mocks", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spExams.id, name: "UNEB registrations", displayOrder: 4 },
    { voteId: v2201.id, subProgrammeId: spExams.id, name: "UNEB expenses", displayOrder: 5 },
    { voteId: v2201.id, subProgrammeId: spExams.id, name: "UNEB practicals", displayOrder: 6 },
    // (xv) Facilitation
    { voteId: v2201.id, subProgrammeId: spFacilitation.id, name: "External facilitation", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spFacilitation.id, name: "Extra duty facilitation", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spFacilitation.id, name: "Remedial facilitation", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spFacilitation.id, name: "Prep facilitation", displayOrder: 4 },
    { voteId: v2201.id, subProgrammeId: spFacilitation.id, name: "Administrators' facilitation", displayOrder: 5 },
    { voteId: v2201.id, subProgrammeId: spFacilitation.id, name: "Overtime facilitation", displayOrder: 6 },
    { voteId: v2201.id, subProgrammeId: spFacilitation.id, name: "Administrative facilitation", displayOrder: 7 },
    { voteId: v2201.id, subProgrammeId: spFacilitation.id, name: "Receiving of students", displayOrder: 8 },
    { voteId: v2201.id, subProgrammeId: spFacilitation.id, name: "Visitation day management", displayOrder: 9 },
    // (xvi) Direct student
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Hair trimming", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Identity cards", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "House fees", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Tents hire", displayOrder: 4 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Candidates Dua", displayOrder: 5 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Royal dinner", displayOrder: 6 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Students' seminars", displayOrder: 7 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Patriotism", displayOrder: 8 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Debating club", displayOrder: 9 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Public speaking", displayOrder: 10 },
    { voteId: v2201.id, subProgrammeId: spDirectStudent.id, name: "Science fair", displayOrder: 11 },
    // (xvii) Tax
    { voteId: v2201.id, subProgrammeId: spTax.id, name: "Local service tax", displayOrder: 1 },
    // (xviii) Other administrative
    { voteId: v2201.id, subProgrammeId: spOtherAdmin.id, name: "Engraving assets", displayOrder: 1 },
    { voteId: v2201.id, subProgrammeId: spOtherAdmin.id, name: "Security", displayOrder: 2 },
    { voteId: v2201.id, subProgrammeId: spOtherAdmin.id, name: "Photography", displayOrder: 3 },
    { voteId: v2201.id, subProgrammeId: spOtherAdmin.id, name: "School mosque", displayOrder: 4 },
  ]);

  // ── 2208 Co-Curricular (no sub-programmes) ────────────────────────────
  await db.insert(budgetItems).values([
    { voteId: v2208.id, name: "Entertainment & excursions", displayOrder: 1 },
    { voteId: v2208.id, name: "Games & sports", displayOrder: 2 },
    { voteId: v2208.id, name: "Cultural days", displayOrder: 3 },
    { voteId: v2208.id, name: "Music, Dance and Drama", displayOrder: 4 },
    { voteId: v2208.id, name: "Quran Day", displayOrder: 5 },
    { voteId: v2208.id, name: "Subscription to clubs", displayOrder: 6 },
    { voteId: v2208.id, name: "Sports dinner", displayOrder: 7 },
  ]);

  // ── 2212 Maintenance and Repair ───────────────────────────────────────
  const maintSubs = await db.insert(subProgrammes).values([
    { voteId: v2212.id, romanNumeral: "(i)", name: "Civil works", displayOrder: 1 },
    { voteId: v2212.id, romanNumeral: "(ii)", name: "Vehicle", displayOrder: 2 },
    { voteId: v2212.id, romanNumeral: "(iii)", name: "Equipment and furniture", displayOrder: 3 },
    { voteId: v2212.id, romanNumeral: "(iv)", name: "Other maintenance", displayOrder: 4 },
  ]).returning();

  const [spCivil, spVehicle, spEquip, spOtherMaint] = maintSubs;

  await db.insert(budgetItems).values([
    { voteId: v2212.id, subProgrammeId: spCivil.id, name: "General maintenance and repair", displayOrder: 1 },
    { voteId: v2212.id, subProgrammeId: spCivil.id, name: "Painting of existing infrastructure", displayOrder: 2 },
    { voteId: v2212.id, subProgrammeId: spCivil.id, name: "Electricity repairs", displayOrder: 3 },
    { voteId: v2212.id, subProgrammeId: spCivil.id, name: "Water repairs", displayOrder: 4 },
    { voteId: v2212.id, subProgrammeId: spCivil.id, name: "Staff quarters", displayOrder: 5 },
    { voteId: v2212.id, subProgrammeId: spCivil.id, name: "\"O\" & \"A\" level Boys' dormitory renovations", displayOrder: 6 },
    { voteId: v2212.id, subProgrammeId: spCivil.id, name: "Girls' dormitory renovations", displayOrder: 7 },
    { voteId: v2212.id, subProgrammeId: spVehicle.id, name: "Vehicle", displayOrder: 1 },
    { voteId: v2212.id, subProgrammeId: spEquip.id, name: "Bed repairs", displayOrder: 1 },
    { voteId: v2212.id, subProgrammeId: spEquip.id, name: "CCTV maintenance", displayOrder: 2 },
    { voteId: v2212.id, subProgrammeId: spEquip.id, name: "Biometric machine", displayOrder: 3 },
    { voteId: v2212.id, subProgrammeId: spEquip.id, name: "Kitchen equipment", displayOrder: 4 },
    { voteId: v2212.id, subProgrammeId: spEquip.id, name: "Generator", displayOrder: 5 },
    { voteId: v2212.id, subProgrammeId: spEquip.id, name: "Computer maintenance", displayOrder: 6 },
    { voteId: v2212.id, subProgrammeId: spEquip.id, name: "Entertainment equipment", displayOrder: 7 },
    { voteId: v2212.id, subProgrammeId: spOtherMaint.id, name: "Fire extinguishers", displayOrder: 1 },
    { voteId: v2212.id, subProgrammeId: spOtherMaint.id, name: "Gas refill", displayOrder: 2 },
    { voteId: v2212.id, subProgrammeId: spOtherMaint.id, name: "Sports field", displayOrder: 3 },
  ]);

  // ── 2202 Tuition Stores (numbered sub-programmes, no initial items) ───
  const tuitionSubNames = [
    "Textbooks", "Science materials", "Accounts", "Class practicals",
    "Vocational skill development", "Wood work", "Technical drawing",
    "Food & Nutrition", "English", "Mathematics", "Geography", "German",
    "Swahili", "Arabic", "Physical Education", "Economics", "C.R.E",
    "History", "I.R.E", "General Paper", "Business Studies", "Luganda",
    "Agriculture", "Computer", "Literature", "Publication / Library",
    "Typing pool / Toner refilling", "Students' seminars", "Academic awards",
    "Academic dinner", "Director of studies", "Fine art",
  ];
  await db.insert(subProgrammes).values(
    tuitionSubNames.map((name, i) => ({
      voteId: v2202.id,
      romanNumeral: String(i + 1),
      name,
      displayOrder: i + 1,
    }))
  );

  // ── 2204 Domestic / Boarding (no sub-programmes) ──────────────────────
  await db.insert(budgetItems).values([
    { voteId: v2204.id, name: "Food expenses", displayOrder: 1 },
    { voteId: v2204.id, name: "Kitchen equipment / repairs", displayOrder: 2 },
    { voteId: v2204.id, name: "Firewood", displayOrder: 3 },
    { voteId: v2204.id, name: "Food basket", displayOrder: 4 },
    { voteId: v2204.id, name: "Staff meals", displayOrder: 5 },
    { voteId: v2204.id, name: "Students IDD", displayOrder: 6 },
    { voteId: v2204.id, name: "Ramadan", displayOrder: 7 },
  ]);

  // ── 2205 Utility (no sub-programmes) ─────────────────────────────────
  await db.insert(budgetItems).values([
    { voteId: v2205.id, name: "Electricity bills", displayOrder: 1 },
    { voteId: v2205.id, name: "Water bills", displayOrder: 2 },
    { voteId: v2205.id, name: "Yaka bills", displayOrder: 3 },
  ]);

  // ── 2206 Finance (no sub-programmes) ─────────────────────────────────
  await db.insert(budgetItems).values([
    { voteId: v2206.id, name: "Bank charges", displayOrder: 1 },
    { voteId: v2206.id, name: "Loan principal", displayOrder: 2 },
    { voteId: v2206.id, name: "Loan interest", displayOrder: 3 },
  ]);

  // ── 2207 Health and Sanitation ────────────────────────────────────────
  const healthSubs = await db.insert(subProgrammes).values([
    { voteId: v2207.id, romanNumeral: "(i)", name: "Cleaning & Sanitation", displayOrder: 1 },
    { voteId: v2207.id, romanNumeral: "(ii)", name: "Health", displayOrder: 2 },
  ]).returning();

  const [spCleaning, spHealth] = healthSubs;

  await db.insert(budgetItems).values([
    { voteId: v2207.id, subProgrammeId: spCleaning.id, name: "Compound maintenance / Garbage collection", displayOrder: 1 },
    { voteId: v2207.id, subProgrammeId: spCleaning.id, name: "Cleaning materials", displayOrder: 2 },
    { voteId: v2207.id, subProgrammeId: spCleaning.id, name: "Dormitory cleaning", displayOrder: 3 },
    { voteId: v2207.id, subProgrammeId: spCleaning.id, name: "Fumigation & pest control", displayOrder: 4 },
    { voteId: v2207.id, subProgrammeId: spHealth.id, name: "Sickbay supplies", displayOrder: 1 },
    { voteId: v2207.id, subProgrammeId: spHealth.id, name: "Medical emergency", displayOrder: 2 },
    { voteId: v2207.id, subProgrammeId: spHealth.id, name: "Medical health scheme", displayOrder: 3 },
  ]);

  // ── 2209 Careers' Development (no sub-programmes) ────────────────────
  await db.insert(budgetItems).values([
    { voteId: v2209.id, name: "Careers expenses", displayOrder: 1 },
    { voteId: v2209.id, name: "Guidance / Counselling", displayOrder: 2 },
    { voteId: v2209.id, name: "Facilitation Sr. man / woman", displayOrder: 3 },
  ]);

  // ── 2211 Transport and Travel (no sub-programmes) ─────────────────────
  await db.insert(budgetItems).values([
    { voteId: v2211.id, name: "Travel inland (Fuel)", displayOrder: 1 },
    { voteId: v2211.id, name: "Transport hire", displayOrder: 2 },
    { voteId: v2211.id, name: "Travel abroad", displayOrder: 3 },
    { voteId: v2211.id, name: "Mosque repair", displayOrder: 4 },
    { voteId: v2211.id, name: "Road & parking", displayOrder: 5 },
    { voteId: v2211.id, name: "Gas materials", displayOrder: 6 },
  ]);

  // ── 2214 Capital Development Expenses ────────────────────────────────
  const capDevSubs = await db.insert(subProgrammes).values([
    { voteId: v2214.id, romanNumeral: "A", name: "Infrastructure", displayOrder: 1 },
    { voteId: v2214.id, romanNumeral: "B", name: "Teaching and Learning", displayOrder: 2 },
    { voteId: v2214.id, romanNumeral: "C", name: "Installation of security & safety equipment", displayOrder: 3 },
    { voteId: v2214.id, romanNumeral: "D", name: "Motor Vehicle", displayOrder: 4 },
    { voteId: v2214.id, romanNumeral: "E", name: "Other", displayOrder: 5 },
  ]).returning();

  const [spInfra, spTeachLearn, spSecurity, spMotor, spOtherCap] = capDevSubs;

  await db.insert(budgetItems).values([
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Sangalyambogo Floor 3 completion", displayOrder: 1 },
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Plan for A-level block", displayOrder: 2 },
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Beds in the Sangalyambogo", displayOrder: 3 },
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Roofing of girls' bathroom", displayOrder: 4 },
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Boys A-level toilet building", displayOrder: 5 },
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Old girls' dormitory", displayOrder: 6 },
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Boy's wall fence", displayOrder: 7 },
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Master plan for the school", displayOrder: 8 },
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Class room ceiling", displayOrder: 9 },
    { voteId: v2214.id, subProgrammeId: spInfra.id, name: "Girls wall fence", displayOrder: 10 },
    { voteId: v2214.id, subProgrammeId: spTeachLearn.id, name: "Furniture replacement", displayOrder: 1 },
    { voteId: v2214.id, subProgrammeId: spTeachLearn.id, name: "Computer", displayOrder: 2 },
    { voteId: v2214.id, subProgrammeId: spTeachLearn.id, name: "Smart boards", displayOrder: 3 },
    { voteId: v2214.id, subProgrammeId: spSecurity.id, name: "Smoke detectors", displayOrder: 1 },
    { voteId: v2214.id, subProgrammeId: spSecurity.id, name: "Lightening conductors", displayOrder: 2 },
    { voteId: v2214.id, subProgrammeId: spSecurity.id, name: "CCTV installation", displayOrder: 3 },
    { voteId: v2214.id, subProgrammeId: spMotor.id, name: "Overhaul of old bus", displayOrder: 1 },
    { voteId: v2214.id, subProgrammeId: spOtherCap.id, name: "General store", displayOrder: 1 },
    { voteId: v2214.id, subProgrammeId: spOtherCap.id, name: "Accounting software", displayOrder: 2 },
    { voteId: v2214.id, subProgrammeId: spOtherCap.id, name: "Wall of fame", displayOrder: 3 },
    { voteId: v2214.id, subProgrammeId: spOtherCap.id, name: "Development fund", displayOrder: 4 },
  ]);

  // ── 2215 Other Recurrent (no sub-programmes) ──────────────────────────
  await db.insert(budgetItems).values([
    { voteId: v2215.id, name: "Payables", displayOrder: 1 },
    { voteId: v2215.id, name: "Fees refund", displayOrder: 2 },
    { voteId: v2215.id, name: "Fees advance", displayOrder: 3 },
    { voteId: v2215.id, name: "NCDC workshop", displayOrder: 4 },
    { voteId: v2215.id, name: "Donations", displayOrder: 5 },
    { voteId: v2215.id, name: "USEEP workshop", displayOrder: 6 },
  ]);

  console.log("Seed complete.");
  await client.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
