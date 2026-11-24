import { useMemo, useState } from 'react';
import { Breadboard } from './components/breadboard/Breadboard';
import {
  INITIAL_EXP3_OBS,
  INITIAL_EXP4_OBS,
  INITIAL_EXP5_OBS,
  type Exp3ObsStore,
  type Exp4ObsRow,
  type Exp5FreqRow,
} from './components/companion/ExperimentObsPanels';
import {
  INITIAL_OBSERVATIONS,
  LabCompanionDrawer,
  type CompanionTab,
  type ObsField,
  type ObsModeKey,
  type ObsRowKey,
  type ObservationStore,
} from './components/companion/LabCompanionDrawer';
import {
  EXP2_DEFAULT_DSO,
  Oscilloscope,
  getDefaultDsoForExperiment,
  type DsoState,
} from './components/dso/Oscilloscope';
import { DualPowerSupply } from './components/instruments/DualPowerSupply';
import { FunctionGenerator } from './components/instruments/FunctionGenerator';
import { simulateBreadboardCircuit } from './engine/mnaSolver';
import type {
  CircuitComponent,
  ExperimentId,
  FgSettings,
  HoleId,
  NodeMarker,
  ProbeId,
  ProbeMap,
  RpsSettings,
} from './engine/types';
import {
  EXP2_DEFAULT_FG,
  EXP2_EMPTY_PROBES,
  EXP2_NODE_MARKERS,
  EXP2_PRESET_COMPONENTS,
  EXP2_PRESET_PROBES,
  EXP2_TIMES,
  verifyExp2Circuit,
} from './experiments/exp2Kirchhoff';
import {
  EXP3_DEFAULT_FG,
  EXP3_DEFAULT_RPS,
  EXP3_EMPTY_PROBES,
  EXP3_NODE_MARKERS,
  EXP3_PRESET_PROBES,
  buildExp3PresetComponents,
  verifyExp3Circuit,
  type Exp3CircuitVariant,
  type Exp3SourceCondition,
} from './experiments/exp3Superposition';
import {
  EXP4_ACTUAL_FG,
  EXP4_LOADS,
  EXP4_THEVENIN_FG,
  buildExp4PresetComponents,
  getExp4NodeMarkers,
  getExp4PresetProbes,
  verifyExp4Circuit,
  type Exp4CircuitMode,
  type Exp4LoadKey,
} from './experiments/exp4Thevenin';
import {
  EXP5_FREQ_FG,
  EXP5_NODE_MARKERS,
  EXP5_PRESET_COMPONENTS,
  EXP5_PRESET_PROBES,
  EXP5_STEP_FG,
  EXP5_SWEEP_FREQS,
  EXP5_THEORY,
  verifyExp5Circuit,
  type Exp5Mode,
} from './experiments/exp5RcFilter';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eraser,
  HelpCircle,
  RotateCcw,
  ShieldAlert,
  Table2,
} from 'lucide-react';

const EXP_TABS: Array<{ id: ExperimentId; label: string; title: string }> = [
  { id: 'exp2', label: 'Exp 2: KCL/KVL', title: "Experiment 2: Verification of Kirchhoff's Laws" },
  { id: 'exp3', label: 'Exp 3: Superpos', title: 'Experiment 3: Superposition Theorem' },
  { id: 'exp4', label: 'Exp 4: Thevenin', title: "Experiment 4: Thevenin's & Norton's Theorems" },
  { id: 'exp5', label: 'Exp 5: RC Filter', title: 'Experiment 5: Time & Frequency Response (Low-Pass RC)' },
];

