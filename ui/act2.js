// Act 2: what entanglement can do. Composes the three panels; state lives per element
// and is reset when `source` changes (precomputed -> live).
import * as leader from './leader.js';
import * as consensus from './consensus.js';
import * as chsh from './chsh.js';
import { currentState, snapshotUi, stateFor } from './dom.js';

const MODS = { leader, consensus, chsh };

// Pure: initial HTML of each panel.
export function panels(data) {
  const out = {};
  for (const [k, m] of Object.entries(MODS)) out[k] = m.html(data);
  return out;
}

export function render(els, data, { source } = {}) {
  for (const [k, m] of Object.entries(MODS)) {
    const el = els[k];
    const prev = currentState(el);
    const st = stateFor(el, source, () => m.newState(data));
    if (k === 'chsh' && prev) st.strategy = prev.strategy;   // the picked table is a preference, not a counter
    st.anim?.cancel();                    // the panel is rebuilt below: stop any batch in flight
    st.data = data;
    const restore = snapshotUi(el);       // keep focus and open <details> across the rebuild
    el.innerHTML = m.html(data, st);
    m.wire(el);
    restore();
  }
}
