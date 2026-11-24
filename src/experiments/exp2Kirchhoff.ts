import { resolveBreadboardNetlist } from '../engine/breadboardNetlist';
import type {
  CircuitComponent,
  FgSettings,
  HoleId,
  ProbeMap,
  VerificationItem,
  VerificationResult,
} from '../engine/types';

export interface ProcedureStep {
  id: string;
  section: 'setup' | 'manual' | 'track';
  title: string;
  description: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  hasFigure3?: boolean;
}

export interface VivaCard {
  id: number;
  question: string;
  answer: string;
  tag: string;
}

export const EXP2_DEFAULT_FG: FgSettings = {
  enabled: true,
  waveform: 'triangle',
  frequency: 1000,
  vpp: 5.0,
  offset: 2.5,
};

/**
 * Clean, spacious breadboard layout matching Experiment 2 Fig. 2.1:
 *   Col 6  (a6-e6)  = Node a (FG+, CH1+, R1 pin1)
 *   Col 12 (a12-e12)= Node b (R1 pin2, D anode, default CH2+)
 *   Col 18 (a18-e18)= Node c (D cathode, R2 pin1, C pin1)
 *   Col 24 (a24-e24)= Node d (C pin2, R3 pin1)
 *   Bottom '-' bus (bn1..bn25) = GND Bus (FG GND, CH1 GND, CH2 GND, R2->GND, R3->GND)
 */
export const EXP2_PRESET_COMPONENTS: CircuitComponent[] = [
  {
    id: 'r1',
    type: 'resistor',
    label: 'R1',
    pin1: 'd6',
    pin2: 'd12',
    value: 1000,
  },
  {
    id: 'd1',
    type: 'diode',
    label: 'D (1N4007)',
    pin1: 'c12', // Anode at node b
    pin2: 'c18', // Cathode at node c
    value: 0,
    model: '1N4007',
  },
  {
    id: 'r2',
    type: 'resistor',
    label: 'R2',
    pin1: 'e18',
    pin2: 'f18',
    value: 1000,
  },
  {
    id: 'c1',
    type: 'capacitor',
    label: 'C',
    pin1: 'd18',
    pin2: 'd24',
    value: 0.1e-6, // 0.1 uF
  },
  {
    id: 'r3',
    type: 'resistor',
    label: 'R3',
    pin1: 'e24',
    pin2: 'f24',
    value: 1000,
  },
  {
    id: 'w_gnd_r2',
    type: 'wire',
    label: 'GND-R2',
    pin1: 'j18',
    pin2: 'bn15',
    value: 0,
    color: 'black',
  },
  {
    id: 'w_gnd_r3',
    type: 'wire',
    label: 'GND-R3',
    pin1: 'j24',
    pin2: 'bn20',
    value: 0,
    color: 'black',
  },
];

export const EXP2_PRESET_PROBES: ProbeMap = {
  fgPos: 'e6',
  fgGnd: 'bn2',
  ch1Pos: 'b6',
  ch1Gnd: 'bn4',
  ch2Pos: 'b12', // Starts on node b (Step 2)
  ch2Gnd: 'bn6',
};

export const EXP2_EMPTY_PROBES: ProbeMap = {
  fgPos: 'a2',
  fgGnd: 'bn2',
  ch1Pos: 'b2',
  ch1Gnd: 'bn4',
  ch2Pos: null,
  ch2Gnd: 'bn6',
};

export const EXP2_NODE_MARKERS: Array<{ label: string; col: number; hole: HoleId; desc: string }> = [
  { label: 'a', col: 6, hole: 'a6', desc: 'FG input va' },
  { label: 'b', col: 12, hole: 'a12', desc: 'Between R1 & Diode Anode' },
  { label: 'c', col: 18, hole: 'a18', desc: 'KCL Node c (Cathode, R2, C)' },
  { label: 'd', col: 24, hole: 'a24', desc: 'Between C & R3' },
];

export const EXP2_TIMES = {
  t1: -0.0004, // -0.4 ms
  t2: 0.0003, // +0.3 ms
} as const;

