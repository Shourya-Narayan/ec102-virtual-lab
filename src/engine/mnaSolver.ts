import { resolveBreadboardNetlist } from './breadboardNetlist';
import type {
  ChannelStats,
  CircuitComponent,
  FgSettings,
  ProbeMap,
  SimulationResult,
  TraceSource,
} from './types';

/**
 * Standard 1N4007 SPICE diode parameters (exact ideal physical model)
 * IS = 14.11 nA, N = 1.984, VT = 25.85 mV (300 K) -> ~0.59–0.65V forward drop at 1–5 mA
 */
const DIODE_IS = 14.11e-9;
const DIODE_N = 1.984;
const DIODE_VT = 0.02585;
const DIODE_NVT = DIODE_N * DIODE_VT;
const DIODE_MAX_VD = 1.25; // smooth linear extension above 1.25V to prevent exp overflow
const DIODE_G_LEAK = 1e-12;
const GMIN = 1e-11;

export function evaluateFgWaveform(fg: FgSettings, tSec: number): number {
  if (!fg.enabled) return 0;
  const freq = Math.max(1, fg.frequency);
  const rawPhase = fg.frequency * tSec;
  const phase = ((rawPhase % 1) + 1) % 1; // [0, 1)
  const amp = fg.vpp / 2;

  switch (fg.waveform) {
    case 'triangle': {
      // Exact Fig. 2.2 phase:
      // t = 0 => midpoint rising (0)
      // t = +T/4 => +1 (peak)
      // t = +T/2 / -T/2 => 0 (falling)
      // t = -T/4 => -1 (bottom tip)
      let norm: number;
      if (phase < 0.25) {
        norm = 4 * phase;
      } else if (phase < 0.75) {
        norm = 2 - 4 * phase;
      } else {
        norm = 4 * phase - 4;
      }
      return fg.offset + amp * norm;
    }
    case 'sine':
      return fg.offset + amp * Math.sin(2 * Math.PI * freq * tSec);
    case 'square':
      return fg.offset + amp * (phase < 0.5 ? 1 : -1);
  }
}

function evalDiode(vd: number): { id: number; gd: number } {
  if (vd <= DIODE_MAX_VD) {
    const expTerm = Math.exp(vd / DIODE_NVT);
    const id = DIODE_IS * (expTerm - 1) + DIODE_G_LEAK * vd;
    const gd = (DIODE_IS / DIODE_NVT) * expTerm + DIODE_G_LEAK;
    return { id, gd };
  }
  const expMax = Math.exp(DIODE_MAX_VD / DIODE_NVT);
  const idMax = DIODE_IS * (expMax - 1) + DIODE_G_LEAK * DIODE_MAX_VD;
  const gdMax = (DIODE_IS / DIODE_NVT) * expMax + DIODE_G_LEAK;
  return {
    id: idMax + gdMax * (vd - DIODE_MAX_VD),
    gd: gdMax,
  };
}

/**
 * SPICE-style pnjlim voltage step limiting for rock-solid Newton-Raphson diode convergence
 */
function limitDiodeStep(vNew: number, vOld: number): number {
  const vCrit = DIODE_NVT * Math.log(DIODE_NVT / (Math.SQRT2 * DIODE_IS));
  if (vNew > vCrit && Math.abs(vNew - vOld) > 2 * DIODE_NVT) {
    if (vOld > 0) {
      const arg = 1 + (vNew - vOld) / DIODE_NVT;
      if (arg > 0) {
        return vOld + DIODE_NVT * Math.log(arg);
      }
      return vCrit;
    }
    return DIODE_NVT * Math.log(vNew / DIODE_NVT);
  }
  const maxStep = 0.25;
  const delta = vNew - vOld;
  if (delta > maxStep) return vOld + maxStep;
  if (delta < -maxStep) return vOld - maxStep;
  return vNew;
}

/**
 * Dense Gaussian elimination with partial pivoting (fast for small breadboard MNA matrices)
 */
function solveLinearSystem(A: Float64Array[], b: Float64Array, n: number): Float64Array | null {
  const M = A.map((row) => Float64Array.from(row));
  const rhs = Float64Array.from(b);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = r;
      }
    }
    if (maxVal < 1e-18) {
      return null;
    }
    if (pivotRow !== col) {
      const tmpRow = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = tmpRow;
      const tmpVal = rhs[col];
      rhs[col] = rhs[pivotRow];
      rhs[pivotRow] = tmpVal;
    }

    const pivot = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivot;
      if (factor === 0) continue;
      for (let c = col; c < n; c++) {
        M[r][c] -= factor * M[col][c];
      }
      rhs[r] -= factor * rhs[col];
    }
  }

  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let sum = rhs[r];
    for (let c = r + 1; c < n; c++) {
      sum -= M[r][c] * x[c];
    }
    x[r] = sum / M[r][r];
  }
  return x;
}

