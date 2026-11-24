import React, { useEffect, useMemo, useState } from 'react';
import {
  ALL_HOLES,
  BB_COLS,
  BB_LAYOUT,
  BB_VIEWBOX,
  BOT_ROWS,
  HOLE_MAP,
  TOP_ROWS,
  getHoleHighlightSets,
} from '../../engine/breadboardNetlist';
import type {
  CircuitComponent,
  ComponentType,
  HoleId,
  ProbeId,
  ProbeMap,
  SimulationResult,
  WireColor,
} from '../../engine/types';
import { EXP2_NODE_MARKERS } from '../../experiments/exp2Kirchhoff';
import {
  WIRE_COLOR_HEX,
  formatCapacitance,
  formatResistance,
  getCapacitorCode,
  getResistorBands,
} from './componentVisuals';
import {
  ArrowLeftRight,
  Cable,
  Cpu,
  MousePointer2,
  RotateCcw,
  Trash2,
  Zap,
} from 'lucide-react';

export type BoardTool = 'select' | ComponentType | `probe:${ProbeId}`;

interface BreadboardProps {
  components: CircuitComponent[];
  probes: ProbeMap;
  simulation: SimulationResult;
  detectedNodes?: { gnd: number; a?: number; b?: number; c?: number; d?: number };
  onAddComponent: (comp: Omit<CircuitComponent, 'id'>) => void;
  onUpdateComponent: (id: string, patch: Partial<CircuitComponent>) => void;
  onDeleteComponent: (id: string) => void;
  onMoveProbe: (probeId: ProbeId, hole: HoleId) => void;
  onQuickProbeCh2: (node: 'b' | 'c' | 'd') => void;
}

const PROBE_META: Record<
  ProbeId,
  { label: string; short: string; color: string; stroke: string; textColor: string }
> = {
  fgPos: { label: 'FG (+)', short: 'FG+', color: '#ef4444', stroke: '#fecaca', textColor: '#fff' },
  fgGnd: { label: 'FG GND', short: 'FG−', color: '#1e293b', stroke: '#94a3b8', textColor: '#e2e8f0' },
  ch1Pos: { label: 'CH1 (+)', short: 'CH1', color: '#facc15', stroke: '#fef08a', textColor: '#0f172a' },
  ch1Gnd: { label: 'CH1 GND', short: 'C1−', color: '#334155', stroke: '#facc15', textColor: '#fef08a' },
  ch2Pos: { label: 'CH2 (+)', short: 'CH2', color: '#22d3ee', stroke: '#a5f3fc', textColor: '#0f172a' },
  ch2Gnd: { label: 'CH2 GND', short: 'C2−', color: '#334155', stroke: '#22d3ee', textColor: '#a5f3fc' },
};

const WIRE_COLORS: WireColor[] = [
  'black',
  'red',
  'yellow',
  'blue',
  'green',
  'orange',
  'purple',
  'cyan',
];

function nextLabel(type: ComponentType, existing: CircuitComponent[]): string {
  const prefix =
    type === 'resistor' ? 'R' : type === 'capacitor' ? 'C' : type === 'diode' ? 'D' : 'W';
  let idx = 1;
  while (existing.some((c) => c.label.startsWith(`${prefix}${idx}`))) {
    idx++;
  }
  return type === 'diode' ? `D${idx} (1N4007)` : `${prefix}${idx}`;
}

