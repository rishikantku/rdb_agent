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
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: 'Inter, sans-serif',
      themeVariables: {
        primaryColor: 'var(--accent-weak)',
        primaryTextColor: 'var(--ink)',
        primaryBorderColor: 'var(--accent)',
        lineColor: 'var(--ink-4)',
        secondaryColor: 'var(--surface-2)',
        tertiaryColor: 'var(--surface-3)',
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
        if (containerRef.current) {
          containerRef.current.innerText = 'Diagram could not be rendered.';
        }
      }
    }
  }, [chart]);

  if (!chart) return null;

  return (
    <div style={{ padding: '8px 0' }}>
      <div ref={containerRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflowX: 'auto' }} />
      <style>{`
        .mermaid svg { height: auto !important; max-width: 100%; }
        .mermaid .node rect, .mermaid .node circle, .mermaid .node ellipse, .mermaid .node polygon {
          fill: var(--accent-weak) !important;
          stroke: var(--accent-line) !important;
          stroke-width: 1px !important;
        }
        .mermaid .edgeLabel {
          background-color: var(--surface) !important;
          color: var(--ink-3) !important;
          font-size: 0.75rem !important;
        }
        .mermaid .messageText { fill: var(--ink) !important; }
      `}</style>
    </div>
  );
};

export default QueryFlow;