function computeStats(arr: number[]): ChannelStats {
  if (arr.length === 0) return { vmin: 0, vmax: 0, vpp: 0, vavg: 0 };
  let vmin = Infinity;
  let vmax = -Infinity;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < vmin) vmin = v;
    if (v > vmax) vmax = v;
    sum += v;
  }
  return {
    vmin,
    vmax,
    vpp: vmax - vmin,
    vavg: sum / arr.length,
  };
}

function makeEmptyResult(
  fg: FgSettings,
  holeToNet: Record<string, number>,
  errors: string[],
  warnings: string[]
): SimulationResult {
  const period = 1 / Math.max(1, fg.frequency);
  const steps = 400;
  const time: number[] = [];
  const fgWave: number[] = [];
  const zeros: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -2 * period + (4 * period * i) / steps;
    time.push(t);
    fgWave.push(evaluateFgWaveform(fg, t));
    zeros.push(0);
  }
  const zeroStats: ChannelStats = { vmin: 0, vmax: 0, vpp: 0, vavg: 0 };
  return {
    ok: false,
    errors,
    warnings,
    time,
    fgWave,
    ch1: zeros,
    ch2: zeros,
    math: zeros,
    nodeVoltages: { 0: zeros },
    holeToNet,
    period,
    stats: { ch1: zeroStats, ch2: zeroStats, math: zeroStats },
    sampleAt: (src, tSec) => (src === 'fg' ? evaluateFgWaveform(fg, tSec) : 0),
  };
}

