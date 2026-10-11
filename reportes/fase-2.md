# Reporte — Fase 2: interactividad

**Estado:** ✅ implementada y revisada (10 oct 2026). ☐ Falta la prueba en Qollab (subida **v0.2**, junto con la Fase 1).

## Qué se hizo
La spec base es la de `HANDOFF_CLAUDE_CODE.md` §5. Encima van los ajustes de Jhoan tras el reporte de la Fase 1:

0. **Defectos visuales de la Fase 1:**
   - Nodos W: muestran solo "31.4 %", con la leyenda "leader share" una sola vez.
   - CHSH: las marcas van encima de la barra (con halo) y la barra de error es un segmento fino.
   - Texto: el cuerpo va en fuente proporcional; la monoespaciada queda solo para fórmulas, ρ_B, bits y debug.
1. **Send a bit** (`ui/sendbit.js`):
   - Mensaje de hasta 32 bits, con "Random message", "Send message" y "Reset tally". El acumulado persiste entre mensajes.
   - El decodificador está explícito ("Bob guesses 0 when he reads 0"), con un toggle para el inverso. Los dos dan ~50 %.
   - **Bob solo recibe `bit(key, 1)`**: `sendBit()` nunca devuelve el bit de Alice.
2. **Carrera CHSH** (`ui/chsh.js`):
   - Dos barras, "Envelopes (best table)" y "Entangled pair", con el **mismo (x, y) uniforme en cada ronda**. Muestran aciertos/rondas y %.
   - Tabla de las 16 estrategias con radios (en un `<details>`). La elegida alimenta la barra clásica.
   - Botones Play 100, Play 1000, Skip y Reset.
3. **W y GHZ** (`ui/leader.js`, `ui/consensus.js`):
   - W: "Elect again" (más "Elect 100 times"), con el acumulado por nodo ("A led 36 of 101 elections") y "Elections: N · Exactly one leader: M".
   - GHZ: "Flip the shared coin".
   - Con datos ruidosos la página lo muestra honestamente: "Split-brain: A and C both lead", "No leader", "No consensus".
4. **Animación** (`ui/anim.js`): ~15 ms por ronda con `requestAnimationFrame`, más Skip. Es instantánea con `prefers-reduced-motion: reduce`. Los controles quedan deshabilitados mientras corre una tanda; el foco va a Skip y luego vuelve al botón que la lanzó.
5. **aria-live:** solo anuncia al terminar la tanda ("100 rounds played: entangled pair won 83, envelopes won 76."). Los contadores intermedios van sin `aria-live`.
6. **Estado:** un objeto por acto/panel, que se resetea cuando cambia `source` (precomputed → live). El render sigue siendo idempotente. La estrategia elegida, el foco y el `<details>` abierto sobreviven al render live.

Módulos nuevos en `ui/`:
- `games.js`: lógica pura con rng inyectable (sendBit, decode, chshRound, classicalAnswer, electRound, coinRound…).
- `anim.js`: bucle de animación con skip, cancel y error.
- `dom.js`: lock/unlock de controles, estado por fuente, snapshot de foco/`<details>`.
- `leader.js`, `consensus.js`, `chsh.js`, `sendbit.js`: un archivo por panel.

## Decisiones y por qué
- **Física fijada por tests deterministas:**
  - Las victorias exactas calculadas desde `chsh.raw` con la regla `(a XOR b) == (x AND y)`, con `a = bit(k,0)` y `b = bit(k,1)`, reproducen `per_pair` y `overall` con tolerancia 1e-9.
  - Las 16 estrategias reproducen su `win_rate` y la máxima es 0.75.
  - Esto coincide con `quantum/chsh.py`.
- **Test anti-fuga que sí muerde:** con un Z anticorrelacionado `{'01': 1000}` y un mensaje de solo ceros, el decodificador honesto da 100 % y el inverso 0 %. Uno que leyera el bit de Alice daría lo contrario.
- **Tests estadísticos con PRNG con semilla** (mulberry32), así que son deterministas:
  - Send a bit con 10 000 bits: 0.50 ± 0.03 con los dos decodificadores.
  - CHSH con 10 000 rondas: la cuántica dentro de 0.02 de `overall`, "always 0" dentro de 0.02 de 0.75, y ninguna estrategia por encima de 0.77.
