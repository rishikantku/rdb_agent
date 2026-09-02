import { useState } from 'react';
import { ShieldCheck, Plus, Info, X } from 'lucide-react';
import {
  permissionService,
  CAPABILITY_LABELS,
  DOMAIN_LABELS,
  DEMO_AREAS,
} from '../lib/permissions';
import type { Capability, DataDomain, ScopeLevel } from '../lib/permissions';

const SCOPE_LEVELS: { id: ScopeLevel; label: string }[] = [
  { id: 'enterprise', label: 'Enterprise — all regions' },
  { id: 'state', label: 'State' },
  { id: 'region', label: 'Region' },
  { id: 'zone', label: 'Zone' },
  { id: 'branch', label: 'Branch' },
];

/**
 * Preview of role administration. The controls are live so the flow can be
 * walked through, but nothing is saved — roles are defined in the permission
 * matrix today and will be managed by the authorization service later.
 */
const RolePermissionsPreview = () => {
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState(false);

  const [name, setName] = useState('');
  const [level, setLevel] = useState<ScopeLevel>('region');
  const [area, setArea] = useState(DEMO_AREAS.region[0]);
  const [domains, setDomains] = useState<DataDomain[]>(['loan_data', 'branch_data']);
  const [capabilities, setCapabilities] = useState<Capability[]>(['view_aggregate']);

  const roles = permissionService.listRoles();

  const toggle = <T,>(list: T[], value: T, set: (v: T[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const reset = () => {
    setAdding(false); setNotice(false); setName('');
    setLevel('region'); setArea(DEMO_AREAS.region[0]);
    setDomains(['loan_data', 'branch_data']); setCapabilities(['view_aggregate']);
  };

  return (
    <div className="glass" style={{ padding: '2rem', maxWidth: '700px', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <ShieldCheck size={16} color="var(--accent)" />
          <h3 style={{ margin: 0 }}>Role Permissions</h3>
        </div>
        {!adding && (
          <button onClick={() => { setAdding(true); setNotice(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '.79rem', padding: '.42rem .8rem' }}>
            <Plus size={14} /> Add role permission
          </button>
        )}
      </div>

      <p style={{ margin: '0 0 1.25rem', fontSize: '.8rem', color: 'var(--ink-3)', maxWidth: '58ch' }}>
        Roles currently configured for the demonstration. Each defines a data scope, the
        business areas it may read, and the level of detail it may see.
      </p>

      {/* Existing roles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--hairline)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: adding ? '1.5rem' : 0 }}>
        {roles.map((r) => (
          <div key={r.id} style={{ background: 'var(--surface-2)', padding: '.75rem .9rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ minWidth: '120px' }}>
              <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)' }}>{r.title}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--ink-3)' }}>{r.scope.label}</div>
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', flex: 1 }}>
              {r.domains.slice(0, 4).map((d) => (
                <span key={d} className="badge">{DOMAIN_LABELS[d]}</span>
              ))}
              {r.domains.length > 4 && <span className="badge">+{r.domains.length - 4}</span>}
            </div>
            <span className="badge" style={{ whiteSpace: 'nowrap' }}>{r.capabilities.length} capabilities</span>
          </div>
        ))}
      </div>

      {/* Add-role form */}
      {adding && (
        <div className="fade-in" style={{ border: '1px solid var(--hairline)', borderRadius: 'var(--r-md)', padding: '1.15rem', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0, fontSize: '.9rem', color: 'var(--ink)' }}>New role permission</h4>
            <button onClick={reset} title="Cancel" style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', padding: '3px' }}>
              <X size={16} />
            </button>
          </div>

          <Field label="Role name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regional Credit Head" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.9rem' }}>
            <Field label="Scope level">
              <select value={level} onChange={(e) => {
                const next = e.target.value as ScopeLevel;
                setLevel(next);
                setArea(DEMO_AREAS[next]?.[0] ?? '');
              }}>
                {SCOPE_LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </Field>
            <Field label="Permitted area">
              <select value={area} onChange={(e) => setArea(e.target.value)}>
                {(DEMO_AREAS[level] ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Data domains">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(Object.keys(DOMAIN_LABELS) as DataDomain[]).map((d) => (
                <Chip key={d} on={domains.includes(d)} onClick={() => toggle(domains, d, setDomains)}>
                  {DOMAIN_LABELS[d]}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Query capabilities">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(Object.keys(CAPABILITY_LABELS) as Capability[]).map((c) => (
                <Chip key={c} on={capabilities.includes(c)} onClick={() => toggle(capabilities, c, setCapabilities)}>
                  {CAPABILITY_LABELS[c]}
                </Chip>
              ))}
            </div>
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '1.15rem' }}>
            <button onClick={() => setNotice(true)}>Save role</button>
            <button onClick={reset} style={{ background: 'transparent', border: '1px solid var(--hairline)', color: 'var(--ink-2)' }}>
              Cancel
            </button>
          </div>

          {notice && (
            <div className="fade-in" style={{ marginTop: '1rem', display: 'flex', gap: '9px', padding: '.75rem .85rem', borderRadius: 'var(--r-md)', background: 'var(--warn-weak)', border: '1px solid rgba(217,154,69,0.35)' }}>
              <Info size={14} color="var(--warn)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '.78rem', color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Not saved. Role administration is shown here as a preview — roles are defined
                in the permission matrix for this demonstration, and will be managed through
                the authorization service once it is in place.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '.9rem' }}>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.64rem', letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: '.4rem' }}>
      {label}
    </div>
    {children}
  </div>
);

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    aria-pressed={on}
    style={{
      fontSize: '.73rem', fontWeight: 500, padding: '.3rem .65rem',
      background: on ? 'var(--accent-weak)' : 'transparent',
      border: `1px solid ${on ? 'var(--accent-line)' : 'var(--hairline)'}`,
      color: on ? 'var(--accent)' : 'var(--ink-3)',
    }}
  >
    {children}
  </button>
);

export default RolePermissionsPreview;
