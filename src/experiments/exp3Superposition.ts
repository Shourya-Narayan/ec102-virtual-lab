import { resolveBreadboardNetlist } from '../engine/breadboardNetlist';
import type {
  CircuitComponent,
  FgSettings,
  NodeMarker,
  ProbeMap,
  RpsSettings,
  VerificationItem,
  VerificationResult,
} from '../engine/types';
import type { ProcedureStep, QuizQuestion, VivaCard } from './exp2Kirchhoff';

export type Exp3CircuitVariant = 'resistive' | 'rc_1khz' | 'rc_2khz';
export type Exp3SourceCondition = 'all' | 'vd1' | 'vd2' | 'va';

export const EXP3_DEFAULT_FG: FgSettings = {
  enabled: true,
  waveform: 'sine',
  frequency: 1000,
  vpp: 3.6,
  offset: 0.0,
};

export const EXP3_DEFAULT_RPS: RpsSettings = {
  enabled: true,
  vd1: 4.8,
  vd2: -3.0,
  vd1Active: true,
  vd2Active: true,
};

export const EXP3_PRESET_PROBES: ProbeMap = {
  fgPos: 'e6',
  fgGnd: 'bn4',
  ch1Pos: 'b6',
  ch1Gnd: 'bn6',
  ch2Pos: 'b14',
  ch2Gnd: 'bn8',
  rpsPos: 'tp2', // Red +VD1 bus
  rpsCom: 'bn2', // Black COM / GND bus
  rpsNeg: 'tn2', // Blue -VD2 bus
};

export const EXP3_EMPTY_PROBES: ProbeMap = {
  fgPos: 'e2',
  fgGnd: 'bn4',
  ch1Pos: 'b2',
  ch1Gnd: 'bn6',
  ch2Pos: null,
  ch2Gnd: 'bn8',
  rpsPos: 'tp2',
  rpsCom: 'bn2',
  rpsNeg: 'tn2',
};

export const EXP3_NODE_MARKERS: NodeMarker[] = [
  { label: 'va', col: 6, hole: 'a6', desc: 'AC Source va (FG)', netKey: 'a' },
  { label: 'vo', col: 14, hole: 'a14', desc: 'Superposition Output Node vo', netKey: 'vo' },
];

export function buildExp3PresetComponents(variant: Exp3CircuitVariant): CircuitComponent[] {
  const isRc = variant !== 'resistive';
  const loadComp: CircuitComponent = isRc
    ? {
        id: 'c_load',
        type: 'capacitor',
        label: 'C',
        pin1: 'e14',
        pin2: 'f14',
        value: 0.01e-6, // 0.01 uF
      }
    : {
        id: 'r2',
        type: 'resistor',
        label: 'R2',
        pin1: 'e14',
        pin2: 'f14',
        value: 10000, // 10 kOhm
      };

  return [
    {
      id: 'r1_a',
      type: 'resistor',
      label: 'R1a',
      pin1: 'd6',
      pin2: 'd14',
      value: 30000,
    },
    {
      id: 'w_vo_bridge',
      type: 'wire',
      label: 'VO-BUS',
      pin1: 'c14',
      pin2: 'c16',
      value: 0,
      color: 'yellow',
    },
    {
      id: 'r1_b',
      type: 'resistor',
      label: 'R1b',
      pin1: 'c16',
      pin2: 'c22',
      value: 30000,
    },
    {
      id: 'w_vd1',
      type: 'wire',
      label: 'VD1-IN',
      pin1: 'a22',
      pin2: 'tp18',
      value: 0,
      color: 'red',
    },
    {
      id: 'r1_c',
      type: 'resistor',
      label: 'R1c',
      pin1: 'd16',
      pin2: 'd27',
      value: 30000,
    },
    {
      id: 'w_vd2',
      type: 'wire',
      label: 'VD2-IN',
      pin1: 'a27',
      pin2: 'tn23',
      value: 0,
      color: 'blue',
    },
    loadComp,
    {
      id: 'w_gnd_load',
      type: 'wire',
      label: 'GND-R2',
      pin1: 'j14',
      pin2: 'bn12',
      value: 0,
      color: 'black',
    },
  ];
}

function approxEq(a: number, b: number, relTol = 0.02): boolean {
  if (b === 0) return Math.abs(a) < 1e-9;
  return Math.abs(a - b) / Math.abs(b) <= relTol;
}

