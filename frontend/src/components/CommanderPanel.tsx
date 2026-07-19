/**
 * CommanderPanel — persona + doctrine + the standing directives.
 * Fully static; the one panel that never depends on telemetry.
 */

import { persona } from "../data/mission";

export function CommanderPanel() {
  return (
    <section className="panel commander-panel" aria-label="Commander">
      <div className="panel-id">
        <span>COMMANDER · IDENT</span>
        <span className="panel-id-right">TT-MC-CMD</span>
      </div>
      <div className="panel-band">
        <span className="panel-title">Commander</span>
        <span className="tag">{persona.org}</span>
      </div>
      <div className="panel-body">
        <div className="commander-callsign">{persona.callsign}</div>

        <div className="commander-constraint">
          <span className="t-micro">constraint</span>
          <p>{persona.constraint}</p>
        </div>

        <div className="commander-doctrine">
          <span className="t-micro">doctrine</span>
          {persona.doctrine.map((d) => (
            <div key={d} className="commander-doctrine-line">
              {d}
            </div>
          ))}
        </div>

        <div className="directive-list">
          <span className="t-micro">standing directives</span>
          {persona.directives.map((d, i) => (
            <div key={d} className="directive">
              <span className="directive-num">{String(i + 1).padStart(2, "0")}</span>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
