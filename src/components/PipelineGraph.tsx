import { useMemo, useState, useRef } from 'react';
import type { PipelineWithRisk } from '@/hooks/useDashboardData';

interface NodePosition {
  x: number;
  y: number;
  pipeline: PipelineWithRisk;
}

interface Edge {
  from: NodePosition;
  to: NodePosition;
}

const CATEGORY_CLUSTERS: Record<string, { cx: number; cy: number; label: string }> = {
  ETL: { cx: 250, cy: 200, label: 'ETL' },
  Sync: { cx: 650, cy: 200, label: 'Sync' },
  ML: { cx: 250, cy: 480, label: 'ML' },
  Reporting: { cx: 650, cy: 480, label: 'Reporting' },
};

const HEALTH_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  healthy: { fill: '#10b981', stroke: '#34d399', glow: 'rgba(16,185,129,0.4)' },
  warning: { fill: '#f59e0b', stroke: '#fbbf24', glow: 'rgba(245,158,11,0.4)' },
  critical: { fill: '#ef4444', stroke: '#f87171', glow: 'rgba(239,68,68,0.5)' },
};

const VIEW_W = 900;
const VIEW_H = 680;

function layoutNodes(pipelines: PipelineWithRisk[]): NodePosition[] {
  const byCategory = new Map<string, PipelineWithRisk[]>();
  for (const p of pipelines) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, []);
    byCategory.get(p.category)!.push(p);
  }

  const nodes: NodePosition[] = [];
  for (const [cat, items] of byCategory) {
    const cluster = CATEGORY_CLUSTERS[cat] || { cx: 450, cy: 340, label: cat };
    const count = items.length;
    const radius = 70 + count * 12;
    items.forEach((p, i) => {
      const angle = (i / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
      const jitter = (p.id.charCodeAt(0) % 7) - 3;
      nodes.push({
        x: cluster.cx + Math.cos(angle) * radius + jitter,
        y: cluster.cy + Math.sin(angle) * radius + jitter,
        pipeline: p,
      });
    });
  }
  return nodes;
}

function buildEdges(nodes: NodePosition[]): Edge[] {
  const edges: Edge[] = [];
  const byCat = new Map<string, NodePosition[]>();
  for (const n of nodes) {
    if (!byCat.has(n.pipeline.category)) byCat.set(n.pipeline.category, []);
    byCat.get(n.pipeline.category)!.push(n);
  }

  // Connect ETL -> Reporting (ETL feeds reporting)
  const etl = byCat.get('ETL') || [];
  const reporting = byCat.get('Reporting') || [];
  for (const e of etl) {
    for (const r of reporting) {
      if (Math.random() < 0.4 || (etl.length <= 2 && reporting.length <= 2)) {
        edges.push({ from: e, to: r });
      }
    }
  }

  // Connect Sync -> ETL (sync feeds ETL)
  const sync = byCat.get('Sync') || [];
  for (const s of sync) {
    for (const e of etl) {
      if (Math.random() < 0.35 || (sync.length <= 2 && etl.length <= 2)) {
        edges.push({ from: s, to: e });
      }
    }
  }

  // Connect ML -> Reporting (ML feeds reporting)
  const ml = byCat.get('ML') || [];
  for (const m of ml) {
    for (const r of reporting) {
      if (Math.random() < 0.3) {
        edges.push({ from: m, to: r });
      }
    }
  }

  return edges;
}

function nodeRadius(p: PipelineWithRisk): number {
  const base = 18;
  const extra = Math.min(12, p.runCount / 30);
  return base + extra;
}

