# Reporte — Fase 1: layout + Acto 1 + Acto 2 estático

**Estado:** ✅ implementada y revisada (10 oct 2026). ☐ Falta la prueba en Qollab (subida **v0.2**).

## Qué se hizo
- **Acto 1** (`ui/act1.js`): tres botones con `aria-pressed` (Alice does nothing / measures Z / measures X). Muestran el histograma de Bob desde `data.nosignal[choice].bob`, la cajita `ρ_B` desde `nosignal.rho_bob` y la línea fija "≥ 45 ms Bogotá → Frankfurt…". La elección se conserva al pasar de precomputed a live.
- **Acto 2** (`ui/act2.js`): paneles en orden **W → GHZ → CHSH**, con los textos de `HANDOFF_CLAUDE_CODE.md` §6 tal cual.
  - W: nodos A/B/C con su % de liderazgo, más una barra de `exactly_one` y el texto de split-brain / no-leader.
  - GHZ: nodos con el bit compartido, más `agreement`.
  - CHSH: barra `overall ± sigma` con marcas en 75 % (límite clásico) y 85.4 % (Tsirelson), más una tabla `per_pair`.
- **Acto 3**: por ahora solo el párrafo de §6 dentro de `#act3-root`. Fase 3 lo reemplaza con el slider.
- **Gráficas** (`ui/charts.js`): funciones puras que devuelven strings SVG (`hbar`, `histogram2`, `nodes`, `pct`, `pctMin`). Cada SVG lleva `role="img"`, `aria-label` y `<title>`, y todo el texto interpolado pasa por `esc()`.
- **`ui/sample.js`**: `sample(raw)` y `bit(key, qubit)`. Todavía sin usar; la base para las rondas de Fase 2.
- **`main.js`**: `render()` llama a `act1.render` y `act2.render` y pone el badge `#source-badge` ("precomputed results" / "live · list mode"). La lógica del job no cambió: sigue habiendo un solo `backend.run`.
- **`index.html`**: badge en el header y debug JSON plegado en `<details>` (el `<pre>` tiene `tabindex="0"`).
- **`main.css`**: diseño real con fondo propio, dos columnas desde 700 px y una sola por debajo. El botón activo lleva borde grueso y ✓ (el ✓ no entra en el nombre accesible). El estado de los nodos se distingue por relleno/contorno y texto, no solo por color.
- **`dev/`**: harness local que **no se sube**. Un import map redirige `quantum.runner` a `dev/shim/runner.js`, y `window.backend` es falso. Acepta `?mode=wide`.

## Decisiones y por qué
- **SVG como string puro.** Se puede testear con `node --test` sin DOM ni dependencias, y no hace falta ninguna librería.
- **Render idempotente.** `act1` construye su DOM una sola vez por root (WeakMap) y solo reescribe un slot cuando su contenido cambió. Así no se duplican listeners y los lectores de pantalla no re-anuncian el cambio de precomputed a live.
- **`aria-live` solo en el resumen del Acto 1**, no en el SVG.
- **Marcas sin ".0"** (`pctMin`): se lee "75 %" y "85.4 %".

## Verificación
- `node --test tests/ui/*.test.mjs` → `# tests 24 · # pass 24 · # fail 0`. Ojo: en Node 22 `node --test tests/ui/` falla porque trata la carpeta como archivo; hay que pasar los archivos.
- `node --check` limpio en todos los JS. `index.html` no tiene `style=`, `<style`, `<script` ni etiquetas de documento.
- Chrome headless en `/dev/` a 900 px y 375 px: sin solapes ni scroll horizontal, sin errores en consola. El badge cambia de precomputed a live.
- Review independiente con contexto limpio: sin BLOCKER ni MAJOR. Se aplicaron los 8 MINOR: escalado en móvil, formato de marcas, ✓ en el nombre accesible, alcance de `aria-live`, `<pre>` del debug, comentario del fragmento, CSS muerto y tests de render con un DOM stub y datos ruidosos.
- Contraste medido: todo el texto ≥ 7.5:1, salvo ink/paper 14.6. Los elementos no textuales ≥ 3:1.
- `quantum/`, `data/` y `tests/test_quantum.py` no se tocaron.

