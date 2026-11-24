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
  { id: 'triangle', label: 'Tri', path: 'M 2 13 L 7 3 L 17 21 L 22 13' },
  { id: 'sine', label: 'Sine', path: 'M 2 12 C 5 2, 9 2, 12 12 C 15 22, 19 22, 22 12' },
  { id: 'square', label: 'Sq', path: 'M 2 18 L 2 6 L 12 6 L 12 18 L 22 18 L 22 6' },
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
    <div className="panel inst-strip">
      <div className="inst-strip-row">
        <div className="inst-strip-id">
          <span className="inst-badge fg-badge">FG</span>
          <span className="inst-strip-range">
            {vmin.toFixed(1)}V → {vmax.toFixed(1)}V
          </span>
        </div>

        <div className="seg-group compact">
          {WAVEFORMS.map((w) => (
            <button
              key={w.id}
              className={`seg-btn ${fg.waveform === w.id ? 'active' : ''}`}
              onClick={() => onChange({ ...fg, waveform: w.id })}
              title={w.id}
            >
              <svg width={15} height={14} viewBox="0 0 24 24" fill="none">
                <path d={w.path} stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{w.label}</span>
            </button>
          ))}
        </div>

        <div className="inst-inputs-inline">
          <label className="inline-num">
            <span>Freq</span>
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
            <em>Hz</em>
          </label>
          <label className="inline-num">
            <span>Amp</span>
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
            <em>Vpp</em>
          </label>
          <label className="inline-num">
            <span>Off</span>
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
            <em>V</em>
          </label>
        </div>

        <div className="inst-strip-actions">
          <button className="btn-ghost btn-sm" onClick={onResetDefault} title={`Reset to ${defaultLabel}`}>
            <RotateCcw size={13} />
          </button>
          <button
            className={`power-btn ${fg.enabled ? 'on' : 'off'}`}
            onClick={() => onChange({ ...fg, enabled: !fg.enabled })}
          >
            <Power size={12} />
            <span>{fg.enabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
