import type { CircuitComponent, HoleId, ProbeMap } from './types';

export const BB_COLS = 30;
export const RAIL_HOLES = 25;
export const TOP_ROWS = ['a', 'b', 'c', 'd', 'e'] as const;
export const BOT_ROWS = ['f', 'g', 'h', 'i', 'j'] as const;
export const ALL_STRIP_ROWS = [...TOP_ROWS, ...BOT_ROWS] as const;

export interface HoleMeta {
  id: HoleId;
  section: 'tp' | 'tn' | 'top' | 'bot' | 'bp' | 'bn';
  rowLabel: string;
  col: number;
  stripKey: string;
  x: number;
  y: number;
}

export const BB_LAYOUT = {
  width: 980,
  height: 332,
  padX: 52,
  colPitch: 29.6,
  holeRadius: 4.8,
  rowY: {
    tp: 28,
    tn: 50,
    a: 88,
    b: 110,
    c: 132,
    d: 154,
    e: 176,
    f: 214,
    g: 236,
    h: 258,
    i: 280,
    j: 302,
    bp: 340,
    bn: 362,
  },
} as const;

export const BB_VIEWBOX = {
  width: 980,
  height: 392,
} as const;

function railHoleX(index1Based: number): number {
  const zero = index1Based - 1;
  const group = Math.floor(zero / 5);
  const inGroup = zero % 5;
  const startCol = 2 + group * 5.8 + inGroup * 1.0;
  return BB_LAYOUT.padX + startCol * BB_LAYOUT.colPitch;
}

function stripHoleX(col1Based: number): number {
  return BB_LAYOUT.padX + (col1Based - 1) * BB_LAYOUT.colPitch;
}

export function buildAllHoles(): HoleMeta[] {
  const holes: HoleMeta[] = [];

  for (let i = 1; i <= RAIL_HOLES; i++) {
    holes.push({
      id: `tp${i}`,
      section: 'tp',
      rowLabel: '+',
      col: i,
      stripKey: 'rail:tp',
      x: railHoleX(i),
      y: BB_LAYOUT.rowY.tp,
    });
    holes.push({
      id: `tn${i}`,
      section: 'tn',
      rowLabel: '-',
      col: i,
      stripKey: 'rail:tn',
      x: railHoleX(i),
      y: BB_LAYOUT.rowY.tn,
    });
  }

  for (let col = 1; col <= BB_COLS; col++) {
    const x = stripHoleX(col);
    for (const row of TOP_ROWS) {
      holes.push({
        id: `${row}${col}`,
        section: 'top',
        rowLabel: row,
        col,
        stripKey: `top:${col}`,
        x,
        y: BB_LAYOUT.rowY[row],
      });
    }
    for (const row of BOT_ROWS) {
      holes.push({
        id: `${row}${col}`,
        section: 'bot',
        rowLabel: row,
        col,
        stripKey: `bot:${col}`,
        x,
        y: BB_LAYOUT.rowY[row],
      });
    }
  }

  for (let i = 1; i <= RAIL_HOLES; i++) {
    holes.push({
      id: `bp${i}`,
      section: 'bp',
      rowLabel: '+',
      col: i,
      stripKey: 'rail:bp',
      x: railHoleX(i),
      y: BB_LAYOUT.rowY.bp,
    });
    holes.push({
      id: `bn${i}`,
      section: 'bn',
      rowLabel: '-',
      col: i,
      stripKey: 'rail:bn',
      x: railHoleX(i),
      y: BB_LAYOUT.rowY.bn,
    });
  }

  return holes;
}

export const ALL_HOLES: HoleMeta[] = buildAllHoles();
export const HOLE_MAP: Record<HoleId, HoleMeta> = Object.fromEntries(
  ALL_HOLES.map((h) => [h.id, h])
);

export const STRIP_TO_HOLES: Record<string, HoleId[]> = (() => {
  const map: Record<string, HoleId[]> = {};
  for (const h of ALL_HOLES) {
    if (!map[h.stripKey]) map[h.stripKey] = [];
    map[h.stripKey].push(h.id);
  }
  return map;
})();

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      return x;
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr)!;
      this.parent.set(curr, root);
      curr = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      this.parent.set(ra, rb);
    }
  }
}

export interface ResolvedNetlist {
  holeToNet: Record<HoleId, number>;
  stripToNet: Record<string, number>;
  netCount: number;
  gndNet: number;
  activeComponents: Array<{
    component: CircuitComponent;
    n1: number;
    n2: number;
  }>;
  probeNets: {
    fgPos: number | null;
    fgGnd: number | null;
    ch1Pos: number | null;
    ch1Gnd: number | null;
    ch2Pos: number | null;
    ch2Gnd: number | null;
    rpsPos: number | null;
    rpsCom: number | null;
    rpsNeg: number | null;
  };
}

