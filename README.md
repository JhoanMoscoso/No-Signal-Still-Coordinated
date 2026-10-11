# No Signal, Still Coordinated

*Entanglement can't let your servers talk. It can let them agree.*

Theme: Quantum Unlocked (quantum networking) · Qollab × IonQ hackathon

Qollab project: [LINK: Qollab project] · Video: [LINK: video] · Code: [LINK: GitHub repo] · Team: [TEAM]

## What it does

An interactive page that builds quantum circuits with Qiskit on Pyodide, in your browser, and runs them on the backend you pick. It separates what entanglement can do for distributed systems from what it cannot.

- **Act 1, the myth.** Whatever Alice does to her half of a Bell pair, Bob's statistics stay 50/50 and his state is ρ_B = I/2. Try to send a message and fail.
- **Act 2, what it can do.** Leader election (W state), a shared coin (GHZ state), then CHSH, where an entangled pair beats every pre-agreed table.
- **Act 3, reality check.** A visibility slider shows how noise erodes the advantage, with points from the built-in simulator and our IonQ Forte 1 noise-model runs.

## The problem it explores

A popular story says entangled particles could synchronise servers or send signals faster than light. They cannot. Measuring one half of a pair never changes what the other owner sees: entanglement gives correlation, not communication (the no-signalling theorem).

Correlation without communication is still useful. In the CHSH game, a referee gives Alice a bit x and Bob a bit y. Each answers with a bit (a and b) without talking, and they win iff a XOR b = x AND y. Think of two load balancers: x and y mean "I see a burst", the answer is backend 0 or 1, and they should pick the same backend unless both see a burst. An "envelope" is a pre-agreed lookup table of answers. There are 16 deterministic ones, and the best wins 75 %.

Three primitives from distributed systems benefit:

