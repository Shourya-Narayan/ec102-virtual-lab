import React, { useState } from 'react';
import type { VerificationResult } from '../../engine/types';
import {
  EXP2_PROCEDURE_STEPS,
  EXP2_QUIZ_QUESTIONS,
  EXP2_VIVA_CARDS,
} from '../../experiments/exp2Kirchhoff';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Crosshair,
  Download,
  HelpCircle,
  Sparkles,
  Table2,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

export type ObsField = 'va' | 'vab' | 'vac' | 'vc' | 'vd';
export type ObsRowKey = 't1' | 't2';
export type ObsModeKey = 'manual' | 'track';

export interface ObsRowData {
  va: string;
  vab: string;
  vac: string;
  vc: string;
  vd: string;
}

export interface ObservationStore {
  manual: Record<ObsRowKey, ObsRowData>;
  track: Record<ObsRowKey, ObsRowData>;
}

export const EMPTY_OBS_ROW: ObsRowData = {
  va: '',
  vab: '',
  vac: '',
  vc: '',
  vd: '',
};

export const INITIAL_OBSERVATIONS: ObservationStore = {
  manual: { t1: { ...EMPTY_OBS_ROW }, t2: { ...EMPTY_OBS_ROW } },
  track: { t1: { ...EMPTY_OBS_ROW }, t2: { ...EMPTY_OBS_ROW } },
};

export type CompanionTab = 'procedure' | 'table' | 'quiz';

interface LabCompanionDrawerProps {
  open: boolean;
  activeTab: CompanionTab;
  onTabChange: (tab: CompanionTab) => void;
  onClose: () => void;
  verification: VerificationResult;
  observations: ObservationStore;
  effectiveY2: number;
  cursorX2Ms: number;
  cursorMode: 'off' | 'manual' | 'track';
  onUpdateObs: (mode: ObsModeKey, row: ObsRowKey, field: ObsField, value: string) => void;
  onCaptureObs: (mode: ObsModeKey, row: ObsRowKey, field: ObsField) => void;
  onAutoFillExactTrack: () => void;
  onClearObs: (mode: ObsModeKey) => void;
}