- **Desviaciones aceptadas respecto a la spec:**
  - El campo acepta de 1 a 32 bits, no exactamente 32. Se limpia al teclear o pegar: solo admite 0/1.
  - Cambiar de decodificador o de estrategia reinicia el acumulado, para no mezclar resultados.
  - Play 1000 dura como máximo ~4 s (varias rondas por frame). Play 100 sí va a 15 ms por ronda.
  - "Elect 100 times" solo mueve contadores (sin parpadeo); el nodo encendido es el de la última elección.
  - Las barras de la carrera van apiladas, no lado a lado: lado a lado el texto SVG bajaba a ~8 px. El salto a una columna pasó de 700 px a 820 px.

## Verificación
- `node --test tests/ui/*.test.mjs` → `# tests 89 · # pass 89 · # fail 0`.
- `node --check` limpio en todos los JS. `index.html` no tiene `style=`, `<style`, `<script` ni etiquetas de documento, y `ui/` no usa `localStorage` ni `fetch`. `main.js` sigue con un solo `backend.run`.
- **Orden de Tab** (18 paradas con los `<details>` cerrados):
  1. Alice does nothing
  2. Alice measures Z
  3. Alice measures X
  4. Message input
  5. Random message
  6. Send message
  7. Reset tally
  8. Inverse decoder
  9. Elect again
  10. Elect 100 times
  11. Reset elections
  12. Flip the shared coin
  13. Reset flips
  14. Play 100
  15. Play 1000
  16. Reset race
  17. Summary "Choose the envelope table…"
  18. Summary "Raw metrics (debug)"

  Con los `<details>` abiertos se suman el grupo de radios y el `<pre>`, 20 paradas en total. Skip deshabilitado no es parada. No hay trampas de foco.
- **Chrome headless** en `/dev/` a 900, 700 y 375 px: sin scroll horizontal y sin errores en consola.
  - Se reprodujo el caso del render live a mitad de tanda (`dev/?delay=…`) con Send, Elect 100 y Play 1000. Los controles vuelven, Skip queda deshabilitado y el foco vuelve al botón.
- **Review independiente:** 1 MAJOR y 8 MINOR, todos aplicados.
  - MAJOR: si el render live llegaba a mitad de una tanda, cancelaba la animación sin desbloquear y el Acto 1 quedaba deshabilitado para siempre. Arreglo: `animate()` acepta `onCancel`/`onError`, y el unlock cuelga de `cancel()`. Lo cubre `tests/ui/lock.test.mjs`.
  - MINOR:
    - `sample()` devuelve `null` con datos vacíos, sin lanzar excepción.
    - El foco y el `<details>` se conservan en el Acto 2.
    - "ideally the same b".
    - El campo de bits se limpia en `beforeinput`.
    - Los tests tautológicos se reemplazaron.
    - El stub de DOM falla ante selectores desconocidos.
- `quantum/`, `data/` y `tests/test_quantum.py` no se tocaron.

## Riesgos / pendientes
- A 375 px el texto de ejes y notas de los SVG queda en ~7 px. Los jueces usan escritorio; se arregla si sobra tiempo.
- Los tests de DOM usan stubs. El comportamiento real solo se ejerció en Chrome local, no en Qollab/Pyodide.
- **Resultado en Qollab:** _pendiente._

## Archivos a subir a Qollab (v0.2 = Fases 1 + 2)
Relativo a la versión publicada v0.1:

| Archivo | Carpeta destino | Cambio |
|---|---|---|
| `index.html` | raíz | modificado (Fase 1) |
| `main.js` | raíz | modificado |
| `main.css` | raíz | modificado |
| `ui/act1.js`, `ui/act2.js`, `ui/charts.js`, `ui/sample.js` | `ui/` | nuevos (Fase 1, cambiados en Fase 2) |
| `ui/games.js`, `ui/anim.js`, `ui/dom.js`, `ui/leader.js`, `ui/consensus.js`, `ui/chsh.js`, `ui/sendbit.js` | `ui/` | nuevos (Fase 2) |

**No subir:** `dev/`, `tests/`, `reportes/`, `*.md`, `.gitignore`. `quantum/` y `data/` no cambian.

## Siguiente fase
Fase 3 — Acto 3: slider de visibilidad V, curvas `noise.*` y el punto "measured on this backend" en `inferred_visibility`.
