import { simulateBreadboardCircuit } from '../src/engine/mnaSolver.ts';
import {
  EXP2_DEFAULT_FG,
  EXP2_PRESET_COMPONENTS,
  EXP2_PRESET_PROBES,
  EXP2_TIMES,
  verifyExp2Circuit,
} from '../src/experiments/exp2Kirchhoff.ts';
import {
  EXP3_DEFAULT_FG,
  EXP3_DEFAULT_RPS,
  EXP3_PRESET_PROBES,
  buildExp3PresetComponents,
  verifyExp3Circuit,
} from '../src/experiments/exp3Superposition.ts';
import {
  EXP4_ACTUAL_FG,
  EXP4_LOADS,
  EXP4_THEVENIN_FG,
  buildExp4PresetComponents,
  getExp4PresetProbes,
  verifyExp4Circuit,
} from '../src/experiments/exp4Thevenin.ts';
import {
  EXP5_FREQ_FG,
  EXP5_PRESET_COMPONENTS,
  EXP5_PRESET_PROBES,
  EXP5_STEP_FG,
  EXP5_THEORY,
  verifyExp5Circuit,
} from '../src/experiments/exp5RcFilter.ts';

function assertClose(actual: number, expected: number, tol: number, label: string) {
  if (Math.abs(actual - expected) > tol) {
    console.error(`FAIL [${label}]: got ${actual.toFixed(6)}, expected ${expected.toFixed(6)} (tol ${tol})`);
    process.exit(1);
  }
}

console.log('=== EXPERIMENT 2: KIRCHHOFF LAWS ===');
{
  const simB = simulateBreadboardCircuit(EXP2_PRESET_COMPONENTS, { ...EXP2_PRESET_PROBES, ch2Pos: 'b12' }, EXP2_DEFAULT_FG);
  const simC = simulateBreadboardCircuit(EXP2_PRESET_COMPONENTS, { ...EXP2_PRESET_PROBES, ch2Pos: 'b18' }, EXP2_DEFAULT_FG);
  const simD = simulateBreadboardCircuit(EXP2_PRESET_COMPONENTS, { ...EXP2_PRESET_PROBES, ch2Pos: 'b24' }, EXP2_DEFAULT_FG);
  const check = verifyExp2Circuit(EXP2_PRESET_COMPONENTS, EXP2_PRESET_PROBES, EXP2_DEFAULT_FG);
  if (!check.allPassed) {
    console.error('Exp 2 topology check failed:', check.items.filter((i) => !i.passed));
    process.exit(1);
  }
  for (const [name, t] of [['t1', EXP2_TIMES.t1], ['t2', EXP2_TIMES.t2]] as const) {
    const va = simB.sampleAt('ch1', t);
    const vab = simB.sampleAt('math', t);
    const vc = simC.sampleAt('ch2', t);
    const vac = simC.sampleAt('math', t);
    const vd = simD.sampleAt('ch2', t);
    assertClose(vab - vc - vd, 0, 1e-4, `Exp2 KCL ${name}`);
    assertClose(va - vac - vc, 0, 1e-4, `Exp2 KVL ${name}`);
    console.log(`  ${name}: va=${va.toFixed(4)} vab=${vab.toFixed(4)} vc=${vc.toFixed(4)} vd=${vd.toFixed(4)} | KCL=${(vab - vc - vd).toFixed(6)}`);
  }
}

console.log('\n=== EXPERIMENT 3: SUPERPOSITION THEOREM ===');
{
  for (const variant of ['resistive', 'rc_1khz', 'rc_2khz'] as const) {
    const comps = buildExp3PresetComponents(variant);
    const fgBase = { ...EXP3_DEFAULT_FG, frequency: variant === 'rc_2khz' ? 2000 : 1000 };
    const check = verifyExp3Circuit(comps, EXP3_PRESET_PROBES, fgBase, EXP3_DEFAULT_RPS, variant);
    if (!check.allPassed) {
      console.error(`Exp 3 (${variant}) topology failed:`, check.items.filter((i) => !i.passed));
      process.exit(1);
    }
    const simAll = simulateBreadboardCircuit(comps, EXP3_PRESET_PROBES, fgBase, EXP3_DEFAULT_RPS);
    const simVd1 = simulateBreadboardCircuit(comps, EXP3_PRESET_PROBES, { ...fgBase, enabled: false }, { ...EXP3_DEFAULT_RPS, vd1Active: true, vd2Active: false });
    const simVd2 = simulateBreadboardCircuit(comps, EXP3_PRESET_PROBES, { ...fgBase, enabled: false }, { ...EXP3_DEFAULT_RPS, vd1Active: false, vd2Active: true });
    const simVa = simulateBreadboardCircuit(comps, EXP3_PRESET_PROBES, fgBase, { ...EXP3_DEFAULT_RPS, vd1Active: false, vd2Active: false });

    const sumMin = simVd1.stats.ch2.vmin + simVd2.stats.ch2.vmin + simVa.stats.ch2.vmin;
    const sumMax = simVd1.stats.ch2.vmax + simVd2.stats.ch2.vmax + simVa.stats.ch2.vmax;
    assertClose(simAll.stats.ch2.vmin, sumMin, 1e-3, `Exp3 ${variant} VoMin superposition`);
    assertClose(simAll.stats.ch2.vmax, sumMax, 1e-3, `Exp3 ${variant} VoMax superposition`);
    console.log(
      `  ${variant}: All=[${simAll.stats.ch2.vmin.toFixed(4)}, ${simAll.stats.ch2.vmax.toFixed(4)}] vs Sum=[${sumMin.toFixed(4)}, ${sumMax.toFixed(4)}] (vo1=${simVd1.stats.ch2.vmax.toFixed(3)}, vo2=${simVd2.stats.ch2.vmax.toFixed(3)}, vo3_pk=${simVa.stats.ch2.vmax.toFixed(4)})`
    );
  }
}

