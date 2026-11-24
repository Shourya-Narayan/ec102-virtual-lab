import { resolveBreadboardNetlist } from './breadboardNetlist';
import type {
  ChannelStats,
  CircuitComponent,
  FgSettings,
  ProbeMap,
  RpsSettings,
  SimulationResult,
  TraceSource,
} from './types';

/**
 * Standard 1N4007 SPICE diode parameters (exact ideal physical model)
 * IS = 14.11 nA, N = 1.984, VT = 25.85 mV (300 K) -> ~0.59-0.65 V forward drop at 1-5 mA
 */
const DIODE_IS = 14.11e-9;
const DIODE_N = 1.984;
const DIODE_VT = 0.02585;
const DIODE_NVT = DIODE_N * DIODE_VT;
const DIODE_MAX_VD = 1.25;
const DIODE_G_LEAK = 1e-12;
const GMIN = 1e-11;

export function evaluateFgWaveform(fg: FgSettings, tSec: number): number {
  if (!fg.enabled) return 0;
  const freq = Math.max(1, fg.frequency);
  const rawPhase = freq * tSec;
  const phase = ((rawPhase % 1) + 1) % 1;
  const amp = fg.vpp / 2;

  switch (fg.waveform) {
    case 'triangle': {
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

/**
 * Computes fundamental phase difference (CH2 phase - CH1 phase) in degrees
 * using exact single-cycle DFT projection over one period.
 */
function computePhaseDiffDeg(
  timeSlice: number[],
  ch1Slice: number[],
  ch2Slice: number[],
  freq: number
): number | null {
  const n = timeSlice.length - 1;
  if (n < 16) return null;
  const omega = 2 * Math.PI * freq;

  let c1 = 0;
  let s1 = 0;
  let c2 = 0;
  let s2 = 0;

  for (let i = 0; i < n; i++) {
    const angle = omega * timeSlice[i];
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    c1 += ch1Slice[i] * cosA;
    s1 += ch1Slice[i] * sinA;
    c2 += ch2Slice[i] * cosA;
    s2 += ch2Slice[i] * sinA;
  }

  const mag1 = Math.hypot(c1, s1);
  const mag2 = Math.hypot(c2, s2);
  if (mag1 < 1e-4 || mag2 < 1e-4) return null;

  // For A*sin(wt + phi) = A*sin(phi)*cos(wt) + A*cos(phi)*sin(wt), phi = atan2(c, s)
  const phi1 = Math.atan2(c1, s1);
  const phi2 = Math.atan2(c2, s2);
  let diff = ((phi2 - phi1) * 180) / Math.PI;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

/**
 * Computes 10%->90% rise time (tr) and 90%->10% fall time (tf) for CH2 over a full period [0, T]
 */
function computeStepTimes(
  time: number[],
  ch2: number[],
  period: number
): { riseTimeSec: number | null; fallTimeSec: number | null } {
  // Slice one full cycle [0, T] (rising edge starts at t=0, falling edge starts at t=T/2)
  const zeroIdx = time.findIndex((t) => t >= -1e-12);
  const endIdx = time.findIndex((t) => t >= period - 1e-12);
  if (zeroIdx < 0 || endIdx <= zeroIdx + 10) {
    return { riseTimeSec: null, fallTimeSec: null };
  }

  let vmin = Infinity;
  let vmax = -Infinity;
  for (let i = zeroIdx; i <= endIdx; i++) {
    if (ch2[i] < vmin) vmin = ch2[i];
    if (ch2[i] > vmax) vmax = ch2[i];
  }
  const span = vmax - vmin;
  if (span < 0.05) return { riseTimeSec: null, fallTimeSec: null };

  const v10 = vmin + 0.1 * span;
  const v90 = vmin + 0.9 * span;

  const findCrossing = (
    start: number,
    end: number,
    level: number,
    rising: boolean
  ): number | null => {
    for (let i = start; i < end; i++) {
      const y0 = ch2[i];
      const y1 = ch2[i + 1];
      const hit = rising ? y0 <= level && y1 >= level : y0 >= level && y1 <= level;
      if (hit && Math.abs(y1 - y0) > 1e-12) {
        const frac = (level - y0) / (y1 - y0);
        return time[i] + frac * (time[i + 1] - time[i]);
      }
    }
    return null;
  };

  const midIdx = Math.floor((zeroIdx + endIdx) / 2);
  const tR10 = findCrossing(zeroIdx, midIdx, v10, true);
  const tR90 = findCrossing(zeroIdx, midIdx, v90, true);
  const tF90 = findCrossing(midIdx, endIdx, v90, false);
  const tF10 = findCrossing(midIdx, endIdx, v10, false);

  return {
    riseTimeSec: tR10 !== null && tR90 !== null && tR90 > tR10 ? tR90 - tR10 : null,
    fallTimeSec: tF90 !== null && tF10 !== null && tF10 > tF90 ? tF10 - tF90 : null,
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
    gain: 0,
    phaseDiffDeg: null,
    riseTimeSec: null,
    fallTimeSec: null,
    sampleAt: (src, tSec) => (src === 'fg' ? evaluateFgWaveform(fg, tSec) : 0),
  };
}

interface VoltageSourceSpec {
  posNet: number;
  negNet: number;
  evalV: (t: number) => number;
}

export function simulateBreadboardCircuit(
  components: CircuitComponent[],
  probes: ProbeMap,
  fg: FgSettings,
  rps?: RpsSettings
): SimulationResult {
  const netlist = resolveBreadboardNetlist(components, probes);
  const errors: string[] = [];
  const warnings: string[] = [];

  const sources: VoltageSourceSpec[] = [];

  // FG Voltage Source
  if (netlist.probeNets.fgPos !== null && netlist.probeNets.fgGnd !== null) {
    if (netlist.probeNets.fgPos === netlist.probeNets.fgGnd) {
      errors.push('Short Circuit Detected: FG (+) and FG GND are on the same electrical node!');
    } else {
      sources.push({
        posNet: netlist.probeNets.fgPos,
        negNet: netlist.probeNets.fgGnd,
        evalV: (t) => evaluateFgWaveform(fg, t),
      });
    }
  } else if (!rps) {
    if (netlist.probeNets.fgPos === null) {
      errors.push('Function Generator (+) probe is not connected to the breadboard.');
    }
    if (netlist.probeNets.fgGnd === null) {
      errors.push('Function Generator GND probe is not connected to the breadboard.');
    }
  }

  // Dual-Rail DC Power Supply (RPS: +VD1 / COM / -VD2)
  if (rps) {
    const comNet = netlist.probeNets.rpsCom ?? netlist.probeNets.fgGnd ?? 0;
    if (netlist.probeNets.rpsPos !== null) {
      if (netlist.probeNets.rpsPos === comNet) {
        errors.push('Short Circuit Detected: DC Power Supply (+VD1) is shorted to COM/GND!');
      } else {
        const v1 = rps.enabled && rps.vd1Active ? rps.vd1 : 0;
        sources.push({
          posNet: netlist.probeNets.rpsPos,
          negNet: comNet,
          evalV: () => v1,
        });
      }
    }
    if (netlist.probeNets.rpsNeg !== null) {
      if (netlist.probeNets.rpsNeg === comNet) {
        errors.push('Short Circuit Detected: DC Power Supply (−VD2) is shorted to COM/GND!');
      } else if (
        netlist.probeNets.rpsPos !== null &&
        netlist.probeNets.rpsNeg === netlist.probeNets.rpsPos
      ) {
        errors.push('Short Circuit Detected: +VD1 and −VD2 rails are shorted together!');
      } else {
        const v2 = rps.enabled && rps.vd2Active ? rps.vd2 : 0;
        sources.push({
          posNet: netlist.probeNets.rpsNeg,
          negNet: comNet,
          evalV: () => v2,
        });
      }
    }
    // Check if FG(+) was accidentally tied directly onto +VD1 or -VD2 rail
    if (
      netlist.probeNets.fgPos !== null &&
      (netlist.probeNets.fgPos === netlist.probeNets.rpsPos ||
        netlist.probeNets.fgPos === netlist.probeNets.rpsNeg)
    ) {
      errors.push('Voltage source conflict: FG (+) is directly shorted to a DC Power Supply rail!');
    }
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

  const N = netlist.netCount;
  const M = sources.length;
  const S = N + M;

  const freq = Math.max(1, fg.frequency);
  const period = 1 / freq;

  // Estimate largest RC time constant to guarantee exact periodic steady-state even at 10 kHz
  let maxR = 0;
  let maxC = 0;
  const resistors: Array<{ n1: number; n2: number; g: number }> = [];
  const capacitors: Array<{ n1: number; n2: number; c: number; vPrev: number; iPrev: number }> = [];
  const diodes: Array<{ n1: number; n2: number; vd: number }> = [];

  for (const item of netlist.activeComponents) {
    const { component, n1, n2 } = item;
    if (n1 === n2) continue;
    if (component.type === 'resistor') {
      const r = Math.max(1e-3, component.value);
      if (r > maxR) maxR = r;
      resistors.push({ n1, n2, g: 1 / r });
    } else if (component.type === 'capacitor') {
      const c = Math.max(0, component.value);
      if (c > maxC) maxC = c;
      if (c > 0) {
        capacitors.push({ n1, n2, c, vPrev: 0, iPrev: 0 });
      }
    } else if (component.type === 'diode') {
      diodes.push({ n1, n2, vd: 0.0 });
    }
  }

  const estTau = maxR * maxC;
  const hasCaps = capacitors.length > 0;
  const stepsPerPeriod = freq >= 5000 ? 240 : 400;
  const warmupCycles = !hasCaps
    ? 1
    : Math.max(10, Math.min(36, Math.ceil((14 * Math.max(estTau, 0.00015)) / period)));
  const captureCycles = 4; // [-2T, +2T] centered at t = 0
  const totalCycles = warmupCycles + captureCycles;
  const totalSteps = totalCycles * stepsPerPeriod;
  const captureStartStep = warmupCycles * stepsPerPeriod;
  const dt = period / stepsPerPeriod;

  const captureLen = captureCycles * stepsPerPeriod + 1;
  const time = new Array<number>(captureLen);
  const fgWave = new Array<number>(captureLen);
  const nodeVoltages: Record<number, number[]> = { 0: new Array<number>(captureLen).fill(0) };
  for (let node = 1; node <= N; node++) {
    nodeVoltages[node] = new Array<number>(captureLen);
  }

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
    if (n1 > 0) b[n1 - 1] -= currentFromN1ToN2;
    if (n2 > 0) b[n2 - 1] += currentFromN1ToN2;
  };

  const tStart = -(warmupCycles + 2) * period;

  for (let step = 0; step <= totalSteps; step++) {
    const t = tStart + step * dt;
    const vsFg = evaluateFgWaveform(fg, t);

    // Backward Euler on first 2 startup steps & on sharp square transitions prevents trapezoidal ringing
    const phaseNow = ((freq * t) % 1 + 1) % 1;
    const nearSquareEdge =
      fg.waveform === 'square' &&
      (phaseNow < 1.5 / stepsPerPeriod ||
        Math.abs(phaseNow - 0.5) < 1.5 / stepsPerPeriod ||
        phaseNow > 1 - 1.5 / stepsPerPeriod);
    const useBackwardEuler = step < 2 || nearSquareEdge;

    const maxNewton = diodes.length > 0 ? 35 : 1;

    for (let iter = 0; iter < maxNewton; iter++) {
      for (let r = 0; r < S; r++) {
        A[r].fill(0);
        b[r] = 0;
      }

      for (let node = 0; node < N; node++) {
        A[node][node] += GMIN;
      }

      for (let i = 0; i < resistors.length; i++) {
        const res = resistors[i];
        stampConductance(res.n1, res.n2, res.g);
      }

      for (let i = 0; i < capacitors.length; i++) {
        const cap = capacitors[i];
        if (useBackwardEuler) {
          const geq = cap.c / dt;
          const iHist = geq * cap.vPrev;
          stampConductance(cap.n1, cap.n2, geq);
          stampCurrent(cap.n1, cap.n2, -iHist);
        } else {
          const geq = (2 * cap.c) / dt;
          const iHist = geq * cap.vPrev + cap.iPrev;
          stampConductance(cap.n1, cap.n2, geq);
          stampCurrent(cap.n1, cap.n2, -iHist);
        }
      }

      for (let i = 0; i < diodes.length; i++) {
        const d = diodes[i];
        const { id, gd } = evalDiode(d.vd);
        const ieq = id - gd * d.vd;
        stampConductance(d.n1, d.n2, gd);
        stampCurrent(d.n1, d.n2, ieq);
      }

      // Stamp all active independent voltage sources
      for (let sIdx = 0; sIdx < M; sIdx++) {
        const src = sources[sIdx];
        const srcRow = N + sIdx;
        if (src.posNet > 0) {
          A[src.posNet - 1][srcRow] += 1;
          A[srcRow][src.posNet - 1] += 1;
        }
        if (src.negNet > 0) {
          A[src.negNet - 1][srcRow] -= 1;
          A[srcRow][src.negNet - 1] -= 1;
        }
        b[srcRow] = src.evalV(t);
      }

      const sol = solveLinearSystem(A, b, S);
      if (!sol) {
        errors.push('Circuit solver encountered a singular matrix — check for floating or shorted voltage loops.');
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

    if (step >= captureStartStep) {
      const idx = step - captureStartStep;
      time[idx] = t;
      fgWave[idx] = vsFg;
      for (let node = 1; node <= N; node++) {
        nodeVoltages[node][idx] = lastSol[node - 1];
      }
    }
  }

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

  const centerStart = Math.round(1.5 * stepsPerPeriod);
  const centerEnd = Math.round(2.5 * stepsPerPeriod);
  const sliceCenter = (arr: number[]) => arr.slice(centerStart, centerEnd + 1);

  const ch1Stats = computeStats(sliceCenter(ch1));
  const ch2Stats = computeStats(sliceCenter(ch2));
  const mathStats = computeStats(sliceCenter(math));
  const gain = ch1Stats.vpp > 1e-4 ? ch2Stats.vpp / ch1Stats.vpp : 0;

  const phaseDiffDeg =
    fg.enabled && fg.waveform === 'sine'
      ? computePhaseDiffDeg(
          sliceCenter(time),
          sliceCenter(ch1),
          sliceCenter(ch2),
          freq
        )
      : null;

  const { riseTimeSec, fallTimeSec } =
    fg.enabled && fg.waveform === 'square'
      ? computeStepTimes(time, ch2, period)
      : { riseTimeSec: null, fallTimeSec: null };

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
      ch1: ch1Stats,
      ch2: ch2Stats,
      math: mathStats,
    },
    gain,
    phaseDiffDeg,
    riseTimeSec,
    fallTimeSec,
    sampleAt,
  };
}
