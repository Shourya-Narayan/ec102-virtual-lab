import { resolveBreadboardNetlist } from '../engine/breadboardNetlist';
import type {
  CircuitComponent,
  FgSettings,
  NodeMarker,
  ProbeMap,
  VerificationItem,
  VerificationResult,
} from '../engine/types';
import type { ProcedureStep, QuizQuestion, VivaCard } from './exp2Kirchhoff';

export type Exp5Mode = 'step' | 'freq';

export const EXP5_STEP_FG: FgSettings = {
  enabled: true,
  waveform: 'square',
  frequency: 1000,
  vpp: 4.0,
  offset: 2.0, // 0V bottom -> 4V top (Vom = 2.0V, 0.1Vom = 0.2V, 0.9Vom = 1.8V)
};

export const EXP5_FREQ_FG: FgSettings = {
  enabled: true,
  waveform: 'sine',
  frequency: 1000,
  vpp: 4.0,
  offset: 0.0,
};

/** Exact 1-2-5 sequence + extra points around fc from Procedure Step 7 */
export const EXP5_SWEEP_FREQS = [
  100, 200, 500, 1000, 1200, 1400, 1600, 1800, 2000, 5000, 10000,
] as const;

export const EXP5_THEORY = {
  r1: 22000,
  r2: 22000,
  c: 0.01e-6,
  req: 11000, // 22k || 22k
  tau: 110e-6, // 110 us
  am: 0.5, // R2 / (R1 + R2)
  trUs: 2.2 * 110, // 242 us (exact ln(9)*110 = 241.7 us)
  fcHz: 1 / (2 * Math.PI * 11000 * 0.01e-6), // 1446.86 Hz
} as const;

export const EXP5_PRESET_PROBES: ProbeMap = {
  fgPos: 'e6',
  fgGnd: 'bn2',
  ch1Pos: 'b6',
  ch1Gnd: 'bn4',
  ch2Pos: 'b14',
  ch2Gnd: 'bn6',
};

export const EXP5_NODE_MARKERS: NodeMarker[] = [
  { label: 'vs', col: 6, hole: 'a6', desc: 'Input Source vs (FG)', netKey: 'a' },
  { label: 'vo', col: 14, hole: 'a14', desc: 'Low-Pass Filter Output vo', netKey: 'vo' },
];

export const EXP5_PRESET_COMPONENTS: CircuitComponent[] = [
  {
    id: 'r1_5',
    type: 'resistor',
    label: 'R1',
    pin1: 'd6',
    pin2: 'd14',
    value: 22000,
  },
  {
    id: 'r2_5',
    type: 'resistor',
    label: 'R2',
    pin1: 'e14',
    pin2: 'f14',
    value: 22000,
  },
  {
    id: 'w_gnd_r2',
    type: 'wire',
    label: 'GND-R2',
    pin1: 'j14',
    pin2: 'bn12',
    value: 0,
    color: 'black',
  },
  {
    id: 'w_vo_cap',
    type: 'wire',
    label: 'VO-C',
    pin1: 'c14',
    pin2: 'c19',
    value: 0,
    color: 'yellow',
  },
  {
    id: 'c_5',
    type: 'capacitor',
    label: 'C',
    pin1: 'e19',
    pin2: 'f19',
    value: 0.01e-6, // 0.01 uF
  },
  {
    id: 'w_gnd_c',
    type: 'wire',
    label: 'GND-C',
    pin1: 'j19',
    pin2: 'bn16',
    value: 0,
    color: 'black',
  },
];

function approxEq(a: number, b: number, relTol = 0.02): boolean {
  if (b === 0) return Math.abs(a) < 1e-9;
  return Math.abs(a - b) / Math.abs(b) <= relTol;
}

