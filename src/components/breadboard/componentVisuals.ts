const DIGIT_COLORS = [
  '#1c1917', // 0 black
  '#7c2d12', // 1 brown
  '#dc2626', // 2 red
  '#ea580c', // 3 orange
  '#eab308', // 4 yellow
  '#16a34a', // 5 green
  '#2563eb', // 6 blue
  '#7c3aed', // 7 violet
  '#64748b', // 8 grey
  '#f8fafc', // 9 white
];

const MULTIPLIER_COLORS: Record<number, string> = {
  [-2]: '#cbd5e1', // silver
  [-1]: '#d97706', // gold
  0: '#1c1917',
  1: '#7c2d12',
  2: '#dc2626',
  3: '#ea580c',
  4: '#eab308',
  5: '#16a34a',
  6: '#2563eb',
  7: '#7c3aed',
};

/**
 * Computes 4-band resistor color codes (1% brown or 5% gold tolerance band)
 * For 1.00 kΩ -> Brown (1), Black (0), Red (x100), Brown (1%)
 */
export function getResistorBands(ohms: number): [string, string, string, string] {
  const safe = Math.max(1, ohms);
  const exp = Math.floor(Math.log10(safe));
  const scaled = Math.round(safe / Math.pow(10, exp - 1));
  let d1 = Math.floor(scaled / 10);
  let d2 = scaled % 10;
  let mult = exp - 1;
  if (d1 >= 10) {
    d1 = 1;
    d2 = 0;
    mult += 1;
  }
  const c1 = DIGIT_COLORS[Math.max(0, Math.min(9, d1))];
  const c2 = DIGIT_COLORS[Math.max(0, Math.min(9, d2))];
  const c3 = MULTIPLIER_COLORS[Math.max(-2, Math.min(7, mult))] ?? '#dc2626';
  const cTol = '#7c2d12'; // 1% metal film (matching manual's 1% resistors)
  return [c1, c2, c3, cTol];
}

function trimFloat(n: number, sig = 3): string {
  return Number(n.toPrecision(sig)).toString();
}

export function formatResistance(ohms: number): string {
  if (ohms >= 1e6) return `${trimFloat(ohms / 1e6, 3)} MΩ`;
  if (ohms >= 1e3) return `${trimFloat(ohms / 1e3, 3)} kΩ`;
  return `${trimFloat(ohms, 3)} Ω`;
}

export function formatCapacitance(farads: number): string {
  // Show >= 0.01 uF in microfarads (matches lab manual: 0.1 uF, 0.01 uF)
  if (farads >= 1e-8) return `${trimFloat(farads * 1e6, 3)} µF`;
  if (farads >= 1e-9) return `${trimFloat(farads * 1e9, 3)} nF`;
  return `${trimFloat(farads * 1e12, 3)} pF`;
}

export function getCapacitorCode(farads: number): string {
  const pf = Math.round(farads * 1e12);
  if (pf < 10) return `${pf}`;
  const str = String(pf);
  const sig = str.slice(0, 2);
  const zeros = str.length - 2;
  return `${sig}${zeros}`; // 0.1 uF = 100000 pF -> "104"
}

export const WIRE_COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  black: '#1e293b',
  yellow: '#facc15',
  blue: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  purple: '#a855f7',
  cyan: '#06b6d4',
};
