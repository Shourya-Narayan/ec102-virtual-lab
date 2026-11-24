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

export type Exp4CircuitMode = 'actual' | 'thevenin';

export type Exp4LoadKey =
  | '1k'
  | '2.2k'
  | '4.7k'
  | '10k'
  | '22k'
  | '47k'
  | '100k'
  | 'cap'
  | 'diode';

export interface Exp4LoadSpec {
  key: Exp4LoadKey;
  label: string;
  short: string;
  loadType: 'Resistive' | 'Capacitive' | 'Diode';
  ohms?: number;
  farads?: number;
}

export const EXP4_LOADS: Exp4LoadSpec[] = [
  { key: '1k', label: '1.0 kΩ', short: '1k', loadType: 'Resistive', ohms: 1000 },
  { key: '2.2k', label: '2.2 kΩ', short: '2.2k', loadType: 'Resistive', ohms: 2200 },
  { key: '4.7k', label: '4.7 kΩ', short: '4.7k', loadType: 'Resistive', ohms: 4700 },
  { key: '10k', label: '10 kΩ', short: '10k', loadType: 'Resistive', ohms: 10000 },
  { key: '22k', label: '22 kΩ', short: '22k', loadType: 'Resistive', ohms: 22000 },
  { key: '47k', label: '47 kΩ', short: '47k', loadType: 'Resistive', ohms: 47000 },
  { key: '100k', label: '100 kΩ', short: '100k', loadType: 'Resistive', ohms: 100000 },
  { key: 'cap', label: '0.01 µF Cap', short: '0.01µF', loadType: 'Capacitive', farads: 0.01e-6 },
  { key: 'diode', label: '1N4007 Diode', short: 'Diode', loadType: 'Diode' },
];

export const EXP4_ACTUAL_FG: FgSettings = {
  enabled: true,
  waveform: 'sine',
  frequency: 1000,
  vpp: 4.0,
  offset: 2.0, // 0V min -> 4V max
};

export const EXP4_THEVENIN_FG: FgSettings = {
  enabled: true,
  waveform: 'sine',
  frequency: 1000,
  vpp: 1.0,
  offset: 0.5, // vOC = vs/4 => 0V min -> 1V max
};

export function getExp4PresetProbes(mode: Exp4CircuitMode): ProbeMap {
  if (mode === 'thevenin') {
    return {
      fgPos: 'e6',
      fgGnd: 'bn2',
      ch1Pos: 'b6',
      ch1Gnd: 'bn4',
      ch2Pos: 'b16',
      ch2Gnd: 'bn6',
    };
  }
  return {
    fgPos: 'e5',
    fgGnd: 'bn2',
    ch1Pos: 'b5',
    ch1Gnd: 'bn4',
    ch2Pos: 'b23',
    ch2Gnd: 'bn6',
  };
}

export function getExp4NodeMarkers(mode: Exp4CircuitMode): NodeMarker[] {
  if (mode === 'thevenin') {
    return [
      { label: 'vOC', col: 6, hole: 'a6', desc: 'Thevenin Source vOC = vs/4', netKey: 'a' },
      { label: 'vo', col: 16, hole: 'a16', desc: 'Load Terminal vo', netKey: 'vo' },
    ];
  }
  return [
    { label: 'vs', col: 5, hole: 'a5', desc: 'FG Input vs (0V–4V)', netKey: 'a' },
    { label: 'vo', col: 23, hole: 'a23', desc: 'Load Output Terminal vo', netKey: 'vo' },
  ];
}

function makeLoadComponent(loadKey: Exp4LoadKey, col: number): CircuitComponent {
  const spec = EXP4_LOADS.find((l) => l.key === loadKey) ?? EXP4_LOADS[3];
  const p1 = `e${col}`;
  const p2 = `f${col}`;
  if (spec.loadType === 'Capacitive') {
    return {
      id: 'load_comp',
      type: 'capacitor',
      label: 'CL',
      pin1: p1,
      pin2: p2,
      value: spec.farads ?? 0.01e-6,
    };
  }
  if (spec.loadType === 'Diode') {
    return {
      id: 'load_comp',
      type: 'diode',
      label: 'DL (1N4007)',
      pin1: p1, // Anode at vo -> conducts for positive vo!
      pin2: p2, // Cathode at GND
      value: 0,
      model: '1N4007',
    };
  }
  return {
    id: 'load_comp',
    type: 'resistor',
    label: 'RL',
    pin1: p1,
    pin2: p2,
    value: spec.ohms ?? 10000,
  };
}

