# EC102 Virtual Lab Workbench — IIIT Bhagalpur

Interactive Tinkercad-style breadboard simulator + hybrid 2-channel ScientiFic-style Digital Storage Oscilloscope (DSO) powered by an exact nonlinear **Modified Nodal Analysis (MNA)** transient circuit solver, built specifically for the **IIIT Bhagalpur Basic Electrical Science Lab (EC102)**.

**Live App:** [https://shourya-narayan.github.io/ec102-virtual-lab/](https://shourya-narayan.github.io/ec102-virtual-lab/)

## v1 Features — Experiment 2: Verification of Kirchhoff's Laws

- **Tinkercad-Style 30-Column Interactive Breadboard**
  - Place, edit, flip polarity, re-route, and delete 1% resistors (live 4-band color codes), 1N4007 diodes (with cathode band), `0.1 µF` polyester film capacitors (`104`), and color-coded jumper wires.
  - Hover any tie-point hole to highlight internal vertical terminal strips, power rails, and jumper-connected nets with live voltage range inspection.
  - Movable BNC instrument probe clips (`FG+`, `FG GND`, `CH1+`, `CH2+`) plus 1-click quick-probe pills for `Node b`, `Node c`, and `Node d`.
  - **Load Exp 2 Preset** (Fig. 2.1) or **Build From Scratch** practice mode with live topology-independent **Verify My Breadboard (8/8)** netlist checking.
- **Exact Ideal MNA Physics Engine**
  - Live Union-Find breadboard netlist resolution + short-circuit & ground-clip diagnostics.
  - Nonlinear Shockley 1N4007 diode model (SPICE `pnjlim` damped Newton-Raphson) + Trapezoidal RC transient integration with steady-state cycle warmup.
  - Verifies KCL (`vab − vc − vd = 0.0000 V`) and KVL (`va − vac − vc = 0.0000 V`) at `t₁ = −0.4 ms` and `t₂ = +0.3 ms`.
- **Hybrid 2-Channel Lab DSO & Function Generator**
  - Phosphor 10×8 oscilloscope canvas with `CH1 (va)`, `CH2`, and `Math (CH1 − CH2)` traces.
  - Both **Manual Cursor Mode** (drag `X1/X2/Y1/Y2` directly on screen or fine-tune via steppers) and **Track Waveform Mode** (locks `Y1/Y2` mathematically onto `CH1`, `CH2`, or `Math`).
  - Quick-align helpers (`Axes X1=0, Y1=2.5V`, `X2 = t₁`, `X2 = t₂`).
- **Lab Companion Drawer**
  - Interactive IIIT Bhagalpur step-by-step procedure checklist & Fig. 2.1 schematic reference.
  - Interactive Observation Table (Manual & Track modes) with 1-click `Y2` cursor capture, live KCL/KVL residual verification, Manual vs Track error summary, and CSV export.
  - All 5 official Experiment 2 Lab Quiz MCQs (including Fig. 3 KCL node diagram) + 8 high-yield EC102 Viva Q&A flashcards.

## Roadmap (v2)

- **Experiment 3:** Verification of the Superposition Theorem (Dual ±DC Power Supply, Resistive & RC circuits at 1 kHz / 2 kHz)
- **Experiment 4:** Thevenin's & Norton's Theorems (7 resistive loads + `Vo` vs `Io` extrapolation graph, capacitive & diode loads)
- **Experiment 5:** Low-Pass RC Filter (Step response `tr`/`tf`, X-Y Lissajous mode, Semilog Bode plot `G(dB)` vs `f`)

## Local Development

```bash
npm install
npm run dev
npm run test:solver
npm run build
```