export function simulateBreadboardCircuit(
  components: CircuitComponent[],
  probes: ProbeMap,
  fg: FgSettings
): SimulationResult {
  const netlist = resolveBreadboardNetlist(components, probes);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (netlist.probeNets.fgPos === null) {
    errors.push('Function Generator (+) probe is not connected to the breadboard.');
  }
  if (netlist.probeNets.fgGnd === null) {
    errors.push('Function Generator GND probe is not connected to the breadboard.');
  }
  if (
    netlist.probeNets.fgPos !== null &&
    netlist.probeNets.fgGnd !== null &&
    netlist.probeNets.fgPos === netlist.probeNets.fgGnd
  ) {
    errors.push('Short Circuit Detected: FG (+) and FG GND are on the same electrical node!');
  }

  if (netlist.probeNets.ch1Pos === null) {
    warnings.push('DSO CH1 (+) probe is unconnected (reading 0 V).');
  }
  if (netlist.probeNets.ch2Pos === null) {
    warnings.push('DSO CH2 (+) probe is unconnected (reading 0 V).');
  }
  if (
    netlist.probeNets.ch1Gnd !== null &&
    netlist.probeNets.fgGnd !== null &&
    netlist.probeNets.ch1Gnd !== netlist.probeNets.fgGnd
  ) {
    warnings.push('CH1 GND clip is not on the same GND bus as FG GND — connect all black clips to GND.');
  }
  if (
    netlist.probeNets.ch2Gnd !== null &&
    netlist.probeNets.fgGnd !== null &&
    netlist.probeNets.ch2Gnd !== netlist.probeNets.fgGnd
  ) {
    warnings.push('CH2 GND clip is not on the same GND bus as FG GND — connect all black clips to GND.');
  }

  if (errors.length > 0) {
    return makeEmptyResult(fg, netlist.holeToNet, errors, warnings);
  }

  const N = netlist.netCount; // non-ground nodes 1..N
  const hasFgSource = netlist.probeNets.fgPos !== null && netlist.probeNets.fgPos !== 0;
  const M = hasFgSource ? 1 : 0; // voltage sources
  const S = N + M;

  const period = 1 / Math.max(1, fg.frequency);
  const stepsPerPeriod = 400; // dt = 2.5 us at 1 kHz -> ultra-smooth exact Trapezoidal accuracy
  const dt = period / stepsPerPeriod;

  // Determine warmup cycles based on longest possible RC time constant (capped at 14 cycles)
  const warmupCycles = 10;
  const captureCycles = 4; // records [-2T, +2T] centered at t = 0
  const totalCycles = warmupCycles + captureCycles;
  const totalSteps = totalCycles * stepsPerPeriod;
  const captureStartStep = warmupCycles * stepsPerPeriod;

  // Pre-partition components for tight inner loop
  const resistors: Array<{ n1: number; n2: number; g: number }> = [];
  const capacitors: Array<{ n1: number; n2: number; c: number; vPrev: number; iPrev: number }> = [];
  const diodes: Array<{ n1: number; n2: number; vd: number }> = [];

  for (const item of netlist.activeComponents) {
    const { component, n1, n2 } = item;
    if (n1 === n2) continue;
    if (component.type === 'resistor') {
      const r = Math.max(1e-3, component.value);
      resistors.push({ n1, n2, g: 1 / r });
    } else if (component.type === 'capacitor') {
      const c = Math.max(0, component.value);
      if (c > 0) {
        capacitors.push({ n1, n2, c, vPrev: 0, iPrev: 0 });
      }
    } else if (component.type === 'diode') {
      diodes.push({ n1, n2, vd: 0.0 });
    }
  }

  const fgPosNet = netlist.probeNets.fgPos!;

  // Allocate capture arrays
  const captureLen = captureCycles * stepsPerPeriod + 1;
  const time = new Array<number>(captureLen);
  const fgWave = new Array<number>(captureLen);
  const nodeVoltages: Record<number, number[]> = { 0: new Array<number>(captureLen).fill(0) };
  for (let node = 1; node <= N; node++) {
    nodeVoltages[node] = new Array<number>(captureLen);
  }

  // Reusable MNA matrix buffers
  const A: Float64Array[] = Array.from({ length: S }, () => new Float64Array(S));
  const b = new Float64Array(S);
  let lastSol: Float64Array<ArrayBufferLike> = new Float64Array(S);

  const stampConductance = (n1: number, n2: number, g: number) => {
    if (n1 > 0) A[n1 - 1][n1 - 1] += g;
    if (n2 > 0) A[n2 - 1][n2 - 1] += g;
    if (n1 > 0 && n2 > 0) {
      A[n1 - 1][n2 - 1] -= g;
      A[n2 - 1][n1 - 1] -= g;
    }
  };

  const stampCurrent = (n1: number, n2: number, currentFromN1ToN2: number) => {
    // Current leaving n1 into n2 -> subtract from b[n1], add to b[n2]
    if (n1 > 0) b[n1 - 1] -= currentFromN1ToN2;
    if (n2 > 0) b[n2 - 1] += currentFromN1ToN2;
  };

  // Start time so that step === captureStartStep corresponds to t = -2 * period,
  // and step === captureStartStep + 2 * stepsPerPeriod corresponds to t = 0 exactly!
  const tStart = -(warmupCycles + 2) * period;

  for (let step = 0; step <= totalSteps; step++) {
    const t = tStart + step * dt;
    const vs = evaluateFgWaveform(fg, t);

    // Use Backward Euler for very first 2 startup steps to damp any initial discontinuity,
    // then Trapezoidal Rule (O(dt^2)) for exact steady-state accuracy!
    const useBackwardEuler = step < 2;

    const maxNewton = diodes.length > 0 ? 35 : 1;

    for (let iter = 0; iter < maxNewton; iter++) {
      // Clear A and b
      for (let r = 0; r < S; r++) {
        A[r].fill(0);
        b[r] = 0;
      }

      // GMIN to ground on every node to guarantee non-singularity for floating nets
      for (let node = 0; node < N; node++) {
        A[node][node] += GMIN;
      }

      // Stamp resistors
      for (let i = 0; i < resistors.length; i++) {
        const res = resistors[i];
        stampConductance(res.n1, res.n2, res.g);
      }

      // Stamp capacitors (companion model)
      for (let i = 0; i < capacitors.length; i++) {
        const cap = capacitors[i];
        if (useBackwardEuler) {
          const geq = cap.c / dt;
          const iHist = geq * cap.vPrev; // flows from n2 to n1 -> entering n1
          stampConductance(cap.n1, cap.n2, geq);
          stampCurrent(cap.n1, cap.n2, -iHist);
        } else {
          const geq = (2 * cap.c) / dt;
          const iHist = geq * cap.vPrev + cap.iPrev;
          stampConductance(cap.n1, cap.n2, geq);
          stampCurrent(cap.n1, cap.n2, -iHist);
        }
      }

      // Stamp linearized nonlinear diodes
      for (let i = 0; i < diodes.length; i++) {
        const d = diodes[i];
        const { id, gd } = evalDiode(d.vd);
        const ieq = id - gd * d.vd;
        stampConductance(d.n1, d.n2, gd);
        stampCurrent(d.n1, d.n2, ieq);
      }

      // Stamp FG voltage source between fgPosNet and GND (net 0)
      if (hasFgSource) {
        const srcRow = N;
        A[fgPosNet - 1][srcRow] += 1;
        A[srcRow][fgPosNet - 1] += 1;
        b[srcRow] = vs;
      }

      const sol = solveLinearSystem(A, b, S);
      if (!sol) {
        errors.push('Circuit solver encountered a singular matrix — check for floating loops.');
        return makeEmptyResult(fg, netlist.holeToNet, errors, warnings);
      }
      lastSol = sol;

      if (diodes.length === 0) break;

      let maxDiff = 0;
      for (let i = 0; i < diodes.length; i++) {
        const d = diodes[i];
        const v1 = d.n1 > 0 ? sol[d.n1 - 1] : 0;
        const v2 = d.n2 > 0 ? sol[d.n2 - 1] : 0;
        const vdRaw = v1 - v2;
        const diff = Math.abs(vdRaw - d.vd);
        if (diff > maxDiff) maxDiff = diff;
        d.vd = limitDiodeStep(vdRaw, d.vd);
      }
      if (maxDiff < 1e-8) break;
    }

    // Update capacitor states for next timestep
    for (let i = 0; i < capacitors.length; i++) {
      const cap = capacitors[i];
      const v1 = cap.n1 > 0 ? lastSol[cap.n1 - 1] : 0;
      const v2 = cap.n2 > 0 ? lastSol[cap.n2 - 1] : 0;
      const vNew = v1 - v2;
      if (useBackwardEuler) {
        cap.iPrev = (cap.c / dt) * (vNew - cap.vPrev);
      } else {
        cap.iPrev = ((2 * cap.c) / dt) * (vNew - cap.vPrev) - cap.iPrev;
      }
      cap.vPrev = vNew;
    }

    // Record capture window [-2T, +2T]
    if (step >= captureStartStep) {
      const idx = step - captureStartStep;
      time[idx] = t;
      fgWave[idx] = vs;
      for (let node = 1; node <= N; node++) {
        nodeVoltages[node][idx] = lastSol[node - 1];
      }
    }
  }

  // Extract CH1, CH2, and Math = CH1 - CH2 waveforms
  const getNetWave = (net: number | null): number[] => {
    if (net === null || !nodeVoltages[net]) {
      return new Array<number>(captureLen).fill(0);
    }
    return nodeVoltages[net];
  };

  const ch1PosWave = getNetWave(netlist.probeNets.ch1Pos);
  const ch1GndWave = getNetWave(netlist.probeNets.ch1Gnd ?? 0);
  const ch2PosWave = getNetWave(netlist.probeNets.ch2Pos);
  const ch2GndWave = getNetWave(netlist.probeNets.ch2Gnd ?? 0);

  const ch1 = new Array<number>(captureLen);
  const ch2 = new Array<number>(captureLen);
  const math = new Array<number>(captureLen);

  for (let i = 0; i < captureLen; i++) {
    const v1 = netlist.probeNets.ch1Pos !== null ? ch1PosWave[i] - ch1GndWave[i] : 0;
    const v2 = netlist.probeNets.ch2Pos !== null ? ch2PosWave[i] - ch2GndWave[i] : 0;
    ch1[i] = v1;
    ch2[i] = v2;
    math[i] = v1 - v2;
  }

  // Compute stats over the central cycle [-T/2, +T/2]
  const centerStart = Math.round((1.5 * stepsPerPeriod));
  const centerEnd = Math.round((2.5 * stepsPerPeriod));
  const sliceCenter = (arr: number[]) => arr.slice(centerStart, centerEnd + 1);

  const sampleAt = (source: TraceSource | 'fg', tSec: number): number => {
    const arr =
      source === 'ch1'
        ? ch1
        : source === 'ch2'
          ? ch2
          : source === 'math'
            ? math
            : fgWave;
    const t0 = time[0];
    const tEnd = time[time.length - 1];
    // Wrap periodically into [-T/2, +T/2] if outside captured range
    let tQuery = tSec;
    if (tQuery < t0 || tQuery > tEnd) {
      const shifted = ((((tQuery + period / 2) % period) + period) % period) - period / 2;
      tQuery = shifted;
    }
    const fIdx = (tQuery - t0) / dt;
    const i0 = Math.max(0, Math.min(arr.length - 2, Math.floor(fIdx)));
    const frac = Math.max(0, Math.min(1, fIdx - i0));
    return arr[i0] + frac * (arr[i0 + 1] - arr[i0]);
  };

  return {
    ok: true,
    errors,
    warnings,
    time,
    fgWave,
    ch1,
    ch2,
    math,
    nodeVoltages,
    holeToNet: netlist.holeToNet,
    period,
    stats: {
      ch1: computeStats(sliceCenter(ch1)),
      ch2: computeStats(sliceCenter(ch2)),
      math: computeStats(sliceCenter(math)),
    },
    sampleAt,
  };
}