export function buildExp4PresetComponents(
  mode: Exp4CircuitMode,
  loadKey: Exp4LoadKey
): CircuitComponent[] {
  if (mode === 'thevenin') {
    return [
      {
        id: 'ro_th',
        type: 'resistor',
        label: 'Ro',
        pin1: 'd6',
        pin2: 'd16',
        value: 10000, // 10 kOhm
      },
      makeLoadComponent(loadKey, 16),
      {
        id: 'w_gnd_load',
        type: 'wire',
        label: 'GND-L',
        pin1: 'j16',
        pin2: 'bn14',
        value: 0,
        color: 'black',
      },
    ];
  }

  // Actual resistive ladder Fig. 4.2(a): 20k series -> 20k shunt -> 10k series -> 20k shunt -> Load
  return [
    {
      id: 'ra1',
      type: 'resistor',
      label: 'R1',
      pin1: 'd5',
      pin2: 'd11',
      value: 20000,
    },
    {
      id: 'ra2',
      type: 'resistor',
      label: 'R2',
      pin1: 'e11',
      pin2: 'f11',
      value: 20000,
    },
    {
      id: 'w_gnd1',
      type: 'wire',
      label: 'GND-1',
      pin1: 'j11',
      pin2: 'bn9',
      value: 0,
      color: 'black',
    },
    {
      id: 'ra3',
      type: 'resistor',
      label: 'R3',
      pin1: 'd11',
      pin2: 'd17',
      value: 10000,
    },
    {
      id: 'ra4',
      type: 'resistor',
      label: 'R4',
      pin1: 'e17',
      pin2: 'f17',
      value: 20000,
    },
    {
      id: 'w_gnd2',
      type: 'wire',
      label: 'GND-2',
      pin1: 'j17',
      pin2: 'bn14',
      value: 0,
      color: 'black',
    },
    {
      id: 'w_vo_bridge',
      type: 'wire',
      label: 'OUT',
      pin1: 'c17',
      pin2: 'c23',
      value: 0,
      color: 'yellow',
    },
    makeLoadComponent(loadKey, 23),
    {
      id: 'w_gnd_load',
      type: 'wire',
      label: 'GND-L',
      pin1: 'j23',
      pin2: 'bn19',
      value: 0,
      color: 'black',
    },
  ];
}

function approxEq(a: number, b: number, relTol = 0.02): boolean {
  if (b === 0) return Math.abs(a) < 1e-9;
  return Math.abs(a - b) / Math.abs(b) <= relTol;
}

