import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SimulationResult, TraceSource } from '../../engine/types';
import { EXP2_TIMES } from '../../experiments/exp2Kirchhoff';
import { Crosshair, Pause, Play, RotateCcw, SlidersHorizontal } from 'lucide-react';

export type CursorMode = 'off' | 'manual' | 'track';

export interface DsoState {
  running: boolean;
  showCh1: boolean;
  showCh2: boolean;
  showMath: boolean;
  /** Seconds per horizontal division (10 divs total) */
  timePerDiv: number;
  /** Volts per vertical division (8 divs total) */
  voltsPerDiv: number;
  /** Center horizontal axis voltage (2.5V puts 0V..5V centered like Fig. 2.2!) */
  centerVoltage: number;
  triggerSource: 'fg' | 'ch1' | 'ch2';
  triggerSlope: 'rising' | 'falling';
  cursorMode: CursorMode;
  trackSource: TraceSource;
  /** Cursor X1 in seconds */
  x1: number;
  /** Cursor X2 in seconds */
  x2: number;
  /** Manual Cursor Y1 in volts */
  y1: number;
  /** Manual Cursor Y2 in volts */
  y2: number;
}

export const EXP2_DEFAULT_DSO: DsoState = {
  running: true,
  showCh1: true,
  showCh2: true,
  showMath: true,
  timePerDiv: 0.0001, // 100 us/div => -0.5 ms to +0.5 ms (1 full cycle!)
  voltsPerDiv: 1.0, // 1 V/div => 8V vertical span
  centerVoltage: 2.5, // Center axis at 2.5V matches Fig. 2.2 exactly!
  triggerSource: 'fg',
  triggerSlope: 'rising',
  cursorMode: 'track',
  trackSource: 'math',
  x1: 0,
  x2: EXP2_TIMES.t1, // -0.4 ms
  y1: 2.5,
  y2: 0.5,
};

interface OscilloscopeProps {
  simulation: SimulationResult;
  dso: DsoState;
  effectiveY1: number;
  effectiveY2: number;
  ch2Label: string;
  onChange: (patch: Partial<DsoState>) => void;
}

const TIME_DIV_OPTIONS = [
  { label: '50 µs', val: 50e-6 },
  { label: '100 µs', val: 100e-6 },
  { label: '200 µs', val: 200e-6 },
  { label: '500 µs', val: 500e-6 },
];

const VOLT_DIV_OPTIONS = [
  { label: '0.5 V', val: 0.5 },
  { label: '1.0 V', val: 1.0 },
  { label: '2.0 V', val: 2.0 },
  { label: '5.0 V', val: 5.0 },
];

type DragHandle = 'x1' | 'x2' | 'y1' | 'y2' | null;

const TRACE_COLORS: Record<TraceSource, string> = {
  ch1: '#facc15',
  ch2: '#22d3ee',
  math: '#f472b6',
};

