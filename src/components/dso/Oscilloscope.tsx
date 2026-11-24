import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ExperimentId, SimulationResult, TraceSource } from '../../engine/types';
import { EXP2_TIMES } from '../../experiments/exp2Kirchhoff';
import { EXP5_THEORY } from '../../experiments/exp5RcFilter';
import { Crosshair, Pause, Play, RotateCcw, SlidersHorizontal } from 'lucide-react';

export type CursorMode = 'off' | 'manual' | 'track';
export type DisplayMode = 'yt' | 'xy';

export interface DsoState {
  running: boolean;
  displayMode: DisplayMode;
  showCh1: boolean;
  showCh2: boolean;
  showMath: boolean;
  /** Seconds per horizontal division (10 divs total) */
  timePerDiv: number;
  /** Volts per vertical division (8 divs total) */
  voltsPerDiv: number;
  /** Center horizontal axis voltage */
  centerVoltage: number;
  triggerSource: 'fg' | 'ch1' | 'ch2';
  triggerSlope: 'rising' | 'falling';
  cursorMode: CursorMode;
  trackSource: TraceSource;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export const EXP2_DEFAULT_DSO: DsoState = {
  running: true,
  displayMode: 'yt',
  showCh1: true,
  showCh2: true,
  showMath: true,
  timePerDiv: 0.0001,
  voltsPerDiv: 1.0,
  centerVoltage: 2.5,
  triggerSource: 'fg',
  triggerSlope: 'rising',
  cursorMode: 'track',
  trackSource: 'math',
  x1: 0,
  x2: EXP2_TIMES.t1,
  y1: 2.5,
  y2: 0.5,
};

export function getDefaultDsoForExperiment(expId: ExperimentId): DsoState {
  switch (expId) {
    case 'exp2':
      return { ...EXP2_DEFAULT_DSO };
    case 'exp3':
      return {
        ...EXP2_DEFAULT_DSO,
        showMath: false,
        timePerDiv: 0.0002,
        voltsPerDiv: 1.0,
        centerVoltage: 0.0,
        cursorMode: 'track',
        trackSource: 'ch2',
        x1: -0.00025,
        x2: 0.00025,
        y1: 0,
        y2: 0.6,
      };
    case 'exp4':
      return {
        ...EXP2_DEFAULT_DSO,
        showMath: false,
        timePerDiv: 0.0002,
        voltsPerDiv: 1.0,
        centerVoltage: 2.0,
        cursorMode: 'manual',
        trackSource: 'ch2',
        x1: -0.00025,
        x2: 0.00025,
        y1: 0.0,
        y2: 4.0,
      };
    case 'exp5':
      return {
        ...EXP2_DEFAULT_DSO,
        showMath: false,
        timePerDiv: 0.0002,
        voltsPerDiv: 1.0,
        centerVoltage: 2.0,
        cursorMode: 'manual',
        trackSource: 'ch2',
        x1: 0.00001,
        x2: 0.000252,
        y1: 0.2,
        y2: 1.8,
      };
  }
}

interface OscilloscopeProps {
  experimentId: ExperimentId;
  simulation: SimulationResult;
  dso: DsoState;
  effectiveY1: number;
  effectiveY2: number;
  ch1Label: string;
  ch2Label: string;
  onChange: (patch: Partial<DsoState>) => void;
  onResetView: () => void;
}

const TIME_DIV_OPTIONS = [
  { label: '50 µs', val: 50e-6 },
  { label: '100 µs', val: 100e-6 },
  { label: '200 µs', val: 200e-6 },
  { label: '500 µs', val: 500e-6 },
  { label: '1 ms', val: 1e-3 },
  { label: '2 ms', val: 2e-3 },
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
  experimentId,
  simulation,
  dso,
  effectiveY1,
  effectiveY2,
  ch1Label,
  ch2Label,
  onChange,
  onResetView,
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

    // Deep phosphor screen
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

    // Frame & 10x8 Graticule
    ctx.strokeStyle = '#1c3e4a';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

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

    // Center axis sub-ticks
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

    // ==================== X-Y LISSAJOUS MODE (EXP 5) ====================
    if (dso.displayMode === 'xy') {
      const xHalfSpan = Math.max(2.5, Math.ceil(Math.max(Math.abs(simulation.stats.ch1.vmax), Math.abs(simulation.stats.ch1.vmin)) * 1.25 * 2) / 2);
      const yHalfSpan = Math.max(1.5, Math.ceil(Math.max(Math.abs(simulation.stats.ch2.vmax), Math.abs(simulation.stats.ch2.vmin)) * 1.4 * 2) / 2);

      const vxToPx = (vx: number) => box.x + ((vx + xHalfSpan) / (2 * xHalfSpan)) * box.w;
      const vyToPy = (vy: number) => box.y + ((yHalfSpan - vy) / (2 * yHalfSpan)) * box.h;

      // Axis labels
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#648d9b';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let j = 0; j <= 8; j += 2) {
        const vVal = yHalfSpan - (j / 8) * (2 * yHalfSpan);
        ctx.fillText(`${vVal.toFixed(1)}V`, box.x - 6, box.y + (box.h * j) / 8);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = 0; i <= 10; i += 2) {
        const xVal = -xHalfSpan + (i / 10) * (2 * xHalfSpan);
        ctx.fillText(`${xVal.toFixed(1)}V`, box.x + (box.w * i) / 10, box.y + box.h + 7);
      }

      // Draw reference slope Am = 0.5 dashed guide
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.w, box.h);
      ctx.clip();

      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(vxToPx(-xHalfSpan), vyToPy(-0.5 * xHalfSpan));
      ctx.lineTo(vxToPx(xHalfSpan), vyToPy(0.5 * xHalfSpan));
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Lissajous (CH1 vs CH2) over central cycle
      const len = simulation.time.length;
      const s0 = Math.floor(len * 0.375);
      const s1 = Math.min(len - 1, Math.ceil(len * 0.625));
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (let i = s0; i <= s1; i++) {
        const px = vxToPx(simulation.ch1[i]);
        const py = vyToPy(simulation.ch2[i]);
        if (i === s0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#34d399';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`X-Y LISSAJOUS · X: CH1 (${ch1Label}) · Y: CH2 (${ch2Label})`, box.x + 8, box.y + 6);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#7dd3fc';
      const phiStr = simulation.phaseDiffDeg !== null ? `${simulation.phaseDiffDeg.toFixed(1)}°` : '—';
      ctx.fillText(`Gain A = ${simulation.gain.toFixed(3)} · Δφ = ${phiStr}`, box.x + box.w - 8, box.y + 6);

      ctx.restore();
      return;
    }

    // ==================== Y-T TIME DOMAIN MODE ====================
    const tToX = (t: number) => box.x + ((t - tMin) / (tMax - tMin)) * box.w;
    const vToY = (v: number) => box.y + ((vMax - v) / (vMax - vMin)) * box.h;

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

      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(box.x - 1, y0);
      ctx.lineTo(box.x - 8, y0 - 4);
      ctx.lineTo(box.x - 8, y0 + 4);
      ctx.closePath();
      ctx.fill();
    }

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
      ctx.fillText(`${Math.abs(tMs) < 1e-6 ? '0' : tMs.toFixed(2)}ms`, gx, box.y + box.h + 7);
    }

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
        if (t < tMin - simulation.period * 0.1 || t > tMax + simulation.period * 0.1) continue;
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

    if (dso.showCh1) drawTrace(simulation.ch1, TRACE_COLORS.ch1, 2.2, 8);
    if (dso.showCh2) drawTrace(simulation.ch2, TRACE_COLORS.ch2, 2.2, 8);
    if (dso.showMath) drawTrace(simulation.math, TRACE_COLORS.math, 2.1, 7);

    if (dso.cursorMode !== 'off') {
      const x1Px = tToX(dso.x1);
      const x2Px = tToX(dso.x2);
      const y1Px = vToY(effectiveY1);
      const y2Px = vToY(effectiveY2);

      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = dragging === 'x1' ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(x1Px, box.y);
      ctx.lineTo(x1Px, box.y + box.h);
      ctx.stroke();

      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = dragging === 'x2' ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(x2Px, box.y);
      ctx.lineTo(x2Px, box.y + box.h);
      ctx.stroke();

      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = dragging === 'y1' ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(box.x, y1Px);
      ctx.lineTo(box.x + box.w, y1Px);
      ctx.stroke();

      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = dragging === 'y2' ? 2 : 1.3;
      ctx.beginPath();
      ctx.moveTo(box.x, y2Px);
      ctx.lineTo(box.x + box.w, y2Px);
      ctx.stroke();
      ctx.restore();

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
        ctx.save();
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x2Px, y2Px, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();

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

    ctx.font = '600 9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const timeLabel =
      dso.timePerDiv >= 1e-3
        ? `${(dso.timePerDiv * 1e3).toFixed(0)}ms/div`
        : `${(dso.timePerDiv * 1e6).toFixed(0)}µs/div`;
    ctx.fillText(
      `TRIG: ${dso.triggerSource.toUpperCase()} (${dso.triggerSlope === 'rising' ? '↗' : '↘'}) · ${timeLabel} · ${dso.voltsPerDiv.toFixed(1)}V/div`,
      box.x + 8,
      box.y + 6
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = dso.cursorMode === 'track' ? '#34d399' : '#fb923c';
    ctx.fillText(
      dso.cursorMode === 'off'
        ? 'CURSORS OFF'
        : dso.cursorMode === 'track'
          ? `TRACK: ${dso.trackSource.toUpperCase()}`
          : 'MANUAL CURSORS (DRAG)',
      box.x + box.w - 8,
      box.y + 6
    );

    ctx.restore();
  }, [simulation, dso, effectiveY1, effectiveY2, dragging, tMin, tMax, vMin, vMax, getPlotBox, ch1Label, ch2Label]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dso.cursorMode === 'off' || dso.displayMode === 'xy') return;
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

  const handlePointerUp = () => setDragging(null);

  const dxMs = (dso.x2 - dso.x1) * 1000;
  const dyV = effectiveY2 - effectiveY1;
  const dbGain =
    simulation.gain > 1e-6 ? 20 * Math.log10(simulation.gain / EXP5_THEORY.am) : -60;

  return (
    <div className="panel dso-panel">
      {/* Instrument Header */}
      <div className="dso-header">
        <div className="fg-brand">
          <span className="inst-badge dso-badge">DSO</span>
          <div>
            <div className="inst-title">ScientiFic 200 MHz Digital Storage Oscilloscope</div>
            <div className="inst-sub">
              CH1: <span className="c-ch1">{ch1Label}</span> · CH2:{' '}
              <span className="c-ch2">{ch2Label}</span>
              {dso.showMath && (
                <>
                  {' '}
                  · Math: <span className="c-math">CH1−CH2</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="dso-header-actions">
          <div className="seg-group compact">
            <button
              className={`seg-btn ${dso.displayMode === 'yt' ? 'active' : ''}`}
              onClick={() => onChange({ displayMode: 'yt' })}
              title="Time-Domain Y-T mode"
            >
              Y-T
            </button>
            <button
              className={`seg-btn ${dso.displayMode === 'xy' ? 'active' : ''}`}
              onClick={() => onChange({ displayMode: 'xy' })}
              title="Lissajous X-Y mode (CH1 vs CH2)"
            >
              X-Y
            </button>
          </div>
          <button
            className="btn-ghost btn-sm"
            onClick={onResetView}
            title="Reset DSO scale to experiment default"
          >
            <RotateCcw size={13} />
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

      {/* Experiment-Specific Quick-Align Helpers */}
      <div className="dso-quick-bar">
        <span className="quick-lbl">
          <Crosshair size={12} /> Quick:
        </span>
        {experimentId === 'exp2' && (
          <>
            <button
              className="mini-chip"
              onClick={() =>
                onChange({
                  cursorMode: dso.cursorMode === 'off' ? 'manual' : dso.cursorMode,
                  x1: 0,
                  y1: 2.5,
                })
              }
            >
              Axes (X1=0, Y1=2.5V)
            </button>
            <button
              className={`mini-chip ${Math.abs(dso.x2 - EXP2_TIMES.t1) < 1e-6 ? 'active' : ''}`}
              onClick={() => onChange({ x2: EXP2_TIMES.t1 })}
            >
              t₁ (−0.4 ms)
            </button>
            <button
              className={`mini-chip ${Math.abs(dso.x2 - EXP2_TIMES.t2) < 1e-6 ? 'active' : ''}`}
              onClick={() => onChange({ x2: EXP2_TIMES.t2 })}
            >
              t₂ (+0.3 ms)
            </button>
          </>
        )}
        {experimentId === 'exp3' && (
          <>
            <button
              className="mini-chip"
              onClick={() => onChange({ centerVoltage: 0, voltsPerDiv: 1.0, showCh1: true, showCh2: true })}
            >
              Center 0V (1V/div)
            </button>
            <button
              className="mini-chip"
              onClick={() => onChange({ centerVoltage: 0.5, voltsPerDiv: 0.5, showCh1: false, showCh2: true })}
            >
              Zoom vo (0.5V/div)
            </button>
          </>
        )}
        {experimentId === 'exp4' && (
          <>
            <button
              className="mini-chip"
              onClick={() => onChange({ cursorMode: 'manual', y1: 0, y2: 4, centerVoltage: 2, voltsPerDiv: 1 })}
            >
              Y1=0V, Y2=4V (vs)
            </button>
            <button
              className="mini-chip"
              onClick={() => onChange({ cursorMode: 'manual', y1: 0, y2: 1, centerVoltage: 0.5, voltsPerDiv: 0.5 })}
            >
              Zoom vo (0–1V)
            </button>
          </>
        )}
        {experimentId === 'exp5' && (
          <>
            <button
              className="mini-chip"
              onClick={() =>
                onChange({
                  displayMode: 'yt',
                  cursorMode: 'manual',
                  y1: 0.2,
                  y2: 1.8,
                  x1: 0.00001,
                  x2: 0.000251,
                  centerVoltage: 2.0,
                  voltsPerDiv: 1.0,
                  timePerDiv: 0.0002,
                })
              }
            >
              Step Cursors (0.20V / 1.80V)
            </button>
            <button
              className={`mini-chip ${dso.displayMode === 'xy' ? 'active' : ''}`}
              onClick={() => onChange({ displayMode: dso.displayMode === 'xy' ? 'yt' : 'xy' })}
            >
              {dso.displayMode === 'xy' ? 'Back to Y-T' : 'X-Y Lissajous'}
            </button>
          </>
        )}
      </div>

      {/* Front-Panel Control Deck */}
      <div className="dso-controls-grid">
        <div className="dso-control-card">
          <div className="card-micro-title">
            <SlidersHorizontal size={12} /> Channels & Timebase
          </div>

          <div className="ch-toggle-row">
            <button
              className={`ch-pill ch1 ${dso.showCh1 ? 'on' : ''}`}
              onClick={() => onChange({ showCh1: !dso.showCh1 })}
            >
              CH1 ({ch1Label})
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
              MATH
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

      {/* Auto Measurement Strip */}
      <div className="auto-meas-strip">
        <div className="meas-pill">
          <span className="c-ch1">CH1</span>
          <span>Min {simulation.stats.ch1.vmin.toFixed(3)}V</span>
          <span>Max {simulation.stats.ch1.vmax.toFixed(3)}V</span>
          <span>Vpp {simulation.stats.ch1.vpp.toFixed(3)}V</span>
        </div>
        <div className="meas-pill">
          <span className="c-ch2">CH2</span>
          <span>Min {simulation.stats.ch2.vmin.toFixed(3)}V</span>
          <span>Max {simulation.stats.ch2.vmax.toFixed(3)}V</span>
          <span>Vpp {simulation.stats.ch2.vpp.toFixed(3)}V</span>
        </div>
        {experimentId === 'exp2' && (
          <div className="meas-pill">
            <span className="c-math">MATH</span>
            <span>Min {simulation.stats.math.vmin.toFixed(3)}V</span>
            <span>Max {simulation.stats.math.vmax.toFixed(3)}V</span>
            <span>Vpp {simulation.stats.math.vpp.toFixed(3)}V</span>
          </div>
        )}
        {experimentId === 'exp5' && (
          <div className="meas-pill exp5-meas">
            <span className="c-ok">RC</span>
            {simulation.riseTimeSec !== null ? (
              <>
                <span>tr {(simulation.riseTimeSec * 1e6).toFixed(1)}µs</span>
                <span>tf {((simulation.fallTimeSec ?? 0) * 1e6).toFixed(1)}µs</span>
                <span>2.2τ = 242µs</span>
              </>
            ) : (
              <>
                <span>A = {simulation.gain.toFixed(3)}</span>
                <span>G = {dbGain.toFixed(2)} dB</span>
                <span>Δφ = {simulation.phaseDiffDeg?.toFixed(1) ?? '—'}°</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
