// ============================================================================
// Phase 2: Customers, Accounts, Products, Relationships
// ============================================================================
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

let _seed = 1001;
function srand(s: number) { _seed = s; }
function rand(): number { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }
function rng(min: number, max: number): number { return Math.floor(rand() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[rng(0, arr.length - 1)]; }

const MALE_FIRST = ['Amit','Rahul','Vijay','Suresh','Ravi','Manoj','Ashok','Rajesh','Sanjay','Anil','Deepak','Pradeep','Sunil','Vinod','Arvind','Pankaj','Nitin','Gaurav','Rohit','Ajay'];
const FEMALE_FIRST = ['Priya','Sneha','Anjali','Neha','Kavita','Sunita','Deepa','Pooja','Meena','Rekha','Swati','Nandini','Geeta','Savita','Asha','Puja','Divya','Shruti','Anita','Sapna'];
const LAST_NAMES = ['Sharma','Patel','Verma','Singh','Kumar','Gupta','Reddy','Yadav','Tiwari','Jha','Mishra','Dubey','Pandey','Sinha','Das','Roy','Thakur','Prasad','Mehta','Chopra'];
const OCCUPATIONS = ['Business','Service','Self-Employed','Professional','Agriculture','Student','Homemaker','Retired','Government','Teacher','Doctor','Engineer','Lawyer','Trader'];
const CITIES = ['Ranchi','Patna','Kolkata','Bhubaneswar','Lucknow','Delhi','Bhopal','Mumbai','Pune','Bengaluru','Chennai','Hyderabad','Jaipur','Ahmedabad','Surat','Nagpur','Varanasi','Indore','Guwahati','Dehradun'];

async function seedPhase2() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('[Phase2] Connected');

  srand(1001);

  // Lookup IDs
  const branchRes = await client.query('SELECT branch_id FROM branches WHERE is_active = TRUE');
  const branchIds = branchRes.rows.map((r: any) => r.branch_id);
  const segRes = await client.query('SELECT segment_id, segment_code FROM customer_segments');
  const segments = segRes.rows;
  const acctTypeRes = await client.query('SELECT account_type_id, type_code FROM account_types');
  const acctTypes = acctTypeRes.rows;
  const productRes = await client.query('SELECT product_id FROM products');
  const productIds = productRes.rows.map((r: any) => r.product_id);

  // ---- CUSTOMERS (5000) ----
  const custCount = 5000;
  const custIds: number[] = [];
  const custBranches: Map<number, number> = new Map();

  // Batch insert for speed
  const custValues: any[][] = [];
  for (let i = 0; i < custCount; i++) {
    const gender = rand() < 0.45 ? 'F' : 'M';
    const fn = gender === 'F' ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
    const ln = pick(LAST_NAMES);
    const custNum = `C${String(i + 1).padStart(8, '0')}`;
    const branchId = pick(branchIds);

    // Customer type distribution
    const typeR = rand();
    let custType: string;
    if (typeR < 0.70) custType = 'INDIVIDUAL';
    else if (typeR < 0.85) custType = 'SME';
    else if (typeR < 0.93) custType = 'CORPORATE';
    else if (typeR < 0.97) custType = 'GOVERNMENT';
    else custType = 'INSTITUTIONAL';

    // Segment — correlated with income
    const income = custType === 'CORPORATE' ? rng(5000000, 50000000) :
                   custType === 'SME' ? rng(1000000, 10000000) :
                   rng(100000, 5000000);
    let segIdx: number;
    if (income >= 5000000) segIdx = 3; // HNI
    else if (income >= 1500000) segIdx = 2; // Premium
    else if (income >= 500000) segIdx = 1; // Preferred
    else segIdx = 0; // Mass
    if (custType === 'CORPORATE' || custType === 'INSTITUTIONAL') segIdx = 4; // Corporate segment

    const segmentId = segments[segIdx].segment_id;

    // Risk category
    const riskR = rand();
    const risk = riskR < 0.50 ? 'LOW' : riskR < 0.80 ? 'MEDIUM' : riskR < 0.95 ? 'HIGH' : 'VERY_HIGH';

    const regYear = rng(2015, 2025);
    const regDate = `${regYear}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}`;
    const dob = `${rng(1955, 2003)}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}`;
    const occ = pick(OCCUPATIONS);
    const status = rand() < 0.92 ? 'ACTIVE' : rand() < 0.5 ? 'INACTIVE' : 'CLOSED';

    custValues.push([custNum, fn, ln, dob, gender, custType, segmentId, risk, occ, income, regDate, status, branchId]);
  }

  // Insert in batches of 200
  for (let batch = 0; batch < custValues.length; batch += 200) {
    const slice = custValues.slice(batch, batch + 200);
    const placeholders: string[] = [];
    const params: any[] = [];
    for (let i = 0; i < slice.length; i++) {
      const offset = i * 13;
      placeholders.push(`($${offset+1},$${offset+2},$${offset+3},$${offset+4},$${offset+5},$${offset+6},$${offset+7},$${offset+8},$${offset+9},$${offset+10},$${offset+11},$${offset+12},$${offset+13})`);
      params.push(...slice[i]);
    }
    const res = await client.query(
      `INSERT INTO customers (customer_number, first_name, last_name, date_of_birth, gender, customer_type, segment_id, risk_category, occupation, annual_income, registration_date, status, branch_id)
       VALUES ${placeholders.join(',')} RETURNING customer_id`,
      params
    );
    for (const row of res.rows) custIds.push(row.customer_id);
  }
  console.log(`[Phase2] ${custIds.length} customers created`);

  // ---- ACCOUNTS (1-3 per customer ≈ 8000-10000) ----
  let acctCount = 0;
  const acctIds: number[] = [];
  const savTypeId = acctTypes.find((a: any) => a.type_code === 'SAV')!.account_type_id;
  const curTypeId = acctTypes.find((a: any) => a.type_code === 'CUR')!.account_type_id;
  const fdTypeId = acctTypes.find((a: any) => a.type_code === 'FD')!.account_type_id;
  const salTypeId = acctTypes.find((a: any) => a.type_code === 'SAL')!.account_type_id;
  const rdTypeId = acctTypes.find((a: any) => a.type_code === 'RD')!.account_type_id;

  for (const custId of custIds) {
    // Every customer has at least one savings account
    const numAccts = rand() < 0.60 ? 1 : rand() < 0.85 ? 2 : 3;

    for (let a = 0; a < numAccts; a++) {
      acctCount++;
      const acctNum = `ACCT${String(acctCount).padStart(10, '0')}`;
      let typeId: number;
      if (a === 0) {
        typeId = rand() < 0.7 ? savTypeId : salTypeId; // Primary is savings or salary
      } else {
        typeId = pick([fdTypeId, curTypeId, rdTypeId]);
      }

      const openYear = rng(2016, 2025);
      const openDate = `${openYear}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}`;
      const balance = typeId === fdTypeId ? rng(50000, 5000000) :
                      typeId === curTypeId ? rng(10000, 2000000) :
                      rng(1000, 500000);
      const branchId = pick(branchIds);
      const status = rand() < 0.90 ? 'ACTIVE' : rand() < 0.5 ? 'DORMANT' : 'CLOSED';

      const res = await client.query(
        `INSERT INTO accounts (account_number, customer_id, account_type_id, branch_id, opening_date, status, current_balance)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING account_id`,
        [acctNum, custId, typeId, branchId, openDate, status, balance]
      );
      acctIds.push(res.rows[0].account_id);
    }
  }
  console.log(`[Phase2] ${acctCount} accounts created`);

  // ---- CUSTOMER_PRODUCTS (1-4 per customer ≈ 10000-15000) ----
  let prodCount = 0;
  for (const custId of custIds) {
    const numProds = rand() < 0.40 ? 1 : rand() < 0.70 ? 2 : rand() < 0.90 ? 3 : 4;
    const usedProducts = new Set<number>();

    for (let p = 0; p < numProds; p++) {
      let pid = pick(productIds);
      // Avoid duplicate products per customer
      let attempts = 0;
      while (usedProducts.has(pid) && attempts < 10) {
        pid = pick(productIds);
        attempts++;
      }
      if (usedProducts.has(pid)) continue;
      usedProducts.add(pid);

      prodCount++;
      const branchId = pick(branchIds);
      const actDate = `${rng(2017, 2025)}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}`;
      const status = rand() < 0.85 ? 'ACTIVE' : rand() < 0.5 ? 'INACTIVE' : 'CANCELLED';
      const deactDate = status !== 'ACTIVE' ? `${rng(2023, 2026)}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}` : null;

      await client.query(
        `INSERT INTO customer_products (customer_id, product_id, branch_id, activation_date, deactivation_date, status)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [custId, pid, branchId, actDate, deactDate, status]
      );
    }
  }
  console.log(`[Phase2] ${prodCount} customer_products created`);

  // ---- CUSTOMER_ADDRESSES (1-2 per customer) ----
  let addrCount = 0;
  for (const custId of custIds) {
    const numAddrs = rand() < 0.70 ? 1 : 2;
    const types = ['PERMANENT', 'CURRENT'];
    for (let a = 0; a < numAddrs; a++) {
      addrCount++;
      const city = pick(CITIES);
      await client.query(
        `INSERT INTO customer_addresses (customer_id, address_type, address_line1, city, state, pincode, is_primary)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [custId, types[a], `${rng(1,999)} ${pick(['MG Road','Gandhi Nagar','Station Road','Main Road','Market Area','Industrial Area'])}`, city, city, `${rng(100000,999999)}`, a === 0]
      );
    }
  }
  console.log(`[Phase2] ${addrCount} customer_addresses created`);

  // ---- CUSTOMER_RELATIONSHIPS (subset — about 500 pairs) ----
  let relCount = 0;
  const relTypes = ['JOINT','GUARDIAN','NOMINEE','SPOUSE','GUARANTOR'];
  for (let i = 0; i < 500; i++) {
    const c1 = custIds[rng(0, custIds.length - 1)];
    let c2 = custIds[rng(0, custIds.length - 1)];
    while (c2 === c1) c2 = custIds[rng(0, custIds.length - 1)];

    relCount++;
    await client.query(
      `INSERT INTO customer_relationships (primary_customer_id, related_customer_id, relationship_type, start_date, status)
       VALUES ($1,$2,$3,$4,'ACTIVE')`,
      [c1, c2, pick(relTypes), `${rng(2018,2025)}-${String(rng(1,12)).padStart(2,'0')}-01`]
    );
  }
  console.log(`[Phase2] ${relCount} customer_relationships created`);

  // ---- ACCOUNT_HOLDERS (primary holder for each account + ~500 joint holders) ----
  let holderCount = 0;
  // Primary holders
  const acctCustRes = await client.query('SELECT account_id, customer_id, opening_date FROM accounts');
  for (const row of acctCustRes.rows) {
    holderCount++;
    await client.query(
      `INSERT INTO account_holders (account_id, customer_id, holder_type, start_date)
       VALUES ($1,$2,'PRIMARY',$3)`,
      [row.account_id, row.customer_id, row.opening_date]
    );
  }
  // Joint holders
  for (let j = 0; j < 500; j++) {
    const acctId = acctIds[rng(0, acctIds.length - 1)];
    const custId = custIds[rng(0, custIds.length - 1)];
    holderCount++;
    try {
      await client.query(
        `INSERT INTO account_holders (account_id, customer_id, holder_type, start_date)
         VALUES ($1,$2,'JOINT',$3) ON CONFLICT DO NOTHING`,
        [acctId, custId, `${rng(2018,2025)}-01-01`]
      );
    } catch (_) { /* skip duplicates */ }
  }
  console.log(`[Phase2] ${holderCount} account_holders created`);

  console.log(`[Phase2] ✅ Complete`);
  await client.end();
}

seedPhase2().catch(err => { console.error('[Phase2] FATAL:', err); process.exit(1); });
