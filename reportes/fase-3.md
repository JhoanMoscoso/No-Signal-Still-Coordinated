# Reporte — Fase 3: Acto 3 (reality check con ruido)

**Estado:** ✅ implementada y revisada (11 oct 2026). ☐ Falta la prueba en Qollab (subida **v0.3**).

## Qué se hizo
- **Problema que resuelve:** en el built-in, donde corren los jueces, `inferred_visibility` vale 1.0, así que un único punto "medido" queda pegado al borde y el reality check no se ve. Por eso cada gráfica lleva dos tipos de punto:
  - **"This run"** (o "Precomputed run" si los datos son precomputed): un anillo con punto central en V = `inferred_visibility.*`, con el valor medido en el eje y.
  - **F0, F1 y F2:** rombos huecos fijos con **nuestras tres corridas en el modelo de ruido de IonQ Forte 1** (10 oct 2026, 1000 shots cada una). Están hardcodeados en `ui/noise.js` (`FORTE_RUNS`) y etiquetados como medición nuestra, no como dato de IonQ.
- **`ui/noise.js`** (puro):
  - `interp` es exacta en los 101 nodos de `data.noise.v`, lineal entre ellos y con clamp en los bordes.
  - `readout` interpola `data.noise.*` sin recalcular fórmulas.
  - `formatReadout` produce, por ejemplo: "At V = 0.80 — CHSH: quantum 78.3 %, envelopes 75 % · Leader election: exactly one 87.5 %, split-brain 10.0 %, no leader 2.5 % · Consensus: 85.0 %".
- **`ui/charts.js` → `curvePlot`:** curvas SVG puras.
  - Las series se distinguen por trazo (sólido, guiones, puntos) y por una etiqueta al final de cada curva.
  - Lleva líneas de referencia etiquetadas.
  - Las etiquetas de los puntos se colocan junto a su punto con una búsqueda de colisiones; si se apiñan, usan líneas guía.
  - El marcador del slider muestra el tag "V = 0.80".
  - Los puntos no finitos no se dibujan. Los recortados al borde conservan su valor real en el `<title>`.
- **`ui/act3.js`:**
  - Texto §6 Act 3 con la frase autorizada por Jhoan: "Across three runs on IonQ's Forte 1 noise model we measured 96.0–97.0 % — roughly one election in 30 to 40 produces two leaders."
  - Lista "What hardware would need" (3 ítems) y leyenda.
  - Slider V ∈ [0, 1], paso 0.01, con `<label>` y `aria-valuetext`.
  - Gráfica CHSH: 0.75 "envelopes", 0.707 "quantum stops helping".
  - Gráfica de líder: exactly one / split-brain / no leader.
- **El slider solo mueve** los marcadores (`setAttribute`) y la línea de lectura. La lectura visual se actualiza al instante; la de `aria-live` con debounce de 300 ms.
- **Render idempotente:** el valor y el foco del slider sobreviven al render live. El Acto 3 nunca lanza excepción: tiene guards para datos faltantes, NaN o > 1, más un try/catch.
- **`index.html`:** el párrafo del Acto 3 queda como fallback sin JS (ya con la frase nueva). `act3.js` lo reemplaza.
- **`HANDOFF_CLAUDE_CODE.md` §6:** se actualizó la frase.

## Decisiones y por qué
- **Tres puntos de Forte, no uno** (decisión de Jhoan). La dispersión entre corridas es parte del reality check, y el texto queda verdadero.

| Run | CHSH | V_chsh | W exactly one | split | no-leader | V_w | GHZ | V_ghz |
|---|---|---|---|---|---|---|---|---|
| F0 | 0.854 | 1.00 (recortado) | 0.968 | 0.027 | 0.005 | 0.949 | 0.984 | 0.979 |
| F1 | 0.846 | 0.979 | 0.960 | 0.027 | 0.013 | 0.936 | 0.977 | 0.969 |
| F2 | 0.8365 | 0.952 | 0.970 | 0.025 | 0.005 | 0.952 | 0.970 | 0.960 |

  F0 cae en V = 1.0 en CHSH a propósito: el ruido de Forte no se distingue en CHSH con 1000 shots.