export const Breadboard: React.FC<BreadboardProps> = ({
  components,
  probes,
  simulation,
  detectedNodes,
  onAddComponent,
  onUpdateComponent,
  onDeleteComponent,
  onMoveProbe,
  onQuickProbeCh2,
}) => {
  const [tool, setTool] = useState<BoardTool>('select');
  const [wireColor, setWireColor] = useState<WireColor>('black');
  const [pendingPin1, setPendingPin1] = useState<HoleId | null>(null);
  const [hoveredHole, setHoveredHole] = useState<HoleId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedComp = useMemo(
    () => components.find((c) => c.id === selectedId) ?? null,
    [components, selectedId]
  );

  // Escape cancels placement; Delete/Backspace deletes selected component
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === 'Escape') {
        setPendingPin1(null);
        setTool('select');
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onDeleteComponent(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, onDeleteComponent]);

  const highlightSets = useMemo(() => {
    if (!hoveredHole) {
      return { stripHoles: new Set<HoleId>(), wireConnectedHoles: new Set<HoleId>() };
    }
    return getHoleHighlightSets(hoveredHole, components);
  }, [hoveredHole, components]);

  const handleHoleClick = (holeId: HoleId) => {
    if (tool.startsWith('probe:')) {
      const probeId = tool.slice(6) as ProbeId;
      onMoveProbe(probeId, holeId);
      setTool('select');
      return;
    }

    if (tool === 'select') {
      // If clicking a hole with a component pin, select that component
      const hit = components.find((c) => c.pin1 === holeId || c.pin2 === holeId);
      setSelectedId(hit ? hit.id : null);
      return;
    }

    // Placing a 2-pin component or wire
    if (!pendingPin1) {
      setPendingPin1(holeId);
      return;
    }

    if (pendingPin1 === holeId) {
      setPendingPin1(null);
      return;
    }

    const compType = tool as ComponentType;
    const defaultValue =
      compType === 'resistor' ? 1000 : compType === 'capacitor' ? 0.1e-6 : 0;

    onAddComponent({
      type: compType,
      label: nextLabel(compType, components),
      pin1: pendingPin1,
      pin2: holeId,
      value: defaultValue,
      color: compType === 'wire' ? wireColor : undefined,
      model: compType === 'diode' ? '1N4007' : undefined,
    });
    setPendingPin1(null);
  };

  // Detect which Exp 2 node CH2 is currently probing
  const activeCh2Node = useMemo<'b' | 'c' | 'd' | null>(() => {
    if (!probes.ch2Pos || !detectedNodes) return null;
    const net = simulation.holeToNet[probes.ch2Pos];
    if (net === undefined || net < 0) return null;
    if (detectedNodes.b !== undefined && net === detectedNodes.b) return 'b';
    if (detectedNodes.c !== undefined && net === detectedNodes.c) return 'c';
    if (detectedNodes.d !== undefined && net === detectedNodes.d) return 'd';
    return null;
  }, [probes.ch2Pos, detectedNodes, simulation.holeToNet]);

  // Hovered hole info for live Tinkercad status strip
  const hoveredInfo = useMemo(() => {
    if (!hoveredHole) return null;
    const meta = HOLE_MAP[hoveredHole];
    if (!meta) return null;
    const net = simulation.holeToNet[hoveredHole];
    let nodeTag = '';
    if (detectedNodes && net !== undefined && net >= 0) {
      if (net === detectedNodes.gnd) nodeTag = 'GND Bus';
      else if (net === detectedNodes.a) nodeTag = 'Node a (va)';
      else if (net === detectedNodes.b) nodeTag = 'Node b';
      else if (net === detectedNodes.c) nodeTag = 'Node c (KCL)';
      else if (net === detectedNodes.d) nodeTag = 'Node d';
    }
    const wave = net !== undefined && net >= 0 ? simulation.nodeVoltages[net] : undefined;
    let vRange = '';
    if (wave && wave.length > 0) {
      let mn = Infinity;
      let mx = -Infinity;
      for (let i = 0; i < wave.length; i++) {
        if (wave[i] < mn) mn = wave[i];
        if (wave[i] > mx) mx = wave[i];
      }
      vRange = `${mn.toFixed(2)}V → ${mx.toFixed(2)}V`;
    }
    return {
      hole: hoveredHole,
      strip: meta.stripKey,
      net: net !== undefined && net >= 0 ? `Net ${net}` : 'Unwired',
      nodeTag,
      vRange,
    };
  }, [hoveredHole, simulation, detectedNodes]);

  const renderComponentSvg = (comp: CircuitComponent, isGhost = false) => {
    const p1 = HOLE_MAP[comp.pin1];
    const p2 = HOLE_MAP[comp.pin2];
    if (!p1 || !p2) return null;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const isSelected = !isGhost && selectedId === comp.id;

    const commonProps = isGhost
      ? { opacity: 0.65, pointerEvents: 'none' as const }
      : {
          className: `bb-comp ${isSelected ? 'bb-comp-selected' : ''}`,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            if (tool === 'select') {
              setSelectedId(comp.id);
            }
          },
        };

    if (comp.type === 'wire') {
      const hex = WIRE_COLOR_HEX[comp.color ?? 'black'] ?? '#1e293b';
      // Slight perpendicular bow for organic jumper wire look
      const bow = Math.min(26, Math.max(10, len * 0.14));
      const nx = len > 0 ? -dy / len : 0;
      const ny = len > 0 ? dx / len : -1;
      const cx = midX + nx * bow * 0.5;
      const cy = midY + ny * bow * 0.5;
      const dPath = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;

      return (
        <g key={comp.id} {...commonProps}>
          {isSelected && (
            <path d={dPath} fill="none" stroke="#38bdf8" strokeWidth={9} strokeLinecap="round" opacity={0.55} />
          )}
          <path d={dPath} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={6} strokeLinecap="round" transform="translate(1,2)" />
          <path d={dPath} fill="none" stroke={hex} strokeWidth={4.6} strokeLinecap="round" />
          <path d={dPath} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.3} strokeLinecap="round" />
          <circle cx={p1.x} cy={p1.y} r={3.6} fill="#cbd5e1" stroke="#334155" strokeWidth={1.1} />
          <circle cx={p2.x} cy={p2.y} r={3.6} fill="#cbd5e1" stroke="#334155" strokeWidth={1.1} />
        </g>
      );
    }

    if (comp.type === 'resistor') {
      const bands = getResistorBands(comp.value);
      const bodyLen = Math.min(46, Math.max(26, len * 0.54));
      const bodyH = 14;
      return (
        <g key={comp.id} {...commonProps}>
          {/* Shadow */}
          <line x1={p1.x} y1={p1.y + 2} x2={p2.x} y2={p2.y + 2} stroke="rgba(0,0,0,0.25)" strokeWidth={4} />
          {/* Metal wire leads */}
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
          <circle cx={p1.x} cy={p1.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
          <circle cx={p2.x} cy={p2.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
          <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
            {isSelected && (
              <rect
                x={-bodyLen / 2 - 4}
                y={-bodyH / 2 - 4}
                width={bodyLen + 8}
                height={bodyH + 8}
                rx={7}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={2.2}
              />
            )}
            {/* 1% Metal-film blue-cyan body */}
            <rect
              x={-bodyLen / 2}
              y={-bodyH / 2}
              width={bodyLen}
              height={bodyH}
              rx={5}
              fill="#60a5fa"
              stroke="#1e40af"
              strokeWidth={1.1}
            />
            {/* Color bands */}
            <rect x={-bodyLen * 0.34} y={-bodyH / 2 + 0.6} width={3.6} height={bodyH - 1.2} fill={bands[0]} />
            <rect x={-bodyLen * 0.14} y={-bodyH / 2 + 0.6} width={3.6} height={bodyH - 1.2} fill={bands[1]} />
            <rect x={bodyLen * 0.06} y={-bodyH / 2 + 0.6} width={3.6} height={bodyH - 1.2} fill={bands[2]} />
            <rect x={bodyLen * 0.27} y={-bodyH / 2 + 0.6} width={3.2} height={bodyH - 1.2} fill={bands[3]} />
            {/* Specular highlight */}
            <rect
              x={-bodyLen / 2 + 2}
              y={-bodyH / 2 + 1.5}
              width={bodyLen - 4}
              height={3}
              rx={1.5}
              fill="rgba(255,255,255,0.32)"
            />
          </g>
          {/* Floating crisp label */}
          {!isGhost && (
            <g transform={`translate(${midX}, ${midY - (Math.abs(dy) > Math.abs(dx) ? 0 : 14)})`}>
              <rect
                x={Math.abs(dy) > Math.abs(dx) ? 12 : -28}
                y={-9}
                width={56}
                height={15}
                rx={4}
                fill="rgba(15,23,42,0.88)"
                stroke={isSelected ? '#38bdf8' : 'rgba(148,163,184,0.35)'}
                strokeWidth={1}
              />
              <text
                x={Math.abs(dy) > Math.abs(dx) ? 40 : 0}
                y={2}
                textAnchor="middle"
                fontSize={9}
                fontWeight={600}
                fontFamily="JetBrains Mono, monospace"
                fill="#f8fafc"
              >
                {comp.label} {formatResistance(comp.value)}
              </text>
            </g>
          )}
        </g>
      );
    }

    if (comp.type === 'diode') {
      const bodyLen = Math.min(44, Math.max(26, len * 0.5));
      const bodyH = 15;
      return (
        <g key={comp.id} {...commonProps}>
          <line x1={p1.x} y1={p1.y + 2} x2={p2.x} y2={p2.y + 2} stroke="rgba(0,0,0,0.3)" strokeWidth={4} />
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
          <circle cx={p1.x} cy={p1.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
          <circle cx={p2.x} cy={p2.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
          <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
            {isSelected && (
              <rect
                x={-bodyLen / 2 - 4}
                y={-bodyH / 2 - 4}
                width={bodyLen + 8}
                height={bodyH + 8}
                rx={6}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={2.2}
              />
            )}
            {/* Black DO-41 epoxy body */}
            <rect
              x={-bodyLen / 2}
              y={-bodyH / 2}
              width={bodyLen}
              height={bodyH}
              rx={3}
              fill="#18181b"
              stroke="#52525b"
              strokeWidth={1.1}
            />
            {/* Silver Cathode Band near pin2 (+x side) */}
            <rect
              x={bodyLen / 2 - 10}
              y={-bodyH / 2 + 0.6}
              width={5.5}
              height={bodyH - 1.2}
              fill="#e2e8f0"
            />
            {/* Subtle arrow showing A -> K direction */}
            <path d="M -9 -3.5 L -2 0 L -9 3.5 Z" fill="#94a3b8" opacity={0.85} />
            <rect
              x={-bodyLen / 2 + 2}
              y={-bodyH / 2 + 1.5}
              width={bodyLen - 4}
              height={2.5}
              rx={1}
              fill="rgba(255,255,255,0.16)"
            />
          </g>
          {!isGhost && (
            <g transform={`translate(${midX}, ${midY - 15})`}>
              <rect
                x={-36}
                y={-9}
                width={72}
                height={15}
                rx={4}
                fill="rgba(15,23,42,0.9)"
                stroke={isSelected ? '#38bdf8' : 'rgba(226,232,240,0.4)'}
                strokeWidth={1}
              />
              <text
                x={0}
                y={2}
                textAnchor="middle"
                fontSize={8.8}
                fontWeight={600}
                fontFamily="JetBrains Mono, monospace"
                fill="#f8fafc"
              >
                1N4007 (A→K)
              </text>
            </g>
          )}
        </g>
      );
    }

    // Capacitor (polyester film box capacitor, 0.1 uF / "104")
    const capW = Math.min(34, Math.max(22, len * 0.36));
    const capH = 18;
    return (
      <g key={comp.id} {...commonProps}>
        <line x1={p1.x} y1={p1.y + 2} x2={p2.x} y2={p2.y + 2} stroke="rgba(0,0,0,0.28)" strokeWidth={4} />
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
        <circle cx={p1.x} cy={p1.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
        <circle cx={p2.x} cy={p2.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
        <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
          {isSelected && (
            <rect
              x={-capW / 2 - 4}
              y={-capH / 2 - 4}
              width={capW + 8}
              height={capH + 8}
              rx={5}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2.2}
            />
          )}
          <rect
            x={-capW / 2}
            y={-capH / 2}
            width={capW}
            height={capH}
            rx={4}
            fill="#d97706"
            stroke="#92400e"
            strokeWidth={1.3}
          />
          <rect
            x={-capW / 2 + 2}
            y={-capH / 2 + 2}
            width={capW - 4}
            height={capH - 4}
            rx={2.5}
            fill="#f59e0b"
          />
          <text
            x={0}
            y={3.5}
            textAnchor="middle"
            fontSize={9.5}
            fontWeight={700}
            fontFamily="JetBrains Mono, monospace"
            fill="#451a03"
          >
            {getCapacitorCode(comp.value)}
          </text>
        </g>
        {!isGhost && (
          <g transform={`translate(${midX}, ${midY - 17})`}>
            <rect
              x={-29}
              y={-9}
              width={58}
              height={15}
              rx={4}
              fill="rgba(15,23,42,0.88)"
              stroke={isSelected ? '#38bdf8' : 'rgba(245,158,11,0.5)'}
              strokeWidth={1}
            />
            <text
              x={0}
              y={2}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fontFamily="JetBrains Mono, monospace"
              fill="#fde68a"
            >
              {comp.label} {formatCapacitance(comp.value)}
            </text>
          </g>
        )}
      </g>
    );
  };

  const ghostComp: CircuitComponent | null = useMemo(() => {
    if (
      !pendingPin1 ||
      !hoveredHole ||
      pendingPin1 === hoveredHole ||
      tool === 'select' ||
      tool.startsWith('probe:')
    ) {
      return null;
    }
    const compType = tool as ComponentType;
    return {
      id: '__ghost__',
      type: compType,
      label: '',
      pin1: pendingPin1,
      pin2: hoveredHole,
      value: compType === 'resistor' ? 1000 : compType === 'capacitor' ? 0.1e-6 : 0,
      color: compType === 'wire' ? wireColor : undefined,
    };
  }, [pendingPin1, hoveredHole, tool, wireColor]);

  return (
    <div className="panel breadboard-panel">
      {/* Component Palette & Probe Quick Bar */}
      <div className="bb-toolbar">
        <div className="bb-tool-group" role="toolbar" aria-label="Breadboard components">
          <button
            className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
            onClick={() => {
              setTool('select');
              setPendingPin1(null);
            }}
            title="Select, inspect, or edit components (Esc)"
          >
            <MousePointer2 size={14} />
            <span>Select</span>
          </button>
          <button
            className={`tool-btn ${tool === 'resistor' ? 'active' : ''}`}
            onClick={() => {
              setTool('resistor');
              setPendingPin1(null);
            }}
            title="Place 1.00 kΩ Resistor (click 2 holes)"
          >
            <span className="tool-chip resistor-chip" />
            <span>Resistor</span>
          </button>
          <button
            className={`tool-btn ${tool === 'diode' ? 'active' : ''}`}
            onClick={() => {
              setTool('diode');
              setPendingPin1(null);
            }}
            title="Place 1N4007 Diode (click Anode hole → Cathode hole)"
          >
            <span className="tool-chip diode-chip" />
            <span>1N4007</span>
          </button>
          <button
            className={`tool-btn ${tool === 'capacitor' ? 'active' : ''}`}
            onClick={() => {
              setTool('capacitor');
              setPendingPin1(null);
            }}
            title="Place 0.1 µF Capacitor (click 2 holes)"
          >
            <span className="tool-chip cap-chip" />
            <span>0.1 µF</span>
          </button>
          <button
            className={`tool-btn ${tool === 'wire' ? 'active' : ''}`}
            onClick={() => {
              setTool('wire');
              setPendingPin1(null);
            }}
            title="Draw Jumper Wire (click 2 holes)"
          >
            <Cable size={14} />
            <span>Wire</span>
          </button>

          {tool === 'wire' && (
            <div className="wire-palette" aria-label="Wire color">
              {WIRE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`wire-dot ${wireColor === c ? 'active' : ''}`}
                  style={{ background: WIRE_COLOR_HEX[c] }}
                  onClick={() => setWireColor(c)}
                  title={`${c} wire`}
                />
              ))}
            </div>
          )}
        </div>

        {/* BNC Probe Placement & Quick CH2 Switching */}
        <div className="bb-probe-group">
          <span className="probe-group-label">CH2 Probe:</span>
          {(['b', 'c', 'd'] as const).map((nodeKey) => (
            <button
              key={nodeKey}
              className={`quick-node-btn ${activeCh2Node === nodeKey ? 'active' : ''}`}
              onClick={() => onQuickProbeCh2(nodeKey)}
              title={`Clip DSO Channel 2 directly to Node ${nodeKey}`}
            >
              Node {nodeKey}
            </button>
          ))}
          <div className="probe-divider" />
          {(['fgPos', 'ch1Pos', 'ch2Pos', 'fgGnd'] as ProbeId[]).map((pid) => {
            const meta = PROBE_META[pid];
            const active = tool === `probe:${pid}`;
            return (
              <button
                key={pid}
                className={`probe-place-btn ${active ? 'active' : ''}`}
                style={{
                  borderColor: active ? meta.color : undefined,
                  boxShadow: active ? `0 0 0 1px ${meta.color}` : undefined,
                }}
                onClick={() => {
                  setTool(active ? 'select' : `probe:${pid}`);
                  setPendingPin1(null);
                }}
                title={`Click any breadboard hole to move ${meta.label} (currently ${probes[pid] ?? 'unconnected'})`}
              >
                <span className="probe-dot" style={{ background: meta.color }} />
                <span>{meta.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Placement Hint Strip */}
      <div className="bb-status-bar">
        <div className="bb-hint">
          {tool.startsWith('probe:') ? (
            <span className="hint-active">
              <Zap size={13} /> Click any breadboard hole to clip{' '}
              <strong>{PROBE_META[tool.slice(6) as ProbeId].label}</strong> (Esc to cancel)
            </span>
          ) : tool !== 'select' ? (
            <span className="hint-active">
              <Cpu size={13} />{' '}
              {pendingPin1
                ? `Pin 1 set at ${pendingPin1.toUpperCase()} — click a second hole to finish ${tool === 'diode' ? 'Cathode (K)' : tool}`
                : tool === 'diode'
                  ? 'Click Anode (A) hole first, then Cathode (K) hole'
                  : `Click Pin 1 hole, then Pin 2 hole to place ${tool}`}
            </span>
          ) : (
            <span>
              Hover any hole to trace internal strips · Click a component to edit/flip/delete · Or
              pick a part above to wire freely
            </span>
          )}
        </div>

        <div className="bb-live-hover">
          {hoveredInfo ? (
            <>
              <span className="mono-badge">{hoveredInfo.hole.toUpperCase()}</span>
              <span className="mono-muted">{hoveredInfo.net}</span>
              {hoveredInfo.nodeTag && <span className="node-pill">{hoveredInfo.nodeTag}</span>}
              {hoveredInfo.vRange && <span className="mono-volt">{hoveredInfo.vRange}</span>}
            </>
          ) : (
            <span className="mono-muted">30-col Breadboard · Exact MNA Live</span>
          )}
        </div>
      </div>

      {/* Main SVG Interactive Breadboard */}
      <div className="bb-canvas-wrap">
        <svg
          className="bb-svg"
          viewBox={`0 0 ${BB_VIEWBOX.width} ${BB_VIEWBOX.height}`}
          onClick={() => {
            if (tool === 'select') setSelectedId(null);
          }}
        >
          {/* Breadboard Plastic Body */}
          <rect
            x={8}
            y={8}
            width={BB_VIEWBOX.width - 16}
            height={BB_VIEWBOX.height - 16}
            rx={12}
            fill="#f4efe4"
            stroke="#c7beab"
            strokeWidth={2.5}
          />
          {/* Subtle inner mold recess */}
          <rect
            x={16}
            y={15}
            width={BB_VIEWBOX.width - 32}
            height={BB_VIEWBOX.height - 30}
            rx={8}
            fill="#f7f3ea"
            stroke="#ded6c5"
            strokeWidth={1.2}
          />

          {/* Top Power Rail Painted Stripes */}
          <line x1={46} y1={19} x2={BB_VIEWBOX.width - 46} y2={19} stroke="#dc2626" strokeWidth={2.2} opacity={0.85} />
          <line x1={46} y1={60} x2={BB_VIEWBOX.width - 46} y2={60} stroke="#2563eb" strokeWidth={2.2} opacity={0.85} />
          <text x={30} y={32} fontSize={13} fontWeight={700} fill="#dc2626" fontFamily="JetBrains Mono, monospace">+</text>
          <text x={30} y={54} fontSize={14} fontWeight={700} fill="#2563eb" fontFamily="JetBrains Mono, monospace">−</text>
          <text x={BB_VIEWBOX.width - 36} y={32} fontSize={13} fontWeight={700} fill="#dc2626" fontFamily="JetBrains Mono, monospace">+</text>
          <text x={BB_VIEWBOX.width - 36} y={54} fontSize={14} fontWeight={700} fill="#2563eb" fontFamily="JetBrains Mono, monospace">−</text>

          {/* Bottom Power Rail Painted Stripes */}
          <line x1={46} y1={331} x2={BB_VIEWBOX.width - 46} y2={331} stroke="#dc2626" strokeWidth={2.2} opacity={0.85} />
          <line x1={46} y1={372} x2={BB_VIEWBOX.width - 46} y2={372} stroke="#2563eb" strokeWidth={2.2} opacity={0.85} />
          <text x={30} y={344} fontSize={13} fontWeight={700} fill="#dc2626" fontFamily="JetBrains Mono, monospace">+</text>
          <text x={30} y={366} fontSize={14} fontWeight={700} fill="#2563eb" fontFamily="JetBrains Mono, monospace">−</text>
          <text x={BB_VIEWBOX.width - 36} y={344} fontSize={13} fontWeight={700} fill="#dc2626" fontFamily="JetBrains Mono, monospace">+</text>
          <text x={BB_VIEWBOX.width - 36} y={366} fontSize={14} fontWeight={700} fill="#2563eb" fontFamily="JetBrains Mono, monospace">−</text>

          {/* Bottom GND Bus Subtle Label */}
          <text
            x={BB_VIEWBOX.width / 2}
            y={383}
            textAnchor="middle"
            fontSize={8.5}
            fontWeight={700}
            letterSpacing="0.12em"
            fill="#475569"
            fontFamily="JetBrains Mono, monospace"
          >
            GND BUS (COMMON REFERENCE NODE 0)
          </text>

          {/* Center IC DIP Trench */}
          <rect
            x={36}
            y={188}
            width={BB_VIEWBOX.width - 72}
            height={14}
            rx={4}
            fill="#e5decb"
            stroke="#cfc6b1"
            strokeWidth={1}
          />

          {/* Column Numbers (1..30, every column subtle, multiples of 5 bold) */}
          {Array.from({ length: BB_COLS }, (_, idx) => {
            const col = idx + 1;
            const x = BB_LAYOUT.padX + idx * BB_LAYOUT.colPitch;
            const major = col === 1 || col % 5 === 0;
            return (
              <g key={`col-${col}`}>
                <text
                  x={x}
                  y={74}
                  textAnchor="middle"
                  fontSize={major ? 9.5 : 8}
                  fontWeight={major ? 700 : 500}
                  fill={major ? '#475569' : '#94a3b8'}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {col}
                </text>
                <text
                  x={x}
                  y={322}
                  textAnchor="middle"
                  fontSize={major ? 9.5 : 8}
                  fontWeight={major ? 700 : 500}
                  fill={major ? '#475569' : '#94a3b8'}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {col}
                </text>
              </g>
            );
          })}

          {/* Row Labels a-e and f-j */}
          {TOP_ROWS.map((r) => (
            <g key={`row-${r}`}>
              <text x={28} y={BB_LAYOUT.rowY[r] + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" fontFamily="JetBrains Mono, monospace">
                {r}
              </text>
              <text x={BB_VIEWBOX.width - 28} y={BB_LAYOUT.rowY[r] + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" fontFamily="JetBrains Mono, monospace">
                {r}
              </text>
            </g>
          ))}
          {BOT_ROWS.map((r) => (
            <g key={`row-${r}`}>
              <text x={28} y={BB_LAYOUT.rowY[r] + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" fontFamily="JetBrains Mono, monospace">
                {r}
              </text>
              <text x={BB_VIEWBOX.width - 28} y={BB_LAYOUT.rowY[r] + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" fontFamily="JetBrains Mono, monospace">
                {r}
              </text>
            </g>
          ))}

          {/* Node Reference Badges for Exp 2 preset columns (a, b, c, d) */}
          {EXP2_NODE_MARKERS.map((nm) => {
            const hole = HOLE_MAP[nm.hole];
            if (!hole || !detectedNodes) return null;
            const expectedNet =
              nm.label === 'a'
                ? detectedNodes.a
                : nm.label === 'b'
                  ? detectedNodes.b
                  : nm.label === 'c'
                    ? detectedNodes.c
                    : detectedNodes.d;
            if (expectedNet === undefined || simulation.holeToNet[nm.hole] !== expectedNet) {
              return null;
            }
            const isProbed = activeCh2Node === nm.label;
            return (
              <g key={`nm-${nm.label}`} transform={`translate(${hole.x}, 63)`}>
                <rect
                  x={-16}
                  y={-9}
                  width={32}
                  height={14}
                  rx={7}
                  fill={isProbed ? '#06b6d4' : '#0f172a'}
                  stroke={isProbed ? '#a5f3fc' : '#64748b'}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={1}
                  textAnchor="middle"
                  fontSize={8.5}
                  fontWeight={700}
                  fontFamily="JetBrains Mono, monospace"
                  fill={isProbed ? '#082f49' : '#f8fafc'}
                >
                  ({nm.label})
                </text>
              </g>
            );
          })}

          {/* Breadboard Tie-Point Holes */}
          {ALL_HOLES.map((h) => {
            const isStripHL = highlightSets.stripHoles.has(h.id);
            const isWireHL = highlightSets.wireConnectedHoles.has(h.id);
            const isPending = pendingPin1 === h.id;
            const isHovered = hoveredHole === h.id;

            return (
              <g
                key={h.id}
                className="bb-hole"
                onMouseEnter={() => setHoveredHole(h.id)}
                onMouseLeave={() => setHoveredHole((prev) => (prev === h.id ? null : prev))}
                onClick={(e) => {
                  e.stopPropagation();
                  handleHoleClick(h.id);
                }}
              >
                {/* Highlight Ring (Tinkercad green/cyan strip trace) */}
                {(isStripHL || isWireHL || isPending) && (
                  <circle
                    cx={h.x}
                    cy={h.y}
                    r={isHovered || isPending ? 9.2 : 7.8}
                    fill={
                      isPending
                        ? 'rgba(249,115,22,0.35)'
                        : isStripHL
                          ? 'rgba(16,185,129,0.3)'
                          : 'rgba(56,189,248,0.28)'
                    }
                    stroke={
                      isPending ? '#f97316' : isStripHL ? '#10b981' : '#38bdf8'
                    }
                    strokeWidth={1.6}
                  />
                )}
                {/* Recessed square socket */}
                <rect
                  x={h.x - 4.4}
                  y={h.y - 4.4}
                  width={8.8}
                  height={8.8}
                  rx={1.8}
                  fill={isHovered ? '#0f172a' : '#292524'}
                  stroke="#a8a29e"
                  strokeWidth={0.9}
                />
                {/* Invisible generous click hitbox */}
                <circle cx={h.x} cy={h.y} r={10} fill="transparent" />
              </g>
            );
          })}

          {/* Wires rendered beneath body components for clean layering */}
          {components.filter((c) => c.type === 'wire').map((c) => renderComponentSvg(c))}

          {/* Active components (Resistors, Diode, Capacitor) */}
          {components.filter((c) => c.type !== 'wire').map((c) => renderComponentSvg(c))}

          {/* Ghost Preview while placing */}
          {ghostComp && renderComponentSvg(ghostComp, true)}

          {/* BNC Instrument Probe Clips */}
          {(Object.keys(PROBE_META) as ProbeId[]).map((pid) => {
            const holeId = probes[pid];
            if (!holeId) return null;
            const h = HOLE_MAP[holeId];
            if (!h) return null;
            const meta = PROBE_META[pid];
            const placeBelow = h.section === 'bn' || h.section === 'bp' || h.rowLabel === 'e';
            const badgeY = placeBelow ? h.y + 18 : h.y - 18;
            const active = tool === `probe:${pid}`;

            return (
              <g
                key={pid}
                className="bb-probe-pin"
                onClick={(e) => {
                  e.stopPropagation();
                  setTool(active ? 'select' : `probe:${pid}`);
                  setPendingPin1(null);
                }}
              >
                {/* Probe pin & collar */}
                <line
                  x1={h.x}
                  y1={h.y}
                  x2={h.x}
                  y2={placeBelow ? h.y + 11 : h.y - 11}
                  stroke={meta.color}
                  strokeWidth={2.5}
                />
                <circle
                  cx={h.x}
                  cy={h.y}
                  r={5.8}
                  fill={meta.color}
                  stroke={meta.stroke}
                  strokeWidth={active ? 2.4 : 1.5}
                />
                <circle cx={h.x} cy={h.y} r={2} fill="#0f172a" />
                {/* Crisp Probe Tag */}
                <g transform={`translate(${h.x}, ${badgeY})`}>
                  <rect
                    x={-16}
                    y={-8}
                    width={32}
                    height={15}
                    rx={4}
                    fill={meta.color}
                    stroke={active ? '#fff' : meta.stroke}
                    strokeWidth={active ? 1.8 : 1}
                  />
                  <text
                    x={0}
                    y={2.5}
                    textAnchor="middle"
                    fontSize={8.5}
                    fontWeight={800}
                    fontFamily="JetBrains Mono, monospace"
                    fill={meta.textColor}
                  >
                    {meta.short}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Component Inspector Bar */}
      {selectedComp && (
        <div className="bb-inspector">
          <div className="insp-title">
            <span className="insp-type">{selectedComp.type.toUpperCase()}</span>
            <input
              className="insp-input insp-label"
              value={selectedComp.label}
              onChange={(e) => onUpdateComponent(selectedComp.id, { label: e.target.value })}
              aria-label="Component label"
            />
            <span className="mono-muted">
              {selectedComp.type === 'diode'
                ? `A:${selectedComp.pin1.toUpperCase()} → K:${selectedComp.pin2.toUpperCase()}`
                : `${selectedComp.pin1.toUpperCase()} ↔ ${selectedComp.pin2.toUpperCase()}`}
            </span>
          </div>

          <div className="insp-controls">
            {selectedComp.type === 'resistor' && (
              <>
                <label className="insp-field">
                  <span>Value (Ω)</span>
                  <input
                    type="number"
                    min={10}
                    step={100}
                    className="insp-input"
                    value={selectedComp.value}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v > 0) {
                        onUpdateComponent(selectedComp.id, { value: v });
                      }
                    }}
                  />
                </label>
                <div className="insp-presets">
                  {[
                    { lbl: '1kΩ', val: 1000 },
                    { lbl: '10kΩ', val: 10000 },
                    { lbl: '22kΩ', val: 22000 },
                    { lbl: '30kΩ', val: 30000 },
                  ].map((p) => (
                    <button
                      key={p.lbl}
                      className={`mini-chip ${selectedComp.value === p.val ? 'active' : ''}`}
                      onClick={() => onUpdateComponent(selectedComp.id, { value: p.val })}
                    >
                      {p.lbl}
                    </button>
                  ))}
                </div>
              </>
            )}

            {selectedComp.type === 'capacitor' && (
              <>
                <label className="insp-field">
                  <span>Value (µF)</span>
                  <input
                    type="number"
                    min={0.001}
                    step={0.01}
                    className="insp-input"
                    value={Number((selectedComp.value * 1e6).toPrecision(4))}
                    onChange={(e) => {
                      const uf = parseFloat(e.target.value);
                      if (Number.isFinite(uf) && uf > 0) {
                        onUpdateComponent(selectedComp.id, { value: uf * 1e-6 });
                      }
                    }}
                  />
                </label>
                <div className="insp-presets">
                  {[
                    { lbl: '0.01µF', val: 0.01e-6 },
                    { lbl: '0.1µF', val: 0.1e-6 },
                    { lbl: '1µF', val: 1e-6 },
                  ].map((p) => (
                    <button
                      key={p.lbl}
                      className={`mini-chip ${Math.abs(selectedComp.value - p.val) < 1e-12 ? 'active' : ''}`}
                      onClick={() => onUpdateComponent(selectedComp.id, { value: p.val })}
                    >
                      {p.lbl}
                    </button>
                  ))}
                </div>
              </>
            )}

            {selectedComp.type === 'diode' && (
              <button
                className="btn-secondary btn-sm"
                onClick={() =>
                  onUpdateComponent(selectedComp.id, {
                    pin1: selectedComp.pin2,
                    pin2: selectedComp.pin1,
                  })
                }
                title="Swap Anode and Cathode terminals"
              >
                <ArrowLeftRight size={13} />
                <span>Flip Polarity (A ↔ K)</span>
              </button>
            )}

            {selectedComp.type === 'wire' && (
              <div className="wire-palette">
                {WIRE_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`wire-dot ${selectedComp.color === c ? 'active' : ''}`}
                    style={{ background: WIRE_COLOR_HEX[c] }}
                    onClick={() => onUpdateComponent(selectedComp.id, { color: c })}
                    title={c}
                  />
                ))}
              </div>
            )}

            <button
              className="btn-danger btn-sm"
              onClick={() => {
                onDeleteComponent(selectedComp.id);
                setSelectedId(null);
              }}
              title="Remove component (Delete)"
            >
              <Trash2 size={13} />
              <span>Delete</span>
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => setSelectedId(null)}
              title="Close inspector"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
