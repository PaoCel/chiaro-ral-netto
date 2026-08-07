"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calculateSalary,
  DEFAULT_INPUT,
  formatCurrency,
  type SalaryInput,
} from "./tax-2026";

const quickRal = [25000, 35000, 50000];

function pct(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export default function Home() {
  const [draft, setDraft] = useState<SalaryInput>(DEFAULT_INPUT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const calculated = draft;
  const result = useMemo(() => calculateSalary(calculated), [calculated]);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  async function copySummary() {
    const summary = `RAL ${formatCurrency(calculated.grossAnnual)} · Netto annuo ${formatCurrency(result.netAnnual)} · Netto medio mensile ${formatCurrency(result.netMonthly)} · Trattenute ${formatCurrency(result.totalWithholdings)}`;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const netShare = calculated.grossAnnual > 0 ? (result.netAnnual / calculated.grossAnnual) * 100 : 0;
  const allocationBase = result.netAnnual + result.employeeContributions + result.totalTaxes;
  const netAllocation = allocationBase > 0 ? (result.netAnnual / allocationBase) * 100 : 0;
  const contributionAllocation = allocationBase > 0 ? (result.employeeContributions / allocationBase) * 100 : 0;
  const taxAllocation = allocationBase > 0 ? (result.totalTaxes / allocationBase) * 100 : 0;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Chiaro, torna all'inizio">
          <span className="brand-mark">C</span>
          <span>chiaro</span>
        </a>
        <nav className="nav-links" aria-label="Navigazione principale">
          <a href="#calcolatore">Calcolatore</a>
          <a href="#dettaglio">Dettaglio</a>
          <a href="#metodo">Metodo</a>
        </nav>
        <div className="topbar-actions">
          <span className="year-pill"><span className="live-dot" /> Regole 2026</span>
        </div>
      </header>

      <section className="workspace-intro" id="top">
        <div className="intro-copy">
          <div className="eyebrow"><span>Calcolatore aziende</span></div>
          <h1>Calcolo netto<br /><em>da RAL</em></h1>
          <p>Inserisci la RAL del dipendente per stimare netto annuale, netto mensile e trattenute.</p>
        </div>
      </section>

      <section className="calculator-shell tool-shell" id="calcolatore" aria-label="Calcolatore stipendio netto">
        <section className="input-panel controls-panel">
          <div className="panel-heading tool-panel-heading">
            <div>
              <span className="step">SIMULAZIONE</span>
              <h2>Dati del dipendente</h2>
            </div>
          </div>

          <div className="primary-field">
            <div className="field-label-row">
              <label className="ral-label" htmlFor="ral">RAL del dipendente</label>
            </div>
            <div className="money-input-wrap">
              <span>€</span>
              <input
                id="ral"
                type="number"
                min="15000"
                max="100000"
                step="500"
                value={draft.grossAnnual}
                onChange={(event) => setDraft({ ...draft, grossAnnual: Number(event.target.value) })}
                onBlur={() => setDraft({ ...draft, grossAnnual: Math.min(100000, Math.max(15000, Number(draft.grossAnnual) || 15000)) })}
                aria-describedby="ral-help"
              />
            </div>
            <p className="field-help">Retribuzione annua lorda indicata nella proposta o nel contratto.</p>
          </div>
          <input
            className="ral-slider"
            type="range"
            min="15000"
            max="100000"
            step="500"
            value={draft.grossAnnual}
            onChange={(event) => setDraft({ ...draft, grossAnnual: Number(event.target.value) })}
            aria-label="RAL da 15.000 a 100.000 euro"
          />
          <div className="range-labels" id="ral-help"><span>15.000 €</span><span>100.000 €</span></div>

          <div className="quick-values" aria-label="Valori RAL frequenti">
            <span>Scelte rapide</span>
            {quickRal.map((value) => (
              <button
                type="button"
                key={value}
                className={draft.grossAnnual === value ? "active" : ""}
                onClick={() => setDraft({ ...draft, grossAnnual: value })}
              >
                {value / 1000}k
              </button>
            ))}
          </div>

          <div className="parameter-card">
            <div className="parameter-heading">
              <div><span className="parameter-dot" /> <strong>Parametri utilizzati</strong></div>
              <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Modifica i parametri utilizzati" title="Modifica parametri">✎</button>
            </div>
            <div className="parameter-grid">
              <div><span>Contratto</span><strong>Tempo indeterminato</strong></div>
              <div><span>Residenza fiscale</span><strong>Milano</strong></div>
              <div><span>Mensilità</span><strong>{draft.months}</strong></div>
              <div><span>Giorni lavorati</span><strong>{draft.workDays}</strong></div>
              <div className="parameter-wide" title="Quota previdenziale trattenuta al dipendente e versata all’INPS"><span>Contributi previdenziali a carico del dipendente</span><strong>{pct(draft.employeeContributionRate)} · FPLD</strong></div>
            </div>
          </div>

        </section>

        <section className="result-panel results-workspace" aria-live="polite">
          <div className="result-topline result-header">
            <div>
              <span className="step step-dark">RISULTATO</span>
              <h2>Stima</h2>
            </div>
            <button type="button" className="copy-button" onClick={copySummary}>{copied ? "Copiato ✓" : "Copia riepilogo"}</button>
          </div>

          <div className="scenario-status"><span className="live-dot" /> Regole fiscali 2026</div>

          <div className="result-summary">
            <div>
              <p className="result-label">Netto mensile stimato</p>
              <div className="hero-result">
                <strong>{formatCurrency(result.netMonthly, 0)}</strong>
                <span>/ mese</span>
              </div>
              <p className="result-context">Media su {calculated.months} mensilità</p>
            </div>
            <div className="annual-result">
              <span>Netto annuale</span>
              <strong>{formatCurrency(result.netAnnual)}</strong>
              <small>{pct(netShare)} della RAL</small>
            </div>
          </div>

          <div className="result-grid employer-results">
            <div><span>Netto annuale</span><strong>{formatCurrency(result.netAnnual)}</strong></div>
            <div><span>Tasse</span><strong>{formatCurrency(result.totalTaxes)}</strong></div>
            <div><span>Contributi previdenziali</span><strong>{formatCurrency(result.employeeContributions)}</strong></div>
            <div className="accent-stat"><span>Resta al dipendente</span><strong>{pct(netShare)}</strong></div>
          </div>

          <div className="results-footer">
            <a href="#dettaglio">Vedi tutte le voci ↓</a>
          </div>
        </section>
      </section>

      <section className="breakdown-section" id="dettaglio">
        <div className="section-intro">
          <div>
            <span className="section-kicker">Dettaglio annuale</span>
            <h2>RAL e trattenute</h2>
          </div>
          <p>Ogni importo è calcolato sull’intero anno. Le addizionali dipendono dalla residenza fiscale impostata.</p>
        </div>

        <div className="allocation-card">
          <div className="allocation-bar" aria-label="Ripartizione percentuale della retribuzione e degli eventuali benefici">
            <span className="bar-net" style={{ width: `${netAllocation}%` }} />
            <span className="bar-contributions" style={{ width: `${contributionAllocation}%` }} />
            <span className="bar-taxes" style={{ width: `${taxAllocation}%` }} />
          </div>
          <div className="allocation-legend">
            <div><i className="dot dot-net" /><span>Netto</span><strong>{pct(netAllocation)}</strong></div>
            <div><i className="dot dot-contributions" /><span>Contributi</span><strong>{pct(contributionAllocation)}</strong></div>
            <div><i className="dot dot-taxes" /><span>Tasse</span><strong>{pct(taxAllocation)}</strong></div>
          </div>
        </div>

        <div className="detail-grid">
          <article className="detail-card dark-card">
            <div className="card-title-row"><span>01</span><h3>Previdenza</h3></div>
            <p>Contributi a carico del dipendente</p>
            <strong>{formatCurrency(result.employeeContributions)}</strong>
            <div className="formula-line"><span>Aliquota base</span><b>{pct(calculated.employeeContributionRate)}</b></div>
            {result.additionalContribution > 0 && <div className="formula-line"><span>Extra oltre 56.224 €</span><b>{formatCurrency(result.additionalContribution)}</b></div>}
          </article>

          <article className="detail-card">
            <div className="card-title-row"><span>02</span><h3>IRPEF</h3></div>
            <p>Imposta nazionale netta</p>
            <strong>{formatCurrency(result.netIrpef)}</strong>
            <div className="formula-line"><span>IRPEF lorda</span><b>{formatCurrency(result.grossIrpef)}</b></div>
            <div className="formula-line positive"><span>Detrazioni applicate</span><b>− {formatCurrency(result.employeeDeduction + result.additionalDeduction)}</b></div>
          </article>

          <article className="detail-card">
            <div className="card-title-row"><span>03</span><h3>Territorio</h3></div>
            <p>Addizionali locali</p>
            <strong>{formatCurrency(result.regionalTax + result.municipalTax)}</strong>
            <div className="formula-line"><span>Regione Lombardia</span><b>{formatCurrency(result.regionalTax)}</b></div>
            <div className="formula-line"><span>Comune di Milano</span><b>{formatCurrency(result.municipalTax)}</b></div>
          </article>

          <article className="detail-card benefit-card">
            <div className="card-title-row"><span>04</span><h3>Benefici</h3></div>
            <p>Somme e crediti riconosciuti</p>
            <strong>+ {formatCurrency(result.cashBenefits)}</strong>
            <div className="formula-line"><span>Somma fiscale 2025–26</span><b>{formatCurrency(result.taxCutCashSum)}</b></div>
            <div className="formula-line"><span>Trattamento integrativo</span><b>{formatCurrency(result.treatmentCredit)}</b></div>
          </article>
        </div>
      </section>

      <section className="method-section" id="metodo">
        <div className="method-heading">
          <span className="section-kicker">Note sul calcolo</span>
          <h2>Metodo di calcolo</h2>
          <p>Stima annuale per il caso standard indicato. Non sostituisce un cedolino.</p>
        </div>

        <div className="calculation-flow">
          <div><span>RAL</span><strong>{formatCurrency(calculated.grossAnnual)}</strong></div>
          <i>−</i>
          <div><span>Contributi</span><strong>{formatCurrency(result.employeeContributions)}</strong></div>
          <i>=</i>
          <div className="highlight-flow"><span>Imponibile fiscale</span><strong>{formatCurrency(result.taxableIncome)}</strong></div>
          <i>−</i>
          <div><span>Imposte nette</span><strong>{formatCurrency(result.totalTaxes)}</strong></div>
          <i>+</i>
          <div><span>Benefici</span><strong>{formatCurrency(result.cashBenefits)}</strong></div>
          <i>=</i>
          <div className="final-flow"><span>Netto annuo</span><strong>{formatCurrency(result.netAnnual)}</strong></div>
        </div>

        <div className="method-columns">
          <div>
            <h3>Assunzioni del modello</h3>
            <ul>
              <li>Impiegato privato a tempo indeterminato</li>
              <li>Unico reddito e lavoro per l’intero anno</li>
              <li>Residenza fiscale a Milano</li>
              <li>Nessun familiare a carico o onere detraibile</li>
              <li>RAL supportata da 15.000 € a 100.000 €</li>
            </ul>
          </div>
          <div>
            <h3>Non è incluso</h3>
            <ul>
              <li>Premi, straordinari, welfare e fringe benefit</li>
              <li>TFR, fondi pensione e altri redditi</li>
              <li>Agevolazioni personali o contributive</li>
              <li>Calendario reale di acconti e conguagli</li>
              <li>Differenze tra singoli cedolini mensili</li>
            </ul>
          </div>
        </div>

        <div className="sources-note" aria-label="Sources">
          <span>Sources</span>
          <a href="https://www.lavoro.gov.it/notizie/pagine/legge-di-bilancio-2026-le-principali-misure-lavoratori-imprese-e-famiglie" target="_blank" rel="noreferrer">IRPEF 2026 — Ministero del Lavoro</a>
          <a href="https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html" target="_blank" rel="noreferrer">Contributi — INPS, circolare 6/2026</a>
          <a href="https://www.regione.lombardia.it/bollo-auto-e-tributi-regionali/red-addizionale-regionale-irpef" target="_blank" rel="noreferrer">Addizionale regionale — Regione Lombardia</a>
          <a href="https://www.comune.milano.it/aree-tematiche/tributi/addizionale-comunale-irpef" target="_blank" rel="noreferrer">Addizionale comunale — Comune di Milano</a>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark">C</span><span>chiaro</span></div>
        <p>Prototipo informativo · Regole fiscali aggiornate ad agosto 2026</p>
        <a href="#top">Torna su ↑</a>
      </footer>

      {settingsOpen && (
        <div className="drawer-layer" role="presentation">
          <button className="drawer-backdrop" aria-label="Chiudi impostazioni" onClick={() => setSettingsOpen(false)} />
          <aside className="settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="drawer-header">
              <div><span className="section-kicker">Parametri</span><h2 id="settings-title">Modifica</h2></div>
              <button type="button" className="drawer-close" onClick={() => setSettingsOpen(false)} aria-label="Chiudi">×</button>
            </div>
            <p className="drawer-copy">I risultati si aggiornano automaticamente.</p>

            <div className="setting-group">
              <label htmlFor="months">Mensilità</label>
              <div className="segmented">
                {[12, 13, 14].map((months) => <button type="button" key={months} className={draft.months === months ? "active" : ""} onClick={() => setDraft({ ...draft, months })}>{months}</button>)}
              </div>
              <small>Il netto mensile è una media del netto annuale.</small>
            </div>

            <div className="setting-group two-inputs">
              <label htmlFor="days">Giorni lavorati</label>
              <input id="days" type="number" min="1" max="365" value={draft.workDays} onChange={(e) => setDraft({ ...draft, workDays: Math.min(365, Math.max(1, Number(e.target.value))) })} />
              <small>Incidono sulle detrazioni da lavoro dipendente.</small>
            </div>

            <div className="setting-group locked-setting contribution-setting">
              <span>Contributi previdenziali a carico del dipendente</span>
              <strong>{pct(DEFAULT_INPUT.employeeContributionRate)} <i>Fisso</i></strong>
              <small>Aliquota standard FPLD. L’1% aggiuntivo oltre 56.224 € è applicato automaticamente.</small>
            </div>

            <div className="setting-group locked-setting">
              <span>Residenza fiscale</span>
              <strong>Milano, Lombardia <i>Fisso</i></strong>
            </div>

            <div className="setting-group locked-setting contribution-setting">
              <span>Addizionale comunale</span>
              <strong>{pct(DEFAULT_INPUT.municipalRate)} <i>Fisso</i></strong>
              <small>Aliquota di Milano, con esenzione fino a 23.000 €.</small>
            </div>

            <button className="reset-button" type="button" onClick={() => setDraft(DEFAULT_INPUT)}>Ripristina valori predefiniti</button>
          </aside>
        </div>
      )}
    </main>
  );
}