interface Props {
  pipelines: PipelineWithRisk[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function PipelineGraph({ pipelines, selectedId, onSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const nodes = useMemo(() => layoutNodes(pipelines), [pipelines]);
  const edges = useMemo(() => buildEdges(nodes), [nodes]);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.pipeline.id, n])), [nodes]);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-full"
        style={{ minHeight: 400 }}
      >
        <defs>
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="pulseGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="url(#bgGrad)" rx="12" />

        {/* Category cluster backgrounds */}
        {Object.entries(CATEGORY_CLUSTERS).map(([cat, c]) => {
          const count = pipelines.filter((p) => p.category === cat).length;
          if (count === 0) return null;
          const r = 70 + count * 12 + 30;
          return (
            <g key={cat}>
              <circle
                cx={c.cx}
                cy={c.cy}
                r={r}
                fill="none"
                stroke="#334155"
                strokeWidth={1}
                strokeDasharray="4 6"
                opacity={0.5}
              />
              <text
                x={c.cx}
                y={c.cy - r - 8}
                textAnchor="middle"
                fill="#64748b"
                fontSize={13}
                fontWeight={600}
                className="select-none"
              >
                {c.label}
              </text>
            </g>
          );
        })}

        {/* Edges */}
        {edges.map((edge, i) => {
          const isHighlighted =
            hoveredId === edge.from.pipeline.id ||
            hoveredId === edge.to.pipeline.id ||
            selectedId === edge.from.pipeline.id ||
            selectedId === edge.to.pipeline.id;
          return (
            <line
              key={i}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke={isHighlighted ? '#475569' : '#1e293b'}
              strokeWidth={isHighlighted ? 1.5 : 1}
              strokeDasharray="3 4"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const p = node.pipeline;
          const colors = HEALTH_COLORS[p.risk.band] || HEALTH_COLORS.healthy;
          const isSelected = selectedId === p.id;
          const isHovered = hoveredId === p.id;
          const r = nodeRadius(p);
          const hasIncident = p.hasActiveIncident;

          return (
            <g
              key={p.id}
              transform={`translate(${node.x}, ${node.y})`}
              className="cursor-pointer"
              onClick={() => onSelect(isSelected ? null : p.id)}
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ transition: 'transform 0.2s' }}
            >
              {/* Pulse ring for incidents */}
              {hasIncident && (
                <circle
                  r={r + 6}
                  fill="none"
                  stroke={colors.stroke}
                  strokeWidth={2}
                  opacity={0.6}
                  style={{
                    animation: 'pipewatch-pulse 2s ease-in-out infinite',
                  }}
                />
              )}

              {/* Selection ring */}
              {isSelected && (
                <circle
                  r={r + 5}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  opacity={0.8}
                />
              )}

              {/* Glow */}
              <circle
                r={r}
                fill={colors.glow}
                filter={hasIncident ? 'url(#pulseGlow)' : 'url(#nodeGlow)'}
                opacity={isHovered ? 0.8 : 0.5}
              />

              {/* Main node */}
              <circle
                r={r}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={isSelected ? 2.5 : 1.5}
                opacity={0.9}
              />

              {/* Inner highlight */}
              <circle r={r * 0.6} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

              {/* Label */}
              <text
                y={r + 16}
                textAnchor="middle"
                fill={isHovered || isSelected ? '#e2e8f0' : '#94a3b8'}
                fontSize={11}
                fontWeight={isHovered || isSelected ? 600 : 500}
                className="select-none"
              >
                {p.name.length > 18 ? p.name.slice(0, 17) + '\u2026' : p.name}
              </text>

              {/* Risk score badge */}
              <text
                y={4}
                textAnchor="middle"
                fill="white"
                fontSize={12}
                fontWeight={700}
                className="select-none pointer-events-none"
              >
                {p.risk.score}
              </text>
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hoveredId && nodeMap.has(hoveredId) && (
          <foreignObject
            x={Math.min(nodeMap.get(hoveredId)!.x + 20, VIEW_W - 280)}
            y={Math.max(nodeMap.get(hoveredId)!.y - 50, 10)}
            width={260}
            height={90}
            style={{ pointerEvents: 'none' }}
          >
            <div className="bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-xl backdrop-blur-sm">
              <div className="text-slate-100 font-semibold text-sm">
                {nodeMap.get(hoveredId)!.pipeline.name}
              </div>
              <div className="text-slate-400 text-xs mt-1 leading-relaxed">
                {nodeMap.get(hoveredId)!.pipeline.risk.explanation}
              </div>
            </div>
          </foreignObject>
        )}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700/50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-xs text-slate-400">Healthy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-xs text-slate-400">Warning</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-slate-400">Critical</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-700">
          <div className="w-3 h-3 rounded-full border-2 border-cyan-400" />
          <span className="text-xs text-slate-400">Selected</span>
        </div>
      </div>
    </div>
  );
}
