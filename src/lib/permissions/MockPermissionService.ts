// ============================================================================
// MockPermissionService — UI permission simulation
// ============================================================================
// Reads the question, infers what access it would need, and compares that to the
// selected role's profile. Everything happens in the renderer: this is a
// demonstration of how role-based access will behave, not an enforcement point.
//
// A BackendPermissionService implementing the same interface would send the
// question and the authenticated identity to the server and return the same
// decision shape. No component would change.
// ============================================================================

import type {
  AuthorizationDecision,
  AuthorizationRequest,
  Capability,
  DataDomain,
  PermissionProfile,
  PermissionService,
  RequestedAccess,
  RoleId,
  ScopeLevel,
} from './types';
import { rank, CAPABILITY_LABELS, DOMAIN_LABELS } from './types';
import { AREA_ALIASES, ROLES, ROLE_ORDER } from './roles';

const DOMAIN_KEYWORDS: [DataDomain, string[]][] = [
  ['loan_data', ['loan', 'npa', 'disburse', 'sanction', 'portfolio', 'outstanding', 'advance']],
  ['transaction_data', ['transaction', 'txn', 'deposit', 'withdrawal', 'transfer', 'debit', 'credit']],
  ['customer_data', ['customer', 'client', 'depositor', 'borrower', 'complaint']],
  ['account_data', ['account', 'balance', 'savings', 'current account', 'fixed deposit']],
  ['employee_data', ['employee', 'staff', 'salary', 'attrition', 'headcount', 'productivity', 'performance score']],
  ['branch_data', ['branch', 'zone', 'region', 'territory']],
  ['financial_performance', ['profit', 'revenue', 'income', 'margin', 'yield', 'profitability']],
  ['sensitive_financial', ['provision', 'write-off', 'writeoff', 'exposure', 'capital adequacy', 'board']],
];

const DETAIL_KEYWORDS: [Capability, string[]][] = [
  ['view_customer_level', ['each customer', 'customer name', 'list customers', 'customer-level', 'per customer', 'top customers', 'which customers', 'customers who', 'customers whose']],
  ['view_account_level', ['each account', 'account number', 'account-level', 'per account', 'list accounts']],
  ['view_transaction_level', ['each transaction', 'transaction-level', 'list transactions', 'individual transactions']],
];

/** Phrases that clearly ask for everything, regardless of any area named. */
const ENTERPRISE_PHRASES = [
  'all branches', 'every branch', 'across all', 'all regions', 'all zones',
  'enterprise', 'nationwide', 'bank-wide', 'organisation', 'organization',
  'entire bank', 'whole bank', 'all over india', 'pan india',
];

const OWN_SCOPE_PHRASES = ['my branch', 'our branch', 'this branch', 'my zone', 'my region'];

export class MockPermissionService implements PermissionService {
  listRoles(): PermissionProfile[] {
    return ROLE_ORDER.map((id) => ROLES[id]);
  }

  getRole(id: RoleId): PermissionProfile {
    return ROLES[id];
  }

