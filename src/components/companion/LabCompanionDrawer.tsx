import React, { useState } from 'react';
import type { ExperimentId, SimulationResult, VerificationResult } from '../../engine/types';
import {
  EXP2_PROCEDURE_STEPS,
  EXP2_QUIZ_QUESTIONS,
  EXP2_VIVA_CARDS,
  type ProcedureStep,
  type QuizQuestion,
  type VivaCard,
} from '../../experiments/exp2Kirchhoff';
import {
  EXP3_PROCEDURE_STEPS,
  EXP3_QUIZ_QUESTIONS,
  EXP3_VIVA_CARDS,
  type Exp3CircuitVariant,
  type Exp3SourceCondition,
} from '../../experiments/exp3Superposition';
import {
  EXP4_PROCEDURE_STEPS,
  EXP4_QUIZ_QUESTIONS,
  EXP4_VIVA_CARDS,
} from '../../experiments/exp4Thevenin';
import {
  EXP5_PROCEDURE_STEPS,
  EXP5_QUIZ_QUESTIONS,
  EXP5_VIVA_CARDS,
} from '../../experiments/exp5RcFilter';
import {
  Exp3ObsPanel,
  Exp4ObsPanel,
  Exp5ObsPanel,
  type Exp3ObsStore,
  type Exp4ObsRow,
  type Exp5FreqRow,
} from './ExperimentObsPanels';
import { ExperimentSchematic } from './ExperimentSchematics';
import {
  Award,
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
  experimentId: ExperimentId;
  open: boolean;
  activeTab: CompanionTab;
  onTabChange: (tab: CompanionTab) => void;
  onClose: () => void;
  verification: VerificationResult;
  simulation: SimulationResult;
  activeFreqHz: number;
  // Exp 2
  observations: ObservationStore;
  effectiveY2: number;
  cursorX2Ms: number;
  cursorMode: 'off' | 'manual' | 'track';
  onUpdateObs: (mode: ObsModeKey, row: ObsRowKey, field: ObsField, value: string) => void;
  onCaptureObs: (mode: ObsModeKey, row: ObsRowKey, field: ObsField) => void;
  onAutoFillExactTrack: () => void;
  onClearObs: (mode: ObsModeKey) => void;
  // Exp 3
  exp3Variant: Exp3CircuitVariant;
  exp3Obs: Exp3ObsStore;
  onUpdateExp3Obs: (variant: Exp3CircuitVariant, cond: Exp3SourceCondition, min: string, max: string) => void;
  onAutoFillExp3: (variant: Exp3CircuitVariant) => void;
  onClearExp3: (variant: Exp3CircuitVariant) => void;
  // Exp 4
  exp4Obs: Exp4ObsRow[];
  onCaptureExp4Row: (rowId: string) => void;
  onAutoSweepExp4: () => void;
  onClearExp4: () => void;
  // Exp 5
  exp5Obs: Exp5FreqRow[];
  onCaptureExp5Freq: (freqHz: number) => void;
  onAutoSweepExp5: () => void;
  onClearExp5: () => void;
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

const EXP_CONTENT: Record<
  ExperimentId,
  {
    shortName: string;
    steps: ProcedureStep[];
    quiz: QuizQuestion[];
    viva: VivaCard[];
  }
> = {
  exp2: {
    shortName: 'Experiment 2',
    steps: EXP2_PROCEDURE_STEPS,
    quiz: EXP2_QUIZ_QUESTIONS,
    viva: EXP2_VIVA_CARDS,
  },
  exp3: {
    shortName: 'Experiment 3',
    steps: EXP3_PROCEDURE_STEPS,
    quiz: EXP3_QUIZ_QUESTIONS,
    viva: EXP3_VIVA_CARDS,
  },
  exp4: {
    shortName: 'Experiment 4',
    steps: EXP4_PROCEDURE_STEPS,
    quiz: EXP4_QUIZ_QUESTIONS,
    viva: EXP4_VIVA_CARDS,
  },
  exp5: {
    shortName: 'Experiment 5',
    steps: EXP5_PROCEDURE_STEPS,
    quiz: EXP5_QUIZ_QUESTIONS,
    viva: EXP5_VIVA_CARDS,
  },
};

export const LabCompanionDrawer: React.FC<LabCompanionDrawerProps> = ({
  experimentId,
  open,
  activeTab,
  onTabChange,
  onClose,
  verification,
  simulation,
  activeFreqHz,
  observations,
  effectiveY2,
  cursorX2Ms,
  cursorMode,
  onUpdateObs,
  onCaptureObs,
  onAutoFillExactTrack,
  onClearObs,
  exp3Variant,
  exp3Obs,
  onUpdateExp3Obs,
  onAutoFillExp3,
  onClearExp3,
  exp4Obs,
  onCaptureExp4Row,
  onAutoSweepExp4,
  onClearExp4,
  exp5Obs,
  onCaptureExp5Freq,
  onAutoSweepExp5,
  onClearExp5,
}) => {
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [obsMode, setObsMode] = useState<ObsModeKey>('track');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [openViva, setOpenViva] = useState<Record<string, boolean>>({ 'exp2-1': true, 'exp3-1': true, 'exp4-1': true, 'exp5-1': true });

  if (!open) return null;

  const content = EXP_CONTENT[experimentId];

  const toggleStep = (id: string) =>
    setCheckedSteps((prev) => ({ ...prev, [id]: !prev[id] }));

  const exportExp2Csv = () => {
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

  const quizScore = content.quiz.reduce(
    (acc, q) => acc + (quizAnswers[`${experimentId}-${q.id}`] === q.correctIndex ? 1 : 0),
    0
  );
  const quizAnsweredCount = content.quiz.filter(
    (q) => quizAnswers[`${experimentId}-${q.id}`] !== undefined
  ).length;

  const activeRows = observations[obsMode];
  const mT1 = computeChecks(observations.manual.t1);
  const mT2 = computeChecks(observations.manual.t2);
  const trT1 = computeChecks(observations.track.t1);
  const trT2 = computeChecks(observations.track.t2);

  return (
    <aside className="companion-drawer" aria-label="Lab Companion">
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
            <span>{experimentId === 'exp4' || experimentId === 'exp5' ? 'Table & Plot' : 'Obs Table'}</span>
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
        {/* TAB 1: PROCEDURE & LIVE CIRCUIT CHECKER */}
        {activeTab === 'procedure' && (
          <div className="drawer-section-stack">
            <div className={`verify-card ${verification.allPassed ? 'passed' : 'pending'}`}>
              <div className="verify-header">
                <div>
                  <div className="verify-title">Verify My Breadboard</div>
                  <div className="verify-sub">Live electrical netlist check ({content.shortName})</div>
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

            <ExperimentSchematic experimentId={experimentId} />

            <div className="proc-card">
              <div className="proc-header">
                <span>IIIT Bhagalpur Procedure</span>
                <span className="mono-muted">
                  {content.steps.filter((s) => checkedSteps[s.id]).length}/{content.steps.length} done
                </span>
              </div>
              <div className="proc-list">
                {content.steps.map((step, idx) => {
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

        {/* TAB 2: OBSERVATION TABLES & LIVE PLOTS */}
        {activeTab === 'table' && experimentId === 'exp2' && (
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
                >
                  <Sparkles size={12} />
                  <span>Exact Track</span>
                </button>
                <button className="btn-ghost btn-sm" onClick={exportExp2Csv} title="Download CSV">
                  <Download size={12} />
                  <span>CSV</span>
                </button>
                <button className="btn-ghost btn-sm" onClick={() => onClearObs(obsMode)} title="Clear">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <div className="obs-live-banner">
              <Crosshair size={13} />
              <span>
                DSO ({cursorMode.toUpperCase()}): <strong>X2 = {cursorX2Ms.toFixed(3)} ms</strong> ·{' '}
                <strong className="c-x2">Y2 = {effectiveY2.toFixed(3)} V</strong>
              </span>
            </div>

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
                            title={`Capture Y2 (${effectiveY2.toFixed(3)} V) into ${f.label}`}
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

                  <div className="obs-verify-strip">
                    <div className="obs-sum">
                      <span className="sum-lbl">KCL (vab − vc − vd):</span>
                      <span className={`sum-val ${kcl === null ? '' : Math.abs(kcl) < 0.02 ? 'ok' : 'warn'}`}>
                        {kcl !== null ? `${kcl >= 0 ? '+' : ''}${kcl.toFixed(4)} V` : '—'}
                      </span>
                    </div>
                    <div className="obs-sum">
                      <span className="sum-lbl">KVL (va − vac − vc):</span>
                      <span className={`sum-val ${kvl === null ? '' : Math.abs(kvl) < 0.02 ? 'ok' : 'warn'}`}>
                        {kvl !== null ? `${kvl >= 0 ? '+' : ''}${kvl.toFixed(4)} V` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="ref-card">
              <div className="ref-title">Steps 14–15: Manual vs Track Error Summary</div>
              <table className="mini-compare-table">
                <thead>
                  <tr>
                    <th>Instant</th>
                    <th>Man |KCL|</th>
                    <th>Trk |KCL|</th>
                    <th>Man |KVL|</th>
                    <th>Trk |KVL|</th>
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
            </div>
          </div>
        )}

        {activeTab === 'table' && experimentId === 'exp3' && (
          <Exp3ObsPanel
            activeVariant={exp3Variant}
            store={exp3Obs}
            simulation={simulation}
            onUpdate={onUpdateExp3Obs}
            onAutoFill={onAutoFillExp3}
            onClear={onClearExp3}
          />
        )}

        {activeTab === 'table' && experimentId === 'exp4' && (
          <Exp4ObsPanel
            rows={exp4Obs}
            simulation={simulation}
            onCaptureRow={onCaptureExp4Row}
            onAutoSweep={onAutoSweepExp4}
            onClear={onClearExp4}
          />
        )}

        {activeTab === 'table' && experimentId === 'exp5' && (
          <Exp5ObsPanel
            rows={exp5Obs}
            activeFreqHz={activeFreqHz}
            simulation={simulation}
            onCaptureFreq={onCaptureExp5Freq}
            onAutoSweepAll={onAutoSweepExp5}
            onClear={onClearExp5}
          />
        )}

        {/* TAB 3: QUIZ & VIVA */}
        {activeTab === 'quiz' && (
          <div className="drawer-section-stack">
            <div className="quiz-score-bar">
              <div className="quiz-score-left">
                <Award size={15} className="c-ch1" />
                <span>{content.shortName} Lab Quiz ({content.quiz.length} MCQs)</span>
              </div>
              <span className="score-badge ok">
                {quizScore}/{content.quiz.length}
                {quizAnsweredCount < content.quiz.length ? ` (${quizAnsweredCount} ans)` : ''}
              </span>
            </div>

            {content.quiz.map((q) => {
              const qKey = `${experimentId}-${q.id}`;
              const picked = quizAnswers[qKey];
              const isAnswered = picked !== undefined;
              return (
                <div key={qKey} className="quiz-card">
                  <div className="quiz-q">
                    Q{q.id}. {q.question}
                  </div>

                  {q.hasFigure3 && (
                    <svg viewBox="0 0 280 120" className="fig3-svg">
                      <defs>
                        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                        </marker>
                      </defs>
                      <line x1="56" y1="24" x2="124" y2="53" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#arr)" />
                      <text x="82" y="28" fontSize="11" fontWeight="700" fill="#facc15" fontFamily="JetBrains Mono">I</text>
                      <line x1="90" y1="96" x2="126" y2="61" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#arr)" />
                      <text x="92" y="79" fontSize="10.5" fill="#e2e8f0" fontFamily="JetBrains Mono">3A</text>
                      <line x1="130" y1="56" x2="46" y2="86" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#arr)" />
                      <text x="68" y="68" fontSize="10.5" fill="#e2e8f0" fontFamily="JetBrains Mono">2A</text>
                      <line x1="130" y1="56" x2="232" y2="16" stroke="#38bdf8" strokeWidth="1.8" markerEnd="url(#arr)" />
                      <text x="174" y="34" fontSize="10.5" fill="#e2e8f0" fontFamily="JetBrains Mono">5A</text>
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
                          onClick={() => setQuizAnswers((prev) => ({ ...prev, [qKey]: idx }))}
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

            <div className="viva-header">
              <span>High-Yield Viva Q&A ({content.shortName})</span>
              <span className="mono-muted">{content.viva.length} cards</span>
            </div>

            {content.viva.map((card) => {
              const vKey = `${experimentId}-${card.id}`;
              const expanded = !!openViva[vKey];
              return (
                <div key={vKey} className="viva-card">
                  <button
                    className="viva-q-btn"
                    onClick={() => setOpenViva((prev) => ({ ...prev, [vKey]: !prev[vKey] }))}
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