export function resolveBreadboardNetlist(
  components: CircuitComponent[],
  probes: ProbeMap
): ResolvedNetlist {
  const uf = new UnionFind();

  for (const stripKey of Object.keys(STRIP_TO_HOLES)) {
    uf.find(stripKey);
  }

  for (const comp of components) {
    if (comp.type !== 'wire') continue;
    const h1 = HOLE_MAP[comp.pin1];
    const h2 = HOLE_MAP[comp.pin2];
    if (h1 && h2) {
      uf.union(h1.stripKey, h2.stripKey);
    }
  }

  // Reference ground: prefer fgGnd, else rpsCom, else ch1Gnd, else bn1
  const gndHole =
    (probes.fgGnd && HOLE_MAP[probes.fgGnd]) ||
    (probes.rpsCom && HOLE_MAP[probes.rpsCom]) ||
    (probes.ch1Gnd && HOLE_MAP[probes.ch1Gnd]) ||
    HOLE_MAP['bn1'];
  const gndRoot = uf.find(gndHole.stripKey);

  const usedRoots = new Set<string>([gndRoot]);
  const probeHoleList = Object.values(probes).filter(Boolean) as HoleId[];
  for (const pid of probeHoleList) {
    const hm = HOLE_MAP[pid];
    if (hm) usedRoots.add(uf.find(hm.stripKey));
  }
  for (const comp of components) {
    if (comp.type === 'wire') continue;
    const h1 = HOLE_MAP[comp.pin1];
    const h2 = HOLE_MAP[comp.pin2];
    if (h1) usedRoots.add(uf.find(h1.stripKey));
    if (h2) usedRoots.add(uf.find(h2.stripKey));
  }

  const rootToNet = new Map<string, number>();
  rootToNet.set(gndRoot, 0);
  let nextNet = 1;
  for (const root of usedRoots) {
    if (!rootToNet.has(root)) {
      rootToNet.set(root, nextNet++);
    }
  }

  const stripToNet: Record<string, number> = {};
  const holeToNet: Record<HoleId, number> = {};

  for (const h of ALL_HOLES) {
    const r = uf.find(h.stripKey);
    const net = rootToNet.has(r) ? rootToNet.get(r)! : -1;
    stripToNet[h.stripKey] = net;
    holeToNet[h.id] = net;
  }

  const activeComponents: ResolvedNetlist['activeComponents'] = [];
  for (const comp of components) {
    if (comp.type === 'wire') continue;
    const n1 = holeToNet[comp.pin1];
    const n2 = holeToNet[comp.pin2];
    if (n1 !== undefined && n2 !== undefined && n1 >= 0 && n2 >= 0) {
      activeComponents.push({ component: comp, n1, n2 });
    }
  }

  const lookupProbe = (hid: HoleId | null | undefined): number | null => {
    if (!hid || holeToNet[hid] === undefined || holeToNet[hid] < 0) return null;
    return holeToNet[hid];
  };

  return {
    holeToNet,
    stripToNet,
    netCount: nextNet - 1,
    gndNet: 0,
    activeComponents,
    probeNets: {
      fgPos: lookupProbe(probes.fgPos),
      fgGnd: lookupProbe(probes.fgGnd),
      ch1Pos: lookupProbe(probes.ch1Pos),
      ch1Gnd: lookupProbe(probes.ch1Gnd),
      ch2Pos: lookupProbe(probes.ch2Pos),
      ch2Gnd: lookupProbe(probes.ch2Gnd),
      rpsPos: lookupProbe(probes.rpsPos),
      rpsCom: lookupProbe(probes.rpsCom),
      rpsNeg: lookupProbe(probes.rpsNeg),
    },
  };
}

export function getHoleHighlightSets(
  holeId: HoleId,
  components: CircuitComponent[]
): { stripHoles: Set<HoleId>; wireConnectedHoles: Set<HoleId> } {
  const hm = HOLE_MAP[holeId];
  if (!hm) {
    return { stripHoles: new Set(), wireConnectedHoles: new Set() };
  }

  const stripHoles = new Set<HoleId>(STRIP_TO_HOLES[hm.stripKey] ?? []);

  const uf = new UnionFind();
  for (const s of Object.keys(STRIP_TO_HOLES)) uf.find(s);
  for (const comp of components) {
    if (comp.type !== 'wire') continue;
    const h1 = HOLE_MAP[comp.pin1];
    const h2 = HOLE_MAP[comp.pin2];
    if (h1 && h2) uf.union(h1.stripKey, h2.stripKey);
  }
  const targetRoot = uf.find(hm.stripKey);
  const wireConnectedHoles = new Set<HoleId>();
  for (const [sKey, hList] of Object.entries(STRIP_TO_HOLES)) {
    if (sKey === hm.stripKey) continue;
    if (uf.find(sKey) === targetRoot) {
      for (const id of hList) wireConnectedHoles.add(id);
    }
  }

  return { stripHoles, wireConnectedHoles };
}