export function verifyExp3Circuit(
  components: CircuitComponent[],
  probes: ProbeMap,
  fg: FgSettings,
  rps: RpsSettings,
  variant: Exp3CircuitVariant
): VerificationResult {
  const netlist = resolveBreadboardNetlist(components, probes);
  const items: VerificationItem[] = [];

  const netGnd = netlist.probeNets.rpsCom ?? netlist.probeNets.fgGnd;
  const netVa = netlist.probeNets.fgPos;
  const netVd1 = netlist.probeNets.rpsPos;
  const netVd2 = netlist.probeNets.rpsNeg;

  const sourcesOk =
    netGnd !== null &&
    netVa !== null &&
    netVd1 !== null &&
    netVd2 !== null &&
    new Set([netGnd, netVa, netVd1, netVd2]).size === 4;

  items.push({
    id: 'sources',
    label: 'Three independent voltage sources (va, +VD1, −VD2) on separate rails',
    passed: sourcesOk,
    detail: sourcesOk
      ? 'FG (+), Red +VD1 rail, Blue −VD2 rail, and Black COM/GND bus are properly isolated.'
      : 'Ensure FG (+), +VD1 (top + rail), −VD2 (top − rail), and COM/GND (bottom − rail) are all connected without shorts.',
  });

  // Identify candidate central node vo connected to va via 30k resistor
  let netVo: number | undefined;
  if (netVa !== null) {
    const r1a = netlist.activeComponents.find(
      (ac) =>
        ac.component.type === 'resistor' &&
        approxEq(ac.component.value, 30000) &&
        ((ac.n1 === netVa && ac.n2 !== netGnd && ac.n2 !== netVa) ||
          (ac.n2 === netVa && ac.n1 !== netGnd && ac.n1 !== netVa))
    );
    if (r1a) {
      netVo = r1a.n1 === netVa ? r1a.n2 : r1a.n1;
    }
  }

  items.push({
    id: 'r1a',
    label: 'R1a (30 kΩ) connects AC source va to output node vo',
    passed: netVo !== undefined,
    detail:
      netVo !== undefined
        ? `30 kΩ resistor links va → central node vo (Net ${netVo}).`
        : 'Place a 30 kΩ resistor from the FG (+) strip to the central vo node.',
  });

  const hasR1b =
    netVo !== undefined &&
    netVd1 !== null &&
    netlist.activeComponents.some(
      (ac) =>
        ac.component.type === 'resistor' &&
        approxEq(ac.component.value, 30000) &&
        ((ac.n1 === netVo && ac.n2 === netVd1) || (ac.n2 === netVo && ac.n1 === netVd1))
    );
  items.push({
    id: 'r1b',
    label: 'R1b (30 kΩ) connects +VD1 (+4.8 V) rail to output node vo',
    passed: hasR1b,
    detail: hasR1b
      ? '30 kΩ resistor connects +VD1 red bus to node vo.'
      : 'Connect a 30 kΩ resistor between the +VD1 red rail and node vo.',
  });

  const hasR1c =
    netVo !== undefined &&
    netVd2 !== null &&
    netlist.activeComponents.some(
      (ac) =>
        ac.component.type === 'resistor' &&
        approxEq(ac.component.value, 30000) &&
        ((ac.n1 === netVo && ac.n2 === netVd2) || (ac.n2 === netVo && ac.n1 === netVd2))
    );
  items.push({
    id: 'r1c',
    label: 'R1c (30 kΩ) connects −VD2 (−3.0 V) rail to output node vo',
    passed: hasR1c,
    detail: hasR1c
      ? '30 kΩ resistor connects −VD2 blue rail to node vo.'
      : 'Connect a 30 kΩ resistor between the −VD2 blue rail and node vo.',
  });

  const isRc = variant !== 'resistive';
  const hasLoad =
    netVo !== undefined &&
    netGnd !== null &&
    netlist.activeComponents.some((ac) => {
      const between = (ac.n1 === netVo && ac.n2 === netGnd) || (ac.n2 === netVo && ac.n1 === netGnd);
      if (!between) return false;
      return isRc
        ? ac.component.type === 'capacitor' && approxEq(ac.component.value, 0.01e-6)
        : ac.component.type === 'resistor' && approxEq(ac.component.value, 10000);
    });
  items.push({
    id: 'load',
    label: isRc
      ? 'Capacitor C (0.01 µF) connects node vo to GND'
      : 'Resistor R2 (10 kΩ) connects node vo to GND',
    passed: hasLoad,
    detail: hasLoad
      ? isRc
        ? '0.01 µF capacitor connects vo to GND (RC Circuit).'
        : '10 kΩ resistor connects vo to GND (Resistive Circuit).'
      : isRc
        ? 'Replace R2 with a 0.01 µF capacitor between node vo and GND.'
        : 'Connect a 10 kΩ resistor between node vo and GND.',
  });

  const probesOk =
    netVa !== null &&
    netVo !== undefined &&
    netlist.probeNets.ch1Pos === netVa &&
    netlist.probeNets.ch2Pos === netVo;
  items.push({
    id: 'probes',
    label: 'DSO CH1 measures va and CH2 measures output vo',
    passed: probesOk,
    detail: probesOk
      ? 'CH1 monitors FG input va; CH2 monitors output voltage vo.'
      : 'Connect CH1 (+) to va and CH2 (+) to the central vo node.',
  });

  const targetFreq = variant === 'rc_2khz' ? 2000 : 1000;
  const levelsOk =
    approxEq(rps.vd1, 4.8, 0.02) &&
    approxEq(rps.vd2, -3.0, 0.02) &&
    fg.waveform === 'sine' &&
    approxEq(fg.frequency, targetFreq, 0.02) &&
    approxEq(fg.vpp, 3.6, 0.02) &&
    Math.abs(fg.offset) < 0.05;
  items.push({
    id: 'levels',
    label: `Sources set: VD1 = +4.8 V, VD2 = −3.0 V, va = ${targetFreq / 1000} kHz Sine 3.6 Vpp`,
    passed: levelsOk,
    detail: levelsOk
      ? 'DC Power Supply and Function Generator match Procedure Step 2.'
      : `Set VD1 = +4.8 V, VD2 = -3.0 V, and FG = ${targetFreq} Hz Sine, 3.6 Vpp, 0 V offset.`,
  });

  const score = items.filter((i) => i.passed).length;
  return {
    allPassed: score === items.length,
    score,
    total: items.length,
    items,
    detectedNodes:
      netGnd !== null ? { gnd: netGnd, a: netVa ?? undefined, vo: netVo } : undefined,
  };
}