export function verifyExp5Circuit(
  components: CircuitComponent[],
  probes: ProbeMap,
  fg: FgSettings,
  mode: Exp5Mode
): VerificationResult {
  const netlist = resolveBreadboardNetlist(components, probes);
  const items: VerificationItem[] = [];
  const netGnd = netlist.probeNets.fgGnd;
  const netIn = netlist.probeNets.fgPos;

  const fgConn = netIn !== null && netGnd !== null && netIn !== netGnd;
  items.push({
    id: 'fg',
    label: 'FG input vs connected between input node and GND',
    passed: fgConn,
    detail: fgConn ? `FG (+) on Net ${netIn}, GND on Net ${netGnd}.` : 'Connect FG (+) and FG GND clips.',
  });

  let netVo: number | undefined;
  if (fgConn && netIn !== null) {
    const r1 = netlist.activeComponents.find(
      (ac) =>
        ac.component.type === 'resistor' &&
        approxEq(ac.component.value, 22000) &&
        ((ac.n1 === netIn && ac.n2 !== netGnd) || (ac.n2 === netIn && ac.n1 !== netGnd))
    );
    if (r1) netVo = r1.n1 === netIn ? r1.n2 : r1.n1;
  }
  items.push({
    id: 'r1',
    label: 'Series Resistor R1 (22 kΩ) connects vs → vo',
    passed: netVo !== undefined,
    detail:
      netVo !== undefined
        ? `R1 (22 kΩ) links vs to filter output node vo (Net ${netVo}).`
        : 'Place a 22 kΩ series resistor from vs to output node vo.',
  });

  const r2Ok =
    netVo !== undefined &&
    netGnd !== null &&
    netlist.activeComponents.some(
      (ac) =>
        ac.component.type === 'resistor' &&
        approxEq(ac.component.value, 22000) &&
        ((ac.n1 === netVo && ac.n2 === netGnd) || (ac.n2 === netVo && ac.n1 === netGnd))
    );
  items.push({
    id: 'r2',
    label: 'Shunt Resistor R2 (22 kΩ) connects vo → GND',
    passed: r2Ok,
    detail: r2Ok
      ? 'R2 = 22 kΩ sets passband gain Am = 0.5 and Req = 22k‖22k = 11 kΩ.'
      : 'Connect a 22 kΩ shunt resistor from vo to the GND bus.',
  });

  const cOk =
    netVo !== undefined &&
    netGnd !== null &&
    netlist.activeComponents.some(
      (ac) =>
        ac.component.type === 'capacitor' &&
        approxEq(ac.component.value, 0.01e-6) &&
        ((ac.n1 === netVo && ac.n2 === netGnd) || (ac.n2 === netVo && ac.n1 === netGnd))
    );
  items.push({
    id: 'cap',
    label: 'Shunt Capacitor C (0.01 µF) in parallel with R2 (vo → GND)',
    passed: cOk,
    detail: cOk
      ? '0.01 µF capacitor sets τ = 110 µs and fc = 1.447 kHz.'
      : 'Connect a 0.01 µF capacitor from vo to GND in parallel with R2.',
  });

  const probesOk =
    netIn !== null &&
    netVo !== undefined &&
    netlist.probeNets.ch1Pos === netIn &&
    netlist.probeNets.ch2Pos === netVo;
  items.push({
    id: 'probes',
    label: 'DSO CH1 on vs and CH2 on vo',
    passed: probesOk,
    detail: probesOk
      ? 'CH1 monitors input vs; CH2 monitors RC filter output vo.'
      : 'Clip CH1 (+) to vs and CH2 (+) to vo.',
  });

  const fgOk =
    mode === 'step'
      ? fg.enabled &&
        fg.waveform === 'square' &&
        approxEq(fg.frequency, 1000) &&
        approxEq(fg.vpp, 4.0) &&
        approxEq(fg.offset, 2.0)
      : fg.enabled && fg.waveform === 'sine' && approxEq(fg.vpp, 4.0);
  items.push({
    id: 'fg_mode',
    label:
      mode === 'step'
        ? 'FG set for Step Response: 1 kHz Square, 4 Vpp, +2 V offset'
        : 'FG set for Frequency Response: Sine, 4 Vpp constant input',
    passed: fgOk,
    detail: fgOk
      ? mode === 'step'
        ? 'Step input 0 V → 4 V active (Vom = 2.0 V).'
        : `4.0 Vpp sine active at ${fg.frequency} Hz.`
      : mode === 'step'
        ? 'Set FG to 1000 Hz Square, 4 Vpp, +2 V offset.'
        : 'Set FG to Sine wave with 4.0 Vpp.',
  });

  const score = items.filter((i) => i.passed).length;
  return {
    allPassed: score === items.length,
    score,
    total: items.length,
    items,
    detectedNodes: netGnd !== null ? { gnd: netGnd, a: netIn ?? undefined, vo: netVo } : undefined,
  };
}

