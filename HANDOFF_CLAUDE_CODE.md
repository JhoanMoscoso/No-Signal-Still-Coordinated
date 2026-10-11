# HANDOFF para Claude Code — *No Signal, Still Coordinated*

Lee esto completo antes de tocar nada. **Empieza por `reportes/`**: hay un reporte por fase con lo hecho, lo verificado y lo pendiente. El plan detallado con tiempos y decisiones está en `PLAN_NSSC.md`; este archivo es lo que necesitas para ejecutar las Fases 1–5 sin volver a preguntar.

## 0. Contexto en diez líneas

- Hackathon Qollab × IonQ, tema **Quantum Unlocked** (quantum networking). Rúbrica: Novelty · Technical Execution · Impact · Documentation, mismo peso.
- **Deadline duro: domingo 11 oct 2026, 18:00 Colombia (19:00 ET).** Envía el capitán, Jhoan.
- El proyecto corre **en el navegador del usuario, dentro de Qollab**: Python (Qiskit 2.x) sobre Pyodide + JS vanilla. No hay servidor nuestro.
- Idea: desmontar el mito "sincronizar servidores con entrelazamiento" (Acto 1) y mostrar lo que el entrelazamiento **sí** hace en sistemas distribuidos: elección de líder (W), consenso (GHZ) y coordinación sin comunicación (CHSH) (Acto 2), más un reality check con ruido (Acto 3).
- El motor cuántico (`quantum/`) está **terminado y validado** en Qollab built-in y en IonQ Forte 1 remoto. **No tocar `quantum/` salvo bug.**
- Lo que falta es **UI (`ui/`, `main.css`, `index.html`), página del proyecto, video y envío**.
- Este proyecto va **en paralelo** con otro del mismo equipo (*Entangled*). Presupuesto para este: ~9 h de Jhoan.
- Todo lo que ve el usuario va en **inglés**. Comentarios de código en inglés. Este documento y la conversación con Jhoan, en español.
- Entregas: **solo los archivos modificados, sueltos, con su carpeta de destino**. Jhoan los sube a mano a Qollab. Nada de zips.
- Jhoan es el único interlocutor. Pregunta solo lo que cambie el resultado.

## 1. Estado exacto

| Hecho | Estado |
|---|---|
| `quantum/` (9 módulos) | ✅ 20/20 tests (`python -m pytest tests -q`) |
| Contrato JS↔Python con modo automático (`list` local / `wide` IonQ) | ✅ probado en built-in (list) y Forte 1 (wide) |
| `main.js` esqueleto: pinta precomputed, corre el job, vuelca JSON en `<pre id="debug">` | ✅ |
| `index.html` con contenedores de 3 actos, `main.css` placeholder | ✅ (feo a propósito) |
| `data/precomputed.{json,js}` | ✅ regenerable con `python local_run.py` |
| Fase 0 pasos 4–7 (built-in list, IBM Fez list < 1 min, Forte wide, publicado MIT) | ✅ publicado en Qollab como **v0.1**; siguiente subida **v0.2** |
| Fase 1 | ✅ implementada y revisada (24/24 tests UI); ☐ prueba en Qollab v0.2 — ver `reportes/fase-1.md` |
| Fases 2–5 | ☐ |

## 2. Restricciones de Qollab (no negociables)

- `index.html` es un **fragmento**: sin `<html>/<head>/<body>`. Los `<script>` dentro **no se ejecutan**. Todo JS entra por `main.js`.
- **Un único CSS: `main.css`.** Nada de `style=""` inline, nada de `<style>`.
- `main.js` importa JS propio con `./ruta.js` y módulos Python por nombre punteado: `import * as runner from 'quantum.runner'`. Funciones Python se llaman con `.callPromising(...)` y los proxies se desempaquetan con `.toJs({ dict_converter: Object.fromEntries })`.
- `backend` lo inyecta Qollab. **Nunca crearlo ni importarlo.**
- **Un solo `backend.run` por run.** Ya está hecho en `main.js`; no añadir otro salvo el botón Mermin (ver §5), que debe estar deshabilitado cuando `mode === 'wide'`.
- Sin `localStorage`, sin `fetch` POST, sin `input()`. Archivos ≤ 2 MB.
- Librerías JS: `three` por nombre; cualquier otra desde `https://cdn.jsdelivr.net/npm/<pkg>/+esm`. **Decisión: ninguna librería; SVG a mano.**
- Accesibilidad es requisito explícito de las reglas: teclado en todo, `:focus-visible`, `aria-label`/`aria-live`, contraste ≥ 4.5:1, nada comunicado solo por color.
- Los jueces corren en el **built-in simulator** (modo `list`, instantáneo). Que todo funcione perfecto ahí es lo único que importa; IonQ es bonus.

