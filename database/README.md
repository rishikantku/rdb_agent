# Bank AI POC — Database Documentation

## Overview

Comprehensive synthetic banking database designed to test and demonstrate an advanced Natural Language → SQL AI system. The database contains **28 tables** organized across **7 business domains** with **8 analytical views**, realistic Indian banking data, and intentionally embedded business patterns for complex query testing.

## Architecture

```
states ← regions ← zones ← branches
                              ├── employees ← employee_performance
                              │              ← employee_attendance
                              │              ← employee_department_history
                              ├── customers ← accounts ← transactions
                              │             ← customer_products    ← account_balances
                              │             ← customer_complaints  ← account_holders
                              │             ← customer_interactions
                              │             ← customer_addresses
                              │             ← customer_relationships
                              ├── loans ← loan_payments
                              │         ← loan_status_history
                              └── (product_categories ← products ← customer_products)
```

## Domain Summary

| Domain | Tables | Description |
|--------|--------|-------------|
| Geography | states, regions, zones, branches | 20 Indian states, 12 regions, 54 zones, 336 branches |
| Employee | employees, departments, employee_department_history, employee_performance, employee_attendance | 2500+ employees with quarterly performance across 5 FYs |
| Customer | customers, customer_segments, customer_addresses, customer_relationships | 5000 customers across 5 types and 5 segments |
| Account | account_types, accounts, account_balances, account_holders | 7000+ accounts with monthly balance snapshots |
| Transaction | transaction_types, transactions | 30000+ transactions across 10 channels |
| Loan | loan_types, loans, loan_payments, loan_status_history | 2000 loans with payment histories and NPA tracking |
| Product | product_categories, products, customer_products | 10 products with customer subscriptions |
| Customer Service | customer_complaints, customer_interactions | 1500 complaints, 3000 interactions |

## Views

| View | Purpose |
|------|---------|
| `vw_active_employees` | Active employees with full org context (department, branch, zone, region, state) |
| `vw_branch_employee_metrics` | Per-branch employee stats: count, avg salary, attrition |
| `vw_customer_balance_summary` | Per-customer: total/avg balance, account count, segment |
| `vw_customer_transaction_summary` | Per-customer: total credits/debits, transaction counts |
| `vw_branch_loan_metrics` | Per-branch: loan portfolio, NPA ratio, disbursement totals |
| `vw_employee_quarterly_performance` | Employee performance with composite score |
| `vw_branch_quarterly_performance` | Aggregated branch-level performance by FY/quarter |
| `vw_customer_product_summary` | Per-customer product count and list |

## Intentional Data Patterns

| Scenario | Pattern | Purpose |
|----------|---------|---------|
| A | Jharkhand branches have larger employee counts and growing loan portfolios but declining productivity | Tests multi-factor trend detection |
| B | ~15% of employees have salary above dept avg but performance below dept avg | Tests comparative analysis |
| C | ~10% of customers have increasing balances but declining transaction frequency | Tests divergent trend detection |
| D | Some Jharkhand branches have declining productivity for 3+ consecutive quarters | Tests consecutive period detection |
| E | Some branches have >15% YoY loan growth | Tests year-over-year calculations |
| F | ~25% of complaints remain unresolved | Tests complaint duration analysis |

## Indian Financial Year

- **FY2023-24** = April 1, 2023 → March 31, 2024
- Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar
- SQL: `CASE WHEN EXTRACT(MONTH FROM date) >= 4 THEN EXTRACT(YEAR FROM date) ELSE EXTRACT(YEAR FROM date) - 1 END`

## How to Rebuild

```bash
# 1. Set DATABASE_URL in .env
# 2. Run schema
npx tsx database/seed/run-sql.ts database/schema/001_create_tables.sql
npx tsx database/seed/run-sql.ts database/schema/002_create_indexes.sql
npx tsx database/seed/run-sql.ts database/schema/003_create_views.sql
npx tsx database/seed/run-sql.ts database/schema/004_reference_data.sql

# 3. Seed data (in order)
npx tsx database/seed/seed-phase1.ts   # Zones, Branches, Employees
npx tsx database/seed/seed-phase2.ts   # Customers, Accounts, Products
npx tsx database/seed/seed-phase3.ts   # Loans, Transactions, Performance, Complaints

# 4. Validate
npx tsx database/seed/validate.ts
```

## How to Reset

```bash
npx tsx database/seed/run-sql.ts database/schema/001_create_tables.sql  # DROP CASCADE + recreate
npx tsx database/seed/run-sql.ts database/schema/002_create_indexes.sql
npx tsx database/seed/run-sql.ts database/schema/003_create_views.sql
npx tsx database/seed/run-sql.ts database/schema/004_reference_data.sql
# Then re-run seed phases
```

## Semantic Layer

See `database/semantic/` for:
- `business_glossary.json` — Term definitions with SQL mappings
- `business_rules.json` — Mandatory rules for SQL generation
- `entities.json` — Entity definitions and join paths
- `metrics.json` — Quantitative measure definitions
- `relationships.json` — Complete FK relationship map
- `examples.json` — Example NL-to-SQL pairs

## Demo Queries

See `database/queries/demo_queries.json` for 20 verified complex queries.