export const EXP5_PROCEDURE_STEPS: ProcedureStep[] = [
  {
    id: 'e5_1',
    section: 'setup',
    title: 'Assemble Low-Pass RC Filter (Fig. 5.1)',
    description:
      'Wire R1 = 22 kΩ series, R2 = 22 kΩ shunt to GND, and C = 0.01 µF in parallel with R2. Connect vs → CH1 and vo → CH2.',
  },
  {
    id: 'e5_2',
    section: 'manual',
    title: 'Step Response & Rise/Fall Time (Steps 1–3)',
    description:
      'Switch to Step Response (1 kHz Square, 0 V → 4 V). Align Y1 = 0.20 V (0.1 Vom) and Y2 = 1.80 V (0.9 Vom). Verify tr = tf = 2.2 Req C = 242 µs!',
  },
  {
    id: 'e5_3',
    section: 'manual',
    title: '1 kHz Sine & X-Y Mode Lissajous Ellipse (Steps 4–5)',
    description:
      'Switch to Frequency Response (1 kHz Sine, 4 Vpp). Measure phase lag (≈ −34.6°), then toggle DSO to X-Y Mode to observe the phase-shift ellipse!',
  },
  {
    id: 'e5_4',
    section: 'track',
    title: 'Low-Frequency In-Phase Straight Line (Step 6)',
    description:
      'In X-Y Mode, reduce frequency down to 100 Hz. Watch the ellipse collapse into a straight line of slope Am = 0.50 (vo in phase with vs).',
  },
  {
    id: 'e5_5',
    section: 'track',
    title: '1-2-5 Frequency Sweep & Semilog Bode Plot (Steps 7–10)',
    description:
      'Return to Y-T Mode and sweep 100 Hz → 10 kHz (including 1.2, 1.4, 1.6, 1.8 kHz). Plot G(dB) = 20 log10(A/Am) vs log(f) and verify fc = 1/(2πReqC) = 1.45 kHz at −3 dB!',
  },
];

export const EXP5_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question:
      'For the Fig. 5.1 Low-Pass RC Filter (R1 = 22 kΩ, R2 = 22 kΩ, C = 0.01 µF), what is the equivalent resistance Req seen by the capacitor?',
    options: ['44 kΩ', '22 kΩ', '11 kΩ', '10 kΩ'],
    correctIndex: 2,
    explanation:
      'With independent source vs shorted to GND, the capacitor sees R1 in parallel with R2: Req = 22 kΩ ‖ 22 kΩ = 11 kΩ.',
  },
  {
    id: 2,
    question: 'How are rise time (tr) and cut-off frequency (fc) related for a single-time-constant RC filter?',
    options: ['tr = 2.2 · fc', 'tr ≈ 0.35 / fc', 'tr = 2π · fc', 'tr = 1 / fc'],
    correctIndex: 1,
    explanation:
      'Since tr = 2.2τ and fc = 1/(2πτ), their product is tr · fc = 2.2 / (2π) ≈ 0.35, so tr ≈ 0.35 / fc (bandwidth–rise-time product!).',
  },
  {
    id: 3,
    question: 'At the cut-off frequency fc (G = −3 dB), what is the ratio of output gain A to passband gain Am?',
    options: ['A = 0.5 · Am', 'A = Am / √2 (≈ 0.707 Am)', 'A = 0.9 · Am', 'A = 0.1 · Am'],
    correctIndex: 1,
    explanation:
      '20·log10(1/√2) = −3.01 dB, corresponding to half the output power (and 70.7% of the passband voltage amplitude).',
  },
  {
    id: 4,
    question:
      'In DSO X-Y display mode (vs on X, vo on Y), what does a tilted straight line through the origin indicate?',
    options: [
      'A 90° phase difference between vo and vs.',
      'Zero phase difference (vo is in phase with vs), with slope equal to gain Am.',
      'The capacitor is shorted.',
      'The circuit is oscillating.',
    ],
    correctIndex: 1,
    explanation:
      'A Lissajous figure collapses from an ellipse to a straight line when phase shift Δφ = 0° (at low frequencies f ≪ fc), and its slope y/x equals the passband voltage gain Am = 0.5.',
  },
  {
    id: 5,
    question: 'Why are the Y1 and Y2 cursors set at 0.20 V and 1.80 V when measuring tr and tf for a 4 V step input?',
    options: [
      'Because 0.20 V and 1.80 V are arbitrary DSO defaults.',
      'Because Vom = 0.5·Vsm = 2.0 V, so 10% Vom = 0.20 V and 90% Vom = 1.80 V.',
      'Because the diode drop is 0.20 V.',
      'Because 1.80 V is the RMS value.',
    ],
    correctIndex: 1,
    explanation:
      'With Vsm = 4.0 V and DC divider Am = 22k/(22k+22k) = 0.5, the steady-state step amplitude is Vom = 2.0 V, making the 10% and 90% thresholds 0.20 V and 1.80 V.',
  },
];