## 3. El contrato: `data`

`main.js` ya produce `data` (live) y ya tiene `precomputed` (misma forma). **La UI solo lee `data`; nunca llama a Qiskit.** Forma:

```
data.nosignal.none.bob.{p0,p1,shots}      Bob cuando Alice no mide
data.nosignal.Z.bob / .X.bob               Bob cuando Alice mide en Z / en X
data.nosignal.Z.p_same_after_compare       ≈1.0: correlación visible solo al comparar
data.nosignal.{none,Z,X}.raw               counts crudos {"ba": n}; key[-1]=Alice, key[-2]=Bob
data.nosignal.rho_bob                      [[0.5,0],[0,0.5]]

data.chsh.overall, .sigma, .shots          tasa de acierto cuántica (~0.85) y error 1σ
data.chsh.per_pair["00"|"01"|"10"|"11"]    por par de preguntas
data.chsh.raw["xy"]                        counts crudos por par {"ba": n}
data.chsh.classical_strategies[16]         [{alice:"0|1|x|¬x", bob:"0|1|y|¬y", win_rate}]
data.chsh.classical_best = 0.75            data.chsh.tsirelson_bound = 0.8536

data.leader.exactly_one, .split_brain, .no_leader, .per_node_leader[3], .raw {"cba": n}
data.consensus.agreement, .p_all_zero, .p_all_one, .disagreement, .raw

data.noise.v[101]                          eje del slider 0..1
data.noise.chsh_win[], .w_exactly_one[], .w_split_brain[], .w_no_leader[], .ghz_agreement[]
data.noise.chsh_threshold = 0.7071         data.noise.classical_bound = 0.75
data.inferred_visibility.{chsh,w,ghz}      dónde cae ESTE backend en el slider (1.0 en ideal)

data.mermin.overall (precomputado en IonQ; live solo con el botón local)
```

**Jugar rondas en la UI sin más jobs:** muestrear de `raw` proporcionalmente a los counts. Es estadísticamente idéntico a un shot nuevo. Helper sugerido en `ui/sample.js`:

```js
export function sample(raw) {            // raw: {"01": 503, "10": 497}
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [key, n] of Object.entries(raw)) { r -= n; if (r < 0) return key; }
}
export const bit = (key, qubit) => Number(key[key.length - 1 - qubit]);   // qubit 0 = Alice/nodo A
```

**Números de referencia** (para tests visuales y para el video):
- Built-in: CHSH 0.858, W 1.0, GHZ 1.0, Bob 0.51/0.51/0.47.
- IonQ Forte 1 (ruido real): CHSH 0.854, **W 0.968 con split-brain 0.027**, GHZ 0.984. "1 de cada 37 elecciones da dos líderes."

## 4. Estructura objetivo

```
index.html          contenedores (ya) → añadir dentro los nodos que cada ui/*.js necesita
main.js             (ya) → en render(): llamar act1.render(data), act2.render(data), act3.render(data)
main.css            diseño real (reemplaza el placeholder)
ui/
  sample.js         sample(), bit()
  charts.js         barra horizontal con marcas, histograma 0/1, nodo-con-luz, curva SVG con punto
  act1.js           Acto 1
  act2.js           Acto 2 (tres paneles: leader, consensus, chsh)
  act3.js           Acto 3 (slider + curvas + texto de requisitos)
quantum/            NO TOCAR
data/               NO TOCAR (regenerar solo con local_run.py)
tests/              NO TOCAR
```

Desarrollo local sin Pyodide: un `dev/index.html` (fuera de lo que se sube) que carga `main.css`, inyecta el fragmento de `index.html`, define `window.backend` falso y reemplaza `quantum.runner` por un módulo que devuelve `precomputed`. Con eso iteras en el navegador local y solo subes a Qollab para validar. No subir `dev/`.

## 5. Fases que te tocan (orden, criterio de hecho)

