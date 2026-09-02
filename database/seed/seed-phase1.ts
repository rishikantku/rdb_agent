// ============================================================================
// Comprehensive Banking Data Generator — Phase 1
// Zones, Branches, Employees (with deterministic patterns)
// ============================================================================
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

// Deterministic pseudo-random (seeded)
let _seed = 42;
function srand(s: number) { _seed = s; }
function rand(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function rng(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[rng(0, arr.length - 1)];
}

// Name pools
const MALE_FIRST = ['Amit','Rahul','Vijay','Suresh','Ravi','Manoj','Ashok','Rajesh','Sanjay','Anil','Deepak','Pradeep','Sunil','Vinod','Arvind','Pankaj','Nitin','Gaurav','Rohit','Ajay','Naveen','Satish','Rakesh','Mohan','Vikram','Sumit','Manish','Girish','Prakash','Yogesh'];
const FEMALE_FIRST = ['Priya','Sneha','Anjali','Neha','Kavita','Sunita','Deepa','Pooja','Meena','Rekha','Swati','Nandini','Geeta','Savita','Asha','Puja','Divya','Shruti','Anita','Sapna','Ritu','Suman','Lakshmi','Bhavna','Pallavi','Shilpa','Nisha','Komal','Jyoti','Mamta'];
const LAST_NAMES = ['Sharma','Patel','Verma','Singh','Kumar','Gupta','Reddy','Yadav','Tiwari','Jha','Mishra','Dubey','Pandey','Sinha','Das','Roy','Thakur','Prasad','Mehta','Chopra','Chauhan','Rathore','Bhatt','Nair','Menon','Pillai','Iyer','Rao','Saxena','Agarwal'];

const DESIGNATIONS = ['CLERK','OFFICER','SENIOR_OFFICER','MANAGER','SENIOR_MANAGER','CHIEF_MANAGER','AGM','DGM','GM'];
const DESIGNATION_SALARY: Record<string, [number,number]> = {
  'CLERK': [25000, 42000],
  'OFFICER': [35000, 58000],
  'SENIOR_OFFICER': [48000, 72000],
  'MANAGER': [60000, 92000],
  'SENIOR_MANAGER': [78000, 115000],
  'CHIEF_MANAGER': [95000, 140000],
  'AGM': [110000, 165000],
  'DGM': [130000, 195000],
  'GM': [160000, 240000],
};

// Zone-city mapping for each region (3-5 zones per region)
const ZONE_MAP: Record<string, string[]> = {
  'REG_JH': ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh'],
  'REG_BR': ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga'],
  'REG_ER': ['Kolkata', 'Howrah', 'Siliguri', 'Durgapur', 'Asansol'],
  'REG_OR': ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur'],
  'REG_UP': ['Lucknow', 'Varanasi', 'Kanpur', 'Agra', 'Allahabad'],
  'REG_DL': ['Delhi Central', 'Delhi South', 'Delhi North', 'Noida-Greater Noida', 'Gurgaon-Faridabad'],
  'REG_CR': ['Bhopal', 'Indore', 'Jabalpur', 'Raipur'],
  'REG_WR': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad'],
  'REG_SR': ['Bengaluru', 'Chennai', 'Hyderabad', 'Kochi', 'Coimbatore'],
  'REG_RJ': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'],
  'REG_GJ': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
  'REG_NE': ['Guwahati', 'Imphal', 'Shillong'],
};

const BRANCH_TYPES = ['MAIN','BRANCH','BRANCH','BRANCH','EXTENSION_COUNTER','DIGITAL'];
const TIERS = ['METRO','URBAN','SEMI_URBAN','RURAL'];

async function seedPhase1() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('[Phase1] Connected');

  srand(42); // Deterministic

  // ---- ZONES ----
  const regionIds: Record<string, number> = {};
  const regRes = await client.query('SELECT region_id, region_code FROM regions');
  for (const r of regRes.rows) regionIds[r.region_code] = r.region_id;

  let zoneCount = 0;
  const zoneIds: number[] = [];
  const zoneRegionMap: Map<number, string> = new Map();

  for (const [regCode, cities] of Object.entries(ZONE_MAP)) {
    const regionId = regionIds[regCode];
    if (!regionId) continue;
    for (const city of cities) {
      zoneCount++;
      const zCode = `Z${String(zoneCount).padStart(3, '0')}`;
      const res = await client.query(
        'INSERT INTO zones (zone_name, zone_code, region_id) VALUES ($1, $2, $3) RETURNING zone_id',
        [`${city} Zone`, zCode, regionId]
      );
      zoneIds.push(res.rows[0].zone_id);
      zoneRegionMap.set(res.rows[0].zone_id, regCode);
    }
  }
  console.log(`[Phase1] ${zoneCount} zones created`);

  // ---- BRANCHES (5-8 per zone ≈ 250-350 total) ----
  let branchCount = 0;
  const branchIds: number[] = [];
  const branchZoneMap: Map<number, number> = new Map();

  for (const zoneId of zoneIds) {
    const numBranches = rng(5, 8);
    for (let b = 0; b < numBranches; b++) {
      branchCount++;
      const bCode = `BR${String(branchCount).padStart(4, '0')}`;
      const ifsc = `BNKX0${bCode}`;
      const bType = pick(BRANCH_TYPES);
      const tier = pick(TIERS);
      const estYear = rng(1990, 2022);
      const res = await client.query(
        `INSERT INTO branches (branch_name, branch_code, ifsc_code, zone_id, city, branch_type, tier, established_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING branch_id`,
        [`Branch ${bCode}`, bCode, ifsc, zoneId, `City-${branchCount}`, bType, tier, `${estYear}-${String(rng(1,12)).padStart(2,'0')}-15`]
      );
      branchIds.push(res.rows[0].branch_id);
      branchZoneMap.set(res.rows[0].branch_id, zoneId);
    }
  }
  console.log(`[Phase1] ${branchCount} branches created`);

  // ---- DEPARTMENTS lookup ----
  const deptRes = await client.query('SELECT department_id, dept_code FROM departments');
  const deptIds = deptRes.rows.map((r: any) => r.department_id);

  // ---- EMPLOYEES (3-12 per branch, realistic designation distribution) ----
  let empCount = 0;
  const empIds: number[] = [];
  const empBranches: Map<number, number> = new Map();
  const empDesignations: Map<number, string> = new Map();
  const empDepts: Map<number, number> = new Map();

  // Track Jharkhand branches for Scenario A (will have more employees)
  const jhZones = new Set<number>();
  for (const [zId, regCode] of zoneRegionMap) {
    if (regCode === 'REG_JH') jhZones.add(zId);
  }

  for (const branchId of branchIds) {
    const isJharkhand = jhZones.has(branchZoneMap.get(branchId)!);
    const numEmps = isJharkhand ? rng(8, 15) : rng(3, 12); // Jharkhand branches are larger

    for (let e = 0; e < numEmps; e++) {
      empCount++;
      const gender = rand() < 0.45 ? 'F' : 'M';
      const fn = gender === 'F' ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
      const ln = pick(LAST_NAMES);
      const empNum = `E${String(empCount).padStart(6, '0')}`;

      // Designation distribution: mostly junior, fewer senior
      let desigIdx: number;
      const r = rand();
      if (r < 0.30) desigIdx = 0;      // 30% CLERK
      else if (r < 0.55) desigIdx = 1;  // 25% OFFICER
      else if (r < 0.70) desigIdx = 2;  // 15% SENIOR_OFFICER
      else if (r < 0.82) desigIdx = 3;  // 12% MANAGER
      else if (r < 0.90) desigIdx = 4;  // 8% SENIOR_MANAGER
      else if (r < 0.95) desigIdx = 5;  // 5% CHIEF_MANAGER
      else if (r < 0.975) desigIdx = 6; // 2.5% AGM
      else if (r < 0.99) desigIdx = 7;  // 1.5% DGM
      else desigIdx = 8;                // 1% GM

      const designation = DESIGNATIONS[desigIdx];
      const [salMin, salMax] = DESIGNATION_SALARY[designation];
      const salary = rng(salMin, salMax);
      const deptId = pick(deptIds);

      // Employment type
      const empTypeR = rand();
      let empType: string;
      if (empTypeR < 0.70) empType = 'PERMANENT';
      else if (empTypeR < 0.85) empType = 'CONTRACT';
      else if (empTypeR < 0.95) empType = 'PROBATION';
      else empType = 'TEMPORARY';

      // Status
      let status: string;
      const statusR = rand();
      if (statusR < 0.82) status = 'ACTIVE';
      else if (statusR < 0.88) status = 'RESIGNED';
      else if (statusR < 0.93) status = 'RETIRED';
      else if (statusR < 0.96) status = 'TERMINATED';
      else status = 'INACTIVE';

      // Dates
      const joinYear = rng(2005, 2024);
      const joinMonth = rng(1, 12);
      const joinDate = `${joinYear}-${String(joinMonth).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}`;
      let exitDate: string | null = null;
      if (status === 'RESIGNED' || status === 'RETIRED' || status === 'TERMINATED') {
        const exitYear = rng(Math.max(joinYear + 1, 2020), 2026);
        exitDate = `${exitYear}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}`;
      }

      const dob = `${rng(1960, 2000)}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}`;

      const res = await client.query(
        `INSERT INTO employees (employee_number, first_name, last_name, gender, date_of_birth, join_date, exit_date,
         employment_type, designation, department_id, branch_id, salary, email, phone, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING employee_id`,
        [empNum, fn, ln, gender, dob, joinDate, exitDate, empType, designation, deptId, branchId, salary,
         `${fn.toLowerCase()}.${ln.toLowerCase()}${empCount}@bank.co.in`, `9${String(rng(100000000,999999999))}`, status]
      );
      empIds.push(res.rows[0].employee_id);
      empBranches.set(res.rows[0].employee_id, branchId);
      empDesignations.set(res.rows[0].employee_id, designation);
      empDepts.set(res.rows[0].employee_id, deptId);
    }
  }
  console.log(`[Phase1] ${empCount} employees created`);

  // Assign some managers (higher-designation employees as managers for lower ones)
  // This is approximate — just link ~60% of employees to a manager in same branch
  let managerUpdates = 0;
  const branchEmployees: Map<number, number[]> = new Map();
  for (const [empId, brId] of empBranches) {
    if (!branchEmployees.has(brId)) branchEmployees.set(brId, []);
    branchEmployees.get(brId)!.push(empId);
  }

  for (const [brId, emps] of branchEmployees) {
    const seniors = emps.filter(eid => {
      const desig = empDesignations.get(eid)!;
      return DESIGNATIONS.indexOf(desig) >= 3; // MANAGER and above
    });
    if (seniors.length === 0) continue;

    for (const empId of emps) {
      const desig = empDesignations.get(empId)!;
      if (DESIGNATIONS.indexOf(desig) < 3 && rand() < 0.6) {
        const mgr = pick(seniors);
        if (mgr !== empId) {
          await client.query('UPDATE employees SET manager_id = $1 WHERE employee_id = $2', [mgr, empId]);
          managerUpdates++;
        }
      }
    }
  }
  console.log(`[Phase1] ${managerUpdates} manager relationships set`);

  console.log(`[Phase1] ✅ Complete: ${zoneCount} zones, ${branchCount} branches, ${empCount} employees`);
  await client.end();
}

seedPhase1().catch(err => { console.error('[Phase1] FATAL:', err); process.exit(1); });