export const EXP5_VIVA_CARDS: VivaCard[] = [
  {
    id: 1,
    tag: 'Time vs Freq Link',
    question:
      'What is the physical relationship between time-domain rise time (tr) and frequency-domain cut-off frequency (fc)?',
    answer:
      'They are inversely proportional: tr · fc = 2.2/(2π) ≈ 0.35! A faster circuit (smaller time constant τ = ReqC → shorter rise time tr) has a wider bandwidth (higher cut-off frequency fc). In this lab: tr ≈ 242 µs and fc ≈ 1.447 kHz → 242e-6 × 1447 = 0.350!',
  },
  {
    id: 2,
    tag: 'Why Req = 11 kΩ?',
    question: 'Why is the time constant τ = 11 kΩ × 0.01 µF instead of 22 kΩ × 0.01 µF?',
    answer:
      'By Thevenin’s theorem looking left from the capacitor terminals, the voltage divider R1 = 22 kΩ and R2 = 22 kΩ has equivalent Thevenin resistance Req = R1 ‖ R2 = 11 kΩ and Thevenin source 0.5·vs. Therefore τ = Req·C = 110 µs and Vom = 0.5·Vsm!',
  },
  {
    id: 3,
    tag: 'X-Y Lissajous',
    question:
      'Why does the X-Y screen show an ellipse at 1 kHz, and why does it flatten into a straight line at very low frequencies?',
    answer:
      'At f = 1 kHz (close to fc = 1.45 kHz), the capacitor introduces a phase lag φ = −arctan(f/fc) ≈ −34.6°, tracing an ellipse on the X-Y plane. As f → 0, Xc → ∞ so φ → 0° and vo(t) = 0.5·vs(t) at every instant — a straight line of slope Am = 0.5.',
  },
  {
    id: 4,
    tag: 'Log Scales',
    question: 'Why is frequency response plotted as dB Gain G = 20 log10(A/Am) vs log(f) on semilog paper?',
    answer:
      'First, human hearing responds logarithmically to both amplitude and frequency. Second, log scales compress wide frequency ranges (decades) cleanly and turn asymptotic power-law roll-offs into straight lines (−20 dB/decade above fc for a first-order RC filter)!',
  },
  {
    id: 5,
    tag: 'Square Wave Choice',
    question:
      'Why do we use a 1 kHz square wave to measure step response instead of a single manual switch step?',
    answer:
      'A 1 kHz square wave repeats positive and negative steps every 0.5 ms (≈ 4.5τ, long enough to reach >99% steady-state), allowing the DSO to trigger repeatedly and display a crisp, stationary rising & falling transient for accurate cursor measurement.',
  },
  {
    id: 6,
    tag: 'Roll-off Slope',
    question: 'What is the phase lag and attenuation slope well above fc (e.g., at 10 kHz)?',
    answer:
      'At f = fc, phase lag is −45° and G = −3 dB. Well above fc (f ≫ fc), phase lag approaches −90° and gain rolls off at −20 dB/decade (−6 dB/octave). At 10 kHz (≈ 6.9 fc), G ≈ −16.9 dB and phase ≈ −81.8°.',
  },
];