export const EXP3_PROCEDURE_STEPS: ProcedureStep[] = [
  {
    id: 'e3_1',
    section: 'setup',
    title: 'Assemble Resistive Circuit (Fig. 3.1)',
    description:
      'Wire three 30 kΩ resistors from node vo to va, +VD1 (Red rail), and −VD2 (Blue rail), plus R2 = 10 kΩ from vo to COM/GND.',
  },
  {
    id: 'e3_2',
    section: 'setup',
    title: 'Set Sources (Step 2)',
    description:
      'Set FG to 1 kHz Sine, 3.6 Vpp, 0 V offset. Set Dual DC Power Supply to VD1 = +4.8 V and VD2 = −3.0 V.',
  },
  {
    id: 'e3_3',
    section: 'manual',
    title: 'Measure All Sources Active (Step 3)',
    description:
      'Display va (CH1) and vo (CH2) on DSO and capture VoMin and VoMax in Table 1 (expected: 0.000 V to +0.600 V).',
  },
  {
    id: 'e3_4',
    section: 'manual',
    title: 'Measure Individual Responses vo1, vo2, vo3 (Steps 4–5)',
    description:
      'Use the Source Condition selector (replacing inactive sources with short circuits to GND, Fig. 3.2) to record vo1 (+0.800 V), vo2 (−0.500 V), and vo3 (−0.300 V to +0.300 V).',
  },
  {
    id: 'e3_5',
    section: 'track',
    title: 'Verify Algebraic Sum (Step 6)',
    description:
      'Compare vo1 + vo2 + vo3 against the all-sources-active measurement in Table 4 (% Error should be 0.00%).',
  },
  {
    id: 'e3_6',
    section: 'track',
    title: 'Switch to RC Circuit at 1 kHz & 2 kHz (Steps 7–8)',
    description:
      'Replace R2 with C = 0.01 µF. Repeat at f = 1 kHz (Table 2) and f = 2 kHz (Table 3). Note how AC amplitude vo3 drops at 2 kHz while DC values vo1 (+1.6 V) and vo2 (−1.0 V) stay unchanged!',
  },
];

