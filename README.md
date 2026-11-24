# EC102 Virtual Lab Workbench — IIIT Bhagalpur

Interactive Tinkercad-style breadboard simulator + hybrid 2-channel ScientiFic-style Digital Storage Oscilloscope (DSO) powered by an exact nonlinear **Modified Nodal Analysis (MNA)** transient circuit solver, built specifically for **all four core experiments** of the **IIIT Bhagalpur Basic Electrical Science Lab (EC102)**.

**Live App:** [https://shourya-narayan.github.io/ec102-virtual-lab/](https://shourya-narayan.github.io/ec102-virtual-lab/)

## Included Experiments (v2 — Complete Suite)

1. **Experiment 2: Verification of Kirchhoff's Laws (KCL & KVL)**
   - Full Fig. 2.1 circuit (`R1 = R2 = R3 = 1 kΩ`, `1N4007` diode, `0.1 µF` capacitor, `1 kHz` triangular FG `0 V → 5 V`).
   - Quick `CH2` probing (`Node b`, `Node c`, `Node d`), `Math (CH1 − CH2)`, Manual & Track `X1/X2/Y1/Y2` cursors at `t₁ = −0.4 ms` & `t₂ = +0.3 ms`, live KCL/KVL sums (`0.0000 V`), official 5 MCQs (with Fig. 3), and Viva Q&A.
2. **Experiment 3: Verification of the Superposition Theorem**
   - Full Fig. 3.1 network (`3 × 30 kΩ`, `10 kΩ` or `0.01 µF` capacitor) with **Dual-Rail DC Power Supply (`+4.8 V / COM / −3.0 V`)** + `3.6 Vpp` Sine FG.
   - 1-click circuit variants (`Resistive`, `RC 1 kHz`, `RC 2 kHz`) and Superposition source conditions (`All`, `Only VD1`, `Only VD2`, `Only AC va`).
   - Tables 1–4 with automatic algebraic sums, `% Error` verification, official 5 MCQs, and Viva Q&A.
3. **Experiment 4: Thevenin's & Norton's Theorems**
   - Switch live between **Actual Resistive Ladder (Fig. 4.2a)** and **Thevenin Equivalent (Fig. 4.2b: `vOC = vs/4`, `Ro = 10 kΩ`)**.
   - Swap all 9 loads live on the breadboard: 7 resistive loads (`1 kΩ` – `100 kΩ`), `0.01 µF` capacitive load, and nonlinear `1N4007` diode load.
   - Live **`Vo` vs `Io` Linear Extrapolation Plot** computing `vOC`, `iSC`, and `Ro = 10.00 kΩ`, official 5 MCQs, and Viva Q&A.
4. **Experiment 5: Time-Domain & Frequency-Domain Response (Low-Pass RC Filter)**
   - Fig. 5.1 Low-Pass RC Filter (`R1 = R2 = 22 kΩ`, `C = 0.01 µF` → `Req = 11 kΩ`, `τ = 110 µs`, `tr = tf ≈ 242 µs`, `Am = 0.50`, `fc = 1.45 kHz`).
   - Time-Domain Step Response (`1 kHz` square wave, `Y1 = 0.20 V`, `Y2 = 1.80 V`) + Frequency-Domain 1-2-5 Sweep (`100 Hz` – `10 kHz`).
   - Live **DSO `X-Y` Lissajous Mode** (ellipse at `1 kHz` collapsing to slope `0.50` line at low frequencies) + **Semilog Bode Plot (`G(dB)` vs `f`)** marking `−3 dB` cut-off `fc`, Quiz, and Viva Q&A.

## Local Development

```bash
npm install
npm run dev
npm run test:solver
npm run build
```