  async authorize(request: AuthorizationRequest): Promise<AuthorizationDecision> {
    const role = this.getRole(request.roleId);
    const requested = this.interpret(request.question, role);

    const reasons: string[] = [];
    let blockingCapability: Capability | undefined;

    // 1. Is the requested breadth within what this role covers?
    const outOfScope = rank(requested.scopeLevel) > rank(role.scope.level);

    // 2. Did the question name an area this role does not hold?
    const permittedAreas = [
      ...(role.scope.regions ?? []),
      ...(role.scope.zones ?? []),
      ...(role.scope.branches ?? []),
    ];
    const foreignAreas =
      role.scope.level === 'enterprise'
        ? []
        : requested.namedAreas.filter((area) => !permittedAreas.includes(area));

    if (outOfScope) {
      blockingCapability = this.scopeCapability(requested.scopeLevel);
      if (!role.capabilities.includes(blockingCapability)) {
        reasons.push(
          `This question covers ${requested.scopeLabel}, which is broader than this role's scope of ${role.scope.label}.`
        );
      } else {
        blockingCapability = undefined;
      }
    }

    if (foreignAreas.length > 0) {
      reasons.push(
        `${foreignAreas.join(' and ')} ${foreignAreas.length > 1 ? 'are' : 'is'} outside the permitted scope for this role.`
      );
      blockingCapability = blockingCapability ?? this.scopeCapability(requested.scopeLevel);
    }

    // 3. Are all the data areas the question touches permitted?
    const deniedDomains = requested.domains.filter((d) => !role.domains.includes(d));
    for (const d of deniedDomains) {
      reasons.push(`${DOMAIN_LABELS[d]} is not available to this role.`);
    }

    // 4. Does the question need a level of detail this role cannot see?
    const deniedCapabilities = requested.capabilities.filter((c) => !role.capabilities.includes(c));
    for (const c of deniedCapabilities) {
      reasons.push(`${CAPABILITY_LABELS[c]} is not granted to this role.`);
      blockingCapability = blockingCapability ?? c;
    }

    return {
      allowed: reasons.length === 0,
      role,
      requested,
      blockingCapability,
      reasons,
      simulated: true,
    };
  }

  // --------------------------------------------------------------------------
  // Reading the question
  // --------------------------------------------------------------------------

  private interpret(question: string, role: PermissionProfile): RequestedAccess {
    const q = question.toLowerCase();

    // Areas named in the question, longest phrasing first so "ranchi zone"
    // matches before bare "ranchi"
    const namedAreas: string[] = [];
    let namedLevel: ScopeLevel | null = null;
    for (const alias of AREA_ALIASES) {
      const hit = [...alias.match].sort((a, b) => b.length - a.length).find((m) => q.includes(m));
      if (hit && !namedAreas.includes(alias.canonical)) {
        namedAreas.push(alias.canonical);
        if (!namedLevel || rank(alias.level) > rank(namedLevel)) namedLevel = alias.level;
      }
    }

    // Breadth
    let scopeLevel: ScopeLevel;
    let scopeLabel: string;

    if (OWN_SCOPE_PHRASES.some((p) => q.includes(p))) {
      // "my branch" means whatever this role already holds
      scopeLevel = role.scope.level;
      scopeLabel = role.scope.label;
    } else if (ENTERPRISE_PHRASES.some((p) => q.includes(p))) {
      // "all branches in Jharkhand" is region-wide; "all branches" alone is everything
      scopeLevel = namedLevel && rank(namedLevel) < rank('enterprise') ? namedLevel : 'enterprise';
      scopeLabel = namedAreas.length
        ? `all branches across ${namedAreas.join(' and ')}`
        : 'all branches across the bank';
    } else if (namedLevel) {
      scopeLevel = namedLevel;
      scopeLabel = namedAreas.join(' and ');
    } else {
      // Nothing named and nothing sweeping — treat as the role's own scope
      scopeLevel = role.scope.level;
      scopeLabel = role.scope.label;
    }

    // Data areas touched
    const domains: DataDomain[] = [];
    for (const [domain, words] of DOMAIN_KEYWORDS) {
      if (words.some((w) => q.includes(w))) domains.push(domain);
    }

    // Detail level
    const capabilities: Capability[] = [];
    for (const [cap, words] of DETAIL_KEYWORDS) {
      if (words.some((w) => q.includes(w))) {
        capabilities.push(cap);
        if (!capabilities.includes('view_detailed_records')) capabilities.push('view_detailed_records');
      }
    }
    if (capabilities.length === 0) capabilities.push('view_aggregate');

    return { scopeLevel, scopeLabel, namedAreas, domains, capabilities };
  }

  /** The capability a role needs to reach beyond its own scope. */
  private scopeCapability(level: ScopeLevel): Capability {
    if (rank(level) >= rank('state')) return 'enterprise_analysis';
    if (rank(level) === rank('region')) return 'cross_region_analysis';
    return 'cross_branch_analysis';
  }
}