function parseNum(s: string): number | null {
  if (s.trim() === '') return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function computeChecks(row: ObsRowData): { kcl: number | null; kvl: number | null } {
  const va = parseNum(row.va);
  const vab = parseNum(row.vab);
  const vac = parseNum(row.vac);
  const vc = parseNum(row.vc);
  const vd = parseNum(row.vd);
  return {
    kcl: vab !== null && vc !== null && vd !== null ? vab - vc - vd : null,
    kvl: va !== null && vac !== null && vc !== null ? va - vac - vc : null,
  };
}

const OBS_FIELDS: Array<{ key: ObsField; label: string; tip: string }> = [
  { key: 'va', label: 'va', tip: 'CH1 at node a' },
  { key: 'vab', label: 'vab', tip: 'Math (CH1−CH2) with CH2 on b' },
  { key: 'vac', label: 'vac', tip: 'Math (CH1−CH2) with CH2 on c' },
  { key: 'vc', label: 'vc', tip: 'CH2 on node c' },
  { key: 'vd', label: 'vd', tip: 'CH2 on node d' },
];

export const LabCompanionDrawer: React.FC<LabCompanionDrawerProps> = ({
  open,
  activeTab,
  onTabChange,
  onClose,
  verification,
  observations,
  effectiveY2,
  cursorX2Ms,
  cursorMode,
  onUpdateObs,
  onCaptureObs,
  onAutoFillExactTrack,
  onClearObs,
}) => {
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [obsMode, setObsMode] = useState<ObsModeKey>('track');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [openViva, setOpenViva] = useState<Record<number, boolean>>({ 1: true });

  if (!open) return null;

  const toggleStep = (id: string) =>
    setCheckedSteps((prev) => ({ ...prev, [id]: !prev[id] }));

  const exportCsv = () => {
    const lines = [
      'Mode,Time,va (V),vab (V),vac (V),vc (V),vd (V),KCL (vab-vc-vd),KVL (va-vac-vc)',
    ];
    for (const mode of ['manual', 'track'] as ObsModeKey[]) {
      for (const rk of ['t1', 't2'] as ObsRowKey[]) {
        const row = observations[mode][rk];
        const { kcl, kvl } = computeChecks(row);
        const tLabel = rk === 't1' ? 't1 (-0.4 ms)' : 't2 (+0.3 ms)';
        lines.push(
          [
            mode.toUpperCase(),
            tLabel,
            row.va,
            row.vab,
            row.vac,
            row.vc,
            row.vd,
            kcl !== null ? kcl.toFixed(4) : '',
            kvl !== null ? kvl.toFixed(4) : '',
          ].join(',')
        );
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'EC102_Exp2_Kirchhoff_Observations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const quizScore = EXP2_QUIZ_QUESTIONS.reduce(
    (acc, q) => acc + (quizAnswers[q.id] === q.correctIndex ? 1 : 0),
    0
  );
  const quizAnsweredCount = Object.keys(quizAnswers).length;

  const activeRows = observations[obsMode];
  const mT1 = computeChecks(observations.manual.t1);
  const mT2 = computeChecks(observations.manual.t2);
  const trT1 = computeChecks(observations.track.t1);
  const trT2 = computeChecks(observations.track.t2);

  return (
    <aside className="companion-drawer" aria-label="Experiment 2 Lab Companion">
      <div className="drawer-header">
        <div className="drawer-tabs">
          <button
            className={`drawer-tab ${activeTab === 'procedure' ? 'active' : ''}`}
            onClick={() => onTabChange('procedure')}
          >
            <ClipboardCheck size={14} />
            <span>Guide & Check</span>
          </button>
          <button
            className={`drawer-tab ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => onTabChange('table')}
          >
            <Table2 size={14} />
            <span>Obs Table</span>
          </button>
          <button
            className={`drawer-tab ${activeTab === 'quiz' ? 'active' : ''}`}
            onClick={() => onTabChange('quiz')}
          >
            <HelpCircle size={14} />
            <span>Quiz & Viva</span>
          </button>
        </div>
        <button className="btn-ghost btn-sm" onClick={onClose} title="Close drawer">
          <X size={15} />
        </button>
      </div>

      <div className="drawer-body">
        {/* TAB 1: PROCEDURE & BREADBOARD CHECKER */}
        {activeTab === 'procedure' && (
          <div className="drawer-section-stack">
            {/* Live Breadboard Topology Verifier */}
            <div className={`verify-card ${verification.allPassed ? 'passed' : 'pending'}`}>
              <div className="verify-header">
                <div>
                  <div className="verify-title">Verify My Breadboard</div>
                  <div className="verify-sub">
                    Live electrical netlist check against Fig. 2.1
                  </div>
                </div>
                <span className={`score-badge ${verification.allPassed ? 'ok' : 'warn'}`}>
                  {verification.score}/{verification.total}
                </span>
              </div>
              <div className="verify-list">
                {verification.items.map((item) => (
                  <div key={item.id} className={`verify-row ${item.passed ? 'ok' : 'fail'}`}>
                    {item.passed ? (
                      <CheckCircle2 size={14} className="v-icon ok" />
                    ) : (
                      <XCircle size={14} className="v-icon fail" />
                    )}
                    <div>
                      <div className="v-label">{item.label}</div>
                      <div className="v-detail">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Crisp Fig 2.1 Schematic Reference */}
            <div className="ref-card">
              <div className="ref-title">
                <BookOpen size={13} /> Fig. 2.1 Reference Schematic (R₁ = R₂ = R₃ = 1 kΩ)
              </div>
              <svg viewBox="0 0 360 125" className="ref-svg">
                {/* Ground rail */}
                <line x1="36" y1="104" x2="318" y2="104" stroke="#64748b" strokeWidth="1.6" />
                {/* Ground symbol */}
                <line x1="176" y1="104" x2="176" y2="112" stroke="#64748b" strokeWidth="1.6" />
                <line x1="165" y1="112" x2="187" y2="112" stroke="#64748b" strokeWidth="1.6" />
                <line x1="170" y1="117" x2="182" y2="117" stroke="#64748b" strokeWidth="1.4" />
                <line x1="174" y1="121" x2="178" y2="121" stroke="#64748b" strokeWidth="1.2" />

                {/* Source va */}
                <line x1="36" y1="30" x2="36" y2="50" stroke="#e2e8f0" strokeWidth="1.6" />
                <circle cx="36" cy="67" r="17" fill="#0f172a" stroke="#facc15" strokeWidth="1.8" />
                <text x="36" y="63" textAnchor="middle" fontSize="11" fill="#facc15" fontWeight="700">+</text>
                <text x="36" y="77" textAnchor="middle" fontSize="12" fill="#94a3b8" fontWeight="700">−</text>
                <text x="14" y="71" textAnchor="middle" fontSize="10" fill="#facc15" fontFamily="JetBrains Mono">va</text>
                <line x1="36" y1="84" x2="36" y2="104" stroke="#e2e8f0" strokeWidth="1.6" />

                {/* Top wire a -> R1 -> b -> D -> c -> C -> d */}
                <line x1="36" y1="30" x2="64" y2="30" stroke="#e2e8f0" strokeWidth="1.6" />
                {/* R1 zigzag */}
                <polyline
                  points="64,30 69,22 77,38 85,22 93,38 101,22 106,30"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="1.8"
                />
                <text x="85" y="16" textAnchor="middle" fontSize="9.5" fill="#93c5fd" fontFamily="JetBrains Mono">R1 1kΩ</text>
                <line x1="106" y1="30" x2="146" y2="30" stroke="#e2e8f0" strokeWidth="1.6" />

                {/* Diode D (b -> c) */}
                <polygon points="146,21 146,39 164,30" fill="#e2e8f0" />
                <line x1="164" y1="21" x2="164" y2="39" stroke="#e2e8f0" strokeWidth="2.2" />
                <text x="155" y="15" textAnchor="middle" fontSize="9.5" fill="#e2e8f0" fontFamily="JetBrains Mono">D 1N4007</text>

                {/* Node c junction */}
                <line x1="164" y1="30" x2="246" y2="30" stroke="#e2e8f0" strokeWidth="1.6" />
                {/* Capacitor C */}
                <line x1="246" y1="19" x2="246" y2="41" stroke="#f59e0b" strokeWidth="2.4" />
                <line x1="255" y1="19" x2="255" y2="41" stroke="#f59e0b" strokeWidth="2.4" />
                <text x="250" y="14" textAnchor="middle" fontSize="9.5" fill="#fcd34d" fontFamily="JetBrains Mono">C 0.1µF</text>
                <line x1="255" y1="30" x2="318" y2="30" stroke="#e2e8f0" strokeWidth="1.6" />

                {/* Branch R2 at node c (x=204) */}
                <line x1="204" y1="30" x2="204" y2="48" stroke="#e2e8f0" strokeWidth="1.6" />
                <polyline
                  points="204,48 196,53 212,61 196,69 212,77 196,85 204,90"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="1.8"
                />
                <line x1="204" y1="90" x2="204" y2="104" stroke="#e2e8f0" strokeWidth="1.6" />
                <text x="180" y="72" textAnchor="middle" fontSize="9.5" fill="#93c5fd" fontFamily="JetBrains Mono">R2</text>

                {/* Branch R3 at node d (x=318) */}
                <line x1="318" y1="30" x2="318" y2="48" stroke="#e2e8f0" strokeWidth="1.6" />
                <polyline
                  points="318,48 310,53 326,61 310,69 326,77 310,85 318,90"
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth="1.8"
                />
                <line x1="318" y1="90" x2="318" y2="104" stroke="#e2e8f0" strokeWidth="1.6" />
                <text x="342" y="72" textAnchor="middle" fontSize="9.5" fill="#93c5fd" fontFamily="JetBrains Mono">R3</text>

                {/* Node dots & labels a, b, c, d */}
                {[
                  { x: 46, lbl: 'a', color: '#facc15' },
                  { x: 124, lbl: 'b', color: '#22d3ee' },
                  { x: 204, lbl: 'c', color: '#34d399' },
                  { x: 318, lbl: 'd', color: '#fb923c' },
                ].map((n) => (
                  <g key={n.lbl}>
                    <circle cx={n.x} cy="30" r="3.5" fill={n.color} />
                    <text
                      x={n.x}
                      y="46"
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="700"
                      fill={n.color}
                      fontFamily="JetBrains Mono"
                    >
                      {n.lbl}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="ref-formula-row">
                <span>KCL (Node c): <code>vab − vc − vd = 0</code></span>
                <span>KVL (Loop): <code>va − vac − vc = 0</code></span>
              </div>
            </div>

            {/* Step-by-step Procedure Checklist */}
            <div className="proc-card">
              <div className="proc-header">
                <span>IIIT Bhagalpur Procedure</span>
                <span className="mono-muted">
                  {Object.values(checkedSteps).filter(Boolean).length}/{EXP2_PROCEDURE_STEPS.length} done
                </span>
              </div>
              <div className="proc-list">
                {EXP2_PROCEDURE_STEPS.map((step, idx) => {
                  const done = !!checkedSteps[step.id];
                  return (
                    <label key={step.id} className={`proc-item ${done ? 'done' : ''}`}>
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleStep(step.id)}
                      />
                      <div>
                        <div className="proc-step-title">
                          <span className={`proc-tag tag-${step.section}`}>{step.section}</span>
                          {idx + 1}. {step.title}
                        </div>
                        <div className="proc-step-desc">{step.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OBSERVATION TABLE */}
        {activeTab === 'table' && (
          <div className="drawer-section-stack">
            <div className="obs-toolbar">
              <div className="seg-group compact">
                <button
                  className={`seg-btn ${obsMode === 'manual' ? 'active' : ''}`}
                  onClick={() => setObsMode('manual')}
                >
                  Manual Mode
                </button>
                <button
                  className={`seg-btn ${obsMode === 'track' ? 'active' : ''}`}
                  onClick={() => setObsMode('track')}
                >
                  Track Mode
                </button>
              </div>
              <div className="obs-actions">
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    setObsMode('track');
                    onAutoFillExactTrack();
                  }}
                  title="Compute exact ideal Track readings from the live circuit solver"
                >
                  <Sparkles size={12} />
                  <span>Exact Track</span>
                </button>
                <button
                  className="btn-ghost btn-sm"
                  onClick={exportCsv}
                  title="Download CSV for lab record"
                >
                  <Download size={12} />
                  <span>CSV</span>
                </button>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => onClearObs(obsMode)}
                  title="Clear current mode rows"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <div className="obs-live-banner">
              <Crosshair size={13} />
              <span>
                DSO Live ({cursorMode.toUpperCase()}): <strong>X2 = {cursorX2Ms.toFixed(3)} ms</strong> ·{' '}
                <strong className="c-x2">Y2 = {effectiveY2.toFixed(3)} V</strong> — click{' '}
                <code>Y2</code> on any cell to log
              </span>
            </div>

            {/* Observation Cards for t1 and t2 */}
            {(['t1', 't2'] as ObsRowKey[]).map((rowKey) => {
              const row = activeRows[rowKey];
              const { kcl, kvl } = computeChecks(row);
              const tTitle = rowKey === 't1' ? 't₁ = −0.4 ms' : 't₂ = +0.3 ms';

              return (
                <div key={rowKey} className="obs-row-card">
                  <div className="obs-row-header">
                    <span className="obs-time-badge">{tTitle}</span>
                    <span className="mono-muted">
                      {obsMode === 'manual' ? 'Manual Cursors' : 'Track Waveform'}
                    </span>
                  </div>

                  <div className="obs-fields-grid">
                    {OBS_FIELDS.map((f) => (
                      <div key={f.key} className="obs-field">
                        <div className="obs-field-top">
                          <span className="obs-sym">{f.label}</span>
                          <button
                            className="capture-btn"
                            onClick={() => onCaptureObs(obsMode, rowKey, f.key)}
                            title={`Capture current DSO Y2 (${effectiveY2.toFixed(3)} V) into ${f.label} (${f.tip})`}
                          >
                            Y2
                          </button>
                        </div>
                        <input
                          type="number"
                          step="0.001"
                          placeholder="0.000"
                          className="obs-input"
                          value={row[f.key]}
                          onChange={(e) => onUpdateObs(obsMode, rowKey, f.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Auto-Calculated KCL & KVL Verification Row */}
                  <div className="obs-verify-strip">
                    <div className="obs-sum">
                      <span className="sum-lbl">KCL (vab − vc − vd):</span>
                      <span
                        className={`sum-val ${
                          kcl === null ? '' : Math.abs(kcl) < 0.02 ? 'ok' : 'warn'
                        }`}
                      >
                        {kcl !== null ? `${kcl >= 0 ? '+' : ''}${kcl.toFixed(4)} V` : '—'}
                      </span>
                    </div>
                    <div className="obs-sum">
                      <span className="sum-lbl">KVL (va − vac − vc):</span>
                      <span
                        className={`sum-val ${
                          kvl === null ? '' : Math.abs(kvl) < 0.02 ? 'ok' : 'warn'
                        }`}
                      >
                        {kvl !== null ? `${kvl >= 0 ? '+' : ''}${kvl.toFixed(4)} V` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Manual vs Track Comparison Summary (Steps 14 & 15) */}
            <div className="ref-card">
              <div className="ref-title">Steps 14–15: Manual vs Track Error Summary</div>
              <table className="mini-compare-table">
                <thead>
                  <tr>
                    <th>Instant</th>
                    <th>Manual |KCL|</th>
                    <th>Track |KCL|</th>
                    <th>Manual |KVL|</th>
                    <th>Track |KVL|</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>t₁ (−0.4 ms)</td>
                    <td>{mT1.kcl !== null ? `${Math.abs(mT1.kcl).toFixed(4)}V` : '—'}</td>
                    <td className="c-ok">{trT1.kcl !== null ? `${Math.abs(trT1.kcl).toFixed(4)}V` : '—'}</td>
                    <td>{mT1.kvl !== null ? `${Math.abs(mT1.kvl).toFixed(4)}V` : '—'}</td>
                    <td className="c-ok">{trT1.kvl !== null ? `${Math.abs(trT1.kvl).toFixed(4)}V` : '—'}</td>
                  </tr>
                  <tr>
                    <td>t₂ (+0.3 ms)</td>
                    <td>{mT2.kcl !== null ? `${Math.abs(mT2.kcl).toFixed(4)}V` : '—'}</td>
                    <td className="c-ok">{trT2.kcl !== null ? `${Math.abs(trT2.kcl).toFixed(4)}V` : '—'}</td>
                    <td>{mT2.kvl !== null ? `${Math.abs(mT2.kvl).toFixed(4)}V` : '—'}</td>
                    <td className="c-ok">{trT2.kvl !== null ? `${Math.abs(trT2.kvl).toFixed(4)}V` : '—'}</td>
                  </tr>
                </tbody>
              </table>
              <p className="compare-note">
                Track Waveform Mode eliminates Manual Y2 eye-estimation error, driving KCL & KVL
                residuals cleanly toward 0.0000 V.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: LAB QUIZ & VIVA Q&A */}
        {activeTab === 'quiz' && (
          <div className="drawer-section-stack">
            <div className="quiz-score-bar">
              <div className="quiz-score-left">
                <Award size={15} className="c-ch1" />
                <span>Experiment 2 Official Lab Quiz (5 MCQs)</span>
              </div>
              <span className="score-badge ok">
                {quizScore}/{EXP2_QUIZ_QUESTIONS.length}
                {quizAnsweredCount < EXP2_QUIZ_QUESTIONS.length ? ` (${quizAnsweredCount} ans)` : ''}
              </span>
            </div>

            {EXP2_QUIZ_QUESTIONS.map((q) => {
              const picked = quizAnswers[q.id];
              const isAnswered = picked !== undefined;
              return (
                <div key={q.id} className="quiz-card">
                  <div className="quiz-q">
                    Q{q.id}. {q.question}
                  </div>

                  {/* Official Fig. 3 KCL Node Diagram for Question 4 */}
                  {q.hasFigure3 && (
                    <svg viewBox="0 0 280 120" className="fig3-svg">
                      <defs>
                        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                        </marker>
                      </defs>
                      {/* Node center at (130, 56) */}
                      {/* I entering from top-left */}
                      <line x1="56" y1="24" x2="124" y2="53" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#arr)" />
                      <text x="82" y="28" fontSize="11" fontWeight="700" fill="#facc15" fontFamily="JetBrains Mono">I</text>
                      {/* 3A entering from bottom-left */}
                      <line x1="90" y1="96" x2="126" y2="61" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#arr)" />
                      <text x="92" y="79" fontSize="10.5" fill="#e2e8f0" fontFamily="JetBrains Mono">3A</text>
                      {/* 2A leaving to left-down */}
                      <line x1="130" y1="56" x2="46" y2="86" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#arr)" />
                      <text x="68" y="68" fontSize="10.5" fill="#e2e8f0" fontFamily="JetBrains Mono">2A</text>
                      {/* 5A leaving to top-right */}
                      <line x1="130" y1="56" x2="232" y2="16" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#arr)" />
                      <text x="174" y="34" fontSize="10.5" fill="#e2e8f0" fontFamily="JetBrains Mono">5A</text>
                      {/* 4A leaving to bottom-right */}
                      <line x1="130" y1="56" x2="182" y2="108" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#arr)" />
                      <text x="167" y="84" fontSize="10.5" fill="#e2e8f0" fontFamily="JetBrains Mono">4A</text>
                      <circle cx="130" cy="56" r="4" fill="#facc15" />
                      <text x="130" y="116" textAnchor="middle" fontSize="9.5" fill="#94a3b8" fontFamily="JetBrains Mono">Fig. 3</text>
                    </svg>
                  )}

                  <div className="quiz-opts">
                    {q.options.map((opt, idx) => {
                      const letter = String.fromCharCode(97 + idx);
                      let cls = 'quiz-opt';
                      if (isAnswered) {
                        if (idx === q.correctIndex) cls += ' correct';
                        else if (idx === picked) cls += ' wrong';
                      }
                      return (
                        <button
                          key={opt}
                          className={cls}
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                        >
                          <span className="opt-letter">{letter})</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {isAnswered && <div className="quiz-exp">{q.explanation}</div>}
                </div>
              );
            })}

            {/* High-Yield EC102 Viva Q&A */}
            <div className="viva-header">
              <span>High-Yield Viva Q&A (Exp 2)</span>
              <span className="mono-muted">{EXP2_VIVA_CARDS.length} cards</span>
            </div>

            {EXP2_VIVA_CARDS.map((card) => {
              const expanded = !!openViva[card.id];
              return (
                <div key={card.id} className="viva-card">
                  <button
                    className="viva-q-btn"
                    onClick={() =>
                      setOpenViva((prev) => ({ ...prev, [card.id]: !prev[card.id] }))
                    }
                  >
                    <div className="viva-q-text">
                      <span className="viva-tag">{card.tag}</span>
                      <span>{card.question}</span>
                    </div>
                    {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                  {expanded && <div className="viva-a">{card.answer}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
