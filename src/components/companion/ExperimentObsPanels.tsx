import React, { useState } from 'react';
import type { SimulationResult } from '../../engine/types';
import type { Exp3CircuitVariant, Exp3SourceCondition } from '../../experiments/exp3Superposition';
import { EXP4_LOADS, type Exp4LoadKey } from '../../experiments/exp4Thevenin';
import { EXP5_SWEEP_FREQS, EXP5_THEORY } from '../../experiments/exp5RcFilter';
import { Download, Sparkles, Trash2 } from 'lucide-react';

/* ==================== EXP 3 SUPERPOSITION OBSERVATIONS ==================== */
export interface Exp3TableData {
  all: { min: string; max: string };
  vd1: { min: string; max: string };
  vd2: { min: string; max: string };
  va: { min: string; max: string };
}

export type Exp3ObsStore = Record<Exp3CircuitVariant, Exp3TableData>;

const EMPTY_EXP3_TABLE = (): Exp3TableData => ({
  all: { min: '', max: '' },
  vd1: { min: '', max: '' },
  vd2: { min: '', max: '' },
  va: { min: '', max: '' },
});

export const INITIAL_EXP3_OBS: Exp3ObsStore = {
  resistive: EMPTY_EXP3_TABLE(),
  rc_1khz: EMPTY_EXP3_TABLE(),
  rc_2khz: EMPTY_EXP3_TABLE(),
};

