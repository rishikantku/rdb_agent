// ============================================================================
// Phase 3: Loans, Transactions, Employee Performance & Attendance,
//          Complaints, Interactions, Loan Payments, Account Balances,
//          Employee Dept History, Loan Status History
// ============================================================================
// This phase generates the analytical/historical data that powers complex
// time-series, fiscal-year, and trend queries.
// ============================================================================
import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;

let _seed = 5001;
function srand(s: number) { _seed = s; }
function rand(): number { _seed = (_seed * 1103515245 + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }
function rng(min: number, max: number): number { return Math.floor(rand() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[rng(0, arr.length - 1)]; }

async function batchInsert(client: Client, table: string, columns: string[], rows: any[][], batchSize = 200): Promise<number> {
  const colCount = columns.length;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const placeholders: string[] = [];
    const params: any[] = [];
    for (let r = 0; r < slice.length; r++) {
      const offset = r * colCount;
      const ph = columns.map((_, ci) => `$${offset + ci + 1}`).join(',');
      placeholders.push(`(${ph})`);
      params.push(...slice[r]);
    }
    await client.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders.join(',')}`,
      params
    );
    inserted += slice.length;
  }
  return inserted;
}

async function seedPhase3() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('[Phase3] Connected');
  srand(5001);

  // Lookups
  const branchRes = await client.query('SELECT branch_id FROM branches WHERE is_active = TRUE');
  const branchIds = branchRes.rows.map((r: any) => r.branch_id);

  const empRes = await client.query("SELECT employee_id, branch_id, department_id, designation, join_date, status FROM employees");
  const employees = empRes.rows;
  const activeEmps = employees.filter((e: any) => e.status === 'ACTIVE');
  console.log(`[Phase3] ${employees.length} employees, ${activeEmps.length} active`);

  const custRes = await client.query("SELECT customer_id, branch_id FROM customers WHERE status = 'ACTIVE' LIMIT 4000");
  const customers = custRes.rows;

  const acctRes = await client.query("SELECT account_id, customer_id, branch_id, opening_date FROM accounts WHERE status = 'ACTIVE'");
  const accounts = acctRes.rows;
  console.log(`[Phase3] ${customers.length} customers, ${accounts.length} accounts`);

  const loanTypeRes = await client.query('SELECT loan_type_id, type_code, min_rate, max_rate FROM loan_types');
  const loanTypes = loanTypeRes.rows;

  const txnTypeRes = await client.query('SELECT txn_type_id, type_code FROM transaction_types');
  const txnTypes = txnTypeRes.rows;

  // ---- LOANS (2000) with intentional patterns ----
  console.log('[Phase3] Generating loans...');
  const loanRows: any[][] = [];
  const loanMeta: Array<{ custId: number; branchId: number; amount: number; status: string; sanctionDate: string }> = [];

  for (let i = 0; i < 2000; i++) {
    const cust = pick(customers);
    const branchId = cust.branch_id;
    const lt = pick(loanTypes);
    const loanNum = `LN${String(i + 1).padStart(8, '0')}`;

    const sanctionYear = rng(2019, 2025);
    const sanctionMonth = rng(1, 12);
    const sanctionDate = `${sanctionYear}-${String(sanctionMonth).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}`;

    // Larger loans for some Jharkhand branches (Scenario A pattern)
    let amount: number;
    if (branchId <= 60 && rand() < 0.4) { // First 60 branches (roughly Jharkhand/Bihar)
      amount = rng(500000, 8000000); // Larger loans
    } else {
      amount = rng(50000, 3000000);
    }

    const rate = Number(lt.min_rate) + Math.round(rand() * (Number(lt.max_rate) - Number(lt.min_rate)) * 100) / 100;
    const tenure = pick([12, 24, 36, 60, 84, 120, 180, 240]);

    // Status with patterns — ~10% NPA
    const statusR = rand();
    let status: string;
    let riskCat: string;
    if (statusR < 0.65) { status = 'ACTIVE'; riskCat = 'STANDARD'; }
    else if (statusR < 0.80) { status = 'CLOSED'; riskCat = 'STANDARD'; }
    else if (statusR < 0.90) { status = 'NPA'; riskCat = pick(['SUBSTANDARD','DOUBTFUL','LOSS']); }
    else if (statusR < 0.95) { status = 'RESTRUCTURED'; riskCat = 'SMA2'; }
    else { status = 'SANCTIONED'; riskCat = 'STANDARD'; }

    const outstanding = status === 'CLOSED' ? 0 : Math.round(amount * (0.2 + rand() * 0.8));
    const disbursed = status === 'SANCTIONED' ? 0 : amount;
    const npaDate = status === 'NPA' ? `${rng(2022, 2025)}-${String(rng(1,12)).padStart(2,'0')}-01` : null;
    const disbDate = status !== 'SANCTIONED' ? sanctionDate : null;

    loanRows.push([cust.customer_id, branchId, lt.loan_type_id, loanNum, sanctionDate, amount, disbursed, outstanding, rate, tenure, null, status, riskCat, npaDate, disbDate]);
    loanMeta.push({ custId: cust.customer_id, branchId, amount, status, sanctionDate });
  }
  const loansInserted = await batchInsert(client, 'loans',
    ['customer_id','branch_id','loan_type_id','loan_number','sanction_date','sanction_amount','disbursed_amount','outstanding_amount','interest_rate','tenure_months','maturity_date','status','risk_category','npa_date','disbursement_date'],
    loanRows, 100);
  console.log(`[Phase3] ${loansInserted} loans created`);

  // ---- LOAN_PAYMENTS (6 per loan avg ≈ 12000) ----
  console.log('[Phase3] Generating loan payments...');
  const loanIdRes = await client.query('SELECT loan_id, sanction_date, sanction_amount, status FROM loans');
  const allLoans = loanIdRes.rows;
  const paymentRows: any[][] = [];

  for (const loan of allLoans) {
    if (loan.status === 'SANCTIONED') continue;
    const numPayments = rng(3, 12);
    const sanctDate = new Date(loan.sanction_date);
    const emi = Math.round(Number(loan.sanction_amount) / 60);

    for (let p = 0; p < numPayments; p++) {
      const payDate = new Date(sanctDate);
      payDate.setMonth(payDate.getMonth() + p + 1);
      if (payDate > new Date()) break;

      const dueDate = new Date(payDate);
      const dueAmount = emi;
      const isOverdue = loan.status === 'NPA' && p >= numPayments - 3;
      const paidAmount = isOverdue ? (rand() < 0.5 ? 0 : Math.round(emi * 0.3)) : emi;
      const principal = Math.round(paidAmount * 0.6);
      const interest = paidAmount - principal;
      const daysOverdue = isOverdue ? rng(30, 180) : 0;
      const payStatus = isOverdue ? (paidAmount === 0 ? 'OVERDUE' : 'PARTIAL') : 'PAID';

      paymentRows.push([loan.loan_id, payDate.toISOString().split('T')[0], dueDate.toISOString().split('T')[0], dueAmount, paidAmount, principal, interest, 0, daysOverdue, payStatus]);
    }
  }
  const paymentsInserted = await batchInsert(client, 'loan_payments',
    ['loan_id','payment_date','due_date','due_amount','paid_amount','principal_amount','interest_amount','penalty_amount','days_overdue','payment_status'],
    paymentRows, 200);
  console.log(`[Phase3] ${paymentsInserted} loan_payments created`);

  // ---- EMPLOYEE PERFORMANCE (quarterly for 5 FYs for active employees ≈ 20,000+) ----
  console.log('[Phase3] Generating employee performance...');
  const perfRows: any[][] = [];
  const fyears = [2021, 2022, 2023, 2024, 2025];
  const quarters = ['Q1','Q2','Q3','Q4'];

  // Scenario B: ~15% of employees have high salary but low performance
  // Scenario D: Some Jharkhand branches have declining productivity for 3 quarters
  const scenarioBEmps = new Set<number>();
  for (const emp of activeEmps) {
    if (rand() < 0.15) scenarioBEmps.add(emp.employee_id);
  }

  for (const emp of activeEmps) {
    const isScenarioB = scenarioBEmps.has(emp.employee_id);
    // Branch-level declining trend for Jharkhand
    const isJhBranch = emp.branch_id <= 60;

    for (const fy of fyears) {
      for (let qi = 0; qi < quarters.length; qi++) {
        const q = quarters[qi];
        const perfDate = `${fy + (qi >= 2 ? 1 : 0)}-${String([4,7,10,1][qi]).padStart(2,'0')}-01`;

        let basePerf = 4.0 + rand() * 4.0; // 4.0-8.0
        let baseProd = 4.0 + rand() * 4.0;

        // Scenario B: high salary, low performance
        if (isScenarioB) {
          basePerf = 2.5 + rand() * 2.5; // 2.5-5.0
          baseProd = 2.5 + rand() * 2.5;
        }

        // Scenario D: Jharkhand branches declining productivity (2024-2025)
        if (isJhBranch && fy >= 2024) {
          baseProd = Math.max(1, baseProd - (qi * 0.5 + (fy - 2024) * 1.5));
        }

        // Some employees with consistently high performance
        if (emp.employee_id % 7 === 0) {
          basePerf = 7.0 + rand() * 3.0;
          baseProd = 7.0 + rand() * 3.0;
        }

        // Some with declining performance
        if (emp.employee_id % 13 === 0 && fy >= 2023) {
          basePerf = Math.max(1, basePerf - (fy - 2023) * 1.5);
        }

        const perfScore = Math.min(10, Math.max(0, Math.round(basePerf * 100) / 100));
        const prodScore = Math.min(10, Math.max(0, Math.round(baseProd * 100) / 100));
        const salesScore = Math.min(10, Math.max(0, Math.round((3.5 + rand() * 5.5) * 100) / 100));
        const csScore = Math.min(10, Math.max(0, Math.round((4.0 + rand() * 5.0) * 100) / 100));
        const attScore = Math.min(10, Math.max(0, Math.round((5.0 + rand() * 5.0) * 100) / 100));

        perfRows.push([emp.employee_id, perfDate, fy, q, perfScore, prodScore, salesScore, csScore, attScore]);
      }
    }
  }
  const perfInserted = await batchInsert(client, 'employee_performance',
    ['employee_id','performance_date','financial_year','quarter','performance_score','productivity_score','sales_score','customer_service_score','attendance_score'],
    perfRows, 200);
  console.log(`[Phase3] ${perfInserted} employee_performance records created`);

  // ---- EMPLOYEE ATTENDANCE (monthly for 2 years for active employees) ----
  console.log('[Phase3] Generating employee attendance...');
  const attRows: any[][] = [];
  for (const emp of activeEmps) {
    for (let m = 0; m < 24; m++) {
      const date = new Date();
      date.setMonth(date.getMonth() - m);
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-01`;
      const workDays = rng(20, 26);
      const absent = rng(0, 5);
      const present = workDays - absent;
      const leaves = rng(0, absent);
      const late = rng(0, 3);
      attRows.push([emp.employee_id, monthYear, workDays, present, absent, leaves, late]);
    }
  }
  const attInserted = await batchInsert(client, 'employee_attendance',
    ['employee_id','month_year','working_days','days_present','days_absent','leaves_taken','late_arrivals'],
    attRows, 300);
  console.log(`[Phase3] ${attInserted} employee_attendance records created`);

  // ---- EMPLOYEE DEPARTMENT HISTORY (1-3 records per employee ≈ 4000+) ----
  console.log('[Phase3] Generating department history...');
  const deptRes = await client.query('SELECT department_id FROM departments');
  const deptIds = deptRes.rows.map((r: any) => r.department_id);
  const histRows: any[][] = [];

  for (const emp of employees) {
    const numChanges = rand() < 0.65 ? 1 : rand() < 0.90 ? 2 : 3;
    let currentDept = emp.department_id;
    let currentDate = emp.join_date;

    for (let h = 0; h < numChanges; h++) {
      const endDate = h < numChanges - 1 ?
        `${rng(new Date(currentDate).getFullYear() + 1, 2025)}-${String(rng(1,12)).padStart(2,'0')}-01` : null;
      const reason = h === 0 ? 'JOINING' : pick(['PROMOTION','TRANSFER','REORGANIZATION','REQUEST']);
      histRows.push([emp.employee_id, currentDept, emp.branch_id, emp.designation, currentDate, endDate, reason]);
      if (endDate) {
        currentDate = endDate;
        currentDept = pick(deptIds);
      }
    }
  }
  const histInserted = await batchInsert(client, 'employee_department_history',
    ['employee_id','department_id','branch_id','designation','start_date','end_date','reason'],
    histRows, 200);
  console.log(`[Phase3] ${histInserted} department_history records created`);

  // ---- TRANSACTIONS (30,000 — enough for analytical queries) ----
  console.log('[Phase3] Generating transactions...');
  const channels = ['BRANCH','ATM','NETBANKING','UPI','NEFT','RTGS','IMPS','MOBILE','CHEQUE','POS'];
  const txnRows: any[][] = [];

  // Scenario C: some customers have declining transaction frequency — tracked by giving them fewer recent txns
  const scenarioCCustomers = new Set<number>();
  for (const cust of customers) {
    if (rand() < 0.1) scenarioCCustomers.add(cust.customer_id);
  }

  for (let i = 0; i < 30000; i++) {
    const acct = pick(accounts);
    const isDebit = rand() < 0.45;
    const debitCredit = isDebit ? 'DR' : 'CR';

    // Transaction type correlated with debit/credit
    let txnType: any;
    if (isDebit) {
      txnType = pick(txnTypes.filter((t: any) => ['CWTH','TRFR','NEFT','RTGS','IMPS','UPI','CHEQ','FEE'].includes(t.type_code)));
    } else {
      txnType = pick(txnTypes.filter((t: any) => ['CDEP','TRFR','NEFT','RTGS','IMPS','UPI','INTC','LREP'].includes(t.type_code)));
    }
    if (!txnType) txnType = txnTypes[0];

    const amount = txnType.type_code === 'RTGS' ? rng(200000, 5000000) :
                   txnType.type_code === 'FEE' ? rng(50, 5000) :
                   txnType.type_code === 'INTC' ? rng(100, 50000) :
                   rng(500, 200000);

    // Date distribution — more recent transactions, fewer old ones
    let txnYear: number;
    const yearR = rand();
    if (yearR < 0.05) txnYear = 2021;
    else if (yearR < 0.15) txnYear = 2022;
    else if (yearR < 0.30) txnYear = 2023;
    else if (yearR < 0.55) txnYear = 2024;
    else if (yearR < 0.85) txnYear = 2025;
    else txnYear = 2026;

    const txnMonth = rng(1, 12);
    const txnDay = rng(1, 28);
    const txnHour = rng(8, 20);
    const txnDate = `${txnYear}-${String(txnMonth).padStart(2,'0')}-${String(txnDay).padStart(2,'0')} ${String(txnHour).padStart(2,'0')}:${String(rng(0,59)).padStart(2,'0')}:${String(rng(0,59)).padStart(2,'0')}`;

    const channel = pick(channels);
    const branchId = rand() < 0.4 ? acct.branch_id : pick(branchIds);
    const refNum = `TXN${String(i + 1).padStart(10, '0')}`;

    txnRows.push([acct.account_id, txnType.txn_type_id, txnDate, amount, debitCredit, channel, branchId, null, 'COMPLETED', refNum, null]);
  }

  const txnInserted = await batchInsert(client, 'transactions',
    ['account_id','txn_type_id','transaction_date','amount','debit_credit','channel','branch_id','counterparty_account_id','status','reference_number','description'],
    txnRows, 200);
  console.log(`[Phase3] ${txnInserted} transactions created`);

  // ---- ACCOUNT_BALANCES (monthly snapshots for 2 years for a sample of accounts ≈ 15,000) ----
  console.log('[Phase3] Generating account balances...');
  const sampleAccounts = accounts.slice(0, Math.min(600, accounts.length));
  const balRows: any[][] = [];

  for (const acct of sampleAccounts) {
    let balance = rng(10000, 500000);
    for (let m = 0; m < 24; m++) {
      const date = new Date();
      date.setMonth(date.getMonth() - m);
      const balDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-01`;

      const credits = rng(5000, 200000);
      const debits = rng(3000, 180000);
      const closingBalance = balance + credits - debits;
      balance = Math.max(0, closingBalance);

      // Scenario C: some customers have increasing balances
      const isScenarioC = scenarioCCustomers.has(acct.customer_id);
      const adjustedBalance = isScenarioC ? balance + m * rng(5000, 20000) : balance;

      balRows.push([acct.account_id, balDate, adjustedBalance - credits + debits, adjustedBalance, credits, debits]);
    }
  }
  const balInserted = await batchInsert(client, 'account_balances',
    ['account_id','balance_date','opening_balance','closing_balance','total_credits','total_debits'],
    balRows, 300);
  console.log(`[Phase3] ${balInserted} account_balances created`);

  // ---- CUSTOMER COMPLAINTS (1500) ----
  console.log('[Phase3] Generating complaints...');
  const complaintCats = ['ACCOUNT','LOAN','CARD','ATM','NETBANKING','UPI','STAFF','CHARGES','FRAUD','OTHER'];
  const priorities = ['LOW','MEDIUM','HIGH','CRITICAL'];
  const compRows: any[][] = [];

  for (let i = 0; i < 1500; i++) {
    const cust = pick(customers);
    const branchId = cust.branch_id;
    const compDate = `${rng(2022, 2026)}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}`;
    const category = pick(complaintCats);
    const priority = pick(priorities);

    // Some complaints remain unresolved for Scenario F
    const isResolved = rand() < 0.75;
    const resDate = isResolved ? `${rng(2022, 2026)}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')}` : null;
    const resStatus = isResolved ? (rand() < 0.8 ? 'RESOLVED' : 'CLOSED') : (rand() < 0.4 ? 'OPEN' : 'IN_PROGRESS');
    const empId = activeEmps.length > 0 ? pick(activeEmps).employee_id : null;
    const satScore = isResolved ? rng(1, 5) : null;

    compRows.push([cust.customer_id, branchId, compDate, category, priority, null, resDate, resStatus, empId, satScore]);
  }
  const compInserted = await batchInsert(client, 'customer_complaints',
    ['customer_id','branch_id','complaint_date','category','priority','description','resolution_date','resolution_status','assigned_employee_id','satisfaction_score'],
    compRows, 200);
  console.log(`[Phase3] ${compInserted} complaints created`);

  // ---- CUSTOMER INTERACTIONS (3000) ----
  console.log('[Phase3] Generating interactions...');
  const intChannels = ['BRANCH','PHONE','EMAIL','CHAT','VIDEO','MOBILE_APP','WEBSITE'];
  const intTypes = ['ENQUIRY','COMPLAINT','SERVICE_REQUEST','SALES','FEEDBACK','KYC','ACCOUNT_OPENING'];
  const outcomes = ['RESOLVED','FOLLOW_UP','ESCALATED','SALE_COMPLETED','NO_ACTION','REFERRED'];
  const intRows: any[][] = [];

  for (let i = 0; i < 3000; i++) {
    const cust = pick(customers);
    const emp = activeEmps.length > 0 ? pick(activeEmps) : null;
    const branchId = pick(branchIds);
    const intDate = `${rng(2022, 2026)}-${String(rng(1,12)).padStart(2,'0')}-${String(rng(1,28)).padStart(2,'0')} ${String(rng(9,18)).padStart(2,'0')}:${String(rng(0,59)).padStart(2,'0')}:00`;
    const channel = pick(intChannels);
    const intType = pick(intTypes);
    const duration = rng(2, 45);
    const outcome = pick(outcomes);

    intRows.push([cust.customer_id, emp?.employee_id || null, branchId, intDate, channel, intType, duration, outcome]);
  }
  const intInserted = await batchInsert(client, 'customer_interactions',
    ['customer_id','employee_id','branch_id','interaction_date','channel','interaction_type','duration_minutes','outcome'],
    intRows, 200);
  console.log(`[Phase3] ${intInserted} interactions created`);

  // ---- LOAN STATUS HISTORY (for NPA/restructured loans ≈ 500) ----
  console.log('[Phase3] Generating loan status history...');
  const npaLoans = await client.query("SELECT loan_id, sanction_date FROM loans WHERE status IN ('NPA','RESTRUCTURED','CLOSED')");
  const lshRows: any[][] = [];
  for (const loan of npaLoans.rows) {
    const sanctDate = new Date(loan.sanction_date);
    // First status: SANCTIONED → ACTIVE
    lshRows.push([loan.loan_id, null, 'ACTIVE', sanctDate.toISOString().split('T')[0], 'Initial activation', null]);
    // Then degradation
    const degradeDate = new Date(sanctDate);
    degradeDate.setMonth(degradeDate.getMonth() + rng(6, 36));
    if (degradeDate <= new Date()) {
      lshRows.push([loan.loan_id, 'ACTIVE', 'NPA', degradeDate.toISOString().split('T')[0], 'Payment default', null]);
    }
  }
  const lshInserted = await batchInsert(client, 'loan_status_history',
    ['loan_id','old_status','new_status','change_date','reason','changed_by'],
    lshRows, 200);
  console.log(`[Phase3] ${lshInserted} loan_status_history records created`);

  console.log('[Phase3] ✅ Complete');
  await client.end();
}

seedPhase3().catch(err => { console.error('[Phase3] FATAL:', err); process.exit(1); });
