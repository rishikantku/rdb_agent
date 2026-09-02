import React from 'react';
import { ShieldCheck, Check, Ban, Info } from 'lucide-react';
import { permissionService, CAPABILITY_LABELS, DOMAIN_LABELS } from '../lib/permissions';
import type { RoleId } from '../lib/permissions';

interface PermissionsViewProps {
  roleId: RoleId;
  onRoleChange: (id: RoleId) => void;
}

const PermissionsView: React.FC<PermissionsViewProps> = ({ roleId, onRoleChange }) => {
  const roles = permissionService.listRoles();
  const role = permissionService.getRole(roleId);

  return (
    <div className="wrap wrap-narrow fade">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Access & Permissions</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>
          Current role configuration and data access scope
        </p>
      </div>

      {/* Current Role */}
      <div className="card card-p" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--r-lg)', background: 'var(--accent-weak)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ShieldCheck size={24} color="var(--accent)" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: 20 }}>{role.title}</h2>
            <span className={`badge ${role.restrictions.length === 0 ? 'badge-ok' : 'badge-warn'}`}>
              {role.restrictions.length === 0 ? 'Full Access' : 'Restricted'}
            </span>
          </div>
          <p style={{ color: 'var(--ink-3)', fontSize: 14, margin: 0 }}>{role.remit}</p>

          {/* Role selector */}
          <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {roles.map((r) => (
              <button
                key={r.id}
                className={`btn btn-sm ${r.id === roleId ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => onRoleChange(r.id)}
              >
                {r.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Organizational Scope */}
      <div className="card card-p">
        <h3 style={{ fontSize: 14, marginBottom: 14 }}>Organizational Scope</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
          <Check size={16} color="var(--ok)" />
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{role.scope.label}</span>
        </div>
      </div>

      {/* Data Domains */}
      <div className="card card-p">
        <h3 style={{ fontSize: 14, marginBottom: 14 }}>Data Domains</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(Object.keys(DOMAIN_LABELS) as Array<keyof typeof DOMAIN_LABELS>).map((domain) => {
            const allowed = role.domains.includes(domain);
            return (
              <div key={domain} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{DOMAIN_LABELS[domain]}</span>
                {allowed ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ok)', fontWeight: 500 }}>
                    <Check size={14} /> Allowed
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--danger)', fontWeight: 500 }}>
                    <Ban size={14} /> Restricted
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Capabilities */}
      <div className="card card-p">
        <h3 style={{ fontSize: 14, marginBottom: 14 }}>Query Capabilities</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(Object.keys(CAPABILITY_LABELS) as Array<keyof typeof CAPABILITY_LABELS>).map((cap) => {
            const allowed = role.capabilities.includes(cap);
            return (
              <div key={cap} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{CAPABILITY_LABELS[cap]}</span>
                {allowed ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ok)', fontWeight: 500 }}>
                    <Check size={14} /> Granted
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--ink-4)', fontWeight: 500 }}>
                    <Ban size={14} /> Not Granted
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Restrictions */}
      {role.restrictions.length > 0 && (
        <div className="card card-p" style={{ borderLeft: '3px solid var(--warn)' }}>
          <h3 style={{ fontSize: 14, marginBottom: 14, color: 'var(--warn)' }}>Restrictions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {role.restrictions.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink-2)' }}>
                <Ban size={13} color="var(--warn)" style={{ flexShrink: 0 }} />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo disclaimer */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 18px', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}>
        <Info size={14} color="var(--ink-4)" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>
          Demo authorization — role-based access is simulated for this demonstration.
          Production authorization will be enforced by the backend IAM layer.
        </p>
      </div>
    </div>
  );
};

export default PermissionsView;
