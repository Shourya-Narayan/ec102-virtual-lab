import React from 'react';
import type { RpsSettings } from '../../engine/types';
import { EXP3_DEFAULT_RPS, type Exp3SourceCondition } from '../../experiments/exp3Superposition';
import { Power, RotateCcw, Zap } from 'lucide-react';

interface DualPowerSupplyProps {
  rps: RpsSettings;
  fgEnabled: boolean;
  onChangeRps: (next: RpsSettings) => void;
  onSelectCondition: (cond: Exp3SourceCondition) => void;
}

export const DualPowerSupply: React.FC<DualPowerSupplyProps> = ({
  rps,
  fgEnabled,
  onChangeRps,
  onSelectCondition,
}) => {
  const activeCondition: Exp3SourceCondition | null =
    rps.enabled && rps.vd1Active && rps.vd2Active && fgEnabled
      ? 'all'
      : rps.enabled && rps.vd1Active && !rps.vd2Active && !fgEnabled
        ? 'vd1'
        : rps.enabled && !rps.vd1Active && rps.vd2Active && !fgEnabled
          ? 'vd2'
          : (!rps.enabled || (!rps.vd1Active && !rps.vd2Active)) && fgEnabled
            ? 'va'
            : null;

  return (
    <div className="panel rps-panel">
      <div className="fg-header">
        <div className="fg-brand">
          <span className="inst-badge rps-badge">RPS</span>
          <div>
            <div className="inst-title">Dual-Rail DC Regulated Power Supply (0–30 V)</div>
            <div className="inst-sub">
              Red <span className="c-vd1">VD1</span> · Black COM · Blue{' '}
              <span className="c-vd2">VD2</span> (inactive sources replaced by short to COM)
            </div>
          </div>
        </div>

        <div className="fg-header-actions">
          <button
            className="btn-ghost btn-sm"
            onClick={() => {
              onChangeRps({ ...EXP3_DEFAULT_RPS });
              onSelectCondition('all');
            }}
            title="Reset RPS to +4.8 V / -3.0 V with all sources active"
          >
            <RotateCcw size={13} />
            <span>Exp 3 Default</span>
          </button>
          <button
            className={`power-btn ${rps.enabled ? 'on' : 'off'}`}
            onClick={() => onChangeRps({ ...rps, enabled: !rps.enabled })}
          >
            <Power size={13} />
            <span>{rps.enabled ? 'DC ON' : 'DC OFF'}</span>
          </button>
        </div>
      </div>

      {/* Superposition 1-Click Source Condition Switcher */}
      <div className="rps-cond-bar">
        <span className="quick-lbl">
          <Zap size={12} /> Superposition Case:
        </span>
        <div className="chip-row">
          {(
            [
              { id: 'all', label: 'All Sources (Fig 3.1)' },
              { id: 'vd1', label: 'Only VD1 (+4.8V)' },
              { id: 'vd2', label: 'Only VD2 (−3.0V)' },
              { id: 'va', label: 'Only AC va' },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              className={`mini-chip ${activeCondition === c.id ? 'active' : ''}`}
              onClick={() => onSelectCondition(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rps-rails-grid">
        {/* +VD1 Red Rail */}
        <div className={`rps-rail-box ${rps.enabled && rps.vd1Active ? 'live-pos' : 'shorted'}`}>
          <div className="rps-rail-top">
            <span className="rail-tag red">RED (+VD1)</span>
            <button
              className={`mini-chip ${rps.vd1Active ? 'active' : ''}`}
              onClick={() => onChangeRps({ ...rps, vd1Active: !rps.vd1Active })}
              title="Toggle between Active (+VD1) and Shorted to COM (0V)"
            >
              {rps.vd1Active ? 'ACTIVE' : 'SHORT → COM'}
            </button>
          </div>
          <div className="num-control">
            <input
              type="number"
              min={0}
              max={30}
              step={0.1}
              value={rps.vd1}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) onChangeRps({ ...rps, vd1: v });
              }}
            />
            <span className="num-unit">V DC</span>
          </div>
        </div>

        {/* -VD2 Blue Rail */}
        <div className={`rps-rail-box ${rps.enabled && rps.vd2Active ? 'live-neg' : 'shorted'}`}>
          <div className="rps-rail-top">
            <span className="rail-tag blue">BLUE (−VD2)</span>
            <button
              className={`mini-chip ${rps.vd2Active ? 'active' : ''}`}
              onClick={() => onChangeRps({ ...rps, vd2Active: !rps.vd2Active })}
              title="Toggle between Active (-VD2) and Shorted to COM (0V)"
            >
              {rps.vd2Active ? 'ACTIVE' : 'SHORT → COM'}
            </button>
          </div>
          <div className="num-control">
            <input
              type="number"
              min={-30}
              max={0}
              step={0.1}
              value={rps.vd2}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) onChangeRps({ ...rps, vd2: v });
              }}
            />
            <span className="num-unit">V DC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
