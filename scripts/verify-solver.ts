import { simulateBreadboardCircuit } from '../src/engine/mnaSolver.ts';
import {
  EXP2_DEFAULT_FG,
  EXP2_PRESET_COMPONENTS,
  EXP2_PRESET_PROBES,
  EXP2_TIMES,
  verifyExp2Circuit,
} from '../src/experiments/exp2Kirchhoff.ts';

function measureNode(ch2Hole: string) {
  return simulateBreadboardCircuit(
    EXP2_PRESET_COMPONENTS,
    { ...EXP2_PRESET_PROBES, ch2Pos: ch2Hole },
    EXP2_DEFAULT_FG
  );
}

const simB = measureNode('a12');
const simC = measureNode('a18');
const simD = measureNode('a24');

const check = verifyExp2Circuit(EXP2_PRESET_COMPONENTS, EXP2_PRESET_PROBES, EXP2_DEFAULT_FG);
console.log('Topology Verification:', check.score + '/' + check.total, 'allPassed =', check.allPassed);
if (!check.allPassed) {
  console.error('FAILED CHECKS:', check.items.filter((i) => !i.passed));
  process.exit(1);
}

for (const [label, t] of [
  ['t1 (-0.4 ms)', EXP2_TIMES.t1],
  ['t2 (+0.3 ms)', EXP2_TIMES.t2],
] as const) {
  const va = simB.sampleAt('ch1', t);
  const vb = simB.sampleAt('ch2', t);
  const vab = simB.sampleAt('math', t);
  const vc = simC.sampleAt('ch2', t);
  const vac = simC.sampleAt('math', t);
  const vd = simD.sampleAt('ch2', t);

  const kcl = vab - vc - vd;
  const kvl = va - vac - vc;

  console.log(`\n=== ${label} ===`);
  console.log(
    `va = ${va.toFixed(4)} V | vb = ${vb.toFixed(4)} V | vab = ${vab.toFixed(4)} V | vac = ${vac.toFixed(4)} V | vc = ${vc.toFixed(4)} V | vd = ${vd.toFixed(4)} V`
  );
  console.log(`KCL (vab - vc - vd) = ${kcl.toFixed(6)} V`);
  console.log(`KVL (va - vac - vc) = ${kvl.toFixed(6)} V`);

  if (Math.abs(kcl) > 1e-4 || Math.abs(kvl) > 1e-4) {
    console.error('KCL/KVL tolerance exceeded!');
    process.exit(1);
  }
}

console.log('\nALL SOLVER CHECKS PASSED!');
