export type ExperimentId = 'exp2' | 'exp3' | 'exp4' | 'exp5';

export type HoleId = string;

export type ComponentType = 'resistor' | 'capacitor' | 'diode' | 'wire';

export type WireColor =
  | 'red'
  | 'black'
  | 'yellow'
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'cyan';

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  label: string;
  /** For diode: Anode pin */
  pin1: HoleId;
  /** For diode: Cathode pin */
  pin2: HoleId;
  /** Ohms for resistor, Farads for capacitor, 0 for wire/diode */
  value: number;
  color?: WireColor;
  model?: string;
}

export type ProbeId =
  | 'fgPos'
  | 'fgGnd'
  | 'ch1Pos'
  | 'ch1Gnd'
  | 'ch2Pos'
  | 'ch2Gnd'
  | 'rpsPos'
  | 'rpsCom'
  | 'rpsNeg';

export interface ProbeMap {
  fgPos: HoleId | null;
  fgGnd: HoleId | null;
  ch1Pos: HoleId | null;
  ch1Gnd: HoleId | null;
  ch2Pos: HoleId | null;
  ch2Gnd: HoleId | null;
  rpsPos?: HoleId | null;
  rpsCom?: HoleId | null;
  rpsNeg?: HoleId | null;
}

export type WaveformType = 'triangle' | 'sine' | 'square';

export interface FgSettings {
  enabled: boolean;
  waveform: WaveformType;
  /** Hz */
  frequency: number;
  /** Peak-to-peak Volts */
  vpp: number;
  /** DC offset Volts */
  offset: number;
}

export interface RpsSettings {
  enabled: boolean;
  /** Positive rail VD1 (V), e.g., +4.8 V */
  vd1: number;
  /** Negative rail VD2 (V), e.g., -3.0 V */
  vd2: number;
  /** When false (in Superposition), rail is shorted to COM (0 V) */
  vd1Active: boolean;
  /** When false (in Superposition), rail is shorted to COM (0 V) */
  vd2Active: boolean;
}

export interface ChannelStats {
  vmin: number;
  vmax: number;
  vpp: number;
  vavg: number;
}

export type TraceSource = 'ch1' | 'ch2' | 'math';

export interface SimulationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Seconds, centered around t = 0 covering [-2T, +2T] */
  time: number[];
  fgWave: number[];
  ch1: number[];
  ch2: number[];
  math: number[];
  /** Net ID -> voltage waveform (V) relative to net 0 (GND) */
  nodeVoltages: Record<number, number[]>;
  /** HoleId -> Net ID (0 = reference GND) */
  holeToNet: Record<string, number>;
  /** Period T in seconds */
  period: number;
  stats: {
    ch1: ChannelStats;
    ch2: ChannelStats;
    math: ChannelStats;
  };
  /** CH2 / CH1 Vpp gain ratio */
  gain: number;
  /** Phase difference of CH2 relative to CH1 in degrees (negative = lag) */
  phaseDiffDeg: number | null;
  /** 10% -> 90% rise time of CH2 in seconds (for step/square inputs) */
  riseTimeSec: number | null;
  /** 90% -> 10% fall time of CH2 in seconds (for step/square inputs) */
  fallTimeSec: number | null;
  sampleAt: (source: TraceSource | 'fg', tSec: number) => number;
}

export interface VerificationItem {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface VerificationResult {
  allPassed: boolean;
  score: number;
  total: number;
  items: VerificationItem[];
  detectedNodes?: {
    gnd: number;
    a?: number;
    b?: number;
    c?: number;
    d?: number;
    vo?: number;
  };
}

export interface NodeMarker {
  label: string;
  col: number;
  hole: HoleId;
  desc: string;
  netKey?: 'a' | 'b' | 'c' | 'd' | 'vo';
}
