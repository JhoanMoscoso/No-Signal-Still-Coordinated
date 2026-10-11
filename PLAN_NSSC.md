# PLAN — *No Signal, Still Coordinated*

**Hackathon:** Qollab × IonQ · Tema **Quantum Unlocked** (quantum networking)
**Deadline duro:** domingo 11 oct 2026, 19:00 ET / 18:00 Colombia. Envía el capitán (Jhoan).
**Estado (10 oct 2026):** Fase 0 cerrada. Motor cuántico listo (20/20 tests), modo automático validado en Qollab built-in (list), IBM Fez con ruido (list) e IonQ Forte 1 remoto (wide). Publicado en Qollab como **v0.1** (MIT); la próxima subida es **v0.2**. Fase 1 (UI: layout, Acto 1, Acto 2 estático) implementada y revisada; pendiente prueba en Qollab como v0.2. Reportes por fase para quien continúe: `reportes/`.
**Corre en paralelo con *Entangled*.** Presupuesto realista para este proyecto: **~11 h de Jhoan + ~2 h de revisión de física + ~1,5 h de video**. Si no hay ese tiempo, ver §6 (plan de corte).

---

## 1. Qué entregamos (en una frase por acto)

| Acto | Qué ve el usuario | Mensaje |
|---|---|---|
| 1 — El mito | Elige qué hace Alice (nada / Z / X). El histograma de Bob no se mueve. Reto "envía un bit" se queda en ~50 %. Cajita con ρ_B = I/2. | Entrelazamiento = correlación, no comunicación. |
| 2a — Líder (W) | Tres réplicas anónimas miden; exactamente una se enciende. Elección justa 33/33/33. | Romper simetría sin mensajes ni IDs. *Honesto:* esto también sale con sobres, si hay repartidor. |
| 2b — Consenso (GHZ) | Tres réplicas leen el mismo bit aleatorio. | Acuerdo gratis sobre un valor que nadie eligió. |
| 2c — CHSH (Bell) | Simulador de sobres (16 estrategias) se estanca en 75 %. Par de Bell sube a 85 %. | **Ningún sobre puede hacer esto.** Lo cuántico coordina mejor que cualquier pacto previo. |
| 3 — Reality check | Slider de visibilidad V: curva CHSH (85→75, umbral 0,707) y curva W (split-brain / sin líder). Punto medido en simulador con ruido. Requisitos de hardware. | Ventaja real pero frágil; hoy no hay hardware a escala. |

Orden pedagógico del Acto 2: **W → GHZ → CHSH**. Los dos primeros dan intuición; el tercero es la prueba.

---

## 2. Arquitectura (ya implementada en `quantum/`)

```
index.html            fragmento sin <html>/<body>; contenedores de los 3 actos; sin estilos inline
main.js               UN backend.run con UN circuito de 20 qubits; pinta precomputed al instante, luego live
main.css              único CSS; contraste ≥ 4.5:1, :focus-visible, aria
quantum/
  circuits.py         bell_pair, ghz3, w3 (exacto), measure_at_angle, bit()
  nosignal.py         3 circuitos Acto 1; marginal de Bob; ρ_B por partial_trace
  chsh.py             4 circuitos; win_rate con σ; 16 estrategias clásicas (máx 0,75)
  leader.py           W; exactly_one / split_brain / no_leader / per_node
  consensus.py        GHZ; agreement
  mermin.py           opcional; juego Mermin-GHZ (100 % vs 75 %); 4 circuitos
  noise.py            curvas analíticas P(V); infer_visibility; umbral 1/√2
  runner.py           build_wide() + parse_wide_counts() (el job real); build_all() (lista, solo local); mermin_wide()
data/
  precomputed.json    resultado real de BasicSimulator (fallback)
  precomputed.js      mismo contenido como módulo ES (import sin fetch)
tests/test_quantum.py 20 tests con Aer (fallback BasicSimulator, lento a 20 qubits)
tests/ui/*.test.mjs   tests de UI con node --test (sin DOM real)
ui/
  sample.js           sample(raw), bit(key, qubit) — rondas sin más jobs (Fase 2)
  charts.js           SVG puro como string: hbar, histogram2, nodes, pct
  act1.js             Acto 1: botones de Alice, histograma de Bob, ρ_B
  act2.js             Acto 2: paneles W → GHZ → CHSH
dev/                  harness local, NO se sube: index.html + shim de quantum.runner (python3 -m http.server → /dev/)
local_run.py          corre todo localmente y regenera data/
```