export const EXP3_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'Superposition theorem is valid for _________.',
    options: [
      'Linear systems.',
      'Non-linear systems.',
      'Both linear and non-linear systems.',
      'Neither linear nor non-linear systems.',
    ],
    correctIndex: 0,
    explanation:
      'Superposition requires additivity and homogeneity, which hold strictly for linear systems (resistors, linear capacitors, linear inductors).',
  },
  {
    id: 2,
    question:
      'In superposition theorem, when we consider the effect of one voltage source, all the other voltage sources are ____________.',
    options: ['Shorted.', 'Opened.', 'Removed.', 'Undisturbed.'],
    correctIndex: 0,
    explanation:
      'Setting an ideal independent voltage source to 0 V means replacing it with a short circuit (zero internal impedance).',
  },
  {
    id: 3,
    question: 'Superposition theorem does not work for ________.',
    options: ['Current.', 'Voltage.', 'Power.', 'All of the above.'],
    correctIndex: 2,
    explanation:
      'Power (P = V²/R = I²R) is a quadratic (non-linear) function of voltage or current, so individual powers cannot simply be added.',
  },
  {
    id: 4,
    question:
      'In superposition theorem, when we consider the effect of one current source, all the other voltage sources are ____________.',
    options: ['Shorted.', 'Opened.', 'Removed.', 'Undisturbed.'],
    correctIndex: 0,
    explanation:
      'Every deactivated independent voltage source is replaced by a short circuit (V = 0), regardless of whether the active source is a voltage or current source.',
  },
  {
    id: 5,
    question:
      'In superposition theorem, when we consider the effect of one current source, all the other current sources are ____________.',
    options: ['Shorted.', 'Opened.', 'Removed.', 'Undisturbed.'],
    correctIndex: 1,
    explanation:
      'Setting an ideal independent current source to 0 A means replacing it with an open circuit (infinite internal impedance).',
  },
];

export const EXP3_VIVA_CARDS: VivaCard[] = [
  {
    id: 1,
    tag: 'Step 8 Question',
    question:
      'In Step 8, changing the FG frequency from 1 kHz to 2 kHz changed vo3 in the RC circuit. Would the same frequency change affect the resistive circuit?',
    answer:
      'No! Ideal resistors have impedance Z = R independent of frequency, so vo1, vo2, and vo3 remain completely unchanged in the resistive circuit. In the RC circuit, capacitive reactance Xc = 1/(2πfC) halves when f doubles (15.9 kΩ → 7.96 kΩ), attenuating the AC component vo3 more strongly while leaving DC components vo1 and vo2 unchanged.',
  },
  {
    id: 2,
    tag: 'RC vs Resistive DC',
    question:
      'Why do vo1 and vo2 double (from +0.8 V / −0.5 V to +1.6 V / −1.0 V) when we replace R2 = 10 kΩ with C = 0.01 µF?',
    answer:
      'At DC (f = 0), an ideal capacitor behaves as an open circuit (Xc → ∞). With R2 = 10 kΩ present, each source sees divider ratio (30k‖30k‖10k) / (30k + 6k) = 1/6. With C replacing R2, each DC source sees (30k‖30k) / (30k + 15k) = 1/3 — exactly double!',
  },
  {
    id: 3,
    tag: 'Symmetry Check',
    question: 'Why does Fig. 3.1 reduce to the exact same equivalent circuit (Fig. 3.2) for all three sources?',
    answer:
      'Because all three sources (VD1, VD2, va) feed the common output node vo through identical series resistors R1 = 30 kΩ. Shorting any two sources to GND always leaves one R1 in series with the active source and the other two R1 resistors in parallel with R2 (or C) to GND.',
  },
  {
    id: 4,
    tag: 'Lab Precaution',
    question:
      'Why must you NEVER short the physical DC power supply output terminals directly when deactivating VD1 or VD2?',
    answer:
      'You disconnect the power supply wire from the circuit FIRST, and only connect the circuit-side resistor lead to GND (COM). Shorting the RPS output terminals directly draws huge short-circuit current and trips current-limiting or damages the supply.',
  },
  {
    id: 5,
    tag: 'Theory Limit',
    question: 'Can Superposition be applied to a circuit containing a 1N4007 diode or dependent sources?',
    answer:
      'No for diodes (a diode is non-linear). YES for linear dependent (controlled) sources — you keep dependent sources active in every sub-circuit and only deactivate the independent sources one by one.',
  },
];
