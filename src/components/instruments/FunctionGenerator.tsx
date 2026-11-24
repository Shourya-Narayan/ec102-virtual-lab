import React from 'react';
import type { FgSettings, WaveformType } from '../../engine/types';
import { Power, RotateCcw } from 'lucide-react';

interface FunctionGeneratorProps {
  fg: FgSettings;
  defaultLabel: string;
  onChange: (next: FgSettings) => void;
  onResetDefault: () => void;
}

const WAVEFORMS: Array<{ id: WaveformType; label: string; path: string }> = [
  { id: 'triangle', label: 'Triangle', path: 'M 2 13 L 7 3 L 17 21 L 22 13' },
  {
    id: 'sine',
    label: 'Sine',
    path: 'M 2 12 C 5 2, 9 2, 12 12 C 15 22, 19 22, 22 12',
  },
  { id: 'square', label: 'Square', path: 'M 2 18 L 2 6 L 12 6 L 12 18 L 22 18 L 22 6' },
];

export const FunctionGenerator: React.FC<FunctionGeneratorProps> = ({
  fg,
  defaultLabel,
  onChange,
  onResetDefault,
}) => {
  const vmin = fg.enabled ? fg.offset - fg.vpp / 2 : 0;
  const vmax = fg.enabled ? fg.offset + fg.vpp / 2 : 0;

  return (
    <div className="panel fg-panel">
      <div className="fg-header">
        <div className="fg-brand">
          <span className="inst-badge fg-badge">FG</span>
          <div>
            <div className="inst-title">Function Generator</div>
            <div className="inst-sub">
              Output Levels:{' '}
              <span className="mono-highlight">
                {vmin.toFixed(2)} V → {vmax.toFixed(2)} V
              </span>
            </div>
          </div>
        </div>

        <div className="fg-header-actions">
          <button
            className="btn-ghost btn-sm"
            onClick={onResetDefault}
            title={`Reset FG to ${defaultLabel} settings`}
          >
            <RotateCcw size={13} />
            <span>{defaultLabel}</span>
          </button>
          <button
            className={`power-btn ${fg.enabled ? 'on' : 'off'}`}
            onClick={() => onChange({ ...fg, enabled: !fg.enabled })}
          >
            <Power size={13} />
            <span>{fg.enabled ? 'OUT ON' : 'OUT OFF'}</span>
          </button>
        </div>
      </div>

      <div className="fg-controls">
        <div className="fg-field">
          <span className="fg-label">Waveform</span>
          <div className="seg-group">
            {WAVEFORMS.map((w) => (
              <button
                key={w.id}
                className={`seg-btn ${fg.waveform === w.id ? 'active' : ''}`}
                onClick={() => onChange({ ...fg, waveform: w.id })}
              >
                <svg width={18} height={16} viewBox="0 0 24 24" fill="none">
                  <path
                    d={w.path}
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{w.label}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="fg-field">
          <span className="fg-label">Frequency</span>
          <div className="num-control">
            <input
              type="number"
              min={10}
              max={100000}
              step={100}
              value={fg.frequency}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v >= 10) onChange({ ...fg, frequency: v });
              }}
            />
            <span className="num-unit">Hz</span>
          </div>
        </label>

        <label className="fg-field">
          <span className="fg-label">Amplitude</span>
          <div className="num-control">
            <input
              type="number"
              min={0.1}
              max={20}
              step={0.1}
              value={fg.vpp}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v >= 0) onChange({ ...fg, vpp: v });
              }}
            />
            <span className="num-unit">Vpp</span>
          </div>
        </label>

        <label className="fg-field">
          <span className="fg-label">DC Offset</span>
          <div className="num-control">
            <input
              type="number"
              min={-10}
              max={10}
              step={0.1}
              value={fg.offset}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) onChange({ ...fg, offset: v });
              }}
            />
            <span className="num-unit">V</span>
          </div>
        </label>
      </div>
    </div>
  );
};