function approxEq(a: number, b: number, relTol = 0.02): boolean {
  if (b === 0) return Math.abs(a) < 1e-9;
  return Math.abs(a - b) / Math.abs(b) <= relTol;
}

/**
 * Topology-independent electrical netlist verifier for Experiment 2 (Fig. 2.1).
 * Works whether the user loaded the preset OR wired from scratch in any columns!
 */
export function verifyExp2Circuit(
  components: CircuitComponent[],
  probes: ProbeMap,
  fg: FgSettings
): VerificationResult {
  const netlist = resolveBreadboardNetlist(components, probes);
  const items: VerificationItem[] = [];

  const netGnd = netlist.probeNets.fgGnd;
  const netA = netlist.probeNets.fgPos;

  // 1. FG Source & GND check
  const fgOk = netA !== null && netGnd !== null && netA !== netGnd;
  items.push({
    id: 'fg_conn',
    label: 'FG connected between node a and GND',
    passed: fgOk,
    detail: fgOk
      ? `FG (+) on Net ${netA}, FG GND on Net ${netGnd}.`
      : netA === netGnd && netA !== null
        ? 'Short circuit! FG (+) and FG GND are on the same rail/strip.'
        : 'Connect both FG (+) and FG GND clips onto the breadboard.',
  });

  // 2. Find R1 = 1 kΩ connected to netA
  let netB: number | undefined;
  let r1Comp: CircuitComponent | undefined;
  if (fgOk && netA !== null) {
    const match = netlist.activeComponents.find(
      (ac) =>
        ac.component.type === 'resistor' &&
        approxEq(ac.component.value, 1000) &&
        ((ac.n1 === netA && ac.n2 !== netGnd && ac.n2 !== netA) ||
          (ac.n2 === netA && ac.n1 !== netGnd && ac.n1 !== netA))
    );
    if (match) {
      r1Comp = match.component;
      netB = match.n1 === netA ? match.n2 : match.n1;
    }
  }
  items.push({
    id: 'r1',
    label: 'R1 (1.00 kΩ) connected from node a to node b',
    passed: netB !== undefined,
    detail:
      netB !== undefined
        ? `${r1Comp!.label} (${(r1Comp!.value / 1000).toFixed(2)} kΩ) links node a → node b.`
        : 'Place a 1.00 kΩ resistor from the FG (+) column (node a) to an isolated column (node b).',
  });

  // 3. Find Diode D (1N4007) with Anode at netB -> Cathode at netC
  let netC: number | undefined;
  let diodeReversed = false;
  if (netB !== undefined) {
    const fwd = netlist.activeComponents.find(
      (ac) =>
        ac.component.type === 'diode' &&
        ac.n1 === netB &&
        ac.n2 !== netB &&
        ac.n2 !== netA &&
        ac.n2 !== netGnd
    );
    if (fwd) {
      netC = fwd.n2;
    } else {
      const rev = netlist.activeComponents.find(
        (ac) => ac.component.type === 'diode' && ac.n2 === netB
      );
      if (rev) diodeReversed = true;
    }
  }
  items.push({
    id: 'diode',
    label: 'Diode D (1N4007) Anode at b → Cathode at c',
    passed: netC !== undefined,
    detail:
      netC !== undefined
        ? '1N4007 properly oriented (Anode at b, silver Cathode band at c).'
        : diodeReversed
          ? 'Diode is reversed! Select the diode and click "Flip Polarity" so Cathode faces node c.'
          : 'Connect the 1N4007 diode from node b (Anode) to a new column for node c (Cathode).',
  });

  // 4. Find R2 (1 kΩ) from netC to GND
  let r2Ok = false;
  if (netC !== undefined && netGnd !== null) {
    r2Ok = netlist.activeComponents.some(
      (ac) =>
        ac.component.type === 'resistor' &&
        approxEq(ac.component.value, 1000) &&
        ((ac.n1 === netC && ac.n2 === netGnd) || (ac.n2 === netC && ac.n1 === netGnd))
    );
  }
  items.push({
    id: 'r2',
    label: 'R2 (1.00 kΩ) connected from node c to GND',
    passed: r2Ok,
    detail: r2Ok
      ? '1.00 kΩ resistor connects node c cleanly to the GND bus.'
      : 'Connect a 1.00 kΩ resistor between node c and the GND bus (add a black jumper to GND if needed).',
  });

  // 5. Find Capacitor C (0.1 µF) from netC to netD
  let netD: number | undefined;
  if (netC !== undefined) {
    const capMatch = netlist.activeComponents.find(
      (ac) =>
        ac.component.type === 'capacitor' &&
        approxEq(ac.component.value, 0.1e-6) &&
        ((ac.n1 === netC && ac.n2 !== netC && ac.n2 !== netGnd) ||
          (ac.n2 === netC && ac.n1 !== netC && ac.n1 !== netGnd))
    );
    if (capMatch) {
      netD = capMatch.n1 === netC ? capMatch.n2 : capMatch.n1;
    }
  }
  items.push({
    id: 'cap',
    label: 'Capacitor C (0.1 µF) connected from node c to node d',
    passed: netD !== undefined,
    detail:
      netD !== undefined
        ? '0.1 µF capacitor connects node c to node d.'
        : 'Place a 0.1 µF capacitor from node c to a new column (node d).',
  });

  // 6. Find R3 (1 kΩ) from netD to GND
  let r3Ok = false;
  if (netD !== undefined && netGnd !== null) {
    r3Ok = netlist.activeComponents.some(
      (ac) =>
        ac.component.type === 'resistor' &&
        approxEq(ac.component.value, 1000) &&
        ((ac.n1 === netD && ac.n2 === netGnd) || (ac.n2 === netD && ac.n1 === netGnd))
    );
  }
  items.push({
    id: 'r3',
    label: 'R3 (1.00 kΩ) connected from node d to GND',
    passed: r3Ok,
    detail: r3Ok
      ? '1.00 kΩ resistor connects node d cleanly to the GND bus.'
      : 'Connect a 1.00 kΩ resistor between node d and the GND bus.',
  });

  // 7. DSO CH1 on node a & ground clips on GND
  const probesOk =
    fgOk &&
    netlist.probeNets.ch1Pos === netA &&
    netlist.probeNets.ch1Gnd === netGnd &&
    netlist.probeNets.ch2Gnd === netGnd;
  items.push({
    id: 'probes',
    label: 'DSO CH1 on node a & all black GND clips on GND bus',
    passed: probesOk,
    detail: probesOk
      ? 'CH1 monitors va at node a; CH1 & CH2 ground clips share the GND bus.'
      : 'Clip CH1 (+) to node a and make sure CH1 GND and CH2 GND are on the black GND bus.',
  });

  // 8. FG Waveform Settings
  const fgSettingsOk =
    fg.enabled &&
    fg.waveform === 'triangle' &&
    approxEq(fg.frequency, 1000, 0.01) &&
    approxEq(fg.vpp, 5.0, 0.01) &&
    approxEq(fg.offset, 2.5, 0.01);
  items.push({
    id: 'fg_settings',
    label: 'FG set to 1 kHz Triangle, 5 Vpp, +2.5 V offset (0 V → 5 V)',
    passed: fgSettingsOk,
    detail: fgSettingsOk
      ? 'Function Generator matches Fig. 2.2 exactly.'
      : 'Set FG to ON, Triangle wave, 1000 Hz, 5.0 Vpp, +2.5 V offset.',
  });

  const score = items.filter((i) => i.passed).length;
  return {
    allPassed: score === items.length,
    score,
    total: items.length,
    items,
    detectedNodes:
      netGnd !== null
        ? { gnd: netGnd, a: netA ?? undefined, b: netB, c: netC, d: netD }
        : undefined,
  };
}

