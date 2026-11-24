import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  NodeMarker,
  ProbeId,
  ProbeMap,
  SimulationResult,
  WireColor,
} from '../../engine/types';
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
  ChevronDown,
  Cpu,
  MousePointer2,
  Trash2,
  X,
  Zap,
} from 'lucide-react';

export type BoardTool = 'select' | ComponentType | `probe:${ProbeId}`;

interface BreadboardProps {
  components: CircuitComponent[];
  probes: ProbeMap;
  simulation: SimulationResult;
  nodeMarkers: NodeMarker[];
  detectedNodes?: { gnd: number; a?: number; b?: number; c?: number; d?: number; vo?: number };
  showRpsProbes?: boolean;
  experimentControls?: React.ReactNode;
  onAddComponent: (comp: Omit<CircuitComponent, 'id'>) => void;
  onUpdateComponent: (id: string, patch: Partial<CircuitComponent>) => void;
  onDeleteComponent: (id: string) => void;
  onMoveProbe: (probeId: ProbeId, hole: HoleId) => void;
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
  rpsPos: { label: 'RPS +VD1', short: '+VD1', color: '#dc2626', stroke: '#fca5a5', textColor: '#fff' },
  rpsCom: { label: 'RPS COM', short: 'COM', color: '#0f172a', stroke: '#e2e8f0', textColor: '#f8fafc' },
  rpsNeg: { label: 'RPS −VD2', short: '−VD2', color: '#2563eb', stroke: '#93c5fd', textColor: '#fff' },
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
  nodeMarkers,
  detectedNodes,
  showRpsProbes = false,
  experimentControls,
  onAddComponent,
  onUpdateComponent,
  onDeleteComponent,
  onMoveProbe,
}) => {
  const [tool, setTool] = useState<BoardTool>('select');
  const [wireColor, setWireColor] = useState<WireColor>('black');
  const [pendingPin1, setPendingPin1] = useState<HoleId | null>(null);
  const [hoveredHole, setHoveredHole] = useState<HoleId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [probeMenuOpen, setProbeMenuOpen] = useState(false);
  const probeMenuRef = useRef<HTMLDivElement | null>(null);

  const selectedComp = useMemo(
    () => components.find((c) => c.id === selectedId) ?? null,
    [components, selectedId]
  );

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
        setProbeMenuOpen(false);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onDeleteComponent(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, onDeleteComponent]);

  // Close probe dropdown when clicking outside
  useEffect(() => {
    if (!probeMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (probeMenuRef.current && !probeMenuRef.current.contains(e.target as Node)) {
        setProbeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [probeMenuOpen]);

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
      const hit = components.find((c) => c.pin1 === holeId || c.pin2 === holeId);
      setSelectedId(hit ? hit.id : null);
      return;
    }

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
      compType === 'resistor' ? 1000 : compType === 'capacitor' ? 0.01e-6 : 0;

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

  const hoveredInfo = useMemo(() => {
    if (!hoveredHole) return null;
    const meta = HOLE_MAP[hoveredHole];
    if (!meta) return null;
    const net = simulation.holeToNet[hoveredHole];
    let nodeTag = '';
    if (detectedNodes && net !== undefined && net >= 0) {
      if (net === detectedNodes.gnd) nodeTag = 'GND';
      else if (detectedNodes.a !== undefined && net === detectedNodes.a) nodeTag = 'Input';
      else if (detectedNodes.b !== undefined && net === detectedNodes.b) nodeTag = 'Node b';
      else if (detectedNodes.c !== undefined && net === detectedNodes.c) nodeTag = 'Node c';
      else if (detectedNodes.d !== undefined && net === detectedNodes.d) nodeTag = 'Node d';
      else if (detectedNodes.vo !== undefined && net === detectedNodes.vo) nodeTag = 'Output vo';
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
      net: net !== undefined && net >= 0 ? `Net ${net}` : 'Open',
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
    const isVertical = Math.abs(dy) > Math.abs(dx);

    const commonProps = isGhost
      ? { opacity: 0.65, pointerEvents: 'none' as const }
      : {
          className: `bb-comp ${isSelected ? 'bb-comp-selected' : ''}`,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            if (tool === 'select') setSelectedId(comp.id);
          },
        };

    if (comp.type === 'wire') {
      const hex = WIRE_COLOR_HEX[comp.color ?? 'black'] ?? '#1e293b';
      const bow = Math.min(24, Math.max(8, len * 0.12));
      const nx = len > 0 ? -dy / len : 0;
      const ny = len > 0 ? dx / len : -1;
      const cx = midX + nx * bow * 0.45;
      const cy = midY + ny * bow * 0.45;
      const dPath = `M ${p1.x} ${p1.y} Q ${cx} ${cy} ${p2.x} ${p2.y}`;

      return (
        <g key={comp.id} {...commonProps}>
          {isSelected && (
            <path d={dPath} fill="none" stroke="#38bdf8" strokeWidth={9} strokeLinecap="round" opacity={0.55} />
          )}
          <path d={dPath} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={6} strokeLinecap="round" transform="translate(1,2)" />
          <path d={dPath} fill="none" stroke={hex} strokeWidth={4.5} strokeLinecap="round" />
          <path d={dPath} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1.3} strokeLinecap="round" />
          <circle cx={p1.x} cy={p1.y} r={3.5} fill="#cbd5e1" stroke="#334155" strokeWidth={1.1} />
          <circle cx={p2.x} cy={p2.y} r={3.5} fill="#cbd5e1" stroke="#334155" strokeWidth={1.1} />
        </g>
      );
    }

    if (comp.type === 'resistor') {
      const bands = getResistorBands(comp.value);
      const bodyLen = Math.min(44, Math.max(24, len * 0.52));
      const bodyH = 14;
      const txt = `${comp.label} ${formatResistance(comp.value)}`;
      const pillW = Math.max(54, txt.length * 5.6 + 10);
      return (
        <g key={comp.id} {...commonProps}>
          <line x1={p1.x} y1={p1.y + 2} x2={p2.x} y2={p2.y + 2} stroke="rgba(0,0,0,0.25)" strokeWidth={4} />
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
          <circle cx={p1.x} cy={p1.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
          <circle cx={p2.x} cy={p2.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
          <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
            {isSelected && (
              <rect x={-bodyLen / 2 - 4} y={-bodyH / 2 - 4} width={bodyLen + 8} height={bodyH + 8} rx={7} fill="none" stroke="#38bdf8" strokeWidth={2.2} />
            )}
            <rect x={-bodyLen / 2} y={-bodyH / 2} width={bodyLen} height={bodyH} rx={5} fill="#60a5fa" stroke="#1e40af" strokeWidth={1.1} />
            <rect x={-bodyLen * 0.34} y={-bodyH / 2 + 0.6} width={3.5} height={bodyH - 1.2} fill={bands[0]} />
            <rect x={-bodyLen * 0.14} y={-bodyH / 2 + 0.6} width={3.5} height={bodyH - 1.2} fill={bands[1]} />
            <rect x={bodyLen * 0.06} y={-bodyH / 2 + 0.6} width={3.5} height={bodyH - 1.2} fill={bands[2]} />
            <rect x={bodyLen * 0.27} y={-bodyH / 2 + 0.6} width={3.1} height={bodyH - 1.2} fill={bands[3]} />
            <rect x={-bodyLen / 2 + 2} y={-bodyH / 2 + 1.5} width={bodyLen - 4} height={3} rx={1.5} fill="rgba(255,255,255,0.32)" />
          </g>
          {!isGhost && (
            <g transform={`translate(${midX}, ${midY - (isVertical ? 0 : 14)})`}>
              <rect x={isVertical ? 12 : -pillW / 2} y={-9} width={pillW} height={15} rx={4} fill="rgba(15,23,42,0.9)" stroke={isSelected ? '#38bdf8' : 'rgba(148,163,184,0.35)'} strokeWidth={1} />
              <text x={isVertical ? 12 + pillW / 2 : 0} y={2} textAnchor="middle" fontSize={8.8} fontWeight={600} fontFamily="JetBrains Mono, monospace" fill="#f8fafc">
                {txt}
              </text>
            </g>
          )}
        </g>
      );
    }

    if (comp.type === 'diode') {
      const bodyLen = Math.min(44, Math.max(24, len * 0.5));
      const bodyH = 15;
      return (
        <g key={comp.id} {...commonProps}>
          <line x1={p1.x} y1={p1.y + 2} x2={p2.x} y2={p2.y + 2} stroke="rgba(0,0,0,0.3)" strokeWidth={4} />
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
          <circle cx={p1.x} cy={p1.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
          <circle cx={p2.x} cy={p2.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
          <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
            {isSelected && (
              <rect x={-bodyLen / 2 - 4} y={-bodyH / 2 - 4} width={bodyLen + 8} height={bodyH + 8} rx={6} fill="none" stroke="#38bdf8" strokeWidth={2.2} />
            )}
            <rect x={-bodyLen / 2} y={-bodyH / 2} width={bodyLen} height={bodyH} rx={3} fill="#18181b" stroke="#52525b" strokeWidth={1.1} />
            <rect x={bodyLen / 2 - 9} y={-bodyH / 2 + 0.6} width={5.2} height={bodyH - 1.2} fill="#e2e8f0" />
            <path d="M -8 -3.5 L -1 0 L -8 3.5 Z" fill="#94a3b8" opacity={0.85} />
          </g>
          {!isGhost && (
            <g transform={`translate(${midX}, ${midY - (isVertical ? 0 : 15)})`}>
              <rect x={isVertical ? 12 : -36} y={-9} width={72} height={15} rx={4} fill="rgba(15,23,42,0.9)" stroke={isSelected ? '#38bdf8' : 'rgba(226,232,240,0.4)'} strokeWidth={1} />
              <text x={isVertical ? 48 : 0} y={2} textAnchor="middle" fontSize={8.5} fontWeight={600} fontFamily="JetBrains Mono, monospace" fill="#f8fafc">
                1N4007 (A→K)
              </text>
            </g>
          )}
        </g>
      );
    }

    const capW = Math.min(34, Math.max(22, len * 0.36));
    const capH = 18;
    const capTxt = `${comp.label} ${formatCapacitance(comp.value)}`;
    const capPillW = Math.max(58, capTxt.length * 5.8 + 10);
    return (
      <g key={comp.id} {...commonProps}>
        <line x1={p1.x} y1={p1.y + 2} x2={p2.x} y2={p2.y + 2} stroke="rgba(0,0,0,0.28)" strokeWidth={4} />
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
        <circle cx={p1.x} cy={p1.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
        <circle cx={p2.x} cy={p2.y} r={3.4} fill="#e2e8f0" stroke="#475569" strokeWidth={1} />
        <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
          {isSelected && (
            <rect x={-capW / 2 - 4} y={-capH / 2 - 4} width={capW + 8} height={capH + 8} rx={5} fill="none" stroke="#38bdf8" strokeWidth={2.2} />
          )}
          <rect x={-capW / 2} y={-capH / 2} width={capW} height={capH} rx={4} fill="#d97706" stroke="#92400e" strokeWidth={1.3} />
          <rect x={-capW / 2 + 2} y={-capH / 2 + 2} width={capW - 4} height={capH - 4} rx={2.5} fill="#f59e0b" />
          <text x={0} y={3.5} textAnchor="middle" fontSize={9.2} fontWeight={700} fontFamily="JetBrains Mono, monospace" fill="#451a03">
            {getCapacitorCode(comp.value)}
          </text>
        </g>
        {!isGhost && (
          <g transform={`translate(${midX}, ${midY - (isVertical ? 0 : 17)})`}>
            <rect x={isVertical ? 14 : -capPillW / 2} y={-9} width={capPillW} height={15} rx={4} fill="rgba(15,23,42,0.9)" stroke={isSelected ? '#38bdf8' : 'rgba(245,158,11,0.5)'} strokeWidth={1} />
            <text x={isVertical ? 14 + capPillW / 2 : 0} y={2} textAnchor="middle" fontSize={8.8} fontWeight={600} fontFamily="JetBrains Mono, monospace" fill="#fde68a">
              {capTxt}
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
      value: compType === 'resistor' ? 1000 : compType === 'capacitor' ? 0.01e-6 : 0,
      color: compType === 'wire' ? wireColor : undefined,
    };
  }, [pendingPin1, hoveredHole, tool, wireColor]);

  const placeableProbes: ProbeId[] = showRpsProbes
    ? ['fgPos', 'ch1Pos', 'ch2Pos', 'rpsPos', 'rpsNeg', 'fgGnd']
    : ['fgPos', 'ch1Pos', 'ch2Pos', 'fgGnd'];

  const activeProbeLabel = tool.startsWith('probe:')
    ? PROBE_META[tool.slice(6) as ProbeId].short
    : null;

  return (
    <div className="panel breadboard-panel">
      {/* Single Clean Toolbar: Left = Parts + Probes Dropdown · Right = Experiment Controls */}
      <div className="bb-toolbar">
        <div className="bb-tool-group" role="toolbar" aria-label="Breadboard tools">
          <div className="seg-group compact">
            <button
              className={`seg-btn ${tool === 'select' ? 'active' : ''}`}
              onClick={() => {
                setTool('select');
                setPendingPin1(null);
              }}
              title="Select & edit parts (Esc)"
            >
              <MousePointer2 size={13} />
              <span>Select</span>
            </button>
            <button
              className={`seg-btn ${tool === 'resistor' ? 'active' : ''}`}
              onClick={() => {
                setTool('resistor');
                setPendingPin1(null);
              }}
              title="Place Resistor"
            >
              <span className="tool-chip resistor-chip" />
              <span>R</span>
            </button>
            <button
              className={`seg-btn ${tool === 'diode' ? 'active' : ''}`}
              onClick={() => {
                setTool('diode');
                setPendingPin1(null);
              }}
              title="Place 1N4007 Diode"
            >
              <span className="tool-chip diode-chip" />
              <span>Diode</span>
            </button>
            <button
              className={`seg-btn ${tool === 'capacitor' ? 'active' : ''}`}
              onClick={() => {
                setTool('capacitor');
                setPendingPin1(null);
              }}
              title="Place Capacitor"
            >
              <span className="tool-chip cap-chip" />
              <span>Cap</span>
            </button>
            <button
              className={`seg-btn ${tool === 'wire' ? 'active' : ''}`}
              onClick={() => {
                setTool('wire');
                setPendingPin1(null);
              }}
              title="Draw Jumper Wire"
            >
              <Cable size={13} />
              <span>Wire</span>
            </button>
          </div>

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

          {/* Compact Probes Dropdown */}
          <div className="popover-wrap" ref={probeMenuRef}>
            <button
              className={`btn-secondary btn-sm ${activeProbeLabel ? 'btn-accent-outline' : ''}`}
              onClick={() => setProbeMenuOpen((o) => !o)}
              title="Move BNC / Power Supply clips"
            >
              <span>{activeProbeLabel ? `Move ${activeProbeLabel}` : 'Probes'}</span>
              <ChevronDown size={13} />
            </button>
            {probeMenuOpen && (
              <div className="popover-menu">
                <div className="popover-heading">Move clip to any hole</div>
                {placeableProbes.map((pid) => {
                  const meta = PROBE_META[pid];
                  return (
                    <button
                      key={pid}
                      className={`popover-item ${tool === `probe:${pid}` ? 'active' : ''}`}
                      onClick={() => {
                        setTool(`probe:${pid}`);
                        setPendingPin1(null);
                        setProbeMenuOpen(false);
                      }}
                    >
                      <span className="probe-dot" style={{ background: meta.color }} />
                      <span>{meta.label}</span>
                      <span className="mono-muted">{probes[pid]?.toUpperCase() ?? 'NC'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Inline Experiment Controls */}
        {experimentControls && <div className="bb-exp-inline">{experimentControls}</div>}
      </div>

      {/* Interactive SVG Breadboard */}
      <div className="bb-canvas-wrap">
        <svg
          className="bb-svg"
          viewBox={`0 0 ${BB_VIEWBOX.width} ${BB_VIEWBOX.height}`}
          onClick={() => {
            if (tool === 'select') setSelectedId(null);
          }}
        >
          <rect x={8} y={8} width={BB_VIEWBOX.width - 16} height={BB_VIEWBOX.height - 16} rx={12} fill="#f4efe4" stroke="#c7beab" strokeWidth={2.5} />
          <rect x={16} y={15} width={BB_VIEWBOX.width - 32} height={BB_VIEWBOX.height - 30} rx={8} fill="#f7f3ea" stroke="#ded6c5" strokeWidth={1.2} />

          {/* Top Power Rails */}
          <line x1={46} y1={19} x2={BB_VIEWBOX.width - 46} y2={19} stroke="#dc2626" strokeWidth={2.2} opacity={0.85} />
          <line x1={46} y1={60} x2={BB_VIEWBOX.width - 46} y2={60} stroke="#2563eb" strokeWidth={2.2} opacity={0.85} />
          <text x={30} y={32} fontSize={13} fontWeight={700} fill="#dc2626" fontFamily="JetBrains Mono, monospace">+</text>
          <text x={30} y={54} fontSize={14} fontWeight={700} fill="#2563eb" fontFamily="JetBrains Mono, monospace">−</text>
          <text x={BB_VIEWBOX.width - 36} y={32} fontSize={13} fontWeight={700} fill="#dc2626" fontFamily="JetBrains Mono, monospace">+</text>
          <text x={BB_VIEWBOX.width - 36} y={54} fontSize={14} fontWeight={700} fill="#2563eb" fontFamily="JetBrains Mono, monospace">−</text>

          {/* Bottom Power Rails */}
          <line x1={46} y1={331} x2={BB_VIEWBOX.width - 46} y2={331} stroke="#dc2626" strokeWidth={2.2} opacity={0.85} />
          <line x1={46} y1={372} x2={BB_VIEWBOX.width - 46} y2={372} stroke="#2563eb" strokeWidth={2.2} opacity={0.85} />
          <text x={30} y={344} fontSize={13} fontWeight={700} fill="#dc2626" fontFamily="JetBrains Mono, monospace">+</text>
          <text x={30} y={366} fontSize={14} fontWeight={700} fill="#2563eb" fontFamily="JetBrains Mono, monospace">−</text>
          <text x={BB_VIEWBOX.width - 36} y={344} fontSize={13} fontWeight={700} fill="#dc2626" fontFamily="JetBrains Mono, monospace">+</text>
          <text x={BB_VIEWBOX.width - 36} y={366} fontSize={14} fontWeight={700} fill="#2563eb" fontFamily="JetBrains Mono, monospace">−</text>

          <text x={BB_VIEWBOX.width / 2} y={383} textAnchor="middle" fontSize={8.5} fontWeight={700} letterSpacing="0.12em" fill="#475569" fontFamily="JetBrains Mono, monospace">
            GND / COM BUS (COMMON REFERENCE NODE 0)
          </text>

          {/* Center IC Trench */}
          <rect x={36} y={188} width={BB_VIEWBOX.width - 72} height={14} rx={4} fill="#e5decb" stroke="#cfc6b1" strokeWidth={1} />

          {/* Column Numbers */}
          {Array.from({ length: BB_COLS }, (_, idx) => {
            const col = idx + 1;
            const x = BB_LAYOUT.padX + idx * BB_LAYOUT.colPitch;
            const major = col === 1 || col % 5 === 0;
            return (
              <g key={`col-${col}`}>
                <text x={x} y={74} textAnchor="middle" fontSize={major ? 9.5 : 8} fontWeight={major ? 700 : 500} fill={major ? '#475569' : '#94a3b8'} fontFamily="JetBrains Mono, monospace">{col}</text>
                <text x={x} y={322} textAnchor="middle" fontSize={major ? 9.5 : 8} fontWeight={major ? 700 : 500} fill={major ? '#475569' : '#94a3b8'} fontFamily="JetBrains Mono, monospace">{col}</text>
              </g>
            );
          })}

          {/* Row Labels */}
          {[...TOP_ROWS, ...BOT_ROWS].map((r) => (
            <g key={`row-${r}`}>
              <text x={28} y={BB_LAYOUT.rowY[r] + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" fontFamily="JetBrains Mono, monospace">{r}</text>
              <text x={BB_VIEWBOX.width - 28} y={BB_LAYOUT.rowY[r] + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#64748b" fontFamily="JetBrains Mono, monospace">{r}</text>
            </g>
          ))}

          {/* Node Badges */}
          {nodeMarkers.map((nm) => {
            const hole = HOLE_MAP[nm.hole];
            if (!hole || !detectedNodes) return null;
            const key = nm.netKey ?? (nm.label as 'a' | 'b' | 'c' | 'd' | 'vo');
            const expectedNet = detectedNodes[key];
            if (expectedNet === undefined || simulation.holeToNet[nm.hole] !== expectedNet) return null;
            const ch2Net = probes.ch2Pos ? simulation.holeToNet[probes.ch2Pos] : -2;
            const isProbed = ch2Net === expectedNet;
            const w = Math.max(30, nm.label.length * 7 + 16);
            return (
              <g key={`nm-${nm.label}-${nm.col}`} transform={`translate(${hole.x}, 63)`}>
                <rect x={-w / 2} y={-9} width={w} height={14} rx={7} fill={isProbed ? '#06b6d4' : '#0f172a'} stroke={isProbed ? '#a5f3fc' : '#64748b'} strokeWidth={1} />
                <text x={0} y={1} textAnchor="middle" fontSize={8.5} fontWeight={700} fontFamily="JetBrains Mono, monospace" fill={isProbed ? '#082f49' : '#f8fafc'}>
                  ({nm.label})
                </text>
              </g>
            );
          })}

          {/* Holes */}
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
                {(isStripHL || isWireHL || isPending) && (
                  <circle
                    cx={h.x}
                    cy={h.y}
                    r={isHovered || isPending ? 9.2 : 7.8}
                    fill={isPending ? 'rgba(249,115,22,0.35)' : isStripHL ? 'rgba(16,185,129,0.3)' : 'rgba(56,189,248,0.28)'}
                    stroke={isPending ? '#f97316' : isStripHL ? '#10b981' : '#38bdf8'}
                    strokeWidth={1.6}
                  />
                )}
                <rect x={h.x - 4.4} y={h.y - 4.4} width={8.8} height={8.8} rx={1.8} fill={isHovered ? '#0f172a' : '#292524'} stroke="#a8a29e" strokeWidth={0.9} />
                <circle cx={h.x} cy={h.y} r={10} fill="transparent" />
              </g>
            );
          })}

          {components.filter((c) => c.type === 'wire').map((c) => renderComponentSvg(c))}
          {components.filter((c) => c.type !== 'wire').map((c) => renderComponentSvg(c))}
          {ghostComp && renderComponentSvg(ghostComp, true)}

          {/* Probe Clips */}
          {(Object.keys(PROBE_META) as ProbeId[]).map((pid) => {
            const holeId = probes[pid];
            if (!holeId) return null;
            const h = HOLE_MAP[holeId];
            if (!h) return null;
            const meta = PROBE_META[pid];
            const placeBelow = h.section === 'bn' || h.section === 'bp' || h.section === 'tn' || h.rowLabel === 'e';
            const badgeY = h.section === 'tp' ? h.y - 16 : placeBelow ? h.y + 18 : h.y - 18;
            const active = tool === `probe:${pid}`;
            const tagW = Math.max(32, meta.short.length * 6.2 + 10);

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
                <line x1={h.x} y1={h.y} x2={h.x} y2={badgeY > h.y ? h.y + 11 : h.y - 11} stroke={meta.color} strokeWidth={2.5} />
                <circle cx={h.x} cy={h.y} r={5.8} fill={meta.color} stroke={meta.stroke} strokeWidth={active ? 2.4 : 1.5} />
                <circle cx={h.x} cy={h.y} r={2} fill="#0f172a" />
                <g transform={`translate(${h.x}, ${badgeY})`}>
                  <rect x={-tagW / 2} y={-8} width={tagW} height={15} rx={4} fill={meta.color} stroke={active ? '#fff' : meta.stroke} strokeWidth={active ? 1.8 : 1} />
                  <text x={0} y={2.5} textAnchor="middle" fontSize={8.2} fontWeight={800} fontFamily="JetBrains Mono, monospace" fill={meta.textColor}>
                    {meta.short}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Quiet 1-line Bottom Status / Inspector Bar */}
      {selectedComp ? (
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
                  <span>Ω</span>
                  <input
                    type="number"
                    min={10}
                    step={100}
                    className="insp-input"
                    value={selectedComp.value}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v) && v > 0) onUpdateComponent(selectedComp.id, { value: v });
                    }}
                  />
                </label>
                {[1000, 10000, 20000, 22000, 30000].map((val) => (
                  <button
                    key={val}
                    className={`mini-chip ${selectedComp.value === val ? 'active' : ''}`}
                    onClick={() => onUpdateComponent(selectedComp.id, { value: val })}
                  >
                    {val / 1000}k
                  </button>
                ))}
              </>
            )}

            {selectedComp.type === 'capacitor' && (
              <>
                <label className="insp-field">
                  <span>µF</span>
                  <input
                    type="number"
                    min={0.001}
                    step={0.01}
                    className="insp-input"
                    value={Number((selectedComp.value * 1e6).toPrecision(4))}
                    onChange={(e) => {
                      const uf = parseFloat(e.target.value);
                      if (Number.isFinite(uf) && uf > 0) onUpdateComponent(selectedComp.id, { value: uf * 1e-6 });
                    }}
                  />
                </label>
                {[0.01e-6, 0.1e-6, 1e-6].map((val) => (
                  <button
                    key={val}
                    className={`mini-chip ${Math.abs(selectedComp.value - val) < 1e-12 ? 'active' : ''}`}
                    onClick={() => onUpdateComponent(selectedComp.id, { value: val })}
                  >
                    {formatCapacitance(val)}
                  </button>
                ))}
              </>
            )}

            {selectedComp.type === 'diode' && (
              <button
                className="btn-secondary btn-sm"
                onClick={() => onUpdateComponent(selectedComp.id, { pin1: selectedComp.pin2, pin2: selectedComp.pin1 })}
              >
                <ArrowLeftRight size={13} />
                <span>Flip Polarity</span>
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
            >
              <Trash2 size={13} />
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setSelectedId(null)}>
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <div className="bb-status-bar">
          <div className="bb-hint">
            {tool.startsWith('probe:') ? (
              <span className="hint-active">
                <Zap size={12} /> Click any hole to move <strong>{PROBE_META[tool.slice(6) as ProbeId].label}</strong> (Esc cancel)
              </span>
            ) : tool !== 'select' ? (
              <span className="hint-active">
                <Cpu size={12} />{' '}
                {pendingPin1
                  ? `Pin 1 at ${pendingPin1.toUpperCase()} — click Pin 2 to place`
                  : `Click two holes to place ${tool} (Esc cancel)`}
              </span>
            ) : (
              <span>Hover holes to trace nets · Click any part or probe clip to edit</span>
            )}
          </div>
          <div className="bb-live-hover">
            {hoveredInfo ? (
              <>
                <span className="mono-badge">{hoveredInfo.hole.toUpperCase()}</span>
                {hoveredInfo.nodeTag && <span className="node-pill">{hoveredInfo.nodeTag}</span>}
                {hoveredInfo.vRange && <span className="mono-volt">{hoveredInfo.vRange}</span>}
              </>
            ) : (
              <span className="mono-muted">Exact MNA Live</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