- **Symmetry breaking / leader election.** Identical nodes with no IDs must pick exactly one leader. Given a pre-shared W state, measuring it gives exactly one winner, fairly (1/3 each), in one step with no messages. Preparing that state without a dealer is the hard part (see Honest limitations).
- **A shared random coin.** Measuring a GHZ state gives every node the same random bit. Nobody chose it, so nothing was sent. A dealer handing out a random bit gives the same coin; CHSH is the only strictly non-classical result in the demo.
- **Non-local coordination (CHSH).** Any pre-agreed strategy wins at most 75 %. Sharing a Bell pair wins about 85.4 %. No table of answers can reproduce that. It is the one result in this demo that no envelope can imitate (Bell's theorem).

## Why it matters

Distributed-systems engineers keep hearing that entanglement could synchronise or signal between nodes. It cannot. This page also shows what quantum networking could give coordination protocols (shared randomness and non-local correlations, but no messages and no speed-up) and states the hardware gap: the advantage needs quantum memory and entanglement distribution that do not exist at scale today.

## How to run it (on Qollab)

1. Open the project and pick any local simulator. The built-in one is instant. IonQ is optional.
2. Each run submits **exactly one job**. The page chooses the format itself:
   - on IonQ, the 9 experiments are packed side by side into one 20-qubit circuit;
   - on local simulators, 9 small circuits go in a single call.
3. The page first paints precomputed results, then replaces them with live ones. A badge says which you are seeing.

What to try:

- **Act 1:** the three Alice buttons, then "Send message" with a 32-bit message and the inverse-decoder toggle. Bob stays near 50 % either way.
- **Act 2:** "Elect again" (and "Elect 100 times") for the W state, "Flip the shared coin" for GHZ, and the CHSH race ("Play 100" / "Play 1000"). In the race you can pick any of the 16 envelope tables. None beats 75 % in the long run; short races fluctuate (±4 % at 100 rounds).
- **Act 3:** drag the visibility slider (keyboard works too).

## Results we measured

1000 shots per experiment (in IonQ's wide mode one shot covers all nine). The nine experiments are 3 no-signalling circuits, 4 CHSH question pairs, W and GHZ. CHSH pools its four pairs (σ ≈ 0.006).

| Run | CHSH win rate | W: exactly one leader | W: split-brain | W: no leader | GHZ agreement |
|---|---|---|---|---|---|
| Built-in simulator (our Qollab runs) | 0.849 to 0.858 | 1.000 | 0.000 | 0.000 | 1.000 |
| IonQ Forte 1 noise model, run F0 | 0.854 | 0.968 | 0.027 | 0.005 | 0.984 |
| IonQ Forte 1 noise model, run F1 | 0.846 | 0.960 | 0.027 | 0.013 | 0.977 |
| IonQ Forte 1 noise model, run F2 | 0.8365 | 0.970 | 0.025 | 0.005 | 0.970 |

The first-paint values shipped with the page come from BasicSimulator and differ slightly from the built-in row. The Forte rows are **our own runs on the Forte 1 noise model, made on Oct 10 2026. They are not IonQ-published data.** In these runs roughly one election in 37 to 40 produced two or more leaders (split-brain).

Classical limit 0.75; Tsirelson bound 0.8536 (the maximum quantum value, cos²(π/8)); Bob's marginal P(1) was 0.46 to 0.53 in every Act 1 case.

## How it works

- **Circuits.** Bell pair; GHZ on 3 qubits; an exact W state on 3 qubits (deterministic preparation, not post-selected); CHSH with Alice measuring at 0° or 45° and Bob at +22.5° or −22.5°. An angle θ is a measurement direction in the X–Z plane, implemented as RY(−2θ) followed by a Z-basis measurement.
- **Playing rounds is resampling.** The buttons in the UI draw i.i.d. samples from the measured counts. This matches fresh shots up to the sampling error of the original 1000. It adds no new measurement information and never submits another job, so a run stays one job.
- **Noise model.** V is the fraction of the ideal state kept under white noise: ρ = V·ρ_ideal + (1−V)·I/2ⁿ. Then P_win = ½ + V·√2/4, so the quantum strategy stops beating 75 % at V = 1/√2 ≈ 0.707. For the W state, P(exactly one leader) = V + 3(1−V)/8. The failures are split-brain (two or more leaders) and no leader.

## How to replicate or extend

Run everything from the repository root. Node 22 or newer is required for the UI tests.

```
pip install qiskit qiskit-aer pytest     # requirements.txt only notes this; Qollab has Qiskit built in
python -m pytest tests -q                # quantum engine tests
node --test tests/ui/*.test.mjs          # UI tests, no npm dependencies
python local_run.py 1000                 # regenerate data/precomputed.json and .js
```

`local_run.py` overwrites the tracked `data/precomputed.*` with new random samples, so commit or discard that change on purpose.

To work on the UI without Qollab, run `python3 -m http.server` from the repository root and open `http://localhost:8000/dev/`. The harness fakes the Qollab `backend` and replaces `quantum.runner` with precomputed data. It serves slightly perturbed values as the "live" result, and Forte-like noisy values under `?mode=wide`. It is not uploaded to Qollab.

Extension ideas: W and GHZ for n nodes; other non-local games (the Mermin–GHZ game is already in `quantum/mermin.py`, not wired into the UI); a noise model per hardware platform.

## Honest limitations

- **No signalling.** Entanglement carries no information and cannot detect remote changes. The correlation only shows once results are compared over an ordinary channel.
- **No speed or latency advantage.** It is about agreement, not faster messages.
- **The W-state caveat.** With a W state that is already prepared, you could get the same leader with shuffled envelopes and a dealer. The quantum point is that anonymous nodes can prepare this symmetry-breaking state among themselves, with no dealer, which no classical algorithm can do exactly in an anonymous, symmetric network (Tani–Kobayashi–Matsumoto). The W state is the resource for this (D'Hondt–Panangaden). The demo shows the measurement step, not that preparation.
- **Not deployable today.** It needs quantum memory that holds entanglement for the decision window (tens of ms; ≈ 45 ms one-way fibre latency Bogotá → Frankfurt) and an entanglement distribution rate at least equal to the decision rate. Neither exists at scale.
- **The Forte points sit on the curve by construction.** Each point uses the visibility inferred from its own metric, so it lands on that curve. What varies between runs is how far left it falls. Real hardware noise is not white, so each metric yields a different V (see the F0–F2 table).
- **Simulators only.** All results are simulator runs, including IonQ's Forte 1 noise model. There is no QPU hardware data.

## Background and related work

- Fitzi, Gisin, Maurer. *Quantum Solution to the Byzantine Agreement Problem.* PRL 87, 217901 (2001). Byzantine agreement from entanglement.
- Ben-Or, Hassidim. *Fast Quantum Byzantine Agreement.* STOC 2005. Faster quantum Byzantine agreement.
- Gaertner, Bourennane, Kurtsiefer, Cabello, Weinfurter. *Experimental demonstration of a quantum protocol for Byzantine agreement and liar detection.* PRL 100, 070504 (2008). Experimental Byzantine agreement demo.
- Tani, Kobayashi, Matsumoto. *Exact Quantum Algorithms for the Leader Election Problem.* arXiv:0712.4213 (ACM TOCT 2012). Leader election in anonymous networks.
- D'Hondt, Panangaden. *The Computational Power of the W and GHZ states.* QIC 6(2), 173–183 (2006). W and GHZ computational power.
- Brassard, Broadbent, Tapp. *Quantum Pseudo-Telepathy.* arXiv:quant-ph/0407221; *Recasting Mermin's multi-player game…* QIC 5(7) (2005). Pseudo-telepathy and the Mermin game.
- Kómár, Kessler, Bishof, Jiang, Sørensen, Ye, Lukin. *A quantum network of clocks.* Nature Physics 10, 582 (2014). Networked atomic clocks.
- Jozsa, Abrams, Dowling, Williams. *Quantum Clock Synchronization Based on Shared Prior Entanglement.* PRL 85, 2010 (2000). Critique: Burt, Ekstrom, Swanson, arXiv:quant-ph/0007030. Clock synchronisation (and critique).
- Chakraborty et al. *Scalable & Noise-Robust Communication Advantage of Multipartite Quantum Entanglement.* arXiv:2409.13223 (2024). Multipartite communication advantage under noise.

## Acknowledgement

This effort is supported by Qollab & IonQ.

## AI disclosure

[AI DISCLOSURE AND PRIOR-MATERIAL STATEMENT — TO BE WRITTEN BY THE TEAM]

## License

MIT. See `LICENSE`.