- **Nota "ideal":** exige V_w y V_ghz ≥ 0.995 **y** que `tsirelson − chsh.overall ≤ 3σ`. La V de CHSH sola no sirve, porque en un simulador ideal baja a ~0.97 por puro ruido de muestreo. El texto dice "consistent with an ideal simulator (no noise detectable at 1000 shots)".
- **Honestidad en la leyenda:** "Points use the visibility inferred from each metric, so they sit on its curve by construction; what varies between runs is how far left they fall."
- **Gráficas apiladas, no lado a lado:** lado a lado el texto bajaba a ~9 px a 900 px; apiladas queda en ≥ 14 px. El eje y de CHSH va de 45 % a 90 % para separar los puntos.

## Verificación
- `node --test tests/ui/*.test.mjs` → `# tests 127 · # pass 127 · # fail 0`. Cubren:
  - Interpolación exacta.
  - Lectura en V = 1 (85.4/100/0/0/100), en V = 0 (50/37.5/50/12.5/25) y la cadena exacta en V = 0.80.
  - `chsh_win(0.7071)` ≈ 0.75.
  - Coherencia de `FORTE_RUNS` con las fórmulas, más los valores fijados.
  - Píxeles de los puntos y distancia de cada etiqueta a su punto.
  - Nota "ideal" (incluye el caso de CHSH ruidoso con W/GHZ ideales).
  - Datos faltantes o NaN.
  - Debounce con timer falso y persistencia del slider.
- `node --check` limpio. `index.html` sin `style=`, `<style`, `<script` ni etiquetas de documento. `ui/` sin `localStorage` ni `fetch`.
- Chrome headless en `/dev/`, `/dev/?mode=wide` (datos tipo Forte) y solo precomputed, a 900 px y 375 px:
  - Sin errores en consola.
  - Con datos tipo F1, el anillo de "This run" cae sobre F1 sin taparlo, y cada rombo tiene su línea guía.
  - Las flechas mueven el slider sin redibujar las curvas.
- **Review independiente:** 3 MAJOR y 6 MINOR, todos aplicados.
  - MAJOR:
    - La nota "ideal" podía mentir con CHSH degradado.
    - El anillo tapaba F1 y las etiquetas F0–F2 quedaban lejos de sus rombos.
    - El marcador del slider no tenía etiqueta ni entrada en la leyenda.
  - Física confirmada por el revisor: las tres corridas cuadran con las fórmulas y suman 1.000, y no hay afirmaciones prohibidas (§7).
- No se tocaron `quantum/`, `data/` ni `tests/test_quantum.py`.

## Riesgos / pendientes
- **Para Jhoan:** "roughly one election in 30 to 40" es su redacción. Los datos dan 1/0.027 ≈ 37 y 1/0.025 = 40; el extremo "30" no sale de ninguna corrida. Alternativa más exacta: "roughly one election in 37 to 40".
- En `?mode=wide` el anillo y los tres rombos quedan a pocos píxeles. Se distinguen gracias a las líneas guía, pero es una zona densa porque los datos son así de cercanos.
- A 375 px el texto SVG queda en ~7.4–8.7 px, igual que en el resto de gráficas.
- En el plot la etiqueta dice "Precomputed run"; el texto completo "(BasicSimulator)" está en el tooltip, la nota y la leyenda.
- **Resultado en Qollab:** _pendiente._

## Archivos a subir a Qollab (v0.3)
Relativo a lo que hay en Qollab (v0.2):

| Archivo | Carpeta destino | Por qué |
|---|---|---|
| `index.html` | raíz | fallback del Acto 3 |
| `main.js` | raíz | llama a `act3.render` |
| `main.css` | raíz | Acto 3 y arreglo de fuente (Fase 2) |
| `data/precomputed.js` | `data/` | sincronizar con el repo (pendiente de Fase 2) |
| `ui/charts.js` | `ui/` | `curvePlot` |
| `ui/act3.js` | `ui/` | nuevo |
| `ui/noise.js` | `ui/` | nuevo |

**No subir:** `dev/`, `tests/`, `reportes/`, `*.md`.

## Siguiente fase
Fase 4: `PROJECT_PAGE.md` y `README.md` (mismo texto), redactados en esta misma sesión.
