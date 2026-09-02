import { X, ShieldCheck, Check, Ban, Info, ArrowRightLeft } from 'lucide-react';
import { CAPABILITY_LABELS, DOMAIN_LABELS, permissionService } from '../lib/permissions';
import type { RoleId } from '../lib/permissions';
import { showToast } from './ui';

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

  const handleRoleChange = (id: RoleId) => {
    const prev = permissionService.getRole(roleId);
    const next = permissionService.getRole(id);
    onRoleChange(id);
    showToast(
      `Role changed: ${prev.title} → ${next.title} · Scope: ${next.scope.label}`,
      <ArrowRightLeft size={15} color="var(--accent)" />
    );
  };

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="slide-panel" onClick={(e) => e.stopPropagation()}>
        <div className="slide-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} color="var(--accent)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Access Control</h3>
          </div>
          <button className="btn btn-quiet btn-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="slide-panel-body">
          {/* Role selector */}
          <div className="label" style={{ marginBottom: 10 }}>Current Role</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
            {roles.map((r) => {
              const active = r.id === roleId;
              return (
                <button
                  key={r.id}
                  onClick={() => handleRoleChange(r.id)}
                  style={{
                    textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3,
                    padding: '12px 16px', borderRadius: 'var(--r-md)',
                    background: active ? 'var(--accent-weak)' : 'var(--surface-2)',
                    border: `1.5px solid ${active ? 'var(--accent-line)' : 'var(--hairline)'}`,
                    color: active ? 'var(--accent)' : 'var(--ink-2)',
                    transition: 'all .14s',
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: active ? 'var(--accent)' : 'var(--ink-3)', fontWeight: 400, opacity: 0.85 }}>{r.remit}</span>
                </button>
              );
            })}
          </div>

          {/* Data scope */}
          <div className="label" style={{ marginBottom: 10 }}>Authorized Scope</div>
          <div style={{ marginBottom: 24 }}>
            <Row icon={<Check size={14} color="var(--ok)" />} text={role.scope.label} />
            {role.domains.map((d) => (
              <Row key={d} icon={<Check size={14} color="var(--ok)" />} text={DOMAIN_LABELS[d]} />
            ))}
            {role.capabilities
              .filter((c) => c.startsWith('cross_') || c === 'enterprise_analysis')
              .map((c) => (
                <Row key={c} icon={<Check size={14} color="var(--ok)" />} text={CAPABILITY_LABELS[c]} />
              ))}
          </div>

          {/* Restricted */}
          {role.restrictions.length > 0 && (
            <>
              <div className="label" style={{ marginBottom: 10 }}>Restricted</div>
              <div style={{ marginBottom: 24 }}>
                {role.restrictions.map((r) => (
                  <Row key={r} icon={<Ban size={14} color="var(--danger)" />} text={r} />
                ))}
              </div>
            </>
          )}

          {/* Demo notice */}
          <div style={{ display: 'flex', gap: 10, padding: '14px 16px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
            <Info size={14} color="var(--ink-4)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
              Role-based access is simulated in this preview. Enforcement will move
              to the authorization service before production use.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
};

const Row = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 13.5, color: 'var(--ink-2)' }}>
    <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
    <span>{text}</span>
  </div>
);

export default AccessControlPanel;
