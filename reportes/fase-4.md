# Reporte — Fase 4: página del proyecto y README

**Estado:** ✅ texto redactado y revisado (11 oct 2026). Falta lo que solo puede hacer el equipo: escribir la declaración de IA y de material previo, completar los enlaces y el equipo, y pegar el texto en Qollab.

## Qué se hizo
- `PROJECT_PAGE.md` en inglés, ~1680 palabras (1490 sin referencias). Es para pegar en la página del proyecto en Qollab.
- `README.md` es una copia byte a byte (`cmp` → idénticos).
- Secciones:
  - Título, tagline y tema (Quantum Unlocked · Qollab × IonQ).
  - Enlaces y equipo (huecos).
  - What it does · The problem it explores (juego CHSH, "envelopes" definidos y las tres primitivas) · Why it matters.
  - How to run it (cualquier simulador; IonQ opcional; un solo job; modo `list`/`wide`; qué probar).
  - Results we measured (built-in frente a nuestras corridas F0–F2 en el modelo de ruido de Forte 1).
  - How it works (circuitos, re-muestreo de counts, modelo de visibilidad V).
  - How to replicate or extend.
  - Honest limitations.
  - Background and related work (las referencias de PLAN §7, anotadas).
  - La frase exacta "This effort is supported by Qollab & IonQ.", el hueco de declaración y la licencia MIT.

## Decisiones y por qué
- **Declaración de IA:** la escribe el equipo (decisión de Jhoan). La página lleva el hueco `[AI DISCLOSURE AND PRIOR-MATERIAL STATEMENT — TO BE WRITTEN BY THE TEAM]`, que cubre también el "material previo" que pide el checklist §8.
- **Todo número sale de los reportes o de `data/precomputed.js`.** Las corridas de Forte van etiquetadas como **nuestras, en el modelo de ruido**, no como datos publicados por IonQ. Además se dice que no hay datos de QPU.
- **Afirmaciones calibradas** para no rozar §7:
  - El re-muestreo se presenta como "draws i.i.d. from measured counts, no new information, no extra job".
  - W lleva la advertencia inline de que se necesita un estado pre-compartido, y de que lo difícil es prepararlo sin repartidor.
  - Se aclara que la moneda GHZ también se logra con un repartidor, y que CHSH es lo único estrictamente no clásico.
- **Instalación:** `requirements.txt` solo tiene comentarios, así que la página indica `pip install qiskit qiskit-aer pytest` y que Qollab ya trae Qiskit.

## Verificación
- **Review independiente:** sin violaciones de §7, todos los números trazados a su fuente y referencias idénticas a PLAN §7. Hubo 4 MAJOR (términos sin definir, re-muestreo exagerado, W sin advertencia inline, faltaban "Why it matters", tema y enlaces) y 15 MINOR, todos aplicados.
- `grep`: la frase obligatoria está en la línea 108, el hueco de declaración en la 112 y MIT en la 116.
- El revisor replicó en una copia: `node --test tests/ui/*.test.mjs` 127/127 y `local_run.py 1000` OK.

## Riesgos / pendientes para el equipo
1. **Escribir la declaración de IA y de material previo.** Es obligatoria: sin ella el envío queda descalificado.
2. **Completar los huecos** `[LINK: Qollab project]`, `[LINK: video]`, `[LINK: GitHub repo]` y `[TEAM]`.
3. ✅ Resuelto: "roughly one election in 37 to 40" en página, README, UI y HANDOFF.
4. ✅ Confirmado por Jhoan: Forte 1 = remote simulator con modelo de ruido (fila "Remote simulator", consola "Circuit execution time"). La página es correcta.
5. ✅ Resuelto: son 18/18. Los 2 tests extra de detección de modo (v0.3) nunca entraron al repo. Se corrigieron el PLAN, el HANDOFF y `reportes/fase-0.md`. No se toca `tests/`.
6. Si se publica el repo en GitHub, el README ya está listo; falta hacerlo público y poner el enlace.

## Archivos a subir a Qollab
Ninguno de código. Hay que **pegar el contenido de `PROJECT_PAGE.md` en la página del proyecto**, después de completar los huecos.

## Siguiente fase
Fase 5: video de 2–3 min grabado en built-in y envío antes del domingo 18:00 Colombia. Antes, probar en Qollab la v0.3 (Fase 3).
