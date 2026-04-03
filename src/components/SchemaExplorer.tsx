import { useState, useEffect } from 'react';
import { Table as TableIcon, Eye, List, ChevronRight, ChevronDown } from 'lucide-react';

const SchemaExplorer = () => {
  const [schema, setSchema] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(['tables']);

  useEffect(() => {
    fetchSchema();
  }, []);

  const fetchSchema = async () => {
    const res = await window.electronAPI.dbGetSchema();
    if (res.success) setSchema(res.data);
  };

  const handleTableClick = async (tableName: string) => {
    setSelectedTable(tableName);
    setLoading(true);
    const res = await window.electronAPI.dbQuery(`SELECT * FROM ${tableName} LIMIT 50`);
    if (res.success) setPreviewData(res.data!);
    setLoading(false);
  };

  const toggleExpand = (key: string) => {
    setExpanded(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  if (!schema) return <div>Loading schema...</div>;

  return (
    <div className="fade-in" style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      {/* Sidebar Explorer */}
      <div className="glass" style={{ width: '300px', flexShrink: 0, padding: '1rem', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TableIcon size={18} color="#64ffda" /> Database Objects
        </h3>

        <div style={{ paddingLeft: '0.5rem' }}>
          {/* Tables Section */}
          <div style={{ marginBottom: '1rem' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '5px', color: '#64ffda', fontWeight: 600 }}
              onClick={() => toggleExpand('tables')}
            >
              {expanded.includes('tables') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Tables ({schema.tables.length})
            </div>
            {expanded.includes('tables') && (
              <div style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                {schema.tables.map((t: any) => (
                  <div 
                    key={t.name}
                    className={`nav-item ${selectedTable === t.name ? 'active' : ''}`}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                    onClick={() => handleTableClick(t.name)}
                  >
                    <TableIcon size={14} /> {t.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Views Section */}
          <div>
            <div 
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '5px', color: '#fbbf24', fontWeight: 600 }}
              onClick={() => toggleExpand('views')}
            >
              {expanded.includes('views') ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Views ({schema.views.length})
            </div>
            {expanded.includes('views') && (
              <div style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                {schema.views.map((v: any) => (
                  <div 
                    key={v.name}
                    className={`nav-item ${selectedTable === v.name ? 'active' : ''}`}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                    onClick={() => handleTableClick(v.name)}
                  >
                    <Eye size={14} /> {v.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Preview Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedTable ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>{selectedTable} Preview</h2>
              <div style={{ fontSize: '0.8rem', color: '#8892b0' }}>Showing up to 50 rows</div>
            </div>

            {loading ? (
              <div className="glass" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                Loading preview data...
              </div>
            ) : (
              <div className="glass table-container" style={{ flex: 1 }}>
                <table>
                  <thead>
                    <tr>
                      {previewData.length > 0 && Object.keys(previewData[0]).map(key => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val: any, j) => (
                          <td key={j}>{val === null ? 'NULL' : String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#8892b0' }}>
            <List size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>Select a table or view from the explorer to preview schema and data.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchemaExplorer;
