import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface QueryFlowProps {
  chart: string;
}

const QueryFlow: React.FC<QueryFlowProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'Inter, sans-serif',
      themeVariables: {
        primaryColor: 'var(--accent)',
        primaryTextColor: 'var(--ink)',
        primaryBorderColor: 'var(--accent)',
        lineColor: 'var(--ink-3)',
        secondaryColor: '#112240',
        tertiaryColor: 'var(--surface-2)',
      }
    });
  }, []);

  useEffect(() => {
    if (containerRef.current && chart) {
      containerRef.current.innerHTML = '';
      const id = `mermaid-${Math.floor(Math.random() * 10000)}`;
      try {
        mermaid.render(id, chart).then(({ svg }) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        });
      } catch (err) {
        console.error('[Mermaid] Render failed', err);
        containerRef.current.innerText = 'Diagram architecture is being refined... (Metadata format mismatch)';
      }
    }
  }, [chart]);

  if (!chart) return null;

  return (
    <div className="glass fade-in" style={{ padding: '1.5rem', marginTop: '1.5rem', background: 'rgba(2, 12, 27, 0.6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, color: 'var(--accent)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Visual Implementation Strategy
        </h4>
        <span style={{ fontSize: '0.7rem', color: 'var(--ink-3)' }}>Interactive Data Flow</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflowX: 'auto' }} />
      <style>{`
        .mermaid svg {
          height: auto !important;
          max-width: 100%;
        }
        .mermaid .node rect, .mermaid .node circle, .mermaid .node ellipse, .mermaid .node polygon {
          fill: rgba(100, 255, 218, 0.05) !important;
          stroke: var(--accent) !important;
          stroke-width: 1px !important;
        }
        .mermaid .edgeLabel {
          background-color: transparent !important;
          color: var(--ink-3) !important;
          font-size: 0.75rem !important;
        }
        .mermaid .messageText {
          fill: var(--ink) !important;
        }
      `}</style>
    </div>
  );
};

export default QueryFlow;