export const EXP2_PROCEDURE_STEPS: ProcedureStep[] = [
  {
    id: 's1',
    section: 'setup',
    title: 'Assemble Fig. 2.1 on Breadboard',
    description:
      'Wire R1 = R2 = R3 = 1.00 kΩ, 1N4007 Diode (b → c), and C = 0.1 µF (c → d). Connect FG (+) and DSO CH1 (+) to node a, and all black GND leads to the bottom GND bus.',
  },
  {
    id: 's2',
    section: 'setup',
    title: 'Configure FG & DSO Trigger',
    description:
      'Set FG to 1 kHz Triangular wave, 5 Vpp, +2.5 V offset (0 V to 5 V). Set DSO Trigger Source = FG (Rising +) and Time/Div = 100 µs/div so 1 full cycle (-0.5 ms to +0.5 ms) is centered at t = 0.',
  },
  {
    id: 's3',
    section: 'setup',
    title: 'Align Coordinate Axes (X1 = 0, Y1 = 2.5 V)',
    description:
      'Enable Cursors in Manual Mode. Move X1 to 0.000 ms and Y1 to 2.500 V (forming the Fig. 2.2 axes).',
  },
  {
    id: 'm1',
    section: 'manual',
    title: 'Set X2 to t1 = -0.4 ms & Probe Node b',
    description:
      'Move cursor X2 to -0.400 ms. Connect CH2 to node b and turn on Math (CH1 − CH2). Position Y2 on va (CH1) and vab (Math) to capture both readings.',
  },
  {
    id: 'm2',
    section: 'manual',
    title: 'Probe Node c & Node d at t1',
    description:
      'Move CH2 to node c and capture vc (CH2) and vac (Math). Then move CH2 to node d and capture vd (CH2). Check KCL (vab − vc − vd) and KVL (va − vac − vc).',
  },
  {
    id: 't1',
    section: 'track',
    title: 'Switch to Track Waveform Mode at t1 = -0.4 ms',
    description:
      'Switch Cursor Mode to Track. Select CH1, CH2, and Math as the Track Source while probing b, c, and d to capture exact eye-error-free readings.',
  },
  {
    id: 't2',
    section: 'track',
    title: 'Repeat All Measurements at t2 = +0.3 ms',
    description:
      'Move X2 to +0.300 ms and capture va, vab, vac, vc, and vd in both Manual and Track modes. Compare KCL & KVL errors between Manual vs Track!',
  },
];

