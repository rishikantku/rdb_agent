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
        primaryColor: '#64ffda',
        primaryTextColor: '#e6f1ff',
        primaryBorderColor: '#64ffda',
        lineColor: '#8892b0',
        secondaryColor: '#112240',
        tertiaryColor: '#0a192f',
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
        <h4 style={{ margin: 0, color: '#64ffda', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Visual Implementation Strategy
        </h4>
        <span style={{ fontSize: '0.7rem', color: '#8892b0' }}>Interactive Data Flow</span>
      </div>
      <div ref={containerRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflowX: 'auto' }} />
      <style>{`
        .mermaid svg {
          height: auto !important;
          max-width: 100%;
        }
        .mermaid .node rect, .mermaid .node circle, .mermaid .node ellipse, .mermaid .node polygon {
          fill: rgba(100, 255, 218, 0.05) !important;
          stroke: #64ffda !important;
          stroke-width: 1px !important;
        }
        .mermaid .edgeLabel {
          background-color: transparent !important;
          color: #8892b0 !important;
          font-size: 0.75rem !important;
        }
        .mermaid .messageText {
          fill: #e6f1ff !important;
        }
      `}</style>
    </div>
  );
};

export default QueryFlow;