export const Oscilloscope: React.FC<OscilloscopeProps> = ({
  simulation,
  dso,
  effectiveY1,
  effectiveY2,
  ch2Label,
  onChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragging, setDragging] = useState<DragHandle>(null);

  const totalTimeSpan = dso.timePerDiv * 10;
  const tMin = -totalTimeSpan / 2;
  const tMax = totalTimeSpan / 2;
  const totalVoltSpan = dso.voltsPerDiv * 8;
  const vMin = dso.centerVoltage - totalVoltSpan / 2;
  const vMax = dso.centerVoltage + totalVoltSpan / 2;

  const pad = { left: 42, right: 20, top: 20, bottom: 26 };

  const getPlotBox = useCallback((w: number, h: number) => {
    return {
      x: pad.left,
      y: pad.top,
      w: w - pad.left - pad.right,
      h: h - pad.top - pad.bottom,
    };
  }, []);

  // Draw phosphor screen
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(300, Math.floor(rect.width));
    const cssH = Math.max(240, Math.floor(rect.height));

    if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background deep phosphor screen
    const bgGrad = ctx.createRadialGradient(
      cssW * 0.5,
      cssH * 0.45,
      20,
      cssW * 0.5,
      cssH * 0.5,
      cssW * 0.72
    );
    bgGrad.addColorStop(0, '#07151a');
    bgGrad.addColorStop(1, '#03080b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cssW, cssH);

    const box = getPlotBox(cssW, cssH);
    const tToX = (t: number) => box.x + ((t - tMin) / (tMax - tMin)) * box.w;
    const vToY = (v: number) => box.y + ((vMax - v) / (vMax - vMin)) * box.h;

    // Frame border
    ctx.strokeStyle = '#1c3e4a';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    // 10x8 Graticule Grid
    for (let i = 1; i < 10; i++) {
      const gx = box.x + (box.w * i) / 10;
      ctx.beginPath();
      ctx.moveTo(gx, box.y);
      ctx.lineTo(gx, box.y + box.h);
      ctx.strokeStyle = i === 5 ? '#265868' : '#102933';
      ctx.lineWidth = i === 5 ? 1.2 : 0.8;
      ctx.stroke();
    }
    for (let j = 1; j < 8; j++) {
      const gy = box.y + (box.h * j) / 8;
      ctx.beginPath();
      ctx.moveTo(box.x, gy);
      ctx.lineTo(box.x + box.w, gy);
      ctx.strokeStyle = j === 4 ? '#265868' : '#102933';
      ctx.lineWidth = j === 4 ? 1.2 : 0.8;
      ctx.stroke();
    }

    // Center axis sub-ticks (authentic ScientiFic DSO graticule)
    ctx.strokeStyle = '#2c6475';
    ctx.lineWidth = 1;
    const midX = box.x + box.w / 2;
    const midY = box.y + box.h / 2;
    for (let i = 0; i <= 50; i++) {
      const tx = box.x + (box.w * i) / 50;
      ctx.beginPath();
      ctx.moveTo(tx, midY - 3);
      ctx.lineTo(tx, midY + 3);
      ctx.stroke();
    }
    for (let j = 0; j <= 40; j++) {
      const ty = box.y + (box.h * j) / 40;
      ctx.beginPath();
      ctx.moveTo(midX - 3, ty);
      ctx.lineTo(midX + 3, ty);
      ctx.stroke();
    }

    // 0V Ground Reference Line & Marker
    const y0 = vToY(0);
    if (y0 >= box.y && y0 <= box.y + box.h) {
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(box.x, y0);
      ctx.lineTo(box.x + box.w, y0);
      ctx.stroke();
      ctx.restore();

      // Left GND arrow badge
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(box.x - 1, y0);
      ctx.lineTo(box.x - 8, y0 - 4);
      ctx.lineTo(box.x - 8, y0 + 4);
      ctx.closePath();
      ctx.fill();
    }

    // Axis Numeric Labels (Voltage on Left, Time in ms on Bottom)
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#648d9b';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let j = 0; j <= 8; j += 2) {
      const vVal = vMax - (j / 8) * (vMax - vMin);
      const gy = box.y + (box.h * j) / 8;
      ctx.fillText(`${vVal.toFixed(1)}V`, box.x - 6, gy);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 10; i += 2) {
      const tMs = (tMin + (i / 10) * (tMax - tMin)) * 1000;
      const gx = box.x + (box.w * i) / 10;
      ctx.fillText(`${tMs === 0 ? '0' : tMs.toFixed(2)}ms`, gx, box.y + box.h + 7);
    }

    // Clip to plot box before drawing waveforms & cursors
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    const drawTrace = (arr: number[], color: string, width: number, glow: number) => {
      if (arr.length < 2) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < simulation.time.length; i++) {
        const t = simulation.time[i];
        if (t < tMin - 0.0001 || t > tMax + 0.0001) continue;
        const px = tToX(t);
        const py = vToY(arr[i]);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    // Draw enabled traces
    if (dso.showCh1) drawTrace(simulation.ch1, TRACE_COLORS.ch1, 2.2, 8);
    if (dso.showCh2) drawTrace(simulation.ch2, TRACE_COLORS.ch2, 2.2, 8);
    if (dso.showMath) drawTrace(simulation.math, TRACE_COLORS.math, 2.1, 7);

    // Draw Cursors if enabled
    if (dso.cursorMode !== 'off') {
      const x1Px = tToX(dso.x1);
      const x2Px = tToX(dso.x2);
      const y1Px = vToY(effectiveY1);
      const y2Px = vToY(effectiveY2);

      // X1 vertical cursor (emerald)
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = dragging === 'x1' ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(x1Px, box.y);
      ctx.lineTo(x1Px, box.y + box.h);
      ctx.stroke();

      // X2 vertical cursor (orange)
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = dragging === 'x2' ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(x2Px, box.y);
      ctx.lineTo(x2Px, box.y + box.h);
      ctx.stroke();

      // Y1 horizontal cursor (emerald)
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = dragging === 'y1' ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(box.x, y1Px);
      ctx.lineTo(box.x + box.w, y1Px);
      ctx.stroke();

      // Y2 horizontal cursor (orange)
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = dragging === 'y2' ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(box.x, y2Px);
      ctx.lineTo(box.x + box.w, y2Px);
      ctx.stroke();
      ctx.restore();

      // Track Mode glowing intersection bullseyes
      if (dso.cursorMode === 'track') {
        const trackColor = TRACE_COLORS[dso.trackSource];
        for (const [cx, cy, cColor] of [
          [x1Px, y1Px, '#34d399'],
          [x2Px, y2Px, '#fb923c'],
        ] as const) {
          ctx.save();
          ctx.fillStyle = trackColor;
          ctx.strokeStyle = cColor;
          ctx.lineWidth = 2;
          ctx.shadowColor = cColor;
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // Manual Mode intersection crosshair for (X2, Y2)
        ctx.save();
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x2Px, y2Px, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore(); // end plot clip

    // Cursor Handle Tabs outside/on edge of plot box
    if (dso.cursorMode !== 'off') {
      const drawTag = (x: number, y: number, text: string, bg: string, fg: string) => {
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        const tw = ctx.measureText(text).width + 8;
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(x - tw / 2, y - 7, tw, 14, 3);
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + 0.5);
      };

      const clampX = (px: number) => Math.max(box.x + 12, Math.min(box.x + box.w - 12, px));
      const clampY = (py: number) => Math.max(box.y + 8, Math.min(box.y + box.h - 8, py));

      drawTag(clampX(tToX(dso.x1)), box.y - 9, 'X1', '#10b981', '#022c22');
      drawTag(clampX(tToX(dso.x2)), box.y - 9, 'X2', '#f97316', '#431407');
      drawTag(box.x + box.w - 14, clampY(vToY(effectiveY1)), 'Y1', '#10b981', '#022c22');
      drawTag(box.x + box.w - 14, clampY(vToY(effectiveY2)), 'Y2', '#f97316', '#431407');
    }

    // Top-left Trigger Status overlay inside screen
    ctx.font = '600 9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `TRIG: ${dso.triggerSource.toUpperCase()} (${dso.triggerSlope === 'rising' ? '↗' : '↘'}) · ${(dso.timePerDiv * 1e6).toFixed(0)}µs/div · ${dso.voltsPerDiv.toFixed(1)}V/div`,
      box.x + 8,
      box.y + 6
    );

    // Top-right Mode badge
    ctx.textAlign = 'right';
    ctx.fillStyle = dso.cursorMode === 'track' ? '#34d399' : '#fb923c';
    ctx.fillText(
      dso.cursorMode === 'off'
        ? 'CURSORS OFF'
        : dso.cursorMode === 'track'
          ? `TRACK: ${dso.trackSource.toUpperCase()}`
          : 'MANUAL CURSORS (DRAG X1/X2/Y1/Y2)',
      box.x + box.w - 8,
      box.y + 6
    );

    ctx.restore();
  }, [simulation, dso, effectiveY1, effectiveY2, dragging, tMin, tMax, vMin, vMax, getPlotBox]);

  // Pointer drag interaction for X1, X2, Y1, Y2 cursors
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dso.cursorMode === 'off') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const box = getPlotBox(rect.width, rect.height);

    const tToX = (t: number) => box.x + ((t - tMin) / (tMax - tMin)) * box.w;
    const vToY = (v: number) => box.y + ((vMax - v) / (vMax - vMin)) * box.h;

    const candidates: Array<{ id: DragHandle; dist: number }> = [
      { id: 'x2', dist: Math.abs(mx - tToX(dso.x2)) },
      { id: 'x1', dist: Math.abs(mx - tToX(dso.x1)) },
    ];
    if (dso.cursorMode === 'manual') {
      candidates.push(
        { id: 'y2', dist: Math.abs(my - vToY(effectiveY2)) },
        { id: 'y1', dist: Math.abs(my - vToY(effectiveY1)) }
      );
    }

    candidates.sort((a, b) => a.dist - b.dist);
    if (candidates[0] && candidates[0].dist <= 16) {
      setDragging(candidates[0].id);
      canvas.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const box = getPlotBox(rect.width, rect.height);

    const fracX = Math.max(0, Math.min(1, (mx - box.x) / box.w));
    const fracY = Math.max(0, Math.min(1, (my - box.y) / box.h));
    const tVal = tMin + fracX * (tMax - tMin);
    const vVal = vMax - fracY * (vMax - vMin);

    if (dragging === 'x1') onChange({ x1: Math.round(tVal * 1e6) / 1e6 });
    if (dragging === 'x2') onChange({ x2: Math.round(tVal * 1e6) / 1e6 });
    if (dragging === 'y1') onChange({ y1: Math.round(vVal * 1000) / 1000 });
    if (dragging === 'y2') onChange({ y2: Math.round(vVal * 1000) / 1000 });
  };

  const handlePointerUp = () => {
    setDragging(null);
  };

  const dxMs = (dso.x2 - dso.x1) * 1000;
  const dyV = effectiveY2 - effectiveY1;

  return (
    <div className="panel dso-panel">
      {/* Instrument Header */}
      <div className="dso-header">
        <div className="fg-brand">
          <span className="inst-badge dso-badge">DSO</span>
          <div>
            <div className="inst-title">ScientiFic 200 MHz Digital Storage Oscilloscope</div>
            <div className="inst-sub">
              CH1: <span className="c-ch1">va</span> · CH2: <span className="c-ch2">{ch2Label}</span>{' '}
              · Math: <span className="c-math">CH1 − CH2</span>
            </div>
          </div>
        </div>

        <div className="dso-header-actions">
          <button
            className="btn-ghost btn-sm"
            onClick={() => onChange({ ...EXP2_DEFAULT_DSO })}
            title="Reset DSO scales to Fig. 2.2 view (100 µs/div, 1 V/div, center 2.5V)"
          >
            <RotateCcw size={13} />
            <span>Fig 2.2 View</span>
          </button>
          <button
            className={`power-btn ${dso.running ? 'on' : 'paused'}`}
            onClick={() => onChange({ running: !dso.running })}
          >
            {dso.running ? <Pause size={13} /> : <Play size={13} />}
            <span>{dso.running ? 'RUN' : 'STOP'}</span>
          </button>
        </div>
      </div>

      {/* Simulation Errors / Warnings Banner */}
      {simulation.errors.length > 0 && (
        <div className="sim-alert sim-error">{simulation.errors[0]}</div>
      )}
      {simulation.errors.length === 0 && simulation.warnings.length > 0 && (
        <div className="sim-alert sim-warn">{simulation.warnings[0]}</div>
      )}

      {/* Phosphor Screen Canvas */}
      <div className="dso-screen-frame">
        <canvas
          ref={canvasRef}
          className={`dso-canvas ${dragging ? 'dragging' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {/* Live Digital Cursor Readout Bar */}
      <div className="dso-readout-bar">
        <div className="readout-cell">
          <span className="r-lbl c-x1">X1</span>
          <span className="r-val">{(dso.x1 * 1000).toFixed(3)} ms</span>
        </div>
        <div className="readout-cell">
          <span className="r-lbl c-x2">X2</span>
          <span className="r-val">{(dso.x2 * 1000).toFixed(3)} ms</span>
        </div>
        <div className="readout-cell">
          <span className="r-lbl">ΔX</span>
          <span className="r-val">{dxMs.toFixed(3)} ms</span>
        </div>
        <div className="readout-cell">
          <span className="r-lbl c-x1">Y1</span>
          <span className="r-val">{effectiveY1.toFixed(3)} V</span>
        </div>
        <div className="readout-cell readout-highlight">
          <span className="r-lbl c-x2">Y2</span>
          <span className="r-val">{effectiveY2.toFixed(3)} V</span>
        </div>
        <div className="readout-cell">
          <span className="r-lbl">ΔY</span>
          <span className="r-val">{dyV.toFixed(3)} V</span>
        </div>
      </div>

      {/* Quick-Align Helpers (Exp 2 Procedure Shortcuts) */}
      <div className="dso-quick-bar">
        <span className="quick-lbl">
          <Crosshair size={12} /> Quick Align:
        </span>
        <button
          className="mini-chip"
          onClick={() =>
            onChange({
              cursorMode: dso.cursorMode === 'off' ? 'manual' : dso.cursorMode,
              x1: 0,
              y1: 2.5,
            })
          }
          title="Align X1 = 0 ms and Y1 = 2.5 V (Step 3)"
        >
          Axes (X1=0, Y1=2.5V)
        </button>
        <button
          className={`mini-chip ${Math.abs(dso.x2 - EXP2_TIMES.t1) < 1e-6 ? 'active' : ''}`}
          onClick={() =>
            onChange({
              cursorMode: dso.cursorMode === 'off' ? 'track' : dso.cursorMode,
              x2: EXP2_TIMES.t1,
            })
          }
        >
          X2 = t₁ (−0.4 ms)
        </button>
        <button
          className={`mini-chip ${Math.abs(dso.x2 - EXP2_TIMES.t2) < 1e-6 ? 'active' : ''}`}
          onClick={() =>
            onChange({
              cursorMode: dso.cursorMode === 'off' ? 'track' : dso.cursorMode,
              x2: EXP2_TIMES.t2,
            })
          }
        >
          X2 = t₂ (+0.3 ms)
        </button>
      </div>

      {/* Front-Panel Control Deck */}
      <div className="dso-controls-grid">
        {/* Channel Toggles & Scales */}
        <div className="dso-control-card">
          <div className="card-micro-title">
            <SlidersHorizontal size={12} /> Channels & Timebase
          </div>

          <div className="ch-toggle-row">
            <button
              className={`ch-pill ch1 ${dso.showCh1 ? 'on' : ''}`}
              onClick={() => onChange({ showCh1: !dso.showCh1 })}
            >
              CH1 (va)
            </button>
            <button
              className={`ch-pill ch2 ${dso.showCh2 ? 'on' : ''}`}
              onClick={() => onChange({ showCh2: !dso.showCh2 })}
            >
              CH2 ({ch2Label})
            </button>
            <button
              className={`ch-pill math ${dso.showMath ? 'on' : ''}`}
              onClick={() => onChange({ showMath: !dso.showMath })}
            >
              MATH (CH1−CH2)
            </button>
          </div>

          <div className="scale-row">
            <div className="scale-group">
              <span className="fg-label">Time/Div</span>
              <div className="chip-row">
                {TIME_DIV_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    className={`mini-chip ${Math.abs(dso.timePerDiv - o.val) < 1e-9 ? 'active' : ''}`}
                    onClick={() => onChange({ timePerDiv: o.val })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="scale-group">
              <span className="fg-label">Volts/Div</span>
              <div className="chip-row">
                {VOLT_DIV_OPTIONS.map((o) => (
                  <button
                    key={o.label}
                    className={`mini-chip ${Math.abs(dso.voltsPerDiv - o.val) < 1e-9 ? 'active' : ''}`}
                    onClick={() => onChange({ voltsPerDiv: o.val })}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Cursor Controls (Manual vs Track Waveform Mode) */}
        <div className="dso-control-card">
          <div className="card-micro-title">
            <Crosshair size={12} /> Cursor Mode & Precision Steppers
          </div>

          <div className="cursor-mode-row">
            <div className="seg-group compact">
              {(['off', 'manual', 'track'] as CursorMode[]).map((m) => (
                <button
                  key={m}
                  className={`seg-btn ${dso.cursorMode === m ? 'active' : ''}`}
                  onClick={() => onChange({ cursorMode: m })}
                >
                  {m === 'off' ? 'Off' : m === 'manual' ? 'Manual' : 'Track'}
                </button>
              ))}
            </div>

            {dso.cursorMode === 'track' && (
              <div className="seg-group compact">
                {(['ch1', 'ch2', 'math'] as TraceSource[]).map((src) => (
                  <button
                    key={src}
                    className={`seg-btn track-${src} ${dso.trackSource === src ? 'active' : ''}`}
                    onClick={() => onChange({ trackSource: src })}
                  >
                    {src.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          {dso.cursorMode !== 'off' && (
            <div className="cursor-inputs-grid">
              <label className="mini-num">
                <span className="c-x1">X1 (ms)</span>
                <input
                  type="number"
                  step={0.01}
                  value={Number((dso.x1 * 1000).toFixed(3))}
                  onChange={(e) => {
                    const ms = parseFloat(e.target.value);
                    if (Number.isFinite(ms)) onChange({ x1: ms / 1000 });
                  }}
                />
              </label>
              <label className="mini-num">
                <span className="c-x2">X2 (ms)</span>
                <input
                  type="number"
                  step={0.01}
                  value={Number((dso.x2 * 1000).toFixed(3))}
                  onChange={(e) => {
                    const ms = parseFloat(e.target.value);
                    if (Number.isFinite(ms)) onChange({ x2: ms / 1000 });
                  }}
                />
              </label>
              <label className="mini-num">
                <span className="c-x1">Y1 (V)</span>
                <input
                  type="number"
                  step={0.05}
                  disabled={dso.cursorMode === 'track'}
                  value={Number(effectiveY1.toFixed(3))}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) onChange({ y1: v });
                  }}
                />
              </label>
              <label className="mini-num">
                <span className="c-x2">Y2 (V)</span>
                <input
                  type="number"
                  step={0.02}
                  disabled={dso.cursorMode === 'track'}
                  value={Number(effectiveY2.toFixed(3))}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) onChange({ y2: v });
                  }}
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Auto Measurement Summary Strip */}
      <div className="auto-meas-strip">
        <div className="meas-pill">
          <span className="c-ch1">CH1</span>
          <span>Min {simulation.stats.ch1.vmin.toFixed(2)}V</span>
          <span>Max {simulation.stats.ch1.vmax.toFixed(2)}V</span>
          <span>Vpp {simulation.stats.ch1.vpp.toFixed(2)}V</span>
        </div>
        <div className="meas-pill">
          <span className="c-ch2">CH2</span>
          <span>Min {simulation.stats.ch2.vmin.toFixed(2)}V</span>
          <span>Max {simulation.stats.ch2.vmax.toFixed(2)}V</span>
          <span>Vpp {simulation.stats.ch2.vpp.toFixed(2)}V</span>
        </div>
        <div className="meas-pill">
          <span className="c-math">MATH</span>
          <span>Min {simulation.stats.math.vmin.toFixed(2)}V</span>
          <span>Max {simulation.stats.math.vmax.toFixed(2)}V</span>
          <span>Vpp {simulation.stats.math.vpp.toFixed(2)}V</span>
        </div>
      </div>
    </div>
  );
};