export const EXP2_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'KCL can be applied for __________.',
    options: [
      'Planar networks.',
      'Non-planar networks.',
      'Both planar and non-planar.',
      'Neither planar nor non-planar.',
    ],
    correctIndex: 2,
    explanation:
      'KCL depends only on conservation of charge at a node, so it holds for every lumped network — both planar and non-planar.',
  },
  {
    id: 2,
    question: 'KCL is applied at _________.',
    options: ['Loop.', 'Node.', 'Both loop and node.', 'Neither loop nor node.'],
    correctIndex: 1,
    explanation:
      'Kirchhoff’s Current Law states that the algebraic sum of currents entering/leaving a node (junction) is zero.',
  },
  {
    id: 3,
    question: 'KCL deals with the conservation of?',
    options: ['Momentum.', 'Mass.', 'Potential Energy.', 'Charge.'],
    correctIndex: 3,
    explanation:
      'Electric charge cannot accumulate at an ideal node, so total current (rate of charge flow) entering equals total current leaving.',
  },
  {
    id: 4,
    question: 'What is the value of the current I as shown in Fig. 3?',
    options: ['8A.', '7A.', '6A.', '5A.'],
    correctIndex: 0,
    hasFigure3: true,
    explanation:
      'By KCL at the junction: currents entering = I + 3A; currents leaving = 2A + 4A + 5A = 11A. Therefore I = 11A − 3A = 8A.',
  },
  {
    id: 5,
    question: 'What are the other names of KCL?',
    options: [
      "Kirchhoff's point rule.",
      "Kirchhoff's junction rule.",
      "Kirchhoff's nodal rule.",
      'All of the above.',
    ],
    correctIndex: 3,
    explanation:
      'KCL is commonly called Kirchhoff’s point rule, junction rule, or nodal rule — all three are correct.',
  },
];