export function verifyExp4Circuit(
  components: CircuitComponent[],
  probes: ProbeMap,
  fg: FgSettings,
  mode: Exp4CircuitMode,
  loadKey: Exp4LoadKey
): VerificationResult {
  const netlist = resolveBreadboardNetlist(components, probes);
  const items: VerificationItem[] = [];
  const netGnd = netlist.probeNets.fgGnd;
  const netIn = netlist.probeNets.fgPos;
  const netOut = netlist.probeNets.ch2Pos;

  const fgConn = netIn !== null && netGnd !== null && netIn !== netGnd;
  items.push({
    id: 'fg_conn',
    label: mode === 'actual' ? 'FG source vs connected to GND' : 'FG Thevenin source vOC connected to GND',
    passed: fgConn,
    detail: fgConn
      ? `FG (+) on Net ${netIn}, GND on Net ${netGnd}.`
      : 'Connect FG (+) and FG GND clips onto separate rails/strips.',
  });

  if (mode === 'actual') {
    // Check 20k -> mid -> 20k to GND -> 10k -> out -> 20k to GND
    let netMid: number | undefined;
    if (fgConn && netIn !== null) {
      const r1 = netlist.activeComponents.find(
        (ac) =>
          ac.component.type === 'resistor' &&
          approxEq(ac.component.value, 20000) &&
          ((ac.n1 === netIn && ac.n2 !== netGnd) || (ac.n2 === netIn && ac.n1 !== netGnd))
      );
      if (r1) netMid = r1.n1 === netIn ? r1.n2 : r1.n1;
    }
    const midShuntOk =
      netMid !== undefined &&
      netGnd !== null &&
      netlist.activeComponents.some(
        (ac) =>
          ac.component.type === 'resistor' &&
          approxEq(ac.component.value, 20000) &&
          ((ac.n1 === netMid && ac.n2 === netGnd) || (ac.n2 === netMid && ac.n1 === netGnd))
      );
    items.push({
      id: 'stage1',
      label: 'First ladder stage: 20 kΩ series & 20 kΩ shunt to GND',
      passed: netMid !== undefined && midShuntOk,
      detail:
        netMid !== undefined && midShuntOk
          ? 'Stage 1 divider reduces vs to vs/2 with 10 kΩ output impedance.'
          : 'Connect 20 kΩ series from vs to mid-node and 20 kΩ shunt from mid-node to GND.',
    });

    let netVo: number | undefined;
    if (netMid !== undefined) {
      const r3 = netlist.activeComponents.find(
        (ac) =>
          ac.component.type === 'resistor' &&
          approxEq(ac.component.value, 10000) &&
          ((ac.n1 === netMid && ac.n2 !== netGnd && ac.n2 !== netIn) ||
            (ac.n2 === netMid && ac.n1 !== netGnd && ac.n1 !== netIn))
      );
      if (r3) netVo = r3.n1 === netMid ? r3.n2 : r3.n1;
    }
    const outShuntOk =
      netVo !== undefined &&
      netGnd !== null &&
      netlist.activeComponents.some(
        (ac) =>
          ac.component.type === 'resistor' &&
          approxEq(ac.component.value, 20000) &&
          ((ac.n1 === netVo && ac.n2 === netGnd) || (ac.n2 === netVo && ac.n1 === netGnd))
      );
    items.push({
      id: 'stage2',
      label: 'Second ladder stage: 10 kΩ series & 20 kΩ shunt to GND',
      passed: netVo !== undefined && outShuntOk,
      detail:
        netVo !== undefined && outShuntOk
          ? 'Stage 2 completes Fig. 4.2(a): exact vOC = vs/4 and Ro = 10 kΩ.'
          : 'Connect 10 kΩ series to output node vo and 20 kΩ shunt from vo to GND.',
    });

    const loadSpec = EXP4_LOADS.find((l) => l.key === loadKey)!;
    const loadOk =
      netVo !== undefined &&
      netGnd !== null &&
      netlist.activeComponents.some((ac) => {
        if (loadSpec.loadType === 'Diode') {
          return ac.component.type === 'diode' && ac.n1 === netVo && ac.n2 === netGnd;
        }
        const between = (ac.n1 === netVo && ac.n2 === netGnd) || (ac.n2 === netVo && ac.n1 === netGnd);
        if (!between) return false;
        if (loadSpec.loadType === 'Capacitive') {
          return ac.component.type === 'capacitor' && approxEq(ac.component.value, loadSpec.farads!);
        }
        return ac.component.type === 'resistor' && approxEq(ac.component.value, loadSpec.ohms!);
      });
    items.push({
      id: 'load',
      label: `Active Load (${loadSpec.label}) connected across vo → GND`,
      passed: loadOk,
      detail: loadOk
        ? `${loadSpec.label} connected cleanly across output terminals.`
        : `Connect ${loadSpec.label} between vo and GND${loadSpec.loadType === 'Diode' ? ' (Anode at vo, Cathode at GND)' : ''}.`,
    });

    const probesOk = netIn !== null && netVo !== undefined && netlist.probeNets.ch1Pos === netIn && netOut === netVo;
    items.push({
      id: 'probes',
      label: 'CH1 monitors vs and CH2 monitors load voltage vo',
      passed: probesOk,
      detail: probesOk ? 'Both DSO channels properly connected.' : 'Clip CH1 to vs and CH2 to vo.',
    });

    const fgOk =
      fg.enabled &&
      fg.waveform === 'sine' &&
      approxEq(fg.frequency, 1000) &&
      approxEq(fg.vpp, 4.0) &&
      approxEq(fg.offset, 2.0);
    items.push({
      id: 'fg_lvl',
      label: 'FG set to 1 kHz Sine, 4.0 Vpp, +2.0 V offset (0 V → 4 V)',
      passed: fgOk,
      detail: fgOk ? 'Matches Procedure A.1 exactly.' : 'Set FG to 1000 Hz Sine, 4 Vpp, +2 V offset.',
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

  // Thevenin Equivalent verification (Fig. 4.2b)
  let netVo: number | undefined;
  if (fgConn && netIn !== null) {
    const ro = netlist.activeComponents.find(
      (ac) =>
        ac.component.type === 'resistor' &&
        approxEq(ac.component.value, 10000) &&
        ((ac.n1 === netIn && ac.n2 !== netGnd) || (ac.n2 === netIn && ac.n1 !== netGnd))
    );
    if (ro) netVo = ro.n1 === netIn ? ro.n2 : ro.n1;
  }
  items.push({
    id: 'ro',
    label: 'Thevenin Resistance Ro = 10 kΩ in series with vOC',
    passed: netVo !== undefined,
    detail:
      netVo !== undefined
        ? 'Ro = 10 kΩ connects vOC source to load terminal vo.'
        : 'Place Ro = 10 kΩ between FG (+) and the load column.',
  });

  const loadSpec = EXP4_LOADS.find((l) => l.key === loadKey)!;
  const loadOk =
    netVo !== undefined &&
    netGnd !== null &&
    netlist.activeComponents.some((ac) => {
      if (loadSpec.loadType === 'Diode') {
        return ac.component.type === 'diode' && ac.n1 === netVo && ac.n2 === netGnd;
      }
      const between = (ac.n1 === netVo && ac.n2 === netGnd) || (ac.n2 === netVo && ac.n1 === netGnd);
      if (!between) return false;
      if (loadSpec.loadType === 'Capacitive') {
        return ac.component.type === 'capacitor' && approxEq(ac.component.value, loadSpec.farads!);
      }
      return ac.component.type === 'resistor' && approxEq(ac.component.value, loadSpec.ohms!);
    });
  items.push({
    id: 'load',
    label: `Load (${loadSpec.label}) connected across vo → GND`,
    passed: loadOk,
    detail: loadOk ? `${loadSpec.label} connected cleanly to Thevenin output.` : `Connect ${loadSpec.label} from vo to GND.`,
  });

  const fgOk =
    fg.enabled &&
    fg.waveform === 'sine' &&
    approxEq(fg.frequency, 1000) &&
    approxEq(fg.vpp, 1.0) &&
    approxEq(fg.offset, 0.5);
  items.push({
    id: 'fg_th',
    label: 'FG set to vOC = vs/4 (1 kHz Sine, 1.0 Vpp, +0.5 V offset: 0 V → 1 V)',
    passed: fgOk,
    detail: fgOk ? 'Matches Procedure A.5 exactly.' : 'Set FG to 1000 Hz Sine, 1 Vpp, +0.5 V offset.',
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

export const EXP4_PROCEDURE_STEPS: ProcedureStep[] = [
  {
    id: 'e4_1',
    section: 'setup',
    title: 'Assemble Fig. 4.2(a) & Set FG to 0 V → 4 V',
    description:
      'Build the 20k–20k–10k–20k ladder with FG at 1 kHz Sine, 4 Vpp, +2 V offset. Align Y1 = 0 V and Y2 = 4 V.',
  },
  {
    id: 'e4_2',
    section: 'manual',
    title: 'Measure All 7 Resistive Loads (Step A.3)',
    description:
      'Swap RL through 1.0, 2.2, 4.7, 10, 22, 47, and 100 kΩ. Capture Vo(Vpp), Peak Vo, and Peak Io = Vo/RL into the Observation Table.',
  },
  {
    id: 'e4_3',
    section: 'track',
    title: 'Extrapolate vOC, iSC & Ro from Vo–Io Plot (Step A.4)',
    description:
      'Inspect the live Vo vs Io straight line in the Obs Table tab. Confirm y-intercept vOC = 1.000 V, x-intercept iSC = 0.100 mA, and Ro = vOC/iSC = 10.00 kΩ.',
  },
  {
    id: 'e4_4',
    section: 'track',
    title: 'Verify Thevenin Equivalent with RL = 10 kΩ (Step A.5)',
    description:
      'Switch to Thevenin Equivalent (vOC = 0–1 V, Ro = 10 kΩ) with RL = 10 kΩ and verify Vo = 0.500 Vpp matches the actual circuit.',
  },
  {
    id: 'e4_5',
    section: 'track',
    title: 'Verify Capacitive (0.01 µF) & Diode (1N4007) Loads (Parts B & C)',
    description:
      'Compare waveforms and Vo(Vpp) between Actual and Thevenin circuits for both the 0.01 µF capacitor (0.847 Vpp) and forward 1N4007 diode (~0.52 V clipped peak)!',
  },
];

export const EXP4_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "Which of the following is also known as the dual of Thevenin's theorem?",
    options: [
      "Norton's theorem.",
      'Superposition theorem.',
      'Maximum power transfer theorem.',
      "Millman's theorem.",
    ],
    correctIndex: 0,
    explanation:
      "Norton's equivalent (current source iSC in parallel with Ro) is the exact electrical dual of Thevenin's equivalent (voltage source vOC in series with Ro).",
  },
  {
    id: 2,
    question: 'Thevenin resistance is found by ________.',
    options: [
      'Shorting all voltage sources.',
      'Opening all current sources.',
      'Shorting all voltage sources and opening all current sources.',
      'Opening all voltage sources and shorting all current sources.',
    ],
    correctIndex: 2,
    explanation:
      'Deactivating independent sources sets voltage sources to 0 V (short circuit) and current sources to 0 A (open circuit) before finding resistance across the open load terminals.',
  },
  {
    id: 3,
    question: "Thevenin's theorem is true for __________.",
    options: [
      'Linear networks.',
      'Non-Linear networks.',
      'Both linear networks and nonlinear networks.',
      'Neither linear networks nor non-linear networks.',
    ],
    correctIndex: 0,
    explanation:
      'The network being replaced must be linear and bilateral (though the external load connected to it CAN be nonlinear, like the 1N4007 diode in Part C!).',
  },
  {
    id: 4,
    question: "In Thevenin's theorem Vth is __________.",
    options: [
      'Sum of two voltage sources.',
      'A single voltage source.',
      'Infinite voltage sources.',
      '0.',
    ],
    correctIndex: 1,
    explanation:
      'Any linear two-terminal network reduces to a single equivalent voltage source Vth (vOC) in series with a single equivalent resistance Rth (Ro).',
  },
  {
    id: 5,
    question: 'The Thevenin voltage is the __________.',
    options: [
      'Open circuit voltage.',
      'Short circuit voltage.',
      'Open circuit and short circuit voltage.',
      'Neither open circuit nor short circuit voltage.',
    ],
    correctIndex: 0,
    explanation:
      'Vth equals the open-circuit voltage vOC measured across the two output terminals with the load disconnected (iO = 0).',
  },
];

export const EXP4_VIVA_CARDS: VivaCard[] = [
  {
    id: 1,
    tag: 'Part C Classic',
    question:
      'If Thevenin’s theorem applies only to linear networks, why did it STILL work accurately in Part C with a nonlinear 1N4007 diode load?',
    answer:
      'Linearity is required ONLY for the circuit inside the Thevenin box (the 20k–20k–10k–20k network). The external Load can be anything — resistive, capacitive, or nonlinear like a diode — because the linear network’s terminal V–I constraint (vO = vOC − Ro·iO) is completely unchanged!',
  },
  {
    id: 2,
    tag: 'Extrapolation',
    question:
      'Why do we measure Vo and Io for 7 load resistors and extrapolate vOC and iSC instead of directly measuring open-circuit and short-circuit on the breadboard?',
    answer:
      'In practice, a finite-impedance voltmeter/DSO probe prevents exact iO = 0 open-circuit, and a physical ammeter has internal shunt resistance (plus shorting a live source can overload/damage it), preventing exact vO = 0 short-circuit. Plotting Vo vs Io and extrapolating the straight line to both axes avoids both errors.',
  },
  {
    id: 3,
    tag: 'Ladder Reduction',
    question: 'Show quickly how Fig. 4.2(a) reduces to vOC = vs/4 and Ro = 10 kΩ.',
    answer:
      'First divider (20 kΩ series, 20 kΩ shunt) gives Vth1 = vs/2 and Rth1 = 20k‖20k = 10 kΩ. Adding the series 10 kΩ gives 20 kΩ feeding the second 20 kΩ shunt: Vth2 = (vs/2)·(20k/40k) = vs/4, and Ro = 20k‖20k = 10 kΩ. Norton iSC = vOC/Ro = vs/40 kΩ.',
  },
  {
    id: 4,
    tag: 'Diode Polarity',
    question: 'Why did Step C.1 specify choosing the diode polarity so current flows through it?',
    answer:
      'Since vs swings between 0 V and +4 V (vOC between 0 V and +1 V), the output is always non-negative. Placing the Anode at vo and Cathode at GND forward-biases the diode once vo exceeds ~0.5 V, visibly clipping the positive peak. Reversing it would leave the diode permanently reverse-biased (open circuit, vo = vOC).',
  },
  {
    id: 5,
    tag: 'Maximum Power',
    question: 'Out of the 7 load resistors in Table 1, which one absorbs maximum power from the network?',
    answer:
      'RL = 10 kΩ! By the Maximum Power Transfer Theorem, maximum power is delivered when RL = Ro = 10 kΩ, at which point Vo = vOC / 2 = 0.500 V.',
  },
];