### Fase 1 — Layout + Acto 1 + Acto 2 estático (~3 h)
- `main.css`: tipografía legible, tres actos claramente separados, badge `body[data-source]` ("precomputed" / "live") visible pero discreto.
- `ui/charts.js`: (a) barra horizontal 0–100 % con marcas verticales etiquetadas (75 %, 85.4 %); (b) histograma de dos barras (0/1) con porcentaje en texto; (c) "nodo" = círculo con etiqueta y estado on/off (texto + forma, no solo color); (d) curva SVG de `noise.*` con un punto marcado.
- `ui/act1.js`: tres botones (`aria-pressed`) "Alice does nothing / measures Z / measures X"; al pulsar, histograma de Bob desde `nosignal[choice].bob`. Cajita con ρ_B = I/2 en texto monoespaciado. Línea fija: "≥ 45 ms Bogotá → Frankfurt over fibre before any correlation becomes visible."
- `ui/act2.js`: tres paneles con barra o nodos desde `leader`, `consensus`, `chsh`. Orden **W → GHZ → CHSH**. Textos del §6.
- **Hecho cuando:** en built-in se ve todo sin `<pre id="debug">` (dejarlo oculto tras un `<details>`), tab recorre todos los controles, nada se solapa en 900 px de ancho.

### Fase 2 — Interactividad (~2 h)
- Acto 1 "Send a bit": input de 8 bits; por cada bit Alice "mide Z" (0) o "X" (1); Bob muestrea de `raw` y decodifica; marcador vivo que converge a ~50 %. Mensaje al final: "Bob's guesses: N/8 — a coin would do the same."
- Acto 2c: botón "Play 100 rounds" (muestreo de `chsh.raw`), contador vivo de aciertos y barra que converge a ~85 %. Tabla plegable con las 16 estrategias de sobres y su tasa (todas ≤ 75 %), resaltando que **ninguna** llega a 4/4.
- Acto 2a: botón "Elect again" que muestrea `leader.raw` y enciende exactamente un nodo. Contador "Elections: N · Exactly one leader: M".
- Acto 2b: botón "Flip the shared coin" que muestrea `consensus.raw` y pone el mismo bit en los tres nodos.
- **Hecho cuando:** los cuatro botones funcionan con precomputed y con live, y los contadores se reinician al cambiar de fuente.

### Fase 3 — Acto 3 (~2 h)
- `<input type="range">` V ∈ [0,1], paso 0.01, con `<label>` y valor en texto.
- Gráfica con `noise.chsh_win` (marca horizontal en 0.75 y vertical en V = 0.707) y segunda gráfica con `noise.w_exactly_one` + `w_split_brain` + `w_no_leader`.
- Punto "measured on this backend" en V = `inferred_visibility.chsh` y `.w`. Si V = 1.0, texto "ideal simulator: no noise". Si < 1, texto con el valor y la frase del split-brain.
- Párrafo de requisitos de ingeniería (§6).
- **Hecho cuando:** mover el slider actualiza números y curvas sin lag; el punto cae donde dice `inferred_visibility`.

### Fase 4 — Documentación y cumplimiento (~2 h, puede ir en paralelo; Samuel puede tomar la página)
- Página del proyecto en Qollab (inglés): qué hace · qué problema explora · cómo correrlo (elegir cualquier simulador local; IonQ opcional) · cómo replicar/extender (n nodos, otros juegos no-locales, `local_run.py`) · referencias (están en `PLAN_NSSC.md` §7).
- Frase exacta, obligatoria: **"This effort is supported by Qollab & IonQ"** (ya en `index.html`; repetir en la página).
- Declaración de IA (obligatoria, descalifica si falta). Borrador en `PLAN_NSSC.md` §4 decisión 10; ajustar a lo que sea cierto.
- README del repo = la página. Repo público MIT.
- Pasada de accesibilidad con teclado y con un checker de contraste.

### Fase 5 — Video y envío (~1.5 h, Jhoan)
- 2–3 min grabados en built-in: 20 s mito → 40 s Acto 1 → 60 s Acto 2 → 30 s Acto 3 → 10 s cierre. YouTube/Loom sin login.
- Enviar en https://qollab.xyz/programs/hackathon/register, tema **Quantum Unlocked**, antes de las 18:00 Colombia.

