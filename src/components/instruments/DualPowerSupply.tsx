import React from 'react';
import type { RpsSettings } from '../../engine/types';
import type { Exp3SourceCondition } from '../../experiments/exp3Superposition';
import { Power } from 'lucide-react';

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
    <div className="panel inst-strip">
      <div className="inst-strip-row">
        <div className="inst-strip-id">
          <span className="inst-badge rps-badge">DC RPS</span>
        </div>

        <div className="seg-group compact">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'vd1', label: 'Only VD1' },
              { id: 'vd2', label: 'Only VD2' },
              { id: 'va', label: 'Only va' },
            ] as const
          ).map((c) => (
            <button
              key={c.id}
              className={`seg-btn ${activeCondition === c.id ? 'active' : ''}`}
              onClick={() => onSelectCondition(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="inst-inputs-inline">
          <label className={`inline-num ${!rps.vd1Active ? 'is-muted' : ''}`}>
            <span className="c-vd1">+VD1</span>
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
            <em>V</em>
          </label>
          <label className={`inline-num ${!rps.vd2Active ? 'is-muted' : ''}`}>
            <span className="c-vd2">−VD2</span>
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
            <em>V</em>
          </label>
        </div>

        <button
          className={`power-btn ${rps.enabled ? 'on' : 'off'}`}
          onClick={() => onChangeRps({ ...rps, enabled: !rps.enabled })}
        >
          <Power size={12} />
          <span>{rps.enabled ? 'ON' : 'OFF'}</span>
        </button>
      </div>
    </div>
  );
};