## Riesgos / pendientes
- **Imports relativos anidados** (`ui/act1.js` → `./charts.js`): no probados en Qollab. Si fallan, el fallback es que `main.js` importe `./ui/charts.js` y pase los helpers por parámetro, o fusionar archivos.
- A 375 px el texto de los SVG queda pequeño (~7 px en los nodos), porque las gráficas escalan con su viewBox. Los jueces usan escritorio; revisar si sobra tiempo.
- El test de DOM es un stub, no un parser: no valida la estructura HTML real.
- **Resultado en Qollab:** ver sección siguiente.

## Prueba en Qollab (v0.2)

### Built-in simulator — ✅ (10 oct 2026)
- Badge final `live · list mode`. Status: `Live results from basic_simulator (list mode).`
- Consola: solo `Loading... / Loading project files... / Running... / Done.`, **sin errores**. Los **imports relativos anidados** (`ui/act1.js` → `./charts.js`) **funcionan en Qollab**: riesgo cerrado.
- Debug JSON:
  ```json
  { "source": "live (list)", "bob_p1": [0.493, 0.518, 0.511], "chsh": 0.849, "chsh_sigma": 0.00566,
    "leader_exactly_one": 1, "split_brain": 0, "ghz_agreement": 1, "mermin_precomputed": 1,
    "inferred_visibility": { "chsh": 0.987, "w": 1, "ghz": 1 } }
  ```
- Visual (capturas de Jhoan):
  - Acto 1: los tres botones cambian el histograma de Bob (50.7/49.3, 48.2/51.8, 48.9/51.1). Con Z aparece "100.0 % of shots match" tras comparar. ρ_B correcta.
  - Acto 2: los paneles W (31.4/32.8/35.8 %, 100 % exactamente uno), GHZ (52.1/47.9, 100 % de acuerdo) y CHSH (84.9 % ± 0.6, por par 86.9/84.6/84.1/84.0) se ven bien.
  - Acto 3: el párrafo se ve.
- Defectos visuales menores, a corregir en la subida de Fase 2:
  1. W: las etiquetas "leader in 31.4 %" de nodos vecinos casi se tocan ("% leader").
  2. CHSH: la barra de error de 85 % se dibuja encima de las marcas 75/85.4 y se ve como una "H" pegada a la marca de Tsirelson.
  3. Los párrafos largos van en monoespaciada: legibles, pero densos. Evaluar fuente proporcional para el cuerpo.
- Navegación con Tab: _no reportada aún._

### IonQ Forte 1 — ✅ (10 oct 2026)
- `source: live (wide)`. Consola: `Circuit execution time: 4000ms`, sin errores.
- Debug JSON:
  ```json
  { "source": "live (wide)", "bob_p1": [0.522, 0.503, 0.513], "chsh": 0.84625, "chsh_sigma": 0.0057,
    "leader_exactly_one": 0.96, "split_brain": 0.027, "ghz_agreement": 0.977, "mermin_precomputed": 1,
    "inferred_visibility": { "chsh": 0.979, "w": 0.936, "ghz": 0.969 } }
  ```
- Coincide con la referencia de Fase 0: W 0.96 (antes 0.968) y split-brain 0.027 idéntico, es decir, ~1 de cada 37 elecciones da dos líderes. No-leader implícito ≈ 0.013.

### IBM Fez — no se corrió en Fase 1 (el modo `list` ya se validó en Fase 0). Navegación con Tab: se reporta en Fase 2.

## Archivos a subir a Qollab (v0.2)
| Archivo | Carpeta destino en Qollab |
|---|---|
| `index.html` | raíz |
| `main.js` | raíz |
| `main.css` | raíz |
| `ui/sample.js` | `ui/` |
| `ui/charts.js` | `ui/` |
| `ui/act1.js` | `ui/` |
| `ui/act2.js` | `ui/` |

**No subir:** `dev/`, `tests/`, `reportes/`.

## Siguiente fase
Fase 2 — Interactividad: reto "Send a bit" en el Acto 1, "Elect again" en W, "Flip the shared coin" en GHZ y "Play 100 rounds" en CHSH con la tabla de las 16 estrategias. Todo muestrea de `raw` con `ui/sample.js`, y los contadores se reinician al cambiar de fuente.