### Contrato JS ↔ Python (lo único que la UI necesita saber)

**Un job, formato según backend (modo automático, v0.3).**
- IonQ (remoto o QPU) acepta un job por run **y rechaza jobs multi-circuito** (`Only job type ionq.circuit.v1 is supported`). → modo **`wide`**: los 9 experimentos lado a lado en **un circuito de 20 qubits** (bloques disjuntos: nosignal 3×2, CHSH 4×2, W 3, GHZ 3). Cada shot es un shot de todos los experimentos. Forte 1: 4 s.
- Simuladores locales (built-in, IBM noise, Braket) aceptan varios circuitos por llamada, pero **un circuito de 20 qubits congela el navegador** (WASM, un hilo). → modo **`list`**: 9 circuitos pequeños en una sola llamada `backend.run`.
- `run_mode(backend)` decide: `'wide'` si la clase del backend viene de `qiskit_ionq`, si no `'list'`.

```js
const mode    = await runner.run_mode.callPromising(backend);      // 'wide' | 'list'
const payload = await runner.build_for.callPromising(mode);        // circuito o lista
const job     = await backend.run(payload, { shots: SHOTS });      // ÚNICO job
const counts  = (await job.result()).get_counts();                 // dict o lista (proxy)
const data    = (await runner.parse_any.callPromising(mode, counts)).toJs({ dict_converter: Object.fromEntries });
```

Mermin-GHZ (12 qubits más) **no** entra en el circuito ancho (32 > 29). Queda como segundo job opcional solo en simuladores locales (`runner.mermin_wide()` + `parse_mermin_wide()`), con botón en P2. En IonQ se muestra el valor precomputado.

`data` tiene esta forma (igual en `data/precomputed.json`):

```
nosignal.{none,Z,X}.bob.{p0,p1}     nosignal.Z.p_same_after_compare   nosignal.rho_bob
chsh.{overall,sigma,per_pair,classical_strategies[16],classical_best,tsirelson_bound,raw}
leader.{exactly_one,split_brain,no_leader,per_node_leader[3],raw}
consensus.{agreement,p_all_zero,p_all_one,raw}
mermin.{overall,per_input}
noise.{v[101],chsh_win[],w_exactly_one[],w_split_brain[],w_no_leader[],ghz_agreement[],chsh_threshold}
inferred_visibility.{chsh,w,ghz,mermin}
```

### Verificado

- **Qollab built-in 24q (v0.1, modo lista):** CHSH 0,858 · W 1,0 · GHZ 1,0 · Mermin 1,0 · Bob 0,51/0,51/0,47. Instantáneo.
- **IonQ Forte 1 remoto (v0.2, modo wide, 1000 shots, 4 s):** CHSH 0,854 ± 0,006 · **W exactamente-uno 0,968, split-brain 0,027** · GHZ 0,984 · Bob 0,53/0,50/0,52 · visibilidad inferida W 0,95, GHZ 0,98. *Con el modelo de ruido real de IonQ, 1 de cada 37 elecciones de líder produce dos líderes.* → frase para el Acto 3.
- **Local (Aer):** 20/20 tests, incluido que ningún gate cruza bloques y que `run_mode` detecta IonQ.
- **Built-in con circuito ancho (v0.2):** congeló el navegador → motivo del modo automático.

### Cómo la UI "juega rondas" sin más jobs

"Jugar una ronda" = sortear (x, y) al azar y muestrear un resultado del dict `raw` de ese circuito proporcionalmente a sus counts. Estadísticamente idéntico a pedir un shot nuevo, y no viola el límite de un job. Documentarlo en la página por si un juez pregunta.

---

## 3. Fases

### Fase 0 — Validar el contrato en Qollab