function pNum(s: string): number | null {
  if (!s.trim()) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

interface Exp3ObsPanelProps {
  activeVariant: Exp3CircuitVariant;
  store: Exp3ObsStore;
  simulation: SimulationResult;
  onUpdate: (variant: Exp3CircuitVariant, cond: Exp3SourceCondition, min: string, max: string) => void;
  onAutoFill: (variant: Exp3CircuitVariant) => void;
  onClear: (variant: Exp3CircuitVariant) => void;
}

export const Exp3ObsPanel: React.FC<Exp3ObsPanelProps> = ({
  activeVariant,
  store,
  simulation,
  onUpdate,
  onAutoFill,
  onClear,
}) => {
  const [viewVar, setViewVar] = useState<Exp3CircuitVariant>(activeVariant);
  const table = store[viewVar];

  const rows: Array<{ key: Exp3SourceCondition; label: string }> = [
    { key: 'all', label: 'All sources active' },
    { key: 'vd1', label: 'Only VD1 (+4.8V)' },
    { key: 'vd2', label: 'Only VD2 (−3.0V)' },
    { key: 'va', label: 'Only AC va' },
  ];

  const v1Min = pNum(table.vd1.min);
  const v2Min = pNum(table.vd2.min);
  const v3Min = pNum(table.va.min);
  const v1Max = pNum(table.vd1.max);
  const v2Max = pNum(table.vd2.max);
  const v3Max = pNum(table.va.max);

  const sumMin = v1Min !== null && v2Min !== null && v3Min !== null ? v1Min + v2Min + v3Min : null;
  const sumMax = v1Max !== null && v2Max !== null && v3Max !== null ? v1Max + v2Max + v3Max : null;
  const allMin = pNum(table.all.min);
  const allMax = pNum(table.all.max);

  const errMin =
    allMin !== null && sumMin !== null
      ? Math.abs(allMin) > 1e-4
        ? (Math.abs(allMin - sumMin) / Math.abs(allMin)) * 100
        : Math.abs(allMin - sumMin) * 100
      : null;
  const errMax =
    allMax !== null && sumMax !== null
      ? Math.abs(allMax) > 1e-4
        ? (Math.abs(allMax - sumMax) / Math.abs(allMax)) * 100
        : Math.abs(allMax - sumMax) * 100
      : null;

  const exportCsv = () => {
    const lines = ['Table,Condition,VoMin (V),VoMax (V)'];
    for (const v of ['resistive', 'rc_1khz', 'rc_2khz'] as Exp3CircuitVariant[]) {
      const t = store[v];
      for (const r of rows) {
        lines.push(`${v},${r.label},${t[r.key].min},${t[r.key].max}`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'EC102_Exp3_Superposition.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="drawer-section-stack">
      <div className="obs-toolbar">
        <div className="seg-group compact">
          <button className={`seg-btn ${viewVar === 'resistive' ? 'active' : ''}`} onClick={() => setViewVar('resistive')}>
            T1: Resistive
          </button>
          <button className={`seg-btn ${viewVar === 'rc_1khz' ? 'active' : ''}`} onClick={() => setViewVar('rc_1khz')}>
            T2: RC 1k
          </button>
          <button className={`seg-btn ${viewVar === 'rc_2khz' ? 'active' : ''}`} onClick={() => setViewVar('rc_2khz')}>
            T3: RC 2k
          </button>
        </div>
        <div className="obs-actions">
          <button className="btn-secondary btn-sm" onClick={() => onAutoFill(viewVar)} title="Auto-solve all 4 rows for this table">
            <Sparkles size={12} /> <span>Auto-Fill</span>
          </button>
          <button className="btn-ghost btn-sm" onClick={exportCsv} title="Export CSV">
            <Download size={12} />
          </button>
          <button className="btn-ghost btn-sm" onClick={() => onClear(viewVar)} title="Clear table">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="obs-live-banner">
        <span>
          Live CH2 (vo): <strong className="c-ch2">Min {simulation.stats.ch2.vmin.toFixed(4)} V</strong> ·{' '}
          <strong className="c-ch2">Max {simulation.stats.ch2.vmax.toFixed(4)} V</strong>
        </span>
      </div>

      <div className="ref-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Condition</th>
              <th>VoMin (V)</th>
              <th>VoMax (V)</th>
              <th>Cap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="td-left">{r.label}</td>
                <td>
                  <input
                    type="number"
                    step="0.001"
                    className="obs-input"
                    value={table[r.key].min}
                    onChange={(e) => onUpdate(viewVar, r.key, e.target.value, table[r.key].max)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.001"
                    className="obs-input"
                    value={table[r.key].max}
                    onChange={(e) => onUpdate(viewVar, r.key, table[r.key].min, e.target.value)}
                  />
                </td>
                <td>
                  <button
                    className="capture-btn"
                    onClick={() =>
                      onUpdate(
                        viewVar,
                        r.key,
                        simulation.stats.ch2.vmin.toFixed(4),
                        simulation.stats.ch2.vmax.toFixed(4)
                      )
                    }
                    title="Capture live DSO CH2 Min & Max"
                  >
                    DSO
                  </button>
                </td>
              </tr>
            ))}
            <tr className="row-sum">
              <td className="td-left">Sum (vo1+vo2+vo3)</td>
              <td className="c-ok">{sumMin !== null ? sumMin.toFixed(4) : '—'}</td>
              <td className="c-ok">{sumMax !== null ? sumMax.toFixed(4) : '—'}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Table 4: Verification Table */}
      <div className="ref-card">
        <div className="ref-title">Table 4: Superposition Verification</div>
        <table className="mini-compare-table">
          <thead>
            <tr>
              <th>Quantity</th>
              <th>All Sources</th>
              <th>Sum (Indiv.)</th>
              <th>% Error</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>VoMin (V)</td>
              <td>{allMin !== null ? allMin.toFixed(4) : '—'}</td>
              <td>{sumMin !== null ? sumMin.toFixed(4) : '—'}</td>
              <td className="c-ok">{errMin !== null ? `${errMin.toFixed(2)}%` : '—'}</td>
            </tr>
            <tr>
              <td>VoMax (V)</td>
              <td>{allMax !== null ? allMax.toFixed(4) : '—'}</td>
              <td>{sumMax !== null ? sumMax.toFixed(4) : '—'}</td>
              <td className="c-ok">{errMax !== null ? `${errMax.toFixed(2)}%` : '—'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ==================== EXP 4 THEVENIN TABLE + VO-IO EXTRAPOLATION PLOT ==================== */
export interface Exp4ObsRow {
  rowId: string;
  loadKey: Exp4LoadKey;
  label: string;
  loadType: string;
  ohms?: number;
  vsVpp: string;
  voVpp: string;
  voPeak: string;
}

export const INITIAL_EXP4_OBS: Exp4ObsRow[] = [
  ...EXP4_LOADS.slice(0, 7).map((l) => ({
    rowId: l.key,
    loadKey: l.key,
    label: l.label,
    loadType: 'Resistive',
    ohms: l.ohms,
    vsVpp: '',
    voVpp: '',
    voPeak: '',
  })),
  {
    rowId: 'thevenin_10k',
    loadKey: '10k',
    label: 'Thev 10 kΩ',
    loadType: 'Thevenin',
    ohms: 10000,
    vsVpp: '',
    voVpp: '',
    voPeak: '',
  },
  {
    rowId: 'cap',
    loadKey: 'cap',
    label: '0.01 µF',
    loadType: 'Capacitive',
    vsVpp: '',
    voVpp: '',
    voPeak: '',
  },
  {
    rowId: 'diode',
    loadKey: 'diode',
    label: '1N4007',
    loadType: 'Diode',
    vsVpp: '',
    voVpp: '',
    voPeak: '',
  },
];

interface Exp4ObsPanelProps {
  rows: Exp4ObsRow[];
  simulation: SimulationResult;
  onCaptureRow: (rowId: string) => void;
  onAutoSweep: () => void;
  onClear: () => void;
}

export const Exp4ObsPanel: React.FC<Exp4ObsPanelProps> = ({
  rows,
  simulation,
  onCaptureRow,
  onAutoSweep,
  onClear,
}) => {
  // Compute Vo vs Io points for the 7 resistive loads and linear regression!
  const pts: Array<{ ioMa: number; vo: number; label: string }> = [];
  for (let i = 0; i < 7; i++) {
    const r = rows[i];
    const vo = pNum(r.voPeak);
    if (vo !== null && r.ohms) {
      const ioMa = (vo / r.ohms) * 1000;
      pts.push({ ioMa, vo, label: r.label });
    }
  }

  let fitVoc: number | null = null;
  let fitIscMa: number | null = null;
  let fitRoKohm: number | null = null;
  if (pts.length >= 2) {
    const n = pts.length;
    const meanX = pts.reduce((s, p) => s + p.ioMa, 0) / n;
    const meanY = pts.reduce((s, p) => s + p.vo, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of pts) {
      num += (p.ioMa - meanX) * (p.vo - meanY);
      den += (p.ioMa - meanX) ** 2;
    }
    if (den > 1e-12) {
      const slope = num / den; // V / mA = -Ro (kOhm)
      const intercept = meanY - slope * meanX;
      if (slope < -1e-6 && intercept > 0) {
        fitVoc = intercept;
        fitRoKohm = -slope;
        fitIscMa = intercept / -slope;
      }
    }
  }

  const exportCsv = () => {
    const lines = ['S.No,Load Type,Load,Vs(Vpp),Vo(Vpp),Peak Vo(V),Peak Io(mA)'];
    rows.forEach((r, idx) => {
      const vp = pNum(r.voPeak);
      const io = vp !== null && r.ohms ? ((vp / r.ohms) * 1000).toFixed(4) : '—';
      lines.push(`${idx + 1},${r.loadType},${r.label},${r.vsVpp},${r.voVpp},${r.voPeak},${io}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'EC102_Exp4_Thevenin_Norton.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Plot geometry (Io: 0..0.11 mA, Vo: 0..1.1 V)
  const pW = 310;
  const pH = 156;
  const pad = { l: 38, r: 14, t: 14, b: 28 };
  const xMax = 0.11;
  const yMax = 1.1;
  const toX = (io: number) => pad.l + (io / xMax) * (pW - pad.l - pad.r);
  const toY = (vo: number) => pad.t + ((yMax - vo) / yMax) * (pH - pad.t - pad.b);

  return (
    <div className="drawer-section-stack">
      <div className="obs-toolbar">
        <span className="verify-title">Exp 4 Observation Table</span>
        <div className="obs-actions">
          <button className="btn-secondary btn-sm" onClick={onAutoSweep} title="Simulate & populate all 10 rows">
            <Sparkles size={12} /> <span>Sweep All 10</span>
          </button>
          <button className="btn-ghost btn-sm" onClick={exportCsv} title="Export CSV">
            <Download size={12} />
          </button>
          <button className="btn-ghost btn-sm" onClick={onClear} title="Clear table">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Live Vo vs Io Extrapolation Graph */}
      <div className="ref-card">
        <div className="ref-title">Step A.4: Peak Vo vs Peak Io Linear Extrapolation</div>
        <svg viewBox={`0 0 ${pW} ${pH}`} className="ref-svg">
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((v) => (
            <g key={`gy-${v}`}>
              <line x1={pad.l} y1={toY(v)} x2={pW - pad.r} y2={toY(v)} stroke="#182738" strokeWidth="1" />
              <text x={pad.l - 5} y={toY(v) + 3} textAnchor="end" fontSize="8.5" fill="#64748b" fontFamily="JetBrains Mono">
                {v.toFixed(2)}
              </text>
            </g>
          ))}
          {[0, 0.025, 0.05, 0.075, 0.1].map((io) => (
            <g key={`gx-${io}`}>
              <line x1={toX(io)} y1={pad.t} x2={toX(io)} y2={pH - pad.b} stroke="#182738" strokeWidth="1" />
              <text x={toX(io)} y={pH - pad.b + 11} textAnchor="middle" fontSize="8.5" fill="#64748b" fontFamily="JetBrains Mono">
                {io.toFixed(3)}
              </text>
            </g>
          ))}
          {/* Axes */}
          <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pH - pad.b} stroke="#475569" strokeWidth="1.4" />
          <line x1={pad.l} y1={pH - pad.b} x2={pW - pad.r} y2={pH - pad.b} stroke="#475569" strokeWidth="1.4" />
          <text x={(pad.l + pW - pad.r) / 2} y={pH - 4} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontFamily="JetBrains Mono">
            Peak Load Current Io (mA)
          </text>
          <text x={11} y={(pad.t + pH - pad.b) / 2} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontFamily="JetBrains Mono" transform={`rotate(-90 11 ${(pad.t + pH - pad.b) / 2})`}>
            Vo (V)
          </text>

          {/* Best-fit extrapolated straight line */}
          {fitVoc !== null && fitIscMa !== null && (
            <>
              <line
                x1={toX(0)}
                y1={toY(fitVoc)}
                x2={toX(fitIscMa)}
                y2={toY(0)}
                stroke="#34d399"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              {/* Intercept markers */}
              <circle cx={toX(0)} cy={toY(fitVoc)} r="4" fill="#facc15" />
              <text x={toX(0) + 6} y={toY(fitVoc) + 3} fontSize="8.5" fontWeight="700" fill="#facc15" fontFamily="JetBrains Mono">
                vOC={fitVoc.toFixed(3)}V
              </text>
              <circle cx={toX(fitIscMa)} cy={toY(0)} r="4" fill="#fb923c" />
              <text x={toX(fitIscMa)} y={toY(0) - 10} textAnchor="end" fontSize="8.2" fontWeight="700" fill="#fb923c" fontFamily="JetBrains Mono">
                iSC={fitIscMa.toFixed(3)}mA
              </text>
            </>
          )}

          {/* Data Points */}
          {pts.map((p) => (
            <circle key={p.label} cx={toX(p.ioMa)} cy={toY(p.vo)} r="3.5" fill="#22d3ee" stroke="#082f49" strokeWidth="1" />
          ))}
        </svg>
        <div className="ref-formula-row">
          <span>Extrapolated: <code>Ro = {fitRoKohm !== null ? `${fitRoKohm.toFixed(2)} kΩ` : '—'}</code></span>
          <span>Theory: <code>10.00 kΩ</code></span>
        </div>
      </div>

      <div className="obs-live-banner">
        <span>
          Live CH2: <strong className="c-ch2">Vpp {simulation.stats.ch2.vpp.toFixed(4)} V</strong> ·{' '}
          <strong className="c-ch2">Peak {simulation.stats.ch2.vmax.toFixed(4)} V</strong>
        </span>
      </div>

      <div className="ref-card">
        <table className="data-table compact-table">
          <thead>
            <tr>
              <th>Load</th>
              <th>Vo(Vpp)</th>
              <th>Peak Vo</th>
              <th>Io (mA)</th>
              <th>Cap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const vp = pNum(r.voPeak);
              const ioStr = vp !== null && r.ohms ? ((vp / r.ohms) * 1000).toFixed(4) : '—';
              return (
                <tr key={r.rowId}>
                  <td className="td-left">{r.label}</td>
                  <td>{r.voVpp || '—'}</td>
                  <td>{r.voPeak || '—'}</td>
                  <td className="c-ok">{ioStr}</td>
                  <td>
                    <button className="capture-btn" onClick={() => onCaptureRow(r.rowId)} title="Capture live DSO CH2 into this row">
                      DSO
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ==================== EXP 5 RC FILTER BODE PLOT & SWEEP TABLE ==================== */
export interface Exp5FreqRow {
  freqHz: number;
  voVpp: string;
  gain: number | null;
  dbGain: number | null;
  phaseDeg: number | null;
}

export const INITIAL_EXP5_OBS: Exp5FreqRow[] = EXP5_SWEEP_FREQS.map((f) => ({
  freqHz: f,
  voVpp: '',
  gain: null,
  dbGain: null,
  phaseDeg: null,
}));

interface Exp5ObsPanelProps {
  rows: Exp5FreqRow[];
  activeFreqHz: number;
  simulation: SimulationResult;
  onCaptureFreq: (freqHz: number) => void;
  onAutoSweepAll: () => void;
  onClear: () => void;
}

export const Exp5ObsPanel: React.FC<Exp5ObsPanelProps> = ({
  rows,
  activeFreqHz,
  simulation,
  onCaptureFreq,
  onAutoSweepAll,
  onClear,
}) => {
  const logged = rows.filter((r) => r.dbGain !== null);

  // Estimate empirical -3 dB cutoff frequency via log-linear interpolation
  let measuredFc: number | null = null;
  for (let i = 0; i < logged.length - 1; i++) {
    const a = logged[i];
    const b = logged[i + 1];
    if (a.dbGain! >= -3 && b.dbGain! <= -3) {
      const frac = (-3 - a.dbGain!) / (b.dbGain! - a.dbGain!);
      const logF = Math.log10(a.freqHz) + frac * (Math.log10(b.freqHz) - Math.log10(a.freqHz));
      measuredFc = Math.pow(10, logF);
      break;
    }
  }

  const exportCsv = () => {
    const lines = ['Frequency (Hz),Vo (Vpp),Gain A,dB Gain G (dB),Phase (deg)'];
    for (const r of rows) {
      lines.push(
        [
          r.freqHz,
          r.voVpp,
          r.gain !== null ? r.gain.toFixed(4) : '',
          r.dbGain !== null ? r.dbGain.toFixed(2) : '',
          r.phaseDeg !== null ? r.phaseDeg.toFixed(1) : '',
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'EC102_Exp5_RC_Frequency_Response.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Semilog Bode plot geometry: f in [100, 10000] (2 decades), G in [-20, +2] dB
  const pW = 310;
  const pH = 160;
  const pad = { l: 36, r: 12, t: 14, b: 28 };
  const logMin = Math.log10(100);
  const logMax = Math.log10(10000);
  const dbMax = 2;
  const dbMin = -20;

  const toX = (f: number) =>
    pad.l + ((Math.log10(f) - logMin) / (logMax - logMin)) * (pW - pad.l - pad.r);
  const toY = (db: number) =>
    pad.t + ((dbMax - Math.max(dbMin, Math.min(dbMax, db))) / (dbMax - dbMin)) * (pH - pad.t - pad.b);

  const semilogTicks = [100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000];

  return (
    <div className="drawer-section-stack">
      <div className="obs-toolbar">
        <span className="verify-title">Exp 5 Semilog Bode & Sweep</span>
        <div className="obs-actions">
          <button className="btn-secondary btn-sm" onClick={onAutoSweepAll} title="Simulate all 11 frequencies in the 1-2-5 sequence">
            <Sparkles size={12} /> <span>Sweep 11 Freqs</span>
          </button>
          <button className="btn-ghost btn-sm" onClick={exportCsv} title="Export CSV">
            <Download size={12} />
          </button>
          <button className="btn-ghost btn-sm" onClick={onClear} title="Clear table">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Live Semilog Bode Plot */}
      <div className="ref-card">
        <div className="ref-title">Fig. 5.3 Semilog Frequency Response — G(dB) vs f</div>
        <svg viewBox={`0 0 ${pW} ${pH}`} className="ref-svg">
          {/* Semilog vertical decade lines */}
          {semilogTicks.map((f) => {
            const major = f === 100 || f === 1000 || f === 10000;
            return (
              <g key={`ft-${f}`}>
                <line
                  x1={toX(f)}
                  y1={pad.t}
                  x2={toX(f)}
                  y2={pH - pad.b}
                  stroke={major ? '#2c425a' : '#142030'}
                  strokeWidth={major ? 1.2 : 0.8}
                />
                {(major || f === 200 || f === 500 || f === 2000 || f === 5000) && (
                  <text x={toX(f)} y={pH - pad.b + 11} textAnchor="middle" fontSize="7.8" fill="#64748b" fontFamily="JetBrains Mono">
                    {f >= 1000 ? `${f / 1000}k` : f}
                  </text>
                )}
              </g>
            );
          })}

          {/* Horizontal dB lines */}
          {[0, -3, -6, -10, -15, -20].map((db) => (
            <g key={`db-${db}`}>
              <line
                x1={pad.l}
                y1={toY(db)}
                x2={pW - pad.r}
                y2={toY(db)}
                stroke={db === -3 ? '#fb923c' : db === 0 ? '#334155' : '#152232'}
                strokeDasharray={db === -3 ? '4 3' : undefined}
                strokeWidth={db === -3 ? 1.2 : 1}
              />
              <text x={pad.l - 5} y={toY(db) + 3} textAnchor="end" fontSize="8" fill={db === -3 ? '#fb923c' : '#64748b'} fontFamily="JetBrains Mono">
                {db}
              </text>
            </g>
          ))}

          <text x={(pad.l + pW - pad.r) / 2} y={pH - 4} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontFamily="JetBrains Mono">
            Frequency f (Hz, log scale)
          </text>
          <text x={10} y={(pad.t + pH - pad.b) / 2} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontFamily="JetBrains Mono" transform={`rotate(-90 10 ${(pad.t + pH - pad.b) / 2})`}>
            G (dB)
          </text>

          {/* Theoretical curve faint guide */}
          <polyline
            fill="none"
            stroke="rgba(148,163,184,0.28)"
            strokeWidth="1.2"
            points={Array.from({ length: 45 }, (_, i) => {
              const f = Math.pow(10, logMin + (i / 44) * (logMax - logMin));
              const db = -10 * Math.log10(1 + (f / EXP5_THEORY.fcHz) ** 2);
              return `${toX(f).toFixed(1)},${toY(db).toFixed(1)}`;
            }).join(' ')}
          />

          {/* Plotted empirical curve */}
          {logged.length >= 2 && (
            <polyline
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2.1"
              points={logged.map((r) => `${toX(r.freqHz).toFixed(1)},${toY(r.dbGain!).toFixed(1)}`).join(' ')}
            />
          )}

          {/* Cutoff marker fc */}
          {measuredFc !== null && (
            <>
              <line x1={toX(measuredFc)} y1={toY(-3)} x2={toX(measuredFc)} y2={pH - pad.b} stroke="#fb923c" strokeDasharray="3 2" strokeWidth="1.3" />
              <circle cx={toX(measuredFc)} cy={toY(-3)} r="4" fill="#fb923c" />
              <text x={toX(measuredFc) + 5} y={toY(-3) - 5} fontSize="8.5" fontWeight="700" fill="#fb923c" fontFamily="JetBrains Mono">
                fc={(measuredFc / 1000).toFixed(2)}kHz
              </text>
            </>
          )}

          {logged.map((r) => (
            <circle key={r.freqHz} cx={toX(r.freqHz)} cy={toY(r.dbGain!)} r="3.2" fill="#34d399" stroke="#022c22" strokeWidth="1" />
          ))}
        </svg>
        <div className="ref-formula-row">
          <span>Measured fc: <code>{measuredFc ? `${measuredFc.toFixed(0)} Hz` : '—'}</code></span>
          <span>Theory: <code>1447 Hz</code></span>
        </div>
      </div>

      {/* Live Step / Sine Metrics */}
      <div className="obs-live-banner">
        <span>
          {simulation.riseTimeSec !== null
            ? `Step Mode: tr = ${(simulation.riseTimeSec * 1e6).toFixed(1)} µs · tf = ${((simulation.fallTimeSec ?? 0) * 1e6).toFixed(1)} µs`
            : `Sine @ ${activeFreqHz} Hz: Vo = ${simulation.stats.ch2.vpp.toFixed(3)} Vpp · A = ${simulation.gain.toFixed(3)} · Δφ = ${simulation.phaseDiffDeg?.toFixed(1) ?? '—'}°`}
        </span>
      </div>

      <div className="ref-card">
        <table className="data-table compact-table">
          <thead>
            <tr>
              <th>f (Hz)</th>
              <th>Vo(pp)</th>
              <th>Gain A</th>
              <th>G (dB)</th>
              <th>Cap</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.freqHz} className={Math.abs(activeFreqHz - r.freqHz) < 1 ? 'row-active' : ''}>
                <td className="td-left">{r.freqHz >= 1000 ? `${r.freqHz / 1000} kHz` : `${r.freqHz} Hz`}</td>
                <td>{r.voVpp || '—'}</td>
                <td>{r.gain !== null ? r.gain.toFixed(3) : '—'}</td>
                <td className={r.dbGain !== null && Math.abs(r.dbGain + 3) < 0.7 ? 'c-x2' : 'c-ok'}>
                  {r.dbGain !== null ? r.dbGain.toFixed(2) : '—'}
                </td>
                <td>
                  <button className="capture-btn" onClick={() => onCaptureFreq(r.freqHz)} title="Capture current DSO sine reading">
                    DSO
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
