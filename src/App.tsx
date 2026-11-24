import { useMemo, useState } from 'react';
import { Breadboard } from './components/breadboard/Breadboard';
import {
  INITIAL_OBSERVATIONS,
  LabCompanionDrawer,
  type CompanionTab,
  type ObsField,
  type ObsModeKey,
  type ObsRowKey,
  type ObservationStore,
} from './components/companion/LabCompanionDrawer';
import { EXP2_DEFAULT_DSO, Oscilloscope, type DsoState } from './components/dso/Oscilloscope';
import { FunctionGenerator } from './components/instruments/FunctionGenerator';
import { simulateBreadboardCircuit } from './engine/mnaSolver';
import type { CircuitComponent, FgSettings, HoleId, ProbeId, ProbeMap } from './engine/types';
import {
  EXP2_DEFAULT_FG,
  EXP2_EMPTY_PROBES,
  EXP2_PRESET_COMPONENTS,
  EXP2_PRESET_PROBES,
  EXP2_TIMES,
  verifyExp2Circuit,
} from './experiments/exp2Kirchhoff';
import {
  CheckCircle2,
  Cpu,
  Eraser,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

export function App() {
  const [components, setComponents] = useState<CircuitComponent[]>(() =>
    EXP2_PRESET_COMPONENTS.map((c) => ({ ...c }))
  );
  const [probes, setProbes] = useState<ProbeMap>({ ...EXP2_PRESET_PROBES });
  const [fg, setFg] = useState<FgSettings>({ ...EXP2_DEFAULT_FG });
  const [dso, setDso] = useState<DsoState>({ ...EXP2_DEFAULT_DSO });

  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [drawerTab, setDrawerTab] = useState<CompanionTab>('procedure');
  const [observations, setObservations] = useState<ObservationStore>(INITIAL_OBSERVATIONS);

  // Live MNA simulation computed directly from breadboard netlist
  const liveSimulation = useMemo(
    () => simulateBreadboardCircuit(components, probes, fg),
    [components, probes, fg]
  );

  // Freeze display when DSO is stopped (RUN/STOP)
  const [frozenSim, setFrozenSim] = useState(liveSimulation);
  const displayedSim = dso.running ? liveSimulation : frozenSim;

  const verification = useMemo(
    () => verifyExp2Circuit(components, probes, fg),
    [components, probes, fg]
  );

  // Effective Y1 / Y2 cursor values (in Track Mode, lock onto tracked waveform!)
  const effectiveY1 = useMemo(() => {
    if (dso.cursorMode === 'track') {
      return displayedSim.sampleAt(dso.trackSource, dso.x1);
    }
    return dso.y1;
  }, [dso.cursorMode, dso.trackSource, dso.x1, dso.y1, displayedSim]);

  const effectiveY2 = useMemo(() => {
    if (dso.cursorMode === 'track') {
      return displayedSim.sampleAt(dso.trackSource, dso.x2);
    }
    return dso.y2;
  }, [dso.cursorMode, dso.trackSource, dso.x2, dso.y2, displayedSim]);

  // Human-readable label for where CH2 is currently clipped
  const ch2Label = useMemo(() => {
    if (!probes.ch2Pos) return 'NC';
    const net = displayedSim.holeToNet[probes.ch2Pos];
    const dn = verification.detectedNodes;
    if (dn && net !== undefined && net >= 0) {
      if (net === dn.a) return 'va (node a)';
      if (net === dn.b) return 'vb (node b)';
      if (net === dn.c) return 'vc (node c)';
      if (net === dn.d) return 'vd (node d)';
      if (net === dn.gnd) return 'GND';
    }
    return probes.ch2Pos.toUpperCase();
  }, [probes.ch2Pos, displayedSim.holeToNet, verification.detectedNodes]);

  const handleDsoChange = (patch: Partial<DsoState>) => {
    setDso((prev) => {
      if (patch.running === false && prev.running === true) {
        setFrozenSim(liveSimulation);
      }
      return { ...prev, ...patch };
    });
  };

  const handleAddComponent = (comp: Omit<CircuitComponent, 'id'>) => {
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setComponents((prev) => [...prev, { ...comp, id }]);
  };

  const handleUpdateComponent = (id: string, patch: Partial<CircuitComponent>) => {
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleDeleteComponent = (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  };

  const handleMoveProbe = (probeId: ProbeId, hole: HoleId) => {
    setProbes((prev) => ({ ...prev, [probeId]: hole }));
  };

  const handleQuickProbeCh2 = (node: 'b' | 'c' | 'd') => {
    const dn = verification.detectedNodes;
    const targetNet = dn ? dn[node] : undefined;
    if (targetNet !== undefined) {
      // Prefer clean row 'b' hole so the CH2 badge never overlaps the (a)/(b)/(c)/(d) top marker
      const preferred = Object.entries(liveSimulation.holeToNet).find(
        ([hid, net]) => net === targetNet && hid.startsWith('b') && !hid.startsWith('bn') && !hid.startsWith('bp')
      );
      const anyHole = Object.entries(liveSimulation.holeToNet).find(
        ([, net]) => net === targetNet
      );
      const chosen = preferred?.[0] ?? anyHole?.[0];
      if (chosen) {
        setProbes((prev) => ({ ...prev, ch2Pos: chosen }));
        return;
      }
    }
    const fallback: Record<'b' | 'c' | 'd', HoleId> = { b: 'b12', c: 'b18', d: 'b24' };
    setProbes((prev) => ({ ...prev, ch2Pos: fallback[node] }));
  };

  const handleLoadExp2Preset = () => {
    setComponents(EXP2_PRESET_COMPONENTS.map((c) => ({ ...c })));
    setProbes({ ...EXP2_PRESET_PROBES });
    setFg({ ...EXP2_DEFAULT_FG });
    setDso({ ...EXP2_DEFAULT_DSO });
  };

  const handleClearForPractice = () => {
    setComponents([]);
    setProbes({ ...EXP2_EMPTY_PROBES });
    setDrawerOpen(true);
    setDrawerTab('procedure');
  };

  const handleUpdateObs = (
    mode: ObsModeKey,
    row: ObsRowKey,
    field: ObsField,
    value: string
  ) => {
    setObservations((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [row]: {
          ...prev[mode][row],
          [field]: value,
        },
      },
    }));
  };

  const handleCaptureObs = (mode: ObsModeKey, row: ObsRowKey, field: ObsField) => {
    handleUpdateObs(mode, row, field, effectiveY2.toFixed(4));
  };

  const handleAutoFillExactTrack = () => {
    const dn = verification.detectedNodes;
    const findHoleForNet = (net: number | undefined, fallback: HoleId): HoleId => {
      if (net === undefined) return fallback;
      const match = Object.entries(liveSimulation.holeToNet).find(([, n]) => n === net);
      return match ? match[0] : fallback;
    };

    const holeB = findHoleForNet(dn?.b, 'a12');
    const holeC = findHoleForNet(dn?.c, 'a18');
    const holeD = findHoleForNet(dn?.d, 'a24');

    const simB = simulateBreadboardCircuit(components, { ...probes, ch2Pos: holeB }, fg);
    const simC = simulateBreadboardCircuit(components, { ...probes, ch2Pos: holeC }, fg);
    const simD = simulateBreadboardCircuit(components, { ...probes, ch2Pos: holeD }, fg);

    const buildRow = (t: number) => ({
      va: simB.sampleAt('ch1', t).toFixed(4),
      vab: simB.sampleAt('math', t).toFixed(4),
      vac: simC.sampleAt('math', t).toFixed(4),
      vc: simC.sampleAt('ch2', t).toFixed(4),
      vd: simD.sampleAt('ch2', t).toFixed(4),
    });

    setObservations((prev) => ({
      ...prev,
      track: {
        t1: buildRow(EXP2_TIMES.t1),
        t2: buildRow(EXP2_TIMES.t2),
      },
    }));
  };

  const handleClearObs = (mode: ObsModeKey) => {
    setObservations((prev) => ({
      ...prev,
      [mode]: {
        t1: { va: '', vab: '', vac: '', vc: '', vd: '' },
        t2: { va: '', vab: '', vac: '', vc: '', vd: '' },
      },
    }));
  };

  return (
    <div className="app-shell">
      {/* Top Lab Bench Navigation Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-mark">
            <Cpu size={18} />
          </div>
          <div>
            <div className="brand-title">EC102 Virtual Lab Workbench</div>
            <div className="brand-sub">IIIT Bhagalpur · Basic Electrical Science Lab</div>
          </div>

          <div className="exp-pills" role="navigation" aria-label="Experiments">
            <span className="exp-pill active">Exp 2: Kirchhoff&apos;s Laws</span>
            <span className="exp-pill soon" title="Coming in v2: Superposition, Thevenin & Norton, RC Filter">
              Exp 3–5 (Next)
            </span>
          </div>
        </div>

        <div className="topbar-right">
          <button
            className="btn-secondary btn-sm"
            onClick={handleLoadExp2Preset}
            title="Load cleanly pre-wired Experiment 2 breadboard (Fig. 2.1)"
          >
            <RotateCcw size={13} />
            <span>Load Exp 2 Preset</span>
          </button>

          <button
            className="btn-ghost btn-sm"
            onClick={handleClearForPractice}
            title="Clear breadboard to practice wiring Fig. 2.1 from scratch"
          >
            <Eraser size={13} />
            <span>Build From Scratch</span>
          </button>

          <button
            className={`status-pill ${verification.allPassed ? 'ok' : 'warn'}`}
            onClick={() => {
              setDrawerOpen(true);
              setDrawerTab('procedure');
            }}
            title="Inspect breadboard verification checklist"
          >
            {verification.allPassed ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
            <span>
              {verification.allPassed
                ? `Verified (${verification.score}/${verification.total})`
                : `Wiring ${verification.score}/${verification.total}`}
            </span>
          </button>

          <button
            className={`btn-primary btn-sm`}
            onClick={() => setDrawerOpen((o) => !o)}
            title="Toggle Lab Companion Drawer (Procedure, Observation Table, Quiz & Viva)"
          >
            {drawerOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            <span>Lab Companion</span>
          </button>
        </div>
      </header>

      {/* Main Split Lab Workspace */}
      <main className={`workspace ${drawerOpen ? 'with-drawer' : ''}`}>
        <div className="bench-grid">
          {/* Left: Tinkercad Breadboard + Function Generator */}
          <section className="bench-left">
            <Breadboard
              components={components}
              probes={probes}
              simulation={displayedSim}
              detectedNodes={verification.detectedNodes}
              onAddComponent={handleAddComponent}
              onUpdateComponent={handleUpdateComponent}
              onDeleteComponent={handleDeleteComponent}
              onMoveProbe={handleMoveProbe}
              onQuickProbeCh2={handleQuickProbeCh2}
            />

            <FunctionGenerator fg={fg} onChange={setFg} />

            {/* Compact Keyboard & Physics Footnote */}
            <div className="bench-footer">
              <span>
                <Layers size={12} /> Exact Ideal MNA Engine · 1N4007 Shockley Newton-Raphson +
                Trapezoidal RC Transient
              </span>
              <span>Shortcuts: Click part → click 2 holes · Esc cancel · Del remove selected</span>
            </div>
          </section>

          {/* Right: Hybrid 2-Channel Lab DSO */}
          <section className="bench-right">
            <Oscilloscope
              simulation={displayedSim}
              dso={dso}
              effectiveY1={effectiveY1}
              effectiveY2={effectiveY2}
              ch2Label={ch2Label}
              onChange={handleDsoChange}
            />
          </section>
        </div>

        {/* Collapsible Lab Companion Drawer */}
        <LabCompanionDrawer
          open={drawerOpen}
          activeTab={drawerTab}
          onTabChange={setDrawerTab}
          onClose={() => setDrawerOpen(false)}
          verification={verification}
          observations={observations}
          effectiveY2={effectiveY2}
          cursorX2Ms={dso.x2 * 1000}
          cursorMode={dso.cursorMode}
          onUpdateObs={handleUpdateObs}
          onCaptureObs={handleCaptureObs}
          onAutoFillExactTrack={handleAutoFillExactTrack}
          onClearObs={handleClearObs}
        />
      </main>
    </div>
  );
}

export default App;