### P2 solo si todo lo anterior está cerrado
- Botón "Run Mermin-GHZ game (local simulators only)": llama `runMerminLocal()` (ya exportado en `main.js`); **deshabilitado si `mode === 'wide'`**. Pinta `mermin.overall` vs 75 %.
- Mapa Bogotá–Frankfurt SVG estático con animación CSS del mensaje clásico (~45 ms).

### Plan de corte (si el tiempo se acaba), de último a primero
P2 → Fase 3 slider (dejar párrafo con las fórmulas) → Acto 2b GHZ (dejar un número) → reto "Send a bit" (dejar selector + histograma). **Nunca se corta:** Acto 1 histograma, Acto 2a W, Acto 2c CHSH con la pared del 75 %, página, video, frase de Qollab, declaración de IA, MIT.

## 6. Textos (inglés, revisados; copiar tal cual salvo ajuste de longitud)

- **Tagline.** "Entanglement can't let your servers talk. It can let them agree."
- **Act 1.** "Alice and Bob share a Bell pair. Whatever Alice does — nothing, measure in Z, measure in X — Bob's statistics stay 50/50 and his local state is ρ_B = I/2. The correlation is real, but it only becomes *visible* once Alice's results reach Bob over an ordinary channel (≥ 45 ms Bogotá → Frankfurt). Entanglement gives correlation, not communication. This is the no-signalling theorem."
- **Act 2a (W).** "Three identical replicas share |W⟩ = (|100⟩+|010⟩+|001⟩)/√3 and each measures its own qubit. Exactly one reads 1: it is the leader. Fair (1/3 each), one step, no IDs, no messages. Honest caveat: with a *pre-prepared* W state you could get the same from shuffled envelopes and a dealer. The quantum result (Tani–Kobayashi–Matsumoto 2012; D'Hondt–Panangaden 2006) is that anonymous nodes can prepare this symmetry-breaking state among themselves, with no dealer — which no classical algorithm can do exactly."
- **Act 2b (GHZ).** "|GHZ⟩ = (|000⟩+|111⟩)/√2: all three read the same random bit. Nobody chose it, so nothing was communicated. Everybody agrees on it, so consensus on a shared coin is free."
- **Act 2c (CHSH).** "Two load balancers each get a local input (burst / no burst) and must answer now: backend 0 or 1. Rule: pick the same backend — unless both see a burst, then split. Any pre-agreed table (all 16 of them, or any random mixture) wins at most 75 %. Sharing |Φ+⟩ and measuring at 0°/45° (Alice) and ±22.5° (Bob) wins cos²(π/8) ≈ 85.4 %, the Tsirelson bound. No table can produce these statistics. That is Bell's theorem, and it is the only part of this page that no envelope can imitate."
- **Act 3.** "Real hardware is noisy. With visibility V, P_win = ½ + V·√2/4: the quantum strategy stops beating 75 % at V = 1/√2 ≈ 0.707. For leader election P(exactly one leader) = V + 3(1−V)/8; the failures are split-brain (two leaders) and no leader. On IonQ's Forte noise model we measured 96.8 % — one election in 37 produces two leaders. Engineering requirements: entanglement must survive in memory for at least the decision window (tens of ms), and entanglement distribution rate must match decision rate. None of this exists at scale today."
- **Footer.** "This effort is supported by Qollab & IonQ."

## 7. Lo que la página NUNCA afirma

- Que el entrelazamiento transmite información o detecta cambios remotos.
- Que hay ventaja de velocidad o latencia.
- Que la elección de líder con W medido en Z es, por sí sola, imposible clásicamente (lo imposible es prepararlo sin repartidor en red anónima).
- Que esto se puede desplegar hoy.

## 8. Comandos

```bash
pip install qiskit qiskit-aer pytest     # Aer: BasicSimulator tarda 1 min a 20 qubits
python -m pytest tests -q                # 20 tests
python local_run.py 1000                 # regenera data/precomputed.{json,js}
node --test tests/ui/*.test.mjs          # tests de UI (Node 22: pasar los archivos, no la carpeta)
python3 -m http.server 8000              # luego abrir http://localhost:8000/dev/ (harness local)
```

## 9. Cómo entregar a Jhoan

Al final de cada fase: lista exacta de archivos modificados con carpeta de destino, y nada más. Él los sube a Qollab y corre built-in + Forte. Si un cambio toca `quantum/`, decirlo explícitamente y volver a correr los tests.
