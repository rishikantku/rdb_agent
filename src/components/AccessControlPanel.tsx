import { X, ShieldCheck, Check, Ban, Info } from 'lucide-react';
import { CAPABILITY_LABELS, DOMAIN_LABELS, permissionService } from '../lib/permissions';
import type { RoleId } from '../lib/permissions';

interface Props {
  open: boolean;
  onClose: () => void;
  roleId: RoleId;
  onRoleChange: (id: RoleId) => void;
}

/**
 * Shows what the selected role may and may not reach. Reads entirely from the
 * permission service, so it stays correct when the role matrix changes.
 */
const AccessControlPanel = ({ open, onClose, roleId, onRoleChange }: Props) => {
  if (!open) return null;

  const roles = permissionService.listRoles();
  const role = permissionService.getRole(roleId);

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,12,0.74)', zIndex: 210, display: 'flex', justifyContent: 'flex-end' }}
    >
      <aside
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(430px, 100%)', height: '100%', overflowY: 'auto', background: 'var(--surface)', borderLeft: '1px solid var(--hairline)', boxShadow: 'var(--shadow-3)', padding: '1.4rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <ShieldCheck size={16} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Access Control</h3>
          </div>
          <button onClick={onClose} title="Close" style={{ background: 'transparent', border: 'none', color: 'var(--ink-3)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <Label>Current role</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1.4rem' }}>
          {roles.map((r) => {
            const active = r.id === roleId;
            return (
              <button
                key={r.id}
                onClick={() => onRoleChange(r.id)}
                style={{
                  textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px',
                  padding: '.6rem .8rem',
                  background: active ? 'var(--accent-weak)' : 'var(--surface-2)',
                  border: `1px solid ${active ? 'var(--accent-line)' : 'var(--hairline)'}`,
                  color: active ? 'var(--accent)' : 'var(--ink-2)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '.85rem' }}>{r.title}</span>
                <span style={{ fontSize: '.72rem', color: 'var(--ink-3)', fontWeight: 400 }}>{r.remit}</span>
              </button>
            );
          })}
        </div>

        <Label>Data scope</Label>
        <div style={{ marginBottom: '1.4rem' }}>
          <Allowed text={role.scope.label} />
          {role.domains.map((d) => <Allowed key={d} text={DOMAIN_LABELS[d]} />)}
          {role.capabilities
            .filter((c) => c.startsWith('cross_') || c === 'enterprise_analysis')
            .map((c) => <Allowed key={c} text={CAPABILITY_LABELS[c]} />)}
        </div>

        {role.restrictions.length > 0 && (
          <>
            <Label>Restricted</Label>
            <div style={{ marginBottom: '1.4rem' }}>
              {role.restrictions.map((r) => <Denied key={r} text={r} />)}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '9px', padding: '.75rem .85rem', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
          <Info size={14} color="var(--ink-3)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '.74rem', color: 'var(--ink-3)', lineHeight: 1.55 }}>
            Role-based access is simulated in this preview to show how permissions will
            behave. Enforcement will move to the authorization service and the database
            before production use.
          </p>
        </div>
      </aside>
    </div>
  );
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.66rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: '.55rem' }}>
    {children}
  </div>
);

const Allowed = ({ text }: { text: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '.3rem 0', fontSize: '.83rem', color: 'var(--ink-2)' }}>
    <Check size={13} color="var(--success)" style={{ flexShrink: 0 }} /> {text}
  </div>
);

const Denied = ({ text }: { text: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '.3rem 0', fontSize: '.83rem', color: 'var(--ink-3)' }}>
    <Ban size={13} color="var(--danger)" style={{ flexShrink: 0 }} /> {text}
  </div>
);

export default AccessControlPanel;