console.log('\n=== EXPERIMENT 4: THEVENIN & NORTON THEOREMS ===');
{
  for (const load of EXP4_LOADS) {
    const actComps = buildExp4PresetComponents('actual', load.key);
    const thComps = buildExp4PresetComponents('thevenin', load.key);
    const actCheck = verifyExp4Circuit(actComps, getExp4PresetProbes('actual'), EXP4_ACTUAL_FG, 'actual', load.key);
    const thCheck = verifyExp4Circuit(thComps, getExp4PresetProbes('thevenin'), EXP4_THEVENIN_FG, 'thevenin', load.key);
    if (!actCheck.allPassed || !thCheck.allPassed) {
      console.error(`Exp 4 (${load.key}) topology failed!`);
      process.exit(1);
    }
    const simAct = simulateBreadboardCircuit(actComps, getExp4PresetProbes('actual'), EXP4_ACTUAL_FG);
    const simTh = simulateBreadboardCircuit(thComps, getExp4PresetProbes('thevenin'), EXP4_THEVENIN_FG);
    assertClose(simAct.stats.ch2.vpp, simTh.stats.ch2.vpp, 1e-3, `Exp4 Actual vs Thevenin (${load.key})`);
    assertClose(simAct.stats.ch2.vmax, simTh.stats.ch2.vmax, 1e-3, `Exp4 Vmax (${load.key})`);
    console.log(`  Load ${load.label.padEnd(12)}: Actual Vo=${simAct.stats.ch2.vmax.toFixed(4)}V (${simAct.stats.ch2.vpp.toFixed(4)}Vpp) == Thevenin Vo=${simTh.stats.ch2.vmax.toFixed(4)}V`);
  }
}

console.log('\n=== EXPERIMENT 5: LOW-PASS RC FILTER ===');
{
  const checkStep = verifyExp5Circuit(EXP5_PRESET_COMPONENTS, EXP5_PRESET_PROBES, EXP5_STEP_FG, 'step');
  if (!checkStep.allPassed) {
    console.error('Exp 5 step topology check failed:', checkStep.items.filter((i) => !i.passed));
    process.exit(1);
  }
  const simStep = simulateBreadboardCircuit(EXP5_PRESET_COMPONENTS, EXP5_PRESET_PROBES, EXP5_STEP_FG);
  const trRelUs = (simStep.riseTimeSec ?? 0) * 1e6;
  const tfRelUs = (simStep.fallTimeSec ?? 0) * 1e6;
  // Exact manual Step 3 measurement between fixed Y1 = 0.20 V and Y2 = 1.80 V cursors
  const findLevelTime = (target: number) => {
    const startIdx = simStep.time.findIndex((t) => t >= 0);
    for (let i = startIdx; i < simStep.time.length - 1; i++) {
      const y0 = simStep.ch2[i];
      const y1 = simStep.ch2[i + 1];
      if (y0 <= target && y1 >= target) {
        return simStep.time[i] + ((target - y0) / (y1 - y0)) * (simStep.time[i + 1] - simStep.time[i]);
      }
    }
    return 0;
  };
  const trCursorUs = (findLevelTime(1.8) - findLevelTime(0.2)) * 1e6;
  assertClose(trCursorUs, EXP5_THEORY.trUs, 2.0, 'Exp5 Cursor Rise Time (0.20V -> 1.80V)');
  assertClose(trRelUs, tfRelUs, 1.0, 'Exp5 tr == tf symmetry');
  console.log(`  Step: Vom=${simStep.stats.ch2.vmax.toFixed(4)}V, tr(0.2-1.8V)=${trCursorUs.toFixed(1)}us (theory 242us), auto tr/tf=${trRelUs.toFixed(1)}/${tfRelUs.toFixed(1)}us`);

  const simLow = simulateBreadboardCircuit(EXP5_PRESET_COMPONENTS, EXP5_PRESET_PROBES, { ...EXP5_FREQ_FG, frequency: 100 });
  const simFc = simulateBreadboardCircuit(EXP5_PRESET_COMPONENTS, EXP5_PRESET_PROBES, { ...EXP5_FREQ_FG, frequency: EXP5_THEORY.fcHz });
  const gLow = 20 * Math.log10(simLow.gain / EXP5_THEORY.am);
  const gFc = 20 * Math.log10(simFc.gain / EXP5_THEORY.am);
  assertClose(simLow.gain, 0.5, 0.005, 'Exp5 Passband Gain Am at 100Hz');
  assertClose(gFc, -3.01, 0.05, 'Exp5 -3dB at fc');
  assertClose(simFc.phaseDiffDeg ?? 0, -45, 0.5, 'Exp5 Phase -45 deg at fc');
  console.log(`  100Hz: A=${simLow.gain.toFixed(4)} (G=${gLow.toFixed(2)} dB), phi=${simLow.phaseDiffDeg?.toFixed(1)}deg`);
  console.log(`  fc (${EXP5_THEORY.fcHz.toFixed(1)}Hz): A=${simFc.gain.toFixed(4)} (G=${gFc.toFixed(2)} dB), phi=${simFc.phaseDiffDeg?.toFixed(1)}deg`);
}

console.log('\nALL 4 EXPERIMENTS VERIFIED MATHEMATICALLY!');