1. ✅ Proyecto JS creado; built-in OK en modo lista (v0.1).
2. ✅ Forte 1 remoto rechazó la lista → circuito ancho (v0.2) → Forte OK, 4 s. `cry` transpiló sin problema.
3. ✅ Built-in se congeló con el circuito ancho → modo automático `run_mode` (v0.3).
4. ✅ Built-in con el modo automático: `"source": "live (list)"`, instantáneo.
5. ✅ IBM Fez con ruido: `live (list)`, números degradados, `inferred_visibility` < 1. Menos de un minuto con 1000 shots → `SHOTS` se queda en 1000.
6. ✅ Forte 1 otra vez: `live (wide)`.
7. ✅ **Publicado en Qollab como v0.1 con licencia MIT.** Ya existe un envío válido aunque feo.

> **Versionado Qollab:** las etiquetas v0.1/v0.2/v0.3 de arriba eran internas del desarrollo. En Qollab la versión publicada es **v0.1** (contiene el modo automático). La siguiente publicación será **v0.2** (Fase 1).

**Fase 0 cerrada.** El contrato queda congelado: la UI solo lee `data`. Reporte: `reportes/fase-0.md`.

### Fase 1 — Layout + Acto 1 + Acto 2 estático (3 h) — ✅ implementada, ☐ prueba en Qollab (v0.2). Reporte: `reportes/fase-1.md`
- `ui/charts.js`: barra horizontal con marcas (75 %, 85,4 %), histograma 0/1, tres "nodos" con luz. SVG a mano, sin librerías.
- Acto 1: selector de acción de Alice (3 botones, `aria-pressed`), histograma de Bob desde `nosignal[choice].bob`, cajita ρ_B.
- Acto 2: tres paneles con sus barras desde `leader`, `consensus`, `chsh`. Texto corto de cada uno (ver §5).
- Mostrar badge "precomputed" vs "live" (`body[data-source]`).

### Fase 2 — Interactividad (2 h)
- Acto 1 reto "send a bit": el usuario escribe 8 bits; por cada bit Alice "hace" Z o X; Bob muestrea de `raw`; marcador de aciertos → ~50 %.
- Acto 2c: botón "Play 100 rounds" (muestreo de `raw`), contador vivo; tabla de las 16 estrategias de sobres con su 75 % máximo, resaltando que ninguna llega a 4/4.
- Acto 2a: botón "Elect again" que muestrea W y enciende un nodo.

### Fase 3 — Acto 3 (2 h)
- Slider V ∈ [0,1] (`<input type="range">` con etiqueta). Dibuja `noise.chsh_win` y `noise.w_exactly_one` + `w_split_brain`; línea en 0,75 y en V = 0,707.
- Punto "measured on this backend" en V = `inferred_visibility.chsh` y `.w`. Si el run fue en Built-in, el punto cae en V = 1 y se dice.
- Texto de requisitos: memoria cuántica ≥ ventana de latencia (decenas de ms), tasa de distribución de entrelazamiento ≥ tasa de decisiones, y que la elección de líder con W necesita que los nodos *preparen* el estado entre sí (Tani et al.) para que no sea "sobres con repartidor".

### Fase 4 — Documentación y cumplimiento (2 h)
- Página del proyecto en Qollab (inglés): qué hace, qué problema explora, cómo correrlo, cómo extenderlo (p. ej. n nodos, otros juegos no-locales), referencias (§7).
- Frase exacta **"This effort is supported by Qollab & IonQ"** (ya está en `index.html`; repetir en la página).
- Declaración de IA y de material previo (ver §4, decisión 10).
- Pasada de accesibilidad: tab por todo, contraste, `aria-live` en el status, resultados no solo por color (texto + forma).
- Repo público en GitHub (MIT) con README = esta página.

### Fase 5 — Video y envío (1,5 h)
- Guion de 2–3 min: 20 s mito → 40 s Acto 1 → 60 s Acto 2 (W, GHZ, CHSH con la pared del 75 %) → 30 s Acto 3 → 10 s cierre.
- Grabar con el Built-in simulator (instantáneo). Subir a YouTube/Loom sin login.
- Enviar desde https://qollab.xyz/programs/hackathon/register con tema **Quantum Unlocked**.

### P2 (solo si todo lo anterior está cerrado)
- Mapa Bogotá–Frankfurt con el mensaje clásico viajando ~45 ms (SVG estático con animación CSS).
- Panel Mermin-GHZ (los circuitos ya corren; falta solo pintar `mermin.overall`).

---