export const EXP2_VIVA_CARDS: VivaCard[] = [
  {
    id: 1,
    tag: 'Core Theory',
    question:
      'Why does Experiment 2 deliberately include a 1N4007 diode (nonlinear) and a 0.1 µF capacitor (energy-storage) in the circuit?',
    answer:
      'To prove that Kirchhoff’s Laws (KCL & KVL) are universal topological laws — they hold at every instant of time for ANY lumped circuit, even when it contains nonlinear elements (diode) and dynamic/reactive elements (capacitor), regardless of waveform shape.',
  },
  {
    id: 2,
    tag: 'DSO Setup',
    question:
      'Why do we set the DSO Trigger Source to FG (External / Channel 1 va) with positive slope instead of triggering on Channel 2?',
    answer:
      'Because Channel 2 is moved repeatedly between nodes b, c, and d (which have different amplitudes and shapes). Triggering on the fixed FG signal va keeps the horizontal time reference (t = 0) locked and synchronized across every measurement so t1 = -0.4 ms and t2 = +0.3 ms always refer to the exact same instants of the cycle.',
  },
  {
    id: 3,
    tag: 'KCL Equation',
    question:
      'Why is verifying KCL (i1 − i2 − i3 = 0) equivalent to verifying vab − vc − vd = 0 in this experiment?',
    answer:
      'By Ohm’s Law: i1 = vab / R1, i2 = vc / R2, and i3 = vd / R3. Since we intentionally chose three matched 1% resistors R1 = R2 = R3 = 1.00 kΩ, multiplying i1 − i2 − i3 = 0 by R gives vab − vc − vd = 0 directly in volts!',
  },
  {
    id: 4,
    tag: 'Measurement',
    question:
      'Why did we use the DSO Math function (CH1 − CH2) to measure vab and vac instead of placing the CH2 ground clip directly on node b or node c?',
    answer:
      'Because a bench DSO’s BNC ground shields are internally shorted to earth ground (shared with the FG ground!). Clipping a DSO ground lead to node b or c would dead-short that node straight to ground, corrupting the circuit and possibly damaging the diode/FG.',
  },
  {
    id: 5,
    tag: 'Accuracy',
    question:
      'Why does Track Waveform Mode give smaller KCL/KVL errors than Manual Cursor Mode?',
    answer:
      'In Manual Mode, you position the horizontal Y2 cursor by eye onto the intersection of vertical cursor X2 with the trace, introducing parallax/pixel eye-estimation error. In Track Mode, the DSO locks Y2 mathematically onto the sampled waveform data at X2, eliminating eye-estimation error.',
  },
  {
    id: 6,
    tag: 'Waveform',
    question:
      'Why were the two measurement instants specifically chosen as t1 = -0.4 ms and t2 = +0.3 ms?',
    answer:
      'They sit in distinct operating regions of the 1 kHz triangular cycle: at t1 = -0.4 ms (va = 1.5 V, falling slope), the capacitor is discharging and diode conduction is low/near cut-in; at t2 = +0.3 ms (va = 4.5 V, just after peak), the diode is strongly forward-biased with substantial current through R1, R2, and C–R3. Both give non-zero, clearly measurable node voltages.',
  },
  {
    id: 7,
    tag: 'Troubleshooting',
    question: 'What happens to vc and vd if you accidentally reverse the 1N4007 diode on the breadboard?',
    answer:
      'Because va stays between 0 V and +5 V (never negative), reversing the diode (cathode at b, anode at c) keeps the diode permanently reverse-biased! Almost zero current flows to node c, so vc ≈ 0 V, vd ≈ 0 V, vb ≈ va, and vab ≈ 0 V.',
  },
  {
    id: 8,
    tag: 'Exam Classic',
    question: 'What conservation laws underlie KCL and KVL, and when do Kirchhoff’s laws break down?',
    answer:
      'KCL expresses conservation of electric charge at a node; KVL expresses conservation of energy around a closed loop. They hold under the lumped-element approximation (circuit dimensions ≪ signal wavelength λ, and negligible time-varying magnetic flux linkage outside inductors). At microwave/RF frequencies where λ is comparable to wire length, Maxwell’s equations / transmission-line theory are needed.',
  },
];
