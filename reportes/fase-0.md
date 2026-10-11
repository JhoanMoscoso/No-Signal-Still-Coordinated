# Reporte — Fase 0: validar el contrato en Qollab

**Estado:** ✅ cerrada (10 oct 2026).

## Qué se hizo
- Motor cuántico (`quantum/`) terminado: 18/18 tests con Aer (los 2 tests de detección de modo de v0.3 se escribieron fuera del repo y nunca entraron; los docs viejos decían 20) (`python -m pytest tests -q`).
- Contrato JS ↔ Python con **modo automático** (`runner.run_mode(backend)`):
  - `wide` en IonQ: los 9 experimentos en **un circuito de 20 qubits** (IonQ rechaza jobs multi-circuito con `Only job type ionq.circuit.v1 is supported`).
  - `list` en simuladores locales: 9 circuitos pequeños en una sola llamada `backend.run` (el circuito ancho congela el navegador, WASM de un hilo).
- `main.js` pinta `data/precomputed.js` al instante y luego reemplaza con resultados live.
- Publicado en Qollab con licencia MIT.

## Decisiones y por qué
- **Un solo `backend.run` por run.** Límite de IonQ; en locales también basta.
- **`SHOTS = 1000`.** IBM Fez con ruido tarda menos de un minuto; no hace falta bajar a 500.
- **Versionado Qollab:** las etiquetas v0.1/v0.2/v0.3 de `PLAN_NSSC.md` eran internas del desarrollo. En Qollab la versión publicada se llama **v0.1** e incluye el modo automático. La próxima publicación será **v0.2** (Fase 1).

## Verificación (hecha por Jhoan en Qollab)
| Backend | `source` | Resultado |
|---|---|---|
| Built-in simulator | `live (list)` | Instantáneo. CHSH ≈ 0.858, W 1.0, GHZ 1.0. |
| IBM Fez (modelo de ruido) | `live (list)` | Números degradados, `inferred_visibility` < 1, < 1 min @ 1000 shots. |
| IonQ Forte 1 (remoto) | `live (wide)` | CHSH 0.854 ± 0.006, W 0.968 (split-brain 0.027), GHZ 0.984, ~4 s. |

## Riesgos / pendientes
- Ninguno en el motor. `quantum/`, `data/`, `tests/` no se tocan salvo bug.
- Mermin-GHZ (32 qubits) no cabe en el circuito ancho: segundo job solo en locales (P2).

## Archivos a subir a Qollab
Ninguno nuevo; v0.1 ya publicada.

## Siguiente fase
Fase 1 — Layout + Acto 1 + Acto 2 estático (`ui/`, `main.css`, `index.html`, `main.js`). Ver `reportes/fase-1.md` cuando exista.