## 4. Decisiones por zanjar

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| 1 | **Dónde ocurre el run** | A) En JS: `await backend.run(...)`, `await job.result()`, pasar counts a Python. B) En Python: `run_all(backend)` vía `callPromising`. | **A, confirmado en Fase 0** (built-in). B queda como respaldo. |
| 1b | **Formato del job** | Lista / circuito ancho / automático | **Automático (zanjado en v0.3):** `wide` en IonQ (la lista falla con `Only job type ionq.circuit.v1 is supported`), `list` en locales (el ancho congela el navegador). |
| 2 | **Shots** | 500 / 1000 / 2000 | **1000.** Cada shot cubre los 9 experimentos. En los simuladores IBM con ruido el costo es por shot y a 20 qubits en el navegador puede tardar 1–3 min; si molesta, bajar a 500 (σ(CHSH) sube a 0,8 %, aún sobra). |
| 3 | **Entorno local** | A) Python con BasicSimulator + pytest; JS contra `data/precomputed.js` con un `dev.html` mínimo que define un `backend` falso. B) Replicar Pyodide localmente. | **A.** B no aporta nada que la Fase 0 no valide en 10 minutos. Para el `dev.html` local: un shim `backend = { run: async () => ({ result: async () => ({ get_counts: () => countsFromJson }) }) }` y `quantum.runner` se reemplaza por un módulo que devuelve `precomputed`. |
| 4 | **Mermin en el job** | En el circuito ancho / segundo job local / solo precomputado | **Segundo job solo en simuladores locales** (botón "Run Mermin — local simulators only"), precomputado en IonQ. 32 qubits no caben en los simuladores de IonQ. `INCLUDE_MERMIN=False`. |
| 5 | **Orden del Acto 2** | W→GHZ→CHSH / CHSH primero | **W→GHZ→CHSH.** Intuición primero, prueba al final, y permite el guiño honesto de los sobres. |
| 6 | **Gráficas** | SVG a mano / D3 desde jsdelivr / Canvas | **SVG a mano.** Son barras y una curva; D3 es dependencia externa y tiempo. Canvas no es accesible por defecto. |
| 7 | **Idioma** | Inglés todo / mixto | **Inglés** en UI, página, README, video. Español solo en este plan. |
| 8 | **Mapa** | Animado / estático / cortar | **Estático con un número grande "≥ 45 ms"** en el Acto 1, y animación solo en P2. |
| 9 | **Fallback precomputed** | Mostrar solo si falla / mostrar siempre primero | **Mostrar siempre primero** con badge, reemplazar por live al terminar. En IonQ remoto el job tarda; la página nunca se ve vacía. |
| 10 | **Declaración de IA** | Texto a decidir | Proponer en la página: *"Project concept, physics review, circuit design and parts of the code were developed with the assistance of Claude (Anthropic). The classical-bound enumeration, angle conventions and all numerical results were independently verified by the team with Qiskit's BasicSimulator. No prior project code or templates were reused."* Ajustar a lo que sea cierto al final. |
| 11 | **Nodo del envío** | El handoff dice Colombia/EAFIT; el equipo está registrado en otro nodo | **Confirmar en el formulario de registro cuál aparece** y usar ese. No es decisión nuestra, pero sí hay que verificarla antes de enviar. |
| 12 | **Reparto con Entangled** | Jhoan solo / repartir | **Jhoan: Fases 0–3 y 5. Juanjo: 1 h revisando los textos de física (§5) y los docstrings. Samuel: Fase 4 (página + README) y el video si Jhoan le pasa la grabación.** Fernanda no entra en B. |
| 13 | **Nombre en Qollab y repo** | `no-signal-still-coordinated` | Usar ese slug en ambos. |

---

## 5. Textos cortos (para que Juanjo los revise)