export function App() {
  const [experimentId, setExperimentId] = useState<ExperimentId>('exp2');

  const [components, setComponents] = useState<CircuitComponent[]>(() =>
    EXP2_PRESET_COMPONENTS.map((c) => ({ ...c }))
  );
  const [probes, setProbes] = useState<ProbeMap>({ ...EXP2_PRESET_PROBES });
  const [fg, setFg] = useState<FgSettings>({ ...EXP2_DEFAULT_FG });
  const [rps, setRps] = useState<RpsSettings>({ ...EXP3_DEFAULT_RPS });
  const [dso, setDso] = useState<DsoState>({ ...EXP2_DEFAULT_DSO });

  const [exp3Variant, setExp3Variant] = useState<Exp3CircuitVariant>('resistive');
  const [exp4Mode, setExp4Mode] = useState<Exp4CircuitMode>('actual');
  const [exp4Load, setExp4Load] = useState<Exp4LoadKey>('10k');
  const [exp5Mode, setExp5Mode] = useState<Exp5Mode>('step');

  // Slide-over drawer CLOSED by default for a clean, breathable 2-column workbench
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<CompanionTab>('table');
  const [exp2Obs, setExp2Obs] = useState<ObservationStore>(INITIAL_OBSERVATIONS);
  const [exp3Obs, setExp3Obs] = useState<Exp3ObsStore>(INITIAL_EXP3_OBS);
  const [exp4Obs, setExp4Obs] = useState<Exp4ObsRow[]>(INITIAL_EXP4_OBS);
  const [exp5Obs, setExp5Obs] = useState<Exp5FreqRow[]>(INITIAL_EXP5_OBS);

  const liveSimulation = useMemo(
    () =>
      simulateBreadboardCircuit(
        components,
        probes,
        fg,
        experimentId === 'exp3' ? rps : undefined
      ),
    [components, probes, fg, rps, experimentId]
  );

  const [frozenSim, setFrozenSim] = useState(liveSimulation);
  const displayedSim = dso.running ? liveSimulation : frozenSim;

  const verification = useMemo(() => {
    switch (experimentId) {
      case 'exp2':
        return verifyExp2Circuit(components, probes, fg);
      case 'exp3':
        return verifyExp3Circuit(components, probes, fg, rps, exp3Variant);
      case 'exp4':
        return verifyExp4Circuit(components, probes, fg, exp4Mode, exp4Load);
      case 'exp5':
        return verifyExp5Circuit(components, probes, fg, exp5Mode);
    }
  }, [experimentId, components, probes, fg, rps, exp3Variant, exp4Mode, exp4Load, exp5Mode]);

  const effectiveY1 = useMemo(() => {
    if (dso.cursorMode === 'track') return displayedSim.sampleAt(dso.trackSource, dso.x1);
    return dso.y1;
  }, [dso.cursorMode, dso.trackSource, dso.x1, dso.y1, displayedSim]);

  const effectiveY2 = useMemo(() => {
    if (dso.cursorMode === 'track') return displayedSim.sampleAt(dso.trackSource, dso.x2);
    return dso.y2;
  }, [dso.cursorMode, dso.trackSource, dso.x2, dso.y2, displayedSim]);

  const nodeMarkers: NodeMarker[] = useMemo(() => {
    if (experimentId === 'exp2') return EXP2_NODE_MARKERS;
    if (experimentId === 'exp3') return EXP3_NODE_MARKERS;
    if (experimentId === 'exp4') return getExp4NodeMarkers(exp4Mode);
    return EXP5_NODE_MARKERS;
  }, [experimentId, exp4Mode]);

  const ch1Label =
    experimentId === 'exp2' || experimentId === 'exp3'
      ? 'va'
      : experimentId === 'exp4' && exp4Mode === 'thevenin'
        ? 'vOC'
        : 'vs';

  const ch2Label = useMemo(() => {
    if (!probes.ch2Pos) return 'NC';
    const net = displayedSim.holeToNet[probes.ch2Pos];
    const dn = verification.detectedNodes;
    if (dn && net !== undefined && net >= 0) {
      if (experimentId === 'exp2') {
        if (net === dn.a) return 'va';
        if (net === dn.b) return 'vb';
        if (net === dn.c) return 'vc';
        if (net === dn.d) return 'vd';
      } else if (dn.vo !== undefined && net === dn.vo) {
        return 'vo';
      }
      if (net === dn.gnd) return 'GND';
    }
    return probes.ch2Pos.toUpperCase();
  }, [probes.ch2Pos, displayedSim.holeToNet, verification.detectedNodes, experimentId]);

  const openCompanionTab = (tab: CompanionTab) => {
    if (drawerOpen && drawerTab === tab) {
      setDrawerOpen(false);
    } else {
      setDrawerTab(tab);
      setDrawerOpen(true);
    }
  };

  const loadExperimentPreset = (target: ExperimentId) => {
    setExperimentId(target);
    if (target === 'exp2') {
      setComponents(EXP2_PRESET_COMPONENTS.map((c) => ({ ...c })));
      setProbes({ ...EXP2_PRESET_PROBES });
      setFg({ ...EXP2_DEFAULT_FG });
      setDso(getDefaultDsoForExperiment('exp2'));
    } else if (target === 'exp3') {
      setExp3Variant('resistive');
      setComponents(buildExp3PresetComponents('resistive'));
      setProbes({ ...EXP3_PRESET_PROBES });
      setFg({ ...EXP3_DEFAULT_FG });
      setRps({ ...EXP3_DEFAULT_RPS });
      setDso(getDefaultDsoForExperiment('exp3'));
    } else if (target === 'exp4') {
      setExp4Mode('actual');
      setExp4Load('10k');
      setComponents(buildExp4PresetComponents('actual', '10k'));
      setProbes(getExp4PresetProbes('actual'));
      setFg({ ...EXP4_ACTUAL_FG });
      setDso(getDefaultDsoForExperiment('exp4'));
    } else if (target === 'exp5') {
      setExp5Mode('step');
      setComponents(EXP5_PRESET_COMPONENTS.map((c) => ({ ...c })));
      setProbes({ ...EXP5_PRESET_PROBES });
      setFg({ ...EXP5_STEP_FG });
      setDso(getDefaultDsoForExperiment('exp5'));
    }
  };

  const handleClearForPractice = () => {
    setComponents([]);
    setProbes(experimentId === 'exp3' ? { ...EXP3_EMPTY_PROBES } : { ...EXP2_EMPTY_PROBES });
    setDrawerTab('procedure');
    setDrawerOpen(true);
  };

  const activeExp2Ch2Node = useMemo<'b' | 'c' | 'd' | null>(() => {
    if (experimentId !== 'exp2' || !probes.ch2Pos || !verification.detectedNodes) return null;
    const net = displayedSim.holeToNet[probes.ch2Pos];
    if (net === verification.detectedNodes.b) return 'b';
    if (net === verification.detectedNodes.c) return 'c';
    if (net === verification.detectedNodes.d) return 'd';
    return null;
  }, [experimentId, probes.ch2Pos, verification.detectedNodes, displayedSim.holeToNet]);

  const handleQuickProbeCh2 = (node: 'b' | 'c' | 'd') => {
    const dn = verification.detectedNodes;
    const targetNet = dn ? dn[node] : undefined;
    if (targetNet !== undefined) {
      const preferred = Object.entries(liveSimulation.holeToNet).find(
        ([hid, net]) => net === targetNet && hid.startsWith('b') && !hid.startsWith('bn') && !hid.startsWith('bp')
      );
      const anyHole = Object.entries(liveSimulation.holeToNet).find(([, net]) => net === targetNet);
      const chosen = preferred?.[0] ?? anyHole?.[0];
      if (chosen) {
        setProbes((prev) => ({ ...prev, ch2Pos: chosen }));
        return;
      }
    }
    const fallback: Record<'b' | 'c' | 'd', HoleId> = { b: 'b12', c: 'b18', d: 'b24' };
    setProbes((prev) => ({ ...prev, ch2Pos: fallback[node] }));
  };

  const handleExp3Variant = (variant: Exp3CircuitVariant) => {
    setExp3Variant(variant);
    setComponents(buildExp3PresetComponents(variant));
    setProbes({ ...EXP3_PRESET_PROBES });
    setFg((prev) => ({
      ...EXP3_DEFAULT_FG,
      enabled: prev.enabled,
      frequency: variant === 'rc_2khz' ? 2000 : 1000,
    }));
    setDso((prev) => ({ ...prev, timePerDiv: variant === 'rc_2khz' ? 0.0001 : 0.0002 }));
  };

  const handleExp3Condition = (cond: Exp3SourceCondition) => {
    if (cond === 'all') {
      setFg((f) => ({ ...f, enabled: true }));
      setRps((r) => ({ ...r, enabled: true, vd1Active: true, vd2Active: true }));
    } else if (cond === 'vd1') {
      setFg((f) => ({ ...f, enabled: false }));
      setRps((r) => ({ ...r, enabled: true, vd1Active: true, vd2Active: false }));
    } else if (cond === 'vd2') {
      setFg((f) => ({ ...f, enabled: false }));
      setRps((r) => ({ ...r, enabled: true, vd1Active: false, vd2Active: true }));
    } else {
      setFg((f) => ({ ...f, enabled: true }));
      setRps((r) => ({ ...r, enabled: true, vd1Active: false, vd2Active: false }));
    }
  };

  const handleAutoFillExp3 = (variant: Exp3CircuitVariant) => {
    const comps = buildExp3PresetComponents(variant);
    const freq = variant === 'rc_2khz' ? 2000 : 1000;
    const baseFg = { ...EXP3_DEFAULT_FG, frequency: freq };
    const sAll = simulateBreadboardCircuit(comps, EXP3_PRESET_PROBES, baseFg, EXP3_DEFAULT_RPS);
    const s1 = simulateBreadboardCircuit(comps, EXP3_PRESET_PROBES, { ...baseFg, enabled: false }, { ...EXP3_DEFAULT_RPS, vd1Active: true, vd2Active: false });
    const s2 = simulateBreadboardCircuit(comps, EXP3_PRESET_PROBES, { ...baseFg, enabled: false }, { ...EXP3_DEFAULT_RPS, vd1Active: false, vd2Active: true });
    const s3 = simulateBreadboardCircuit(comps, EXP3_PRESET_PROBES, baseFg, { ...EXP3_DEFAULT_RPS, vd1Active: false, vd2Active: false });
    const fmt = (sim: typeof sAll) => ({
      min: sim.stats.ch2.vmin.toFixed(4),
      max: sim.stats.ch2.vmax.toFixed(4),
    });
    setExp3Obs((prev) => ({
      ...prev,
      [variant]: { all: fmt(sAll), vd1: fmt(s1), vd2: fmt(s2), va: fmt(s3) },
    }));
  };

  const handleExp4Switch = (nextMode: Exp4CircuitMode, nextLoad: Exp4LoadKey) => {
    setExp4Mode(nextMode);
    setExp4Load(nextLoad);
    setComponents(buildExp4PresetComponents(nextMode, nextLoad));
    setProbes(getExp4PresetProbes(nextMode));
    setFg(nextMode === 'actual' ? { ...EXP4_ACTUAL_FG } : { ...EXP4_THEVENIN_FG });
    setDso((prev) => ({
      ...prev,
      centerVoltage: nextMode === 'actual' ? 2.0 : 0.5,
      voltsPerDiv: nextMode === 'actual' ? 1.0 : 0.5,
      y1: 0,
      y2: nextMode === 'actual' ? 4.0 : 1.0,
    }));
  };

  const handleAutoSweepExp4 = () => {
    const nextRows: Exp4ObsRow[] = INITIAL_EXP4_OBS.map((row) => {
      const isThev = row.rowId === 'thevenin_10k';
      const m: Exp4CircuitMode = isThev ? 'thevenin' : 'actual';
      const comps = buildExp4PresetComponents(m, row.loadKey);
      const pr = getExp4PresetProbes(m);
      const f = isThev ? EXP4_THEVENIN_FG : EXP4_ACTUAL_FG;
      const sim = simulateBreadboardCircuit(comps, pr, f);
      return {
        ...row,
        vsVpp: sim.stats.ch1.vpp.toFixed(3),
        voVpp: sim.stats.ch2.vpp.toFixed(4),
        voPeak: sim.stats.ch2.vmax.toFixed(4),
      };
    });
    setExp4Obs(nextRows);
  };

  const handleExp5Mode = (nextMode: Exp5Mode) => {
    setExp5Mode(nextMode);
    if (nextMode === 'step') {
      setFg({ ...EXP5_STEP_FG });
      setDso((prev) => ({
        ...prev,
        displayMode: 'yt',
        timePerDiv: 0.0002,
        voltsPerDiv: 1.0,
        centerVoltage: 2.0,
        cursorMode: 'manual',
        y1: 0.2,
        y2: 1.8,
      }));
    } else {
      setFg({ ...EXP5_FREQ_FG });
      setDso((prev) => ({
        ...prev,
        displayMode: 'yt',
        timePerDiv: 0.0002,
        voltsPerDiv: 1.0,
        centerVoltage: 0.0,
      }));
    }
  };

  const handleExp5FreqSelect = (freqHz: number) => {
    setExp5Mode('freq');
    setFg({ ...EXP5_FREQ_FG, frequency: freqHz });
    const idealDiv = 0.2 / freqHz;
    const choices = [50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3];
    const best = choices.reduce((a, b) => (Math.abs(b - idealDiv) < Math.abs(a - idealDiv) ? b : a));
    setDso((prev) => ({ ...prev, timePerDiv: best, centerVoltage: 0.0, voltsPerDiv: 1.0 }));
  };

  const handleAutoSweepExp5 = () => {
    const swept: Exp5FreqRow[] = EXP5_SWEEP_FREQS.map((freqHz) => {
      const sim = simulateBreadboardCircuit(
        EXP5_PRESET_COMPONENTS,
        EXP5_PRESET_PROBES,
        { ...EXP5_FREQ_FG, frequency: freqHz }
      );
      const gain = sim.gain;
      const dbGain = gain > 1e-6 ? 20 * Math.log10(gain / EXP5_THEORY.am) : -60;
      return {
        freqHz,
        voVpp: sim.stats.ch2.vpp.toFixed(3),
        gain,
        dbGain,
        phaseDeg: sim.phaseDiffDeg,
      };
    });
    setExp5Obs(swept);
  };

  const handleDsoChange = (patch: Partial<DsoState>) => {
    setDso((prev) => {
      if (patch.running === false && prev.running === true) setFrozenSim(liveSimulation);
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

  const handleUpdateExp2Obs = (mode: ObsModeKey, row: ObsRowKey, field: ObsField, value: string) => {
    setExp2Obs((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], [row]: { ...prev[mode][row], [field]: value } },
    }));
  };

  const handleAutoFillExactTrackExp2 = () => {
    const dn = verification.detectedNodes;
    const findHole = (net: number | undefined, fb: HoleId): HoleId => {
      if (net === undefined) return fb;
      const m = Object.entries(liveSimulation.holeToNet).find(([, n]) => n === net);
      return m ? m[0] : fb;
    };
    const simB = simulateBreadboardCircuit(components, { ...probes, ch2Pos: findHole(dn?.b, 'b12') }, fg);
    const simC = simulateBreadboardCircuit(components, { ...probes, ch2Pos: findHole(dn?.c, 'b18') }, fg);
    const simD = simulateBreadboardCircuit(components, { ...probes, ch2Pos: findHole(dn?.d, 'b24') }, fg);
    const rowAt = (t: number) => ({
      va: simB.sampleAt('ch1', t).toFixed(4),
      vab: simB.sampleAt('math', t).toFixed(4),
      vac: simC.sampleAt('math', t).toFixed(4),
      vc: simC.sampleAt('ch2', t).toFixed(4),
      vd: simD.sampleAt('ch2', t).toFixed(4),
    });
    setExp2Obs((prev) => ({
      ...prev,
      track: { t1: rowAt(EXP2_TIMES.t1), t2: rowAt(EXP2_TIMES.t2) },
    }));
  };

  const handleResetFgDefault = () => {
    if (experimentId === 'exp2') setFg({ ...EXP2_DEFAULT_FG });
    else if (experimentId === 'exp3')
      setFg({ ...EXP3_DEFAULT_FG, frequency: exp3Variant === 'rc_2khz' ? 2000 : 1000 });
    else if (experimentId === 'exp4')
      setFg(exp4Mode === 'actual' ? { ...EXP4_ACTUAL_FG } : { ...EXP4_THEVENIN_FG });
    else setFg(exp5Mode === 'step' ? { ...EXP5_STEP_FG } : { ...EXP5_FREQ_FG });
  };

  // Compact single-line experiment controls tucked neatly on the right side of the breadboard toolbar
  const experimentControls = useMemo(() => {
    if (experimentId === 'exp2') {
      return (
        <div className="exp-ctrl-row">
          <span className="ctrl-lbl">CH2:</span>
          <div className="seg-group compact">
            {(['b', 'c', 'd'] as const).map((nk) => (
              <button
                key={nk}
                className={`seg-btn ${activeExp2Ch2Node === nk ? 'active' : ''}`}
                onClick={() => handleQuickProbeCh2(nk)}
              >
                Node {nk}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (experimentId === 'exp3') {
      return (
        <div className="seg-group compact">
          {(
            [
              { id: 'resistive', label: 'Resistive' },
              { id: 'rc_1khz', label: 'RC 1 kHz' },
              { id: 'rc_2khz', label: 'RC 2 kHz' },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              className={`seg-btn ${exp3Variant === v.id ? 'active' : ''}`}
              onClick={() => handleExp3Variant(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      );
    }

    if (experimentId === 'exp4') {
      const loadIdx = EXP4_LOADS.findIndex((l) => l.key === exp4Load);
      return (
        <div className="exp-ctrl-row">
          <div className="seg-group compact">
            <button
              className={`seg-btn ${exp4Mode === 'actual' ? 'active' : ''}`}
              onClick={() => handleExp4Switch('actual', exp4Load)}
            >
              Actual
            </button>
            <button
              className={`seg-btn ${exp4Mode === 'thevenin' ? 'active' : ''}`}
              onClick={() => handleExp4Switch('thevenin', exp4Load)}
            >
              Thevenin
            </button>
          </div>
          <div className="step-select">
            <button
              className="step-btn"
              disabled={loadIdx <= 0}
              onClick={() => loadIdx > 0 && handleExp4Switch(exp4Mode, EXP4_LOADS[loadIdx - 1].key)}
              title="Previous load"
            >
              <ChevronLeft size={13} />
            </button>
            <select
              className="clean-select compact"
              value={exp4Load}
              onChange={(e) => handleExp4Switch(exp4Mode, e.target.value as Exp4LoadKey)}
              aria-label="Select load"
            >
              {EXP4_LOADS.map((l) => (
                <option key={l.key} value={l.key}>
                  Load: {l.label}
                </option>
              ))}
            </select>
            <button
              className="step-btn"
              disabled={loadIdx >= EXP4_LOADS.length - 1}
              onClick={() =>
                loadIdx < EXP4_LOADS.length - 1 &&
                handleExp4Switch(exp4Mode, EXP4_LOADS[loadIdx + 1].key)
              }
              title="Next load"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      );
    }

    const freqIdx = EXP5_SWEEP_FREQS.findIndex((f) => Math.abs(f - fg.frequency) < 1);
    return (
      <div className="exp-ctrl-row">
        <div className="seg-group compact">
          <button
            className={`seg-btn ${exp5Mode === 'step' ? 'active' : ''}`}
            onClick={() => handleExp5Mode('step')}
          >
            Step
          </button>
          <button
            className={`seg-btn ${exp5Mode === 'freq' ? 'active' : ''}`}
            onClick={() => handleExp5Mode('freq')}
          >
            Sine Sweep
          </button>
        </div>

        {exp5Mode === 'freq' && (
          <div className="step-select">
            <button
              className="step-btn"
              disabled={freqIdx <= 0}
              onClick={() => freqIdx > 0 && handleExp5FreqSelect(EXP5_SWEEP_FREQS[freqIdx - 1])}
              title="Lower frequency"
            >
              <ChevronLeft size={13} />
            </button>
            <select
              className="clean-select compact"
              value={freqIdx >= 0 ? EXP5_SWEEP_FREQS[freqIdx] : 1000}
              onChange={(e) => handleExp5FreqSelect(Number(e.target.value))}
              aria-label="Select sweep frequency"
            >
              {EXP5_SWEEP_FREQS.map((f) => (
                <option key={f} value={f}>
                  {f >= 1000 ? `${f / 1000} kHz` : `${f} Hz`}
                </option>
              ))}
            </select>
            <button
              className="step-btn"
              disabled={freqIdx >= EXP5_SWEEP_FREQS.length - 1}
              onClick={() =>
                freqIdx < EXP5_SWEEP_FREQS.length - 1 &&
                handleExp5FreqSelect(EXP5_SWEEP_FREQS[freqIdx + 1])
              }
              title="Higher frequency"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
    );
  }, [experimentId, activeExp2Ch2Node, exp3Variant, exp4Mode, exp4Load, exp5Mode, fg.frequency]);

  return (
    <div className="app-shell">
      {/* Calm Single-Row Header */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-mark">
            <Cpu size={16} />
          </div>
          <span className="brand-title">EC102 Lab</span>

          <div className="seg-group" role="tablist" aria-label="Experiments">
            {EXP_TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={experimentId === tab.id}
                className={`seg-btn ${experimentId === tab.id ? 'active' : ''}`}
                onClick={() => loadExperimentPreset(tab.id)}
                title={tab.title}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="topbar-right">
          <button
            className="btn-ghost btn-sm"
            onClick={() => loadExperimentPreset(experimentId)}
            title="Reload clean circuit preset"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          <button
            className="btn-ghost btn-sm"
            onClick={handleClearForPractice}
            title="Clear breadboard to wire from scratch"
          >
            <Eraser size={13} />
            <span>Practice</span>
          </button>

          <div className="topbar-sep" />

          <button
            className={`status-pill ${verification.allPassed ? 'ok' : 'warn'}`}
            onClick={() => openCompanionTab('procedure')}
            title="Open Guide & Wiring Verification"
          >
            {verification.allPassed ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} />}
            <span>
              {verification.score}/{verification.total} Guide
            </span>
          </button>

          <button
            className={`btn-secondary btn-sm ${drawerOpen && drawerTab === 'table' ? 'btn-accent-outline' : ''}`}
            onClick={() => openCompanionTab('table')}
          >
            <Table2 size={13} />
            <span>{experimentId === 'exp4' || experimentId === 'exp5' ? 'Table & Plot' : 'Obs Table'}</span>
          </button>

          <button
            className={`btn-secondary btn-sm ${drawerOpen && drawerTab === 'quiz' ? 'btn-accent-outline' : ''}`}
            onClick={() => openCompanionTab('quiz')}
          >
            <HelpCircle size={13} />
            <span>Quiz & Viva</span>
          </button>
        </div>
      </header>

      {/* Spacious 2-Column Main Workbench */}
      <main className="workspace">
        <div className="bench-grid">
          <section className="bench-left">
            <Breadboard
              components={components}
              probes={probes}
              simulation={displayedSim}
              nodeMarkers={nodeMarkers}
              detectedNodes={verification.detectedNodes}
              showRpsProbes={experimentId === 'exp3'}
              experimentControls={experimentControls}
              onAddComponent={handleAddComponent}
              onUpdateComponent={handleUpdateComponent}
              onDeleteComponent={handleDeleteComponent}
              onMoveProbe={handleMoveProbe}
            />

            <FunctionGenerator
              fg={fg}
              defaultLabel={`${experimentId.toUpperCase()} Default`}
              onChange={setFg}
              onResetDefault={handleResetFgDefault}
            />

            {experimentId === 'exp3' && (
              <DualPowerSupply
                rps={rps}
                fgEnabled={fg.enabled}
                onChangeRps={setRps}
                onSelectCondition={handleExp3Condition}
              />
            )}
          </section>

          <section className="bench-right">
            <Oscilloscope
              experimentId={experimentId}
              simulation={displayedSim}
              dso={dso}
              effectiveY1={effectiveY1}
              effectiveY2={effectiveY2}
              ch1Label={ch1Label}
              ch2Label={ch2Label}
              onChange={handleDsoChange}
              onResetView={() => setDso(getDefaultDsoForExperiment(experimentId))}
            />
          </section>
        </div>
      </main>

      {/* Clean Slide-Over Lab Companion Overlay */}
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <LabCompanionDrawer
        experimentId={experimentId}
        open={drawerOpen}
        activeTab={drawerTab}
        onTabChange={setDrawerTab}
        onClose={() => setDrawerOpen(false)}
        verification={verification}
        simulation={displayedSim}
        activeFreqHz={fg.frequency}
        observations={exp2Obs}
        effectiveY2={effectiveY2}
        cursorX2Ms={dso.x2 * 1000}
        cursorMode={dso.cursorMode}
        onUpdateObs={handleUpdateExp2Obs}
        onCaptureObs={(m, r, f) => handleUpdateExp2Obs(m, r, f, effectiveY2.toFixed(4))}
        onAutoFillExactTrack={handleAutoFillExactTrackExp2}
        onClearObs={(m) =>
          setExp2Obs((prev) => ({
            ...prev,
            [m]: {
              t1: { va: '', vab: '', vac: '', vc: '', vd: '' },
              t2: { va: '', vab: '', vac: '', vc: '', vd: '' },
            },
          }))
        }
        exp3Variant={exp3Variant}
        exp3Obs={exp3Obs}
        onUpdateExp3Obs={(v, cond, min, max) =>
          setExp3Obs((prev) => ({
            ...prev,
            [v]: { ...prev[v], [cond]: { min, max } },
          }))
        }
        onAutoFillExp3={handleAutoFillExp3}
        onClearExp3={(v) =>
          setExp3Obs((prev) => ({
            ...prev,
            [v]: {
              all: { min: '', max: '' },
              vd1: { min: '', max: '' },
              vd2: { min: '', max: '' },
              va: { min: '', max: '' },
            },
          }))
        }
        exp4Obs={exp4Obs}
        onCaptureExp4Row={(rowId) =>
          setExp4Obs((prev) =>
            prev.map((r) =>
              r.rowId === rowId
                ? {
                    ...r,
                    vsVpp: displayedSim.stats.ch1.vpp.toFixed(3),
                    voVpp: displayedSim.stats.ch2.vpp.toFixed(4),
                    voPeak: displayedSim.stats.ch2.vmax.toFixed(4),
                  }
                : r
            )
          )
        }
        onAutoSweepExp4={handleAutoSweepExp4}
        onClearExp4={() => setExp4Obs(INITIAL_EXP4_OBS)}
        exp5Obs={exp5Obs}
        onCaptureExp5Freq={(freqHz) => {
          const gain = displayedSim.gain;
          const dbGain = gain > 1e-6 ? 20 * Math.log10(gain / EXP5_THEORY.am) : -60;
          setExp5Obs((prev) =>
            prev.map((r) =>
              r.freqHz === freqHz
                ? {
                    ...r,
                    voVpp: displayedSim.stats.ch2.vpp.toFixed(3),
                    gain,
                    dbGain,
                    phaseDeg: displayedSim.phaseDiffDeg,
                  }
                : r
            )
          );
        }}
        onAutoSweepExp5={handleAutoSweepExp5}
        onClearExp5={() => setExp5Obs(INITIAL_EXP5_OBS)}
      />
    </div>
  );
}

export default App;
