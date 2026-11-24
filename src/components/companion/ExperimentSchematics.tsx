import React from 'react';
import type { ExperimentId } from '../../engine/types';
import { BookOpen } from 'lucide-react';

interface ExperimentSchematicProps {
  experimentId: ExperimentId;
}

export const ExperimentSchematic: React.FC<ExperimentSchematicProps> = ({ experimentId }) => {
  if (experimentId === 'exp2') {
    return (
      <div className="ref-card">
        <div className="ref-title">
          <BookOpen size={13} /> Fig. 2.1 Reference Schematic (R₁ = R₂ = R₃ = 1 kΩ)
        </div>
        <svg viewBox="0 0 360 125" className="ref-svg">
          <line x1="36" y1="104" x2="318" y2="104" stroke="#64748b" strokeWidth="1.6" />
          <line x1="176" y1="104" x2="176" y2="112" stroke="#64748b" strokeWidth="1.6" />
          <line x1="165" y1="112" x2="187" y2="112" stroke="#64748b" strokeWidth="1.6" />
          <line x1="170" y1="117" x2="182" y2="117" stroke="#64748b" strokeWidth="1.4" />
          <line x1="36" y1="30" x2="36" y2="50" stroke="#e2e8f0" strokeWidth="1.6" />
          <circle cx="36" cy="67" r="17" fill="#0f172a" stroke="#facc15" strokeWidth="1.8" />
          <text x="36" y="63" textAnchor="middle" fontSize="11" fill="#facc15" fontWeight="700">+</text>
          <text x="36" y="77" textAnchor="middle" fontSize="12" fill="#94a3b8" fontWeight="700">−</text>
          <text x="14" y="71" textAnchor="middle" fontSize="10" fill="#facc15" fontFamily="JetBrains Mono">va</text>
          <line x1="36" y1="84" x2="36" y2="104" stroke="#e2e8f0" strokeWidth="1.6" />
          <line x1="36" y1="30" x2="64" y2="30" stroke="#e2e8f0" strokeWidth="1.6" />
          <polyline points="64,30 69,22 77,38 85,22 93,38 101,22 106,30" fill="none" stroke="#60a5fa" strokeWidth="1.8" />
          <text x="85" y="16" textAnchor="middle" fontSize="9.5" fill="#93c5fd" fontFamily="JetBrains Mono">R1 1kΩ</text>
          <line x1="106" y1="30" x2="146" y2="30" stroke="#e2e8f0" strokeWidth="1.6" />
          <polygon points="146,21 146,39 164,30" fill="#e2e8f0" />
          <line x1="164" y1="21" x2="164" y2="39" stroke="#e2e8f0" strokeWidth="2.2" />
          <text x="155" y="15" textAnchor="middle" fontSize="9.5" fill="#e2e8f0" fontFamily="JetBrains Mono">D 1N4007</text>
          <line x1="164" y1="30" x2="246" y2="30" stroke="#e2e8f0" strokeWidth="1.6" />
          <line x1="246" y1="19" x2="246" y2="41" stroke="#f59e0b" strokeWidth="2.4" />
          <line x1="255" y1="19" x2="255" y2="41" stroke="#f59e0b" strokeWidth="2.4" />
          <text x="250" y="14" textAnchor="middle" fontSize="9.5" fill="#fcd34d" fontFamily="JetBrains Mono">C 0.1µF</text>
          <line x1="255" y1="30" x2="318" y2="30" stroke="#e2e8f0" strokeWidth="1.6" />
          <line x1="204" y1="30" x2="204" y2="48" stroke="#e2e8f0" strokeWidth="1.6" />
          <polyline points="204,48 196,53 212,61 196,69 212,77 196,85 204,90" fill="none" stroke="#60a5fa" strokeWidth="1.8" />
          <line x1="204" y1="90" x2="204" y2="104" stroke="#e2e8f0" strokeWidth="1.6" />
          <text x="180" y="72" textAnchor="middle" fontSize="9.5" fill="#93c5fd" fontFamily="JetBrains Mono">R2</text>
          <line x1="318" y1="30" x2="318" y2="48" stroke="#e2e8f0" strokeWidth="1.6" />
          <polyline points="318,48 310,53 326,61 310,69 326,77 310,85 318,90" fill="none" stroke="#60a5fa" strokeWidth="1.8" />
          <line x1="318" y1="90" x2="318" y2="104" stroke="#e2e8f0" strokeWidth="1.6" />
          <text x="342" y="72" textAnchor="middle" fontSize="9.5" fill="#93c5fd" fontFamily="JetBrains Mono">R3</text>
          {[
            { x: 46, lbl: 'a', color: '#facc15' },
            { x: 124, lbl: 'b', color: '#22d3ee' },
            { x: 204, lbl: 'c', color: '#34d399' },
            { x: 318, lbl: 'd', color: '#fb923c' },
          ].map((n) => (
            <g key={n.lbl}>
              <circle cx={n.x} cy="30" r="3.5" fill={n.color} />
              <text x={n.x} y="46" textAnchor="middle" fontSize="10.5" fontWeight="700" fill={n.color} fontFamily="JetBrains Mono">
                {n.lbl}
              </text>
            </g>
          ))}
        </svg>
        <div className="ref-formula-row">
          <span>KCL: <code>vab − vc − vd = 0</code></span>
          <span>KVL: <code>va − vac − vc = 0</code></span>
        </div>
      </div>
    );
  }

  if (experimentId === 'exp3') {
    return (
      <div className="ref-card">
        <div className="ref-title">
          <BookOpen size={13} /> Fig. 3.1 Three-Source Network (R₁ = 30 kΩ, R₂ = 10 kΩ / 0.01 µF)
        </div>
        <svg viewBox="0 0 360 125" className="ref-svg">
          {/* Central node vo at (180, 56) */}
          <line x1="38" y1="56" x2="72" y2="56" stroke="#facc15" strokeWidth="1.6" />
          <circle cx="24" cy="56" r="14" fill="#0f172a" stroke="#facc15" strokeWidth="1.6" />
          <text x="24" y="60" textAnchor="middle" fontSize="9.5" fill="#facc15" fontFamily="JetBrains Mono">va</text>
          <polyline points="72,56 78,49 86,63 94,49 102,63 110,49 116,56" fill="none" stroke="#60a5fa" strokeWidth="1.8" />
          <text x="94" y="43" textAnchor="middle" fontSize="9" fill="#93c5fd" fontFamily="JetBrains Mono">R1 30k</text>
          <line x1="116" y1="56" x2="180" y2="56" stroke="#e2e8f0" strokeWidth="1.6" />

          {/* Top-right to +VD1 */}
          <line x1="180" y1="56" x2="210" y2="26" stroke="#e2e8f0" strokeWidth="1.5" />
          <polyline points="210,26 218,20 226,32 234,20 242,32 250,20 258,26" fill="none" stroke="#60a5fa" strokeWidth="1.8" />
          <text x="234" y="15" textAnchor="middle" fontSize="9" fill="#93c5fd" fontFamily="JetBrains Mono">R1 30k</text>
          <line x1="258" y1="26" x2="292" y2="26" stroke="#ef4444" strokeWidth="1.8" />
          <rect x="292" y="14" width="58" height="22" rx="4" fill="rgba(239,68,68,0.2)" stroke="#ef4444" />
          <text x="321" y="29" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#fca5a5" fontFamily="JetBrains Mono">+VD1</text>

          {/* Bottom-right to -VD2 */}
          <line x1="180" y1="56" x2="210" y2="86" stroke="#e2e8f0" strokeWidth="1.5" />
          <polyline points="210,86 218,80 226,92 234,80 242,92 250,80 258,86" fill="none" stroke="#60a5fa" strokeWidth="1.8" />
          <text x="234" y="75" textAnchor="middle" fontSize="9" fill="#93c5fd" fontFamily="JetBrains Mono">R1 30k</text>
          <line x1="258" y1="86" x2="292" y2="86" stroke="#3b82f6" strokeWidth="1.8" />
          <rect x="292" y="74" width="58" height="22" rx="4" fill="rgba(59,130,246,0.2)" stroke="#3b82f6" />
          <text x="321" y="89" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#93c5fd" fontFamily="JetBrains Mono">−VD2</text>

          {/* Load R2 / C down to GND */}
          <line x1="180" y1="56" x2="180" y2="70" stroke="#e2e8f0" strokeWidth="1.6" />
          <polyline points="180,70 173,75 187,81 173,87 187,93 173,99 180,104" fill="none" stroke="#f59e0b" strokeWidth="1.8" />
          <text x="144" y="90" textAnchor="middle" fontSize="9" fill="#fcd34d" fontFamily="JetBrains Mono">R2 / C</text>
          <line x1="180" y1="104" x2="180" y2="112" stroke="#64748b" strokeWidth="1.6" />
          <line x1="168" y1="112" x2="192" y2="112" stroke="#64748b" strokeWidth="1.6" />
          <line x1="173" y1="117" x2="187" y2="117" stroke="#64748b" strokeWidth="1.4" />

          {/* Node vo dot */}
          <circle cx="180" cy="56" r="4.5" fill="#22d3ee" />
          <text x="172" y="45" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#22d3ee" fontFamily="JetBrains Mono">vo</text>
        </svg>
        <div className="ref-formula-row">
          <span>Resistive: <code>vo = (VD1+VD2+va)/6</code></span>
          <span>Superposition: <code>vo = vo1 + vo2 + vo3</code></span>
        </div>
      </div>
    );
  }

  if (experimentId === 'exp4') {
    return (
      <div className="ref-card">
        <div className="ref-title">
          <BookOpen size={13} /> Fig. 4.2(a) Actual Ladder → Fig. 4.2(b) Thevenin Equivalent
        </div>
        <svg viewBox="0 0 360 120" className="ref-svg">
          {/* Ground rail */}
          <line x1="28" y1="100" x2="215" y2="100" stroke="#64748b" strokeWidth="1.5" />
          {/* Source vs */}
          <circle cx="28" cy="64" r="14" fill="#0f172a" stroke="#facc15" strokeWidth="1.6" />
          <text x="28" y="68" textAnchor="middle" fontSize="9.5" fill="#facc15" fontFamily="JetBrains Mono">vs</text>
          <line x1="28" y1="28" x2="28" y2="50" stroke="#e2e8f0" strokeWidth="1.5" />
          <line x1="28" y1="78" x2="28" y2="100" stroke="#e2e8f0" strokeWidth="1.5" />
          {/* 20k series */}
          <line x1="28" y1="28" x2="46" y2="28" stroke="#e2e8f0" strokeWidth="1.5" />
          <polyline points="46,28 51,21 57,35 63,21 69,35 75,21 80,28" fill="none" stroke="#60a5fa" strokeWidth="1.6" />
          <text x="63" y="16" textAnchor="middle" fontSize="8.5" fill="#93c5fd" fontFamily="JetBrains Mono">20k</text>
          <line x1="80" y1="28" x2="108" y2="28" stroke="#e2e8f0" strokeWidth="1.5" />
          {/* 20k shunt */}
          <line x1="94" y1="28" x2="94" y2="48" stroke="#e2e8f0" strokeWidth="1.5" />
          <polyline points="94,48 88,53 100,59 88,65 100,71 88,77 94,82" fill="none" stroke="#60a5fa" strokeWidth="1.6" />
          <line x1="94" y1="82" x2="94" y2="100" stroke="#e2e8f0" strokeWidth="1.5" />
          <text x="77" y="68" textAnchor="middle" fontSize="8" fill="#93c5fd" fontFamily="JetBrains Mono">20k</text>
          {/* 10k series */}
          <polyline points="108,28 113,21 119,35 125,21 131,35 137,21 142,28" fill="none" stroke="#60a5fa" strokeWidth="1.6" />
          <text x="125" y="16" textAnchor="middle" fontSize="8.5" fill="#93c5fd" fontFamily="JetBrains Mono">10k</text>
          <line x1="142" y1="28" x2="200" y2="28" stroke="#e2e8f0" strokeWidth="1.5" />
          {/* 20k shunt 2 */}
          <line x1="158" y1="28" x2="158" y2="48" stroke="#e2e8f0" strokeWidth="1.5" />
          <polyline points="158,48 152,53 164,59 152,65 164,71 152,77 158,82" fill="none" stroke="#60a5fa" strokeWidth="1.6" />
          <line x1="158" y1="82" x2="158" y2="100" stroke="#e2e8f0" strokeWidth="1.5" />
          <text x="141" y="68" textAnchor="middle" fontSize="8" fill="#93c5fd" fontFamily="JetBrains Mono">20k</text>
          {/* Load RL */}
          <rect x="188" y="48" width="24" height="32" rx="4" fill="rgba(34,211,238,0.16)" stroke="#22d3ee" />
          <text x="200" y="67" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#22d3ee" fontFamily="JetBrains Mono">Load</text>
          <line x1="200" y1="28" x2="200" y2="48" stroke="#22d3ee" strokeWidth="1.5" />
          <line x1="200" y1="80" x2="200" y2="100" stroke="#22d3ee" strokeWidth="1.5" />

          {/* Arrow -> Thevenin */}
          <text x="231" y="64" textAnchor="middle" fontSize="14" fill="#34d399" fontWeight="700">⇒</text>

          {/* Thevenin Box */}
          <line x1="256" y1="100" x2="342" y2="100" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="256" cy="64" r="14" fill="#0f172a" stroke="#34d399" strokeWidth="1.6" />
          <text x="256" y="68" textAnchor="middle" fontSize="8.5" fill="#34d399" fontFamily="JetBrains Mono">vOC</text>
          <line x1="256" y1="28" x2="256" y2="50" stroke="#e2e8f0" strokeWidth="1.5" />
          <line x1="256" y1="78" x2="256" y2="100" stroke="#e2e8f0" strokeWidth="1.5" />
          <line x1="256" y1="28" x2="274" y2="28" stroke="#e2e8f0" strokeWidth="1.5" />
          <polyline points="274,28 279,21 285,35 291,21 297,35 303,21 308,28" fill="none" stroke="#34d399" strokeWidth="1.7" />
          <text x="291" y="16" textAnchor="middle" fontSize="8.5" fill="#6ee7b7" fontFamily="JetBrains Mono">Ro 10k</text>
          <line x1="308" y1="28" x2="334" y2="28" stroke="#e2e8f0" strokeWidth="1.5" />
          <rect x="322" y="48" width="24" height="32" rx="4" fill="rgba(34,211,238,0.16)" stroke="#22d3ee" />
          <text x="334" y="67" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#22d3ee" fontFamily="JetBrains Mono">Load</text>
          <line x1="334" y1="28" x2="334" y2="48" stroke="#22d3ee" strokeWidth="1.5" />
          <line x1="334" y1="80" x2="334" y2="100" stroke="#22d3ee" strokeWidth="1.5" />
        </svg>
        <div className="ref-formula-row">
          <span><code>vOC = vs/4 = 1.0 V</code></span>
          <span><code>Ro = 10 kΩ</code></span>
          <span><code>iSC = 0.10 mA</code></span>
        </div>
      </div>
    );
  }

  // Experiment 5: Low-Pass RC Filter (Fig 5.1)
  return (
    <div className="ref-card">
      <div className="ref-title">
        <BookOpen size={13} /> Fig. 5.1 Low-Pass RC Filter (R₁ = R₂ = 22 kΩ, C = 0.01 µF)
      </div>
      <svg viewBox="0 0 360 120" className="ref-svg">
        <line x1="48" y1="100" x2="300" y2="100" stroke="#64748b" strokeWidth="1.6" />
        <circle cx="48" cy="64" r="16" fill="#0f172a" stroke="#facc15" strokeWidth="1.7" />
        <text x="48" y="68" textAnchor="middle" fontSize="10" fill="#facc15" fontFamily="JetBrains Mono">vs</text>
        <line x1="48" y1="28" x2="48" y2="48" stroke="#e2e8f0" strokeWidth="1.6" />
        <line x1="48" y1="80" x2="48" y2="100" stroke="#e2e8f0" strokeWidth="1.6" />
        <line x1="48" y1="28" x2="88" y2="28" stroke="#e2e8f0" strokeWidth="1.6" />
        <polyline points="88,28 94,20 102,36 110,20 118,36 126,20 132,28" fill="none" stroke="#60a5fa" strokeWidth="1.8" />
        <text x="110" y="15" textAnchor="middle" fontSize="9.5" fill="#93c5fd" fontFamily="JetBrains Mono">R1 22kΩ</text>
        <line x1="132" y1="28" x2="296" y2="28" stroke="#e2e8f0" strokeWidth="1.6" />

        {/* R2 shunt */}
        <line x1="184" y1="28" x2="184" y2="48" stroke="#e2e8f0" strokeWidth="1.6" />
        <polyline points="184,48 176,53 192,60 176,67 192,74 176,81 184,86" fill="none" stroke="#60a5fa" strokeWidth="1.8" />
        <line x1="184" y1="86" x2="184" y2="100" stroke="#e2e8f0" strokeWidth="1.6" />
        <text x="156" y="70" textAnchor="middle" fontSize="9.5" fill="#93c5fd" fontFamily="JetBrains Mono">R2 22k</text>

        {/* C shunt */}
        <line x1="252" y1="28" x2="252" y2="58" stroke="#e2e8f0" strokeWidth="1.6" />
        <line x1="238" y1="58" x2="266" y2="58" stroke="#f59e0b" strokeWidth="2.4" />
        <line x1="238" y1="68" x2="266" y2="68" stroke="#f59e0b" strokeWidth="2.4" />
        <line x1="252" y1="68" x2="252" y2="100" stroke="#e2e8f0" strokeWidth="1.6" />
        <text x="288" y="67" textAnchor="middle" fontSize="9.5" fill="#fcd34d" fontFamily="JetBrains Mono">0.01µF</text>

        <circle cx="296" cy="28" r="4" fill="#22d3ee" />
        <text x="314" y="32" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#22d3ee" fontFamily="JetBrains Mono">+vo</text>
      </svg>
      <div className="ref-formula-row">
        <span><code>Req = 11 kΩ</code> · <code>τ = 110 µs</code></span>
        <span><code>tr = 242 µs</code> · <code>fc = 1.45 kHz</code></span>
      </div>
    </div>
  );
};