- **Act 1.** "Alice and Bob share a Bell pair. Whatever Alice does — nothing, measure in Z, measure in X — Bob's statistics are 50/50 and his local state is ρ_B = I/2. The correlation exists, but it only becomes *visible* when Alice's results reach Bob over an ordinary channel (≥ 45 ms Bogotá→Frankfurt). Entanglement gives correlation, not communication (no-signalling theorem)."
- **Act 2a (W).** "Three identical replicas share |W⟩ = (|100⟩+|010⟩+|001⟩)/√3 and each measures its qubit. Exactly one reads 1: it is the leader. Fair (1/3 each), one step, no IDs, no messages. Caveat: with a *pre-prepared* W state you could do the same with shuffled envelopes and a dealer. The quantum result (Tani–Kobayashi–Matsumoto; D'Hondt–Panangaden) is that anonymous nodes can prepare this symmetry-breaking state among themselves — no dealer — which is classically impossible."
- **Act 2b (GHZ).** "|GHZ⟩ = (|000⟩+|111⟩)/√2: all three read the same random bit. Nobody chose it, so nothing was communicated; everybody agrees on it, so consensus on a coin is free."
- **Act 2c (CHSH).** "Two load balancers get a local input (burst / no burst) and must answer now. Rule: same backend unless both see a burst. Any pre-agreed table (16 of them, or any mixture) wins at most 75 %. Sharing |Φ+⟩ and measuring at 0°/45° and ±22.5° wins cos²(π/8) ≈ 85.4 % (Tsirelson bound). No table can produce these statistics — that is Bell's theorem."
- **Act 3.** "With visibility V (white noise), P_win = ½ + V√2/4; quantum stops helping at V = 1/√2 ≈ 0.707. For leader election P(exactly one leader) = V + 3(1−V)/8; the failures are split-brain (two leaders) and no leader. Engineering requirements: entanglement must be stored for at least the decision window (quantum memory ≥ tens of ms), and distribution rate must match decision rate."

---

## 6. Plan de corte (si el tiempo se acaba)

Orden en que se recorta, de último a primero:
1. P2 (mapa animado, panel Mermin).
2. Acto 3 slider → reemplazar por un párrafo con las dos fórmulas y el umbral 0,707.
3. Acto 2b (GHZ) → un párrafo con `consensus.agreement`.
4. Interactividad del Acto 1 (reto) → solo el selector y el histograma.

**Nunca se recorta:** Acto 1 histograma + Acto 2a W + Acto 2c CHSH con la pared del 75 % + página + video + frase de Qollab + declaración de IA + MIT.

---

## 7. Referencias (verificadas 10 oct 2026)

- Fitzi, Gisin, Maurer. *Quantum Solution to the Byzantine Agreement Problem.* PRL 87, 217901 (2001).
- Ben-Or, Hassidim. *Fast Quantum Byzantine Agreement.* STOC 2005.
- Gaertner, Bourennane, Kurtsiefer, Cabello, Weinfurter. *Experimental demonstration of a quantum protocol for Byzantine agreement and liar detection.* PRL 100, 070504 (2008).
- Tani, Kobayashi, Matsumoto. *Exact Quantum Algorithms for the Leader Election Problem.* arXiv:0712.4213 (ACM TOCT 2012).
- D'Hondt, Panangaden. *The Computational Power of the W and GHZ states.* QIC 6(2), 173–183 (2006).
- Brassard, Broadbent, Tapp. *Quantum Pseudo-Telepathy.* arXiv:quant-ph/0407221; *Recasting Mermin's multi-player game…* QIC 5(7) (2005).
- Kómár, Kessler, Bishof, Jiang, Sørensen, Ye, Lukin. *A quantum network of clocks.* Nature Physics 10, 582 (2014).
- Jozsa, Abrams, Dowling, Williams. *Quantum Clock Synchronization Based on Shared Prior Entanglement.* PRL 85, 2010 (2000). Crítica: Burt, Ekstrom, Swanson, arXiv:quant-ph/0007030.
- Chakraborty et al. *Scalable & Noise-Robust Communication Advantage of Multipartite Quantum Entanglement.* arXiv:2409.13223 (2024).

---

## 8. Checklist de envío

- [x] Fase 0 pasada en Built-in, IBM noise y IonQ remote (un solo job).
- [x] Publicado en Qollab con MIT (v0.1).
- [ ] Página: qué/por qué/cómo correr/cómo extender + referencias.
- [ ] "This effort is supported by Qollab & IonQ" en página e `index.html`.
- [ ] Declaración de IA y de material previo.
- [ ] Accesibilidad: teclado, contraste, aria, no solo color.
- [ ] Video 2–3 min público sin login.
- [ ] Repo público MIT (opcional pero recomendado).
- [ ] Tema **Quantum Unlocked** declarado. Nodo verificado.
- [ ] Enviado antes del domingo 18:00 Colombia.