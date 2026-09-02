import { useState, useEffect } from 'react';
import { Table as TableIcon, Eye, List, ChevronRight, ChevronDown } from 'lucide-react';
import { DataTable, EmptyState } from './ui';

interface SchemaExplorerProps {
  cachedSchema: { tables: any[]; views: any[] } | null;
}

const SchemaExplorer = ({ cachedSchema }: SchemaExplorerProps) => {
  const [schema, setSchema] = useState<any>(cachedSchema);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(['tables']);

  // Sync with cached schema from App
  useEffect(() => {
    if (cachedSchema) setSchema(cachedSchema);
  }, [cachedSchema]);

  const handleTableClick = async (tableName: string) => {
    setSelectedTable(tableName);
    setLoading(true);
    const res = await window.electronAPI.aiDbPreview(tableName, 50);
    if (res.success) setPreviewData(res.data!);
    setLoading(false);
  };

  const toggleExpand = (key: string) => {
    setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  if (!schema) return (
    <div className="wrap fade">
      <div className="skeleton" style={{ height: 400, borderRadius: 'var(--r-lg)' }} />
    </div>
  );

  return (
    <div className="fade" style={{ display: 'flex', gap: 20, height: 'calc(100vh - var(--topbar-h) - 48px)', padding: '24px 32px' }}>
      {/* Sidebar Explorer */}
      <div className="card" style={{ width: 280, flexShrink: 0, padding: 16, overflowY: 'auto' }}>
        <h3 style={{ fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TableIcon size={16} color="var(--accent)" /> Database Objects
        </h3>

        <div style={{ paddingLeft: 4 }}>
          {/* Tables */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => toggleExpand('tables')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: '4px 0' }}
            >
              {expanded.includes('tables') ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              Tables ({schema.tables.length})
            </button>
            {expanded.includes('tables') && (
              <div style={{ paddingLeft: 8, marginTop: 4 }}>
                {schema.tables.map((t: any) => (
                  <button
                    key={t.name}
                    className={`navitem ${selectedTable === t.name ? 'active' : ''}`}
                    onClick={() => handleTableClick(t.name)}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  >
                    <TableIcon size={13} /> {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Views */}
          <div>
            <button
              onClick={() => toggleExpand('views')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', padding: '4px 0' }}
            >
              {expanded.includes('views') ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              Views ({schema.views.length})
            </button>
            {expanded.includes('views') && (
              <div style={{ paddingLeft: 8, marginTop: 4 }}>
                {schema.views.map((v: any) => (
                  <button
                    key={v.name}
                    className={`navitem ${selectedTable === v.name ? 'active' : ''}`}
                    onClick={() => handleTableClick(v.name)}
                    style={{ padding: '6px 10px', fontSize: 13 }}
                  >
                    <Eye size={13} /> {v.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selectedTable ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18 }}>{selectedTable}</h2>
              <span className="meta">Up to 50 rows</span>
            </div>

            {loading ? (
              <div className="card" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div className="spinner" />
              </div>
            ) : previewData.length > 0 ? (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <DataTable rows={previewData} pageSize={20} />
              </div>
            ) : (
              <div className="card" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--ink-3)' }}>
                This table has no rows.
              </div>
            )}
          </>
        ) : (
          <EmptyState
            icon={<List size={48} />}
            title="Select a table"
            body="Choose a table or view from the explorer to preview its schema and data."
          />
        )}
      </div>
    </div>
  );
};

export default SchemaExplorer;
