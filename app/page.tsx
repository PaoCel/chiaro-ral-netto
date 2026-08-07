"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
  const [calculated, setCalculated] = useState<SalaryInput>(DEFAULT_INPUT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => calculateSalary(calculated), [calculated]);
  const nextResult = useMemo(
    () => calculateSalary({ ...calculated, grossAnnual: calculated.grossAnnual + 1000 }),
    [calculated],
  );

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    setCalculated({
      ...draft,
      grossAnnual: Math.min(100000, Math.max(15000, Number(draft.grossAnnual) || 15000)),
    });
  }

  async function copySummary() {
    const summary = `RAL ${formatCurrency(calculated.grossAnnual)} · Netto annuo ${formatCurrency(result.netAnnual)} · Netto medio mensile ${formatCurrency(result.netMonthly)} · Trattenute ${formatCurrency(result.totalWithholdings)}`;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const netShare = (result.netAnnual / calculated.grossAnnual) * 100;
  const contributionShare = (result.employeeContributions / calculated.grossAnnual) * 100;
  const taxShare = (result.totalTaxes / calculated.grossAnnual) * 100;
  const allocationBase = result.netAnnual + result.employeeContributions + result.totalTaxes;
  const netAllocation = (result.netAnnual / allocationBase) * 100;
  const contributionAllocation = (result.employeeContributions / allocationBase) * 100;
  const taxAllocation = (result.totalTaxes / allocationBase) * 100;

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
          <a href="#metodo">Metodo e fonti</a>
        </nav>
        <div className="topbar-actions">
          <span className="year-pill"><span className="live-dot" /> Regole 2026</span>
          <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Apri impostazioni avanzate">
            <span aria-hidden="true">☰</span>
            <span className="desktop-only">Personalizza</span>
          </button>
        </div>
      </header>

      <section className="workspace-intro" id="top">
        <div className="intro-copy">
          <div className="eyebrow"><span>Calcolatore 2026</span><i /> Caso standard · Milano</div>
          <h1>Calcola il tuo<br />stipendio netto</h1>
          <p>Inserisci la RAL indicata nel contratto. Otterrai una stima del netto annuale e mensile, con il dettaglio completo delle trattenute.</p>
        </div>
        <div className="how-card" aria-label="Come usare il calcolatore">
          <span className="section-kicker">Come funziona</span>
          <ol>
            <li><b>1</b><span><strong>Inserisci la RAL</strong><small>La retribuzione lorda annuale</small></span></li>
            <li><b>2</b><span><strong>Controlla lo scenario</strong><small>Mensilità, residenza e aliquote</small></span></li>
            <li><b>3</b><span><strong>Leggi il risultato</strong><small>Netto, tasse e contributi</small></span></li>
          </ol>
        </div>
      </section>

      <section className="calculator-shell tool-shell" id="calcolatore" aria-label="Calcolatore stipendio netto">
        <form className="input-panel controls-panel" onSubmit={submit}>
          <div className="panel-heading tool-panel-heading">
            <div>
              <span className="step">I TUOI DATI</span>
              <h2>Imposta lo scenario</h2>
            </div>
            <button type="button" className="text-button" onClick={() => setSettingsOpen(true)}>Tutte le opzioni <span>↗</span></button>
          </div>

          <div className="primary-field">
            <div className="field-label-row">
              <label className="ral-label" htmlFor="ral">RAL — Retribuzione annua lorda</label>
              <span className="info-tip" title="La retribuzione lorda annuale indicata nel contratto, esclusi TFR e bonus.">?</span>
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
                aria-describedby="ral-help"
              />
            </div>
            <p className="field-help">Inserisci l’importo lordo annuo riportato nella proposta o nel contratto.</p>
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

          <div className="visible-settings">
            <div className="visible-setting">
              <span>Mensilità</span>
              <div className="mini-segmented">
                {[12, 13, 14].map((months) => <button type="button" key={months} className={draft.months === months ? "active" : ""} onClick={() => setDraft({ ...draft, months })}>{months}</button>)}
              </div>
            </div>
            <div className="visible-setting">
              <span>Residenza fiscale</span>
              <strong>Milano <small>Predefinita</small></strong>
            </div>
            <div className="visible-setting">
              <span>Contratto</span>
              <strong>Indeterminato <small>Privato</small></strong>
            </div>
          </div>

          <div className="assumption-line tool-assumption">
            <span className="assumption-icon">i</span>
            <p>Il calcolo assume <strong>365 giorni lavorati</strong>, un solo reddito e nessuna agevolazione. Puoi modificare i parametri nelle opzioni avanzate.</p>
          </div>

          <button className="calculate-button" type="submit">
            Calcola lo stipendio netto <span aria-hidden="true">→</span>
          </button>
        </form>

        <section className="result-panel results-workspace" aria-live="polite">
          <div className="result-topline result-header">
            <div>
              <span className="step step-dark">RISULTATO</span>
              <h2>La tua simulazione</h2>
            </div>
            <button type="button" className="copy-button" onClick={copySummary}>{copied ? "Copiato ✓" : "Copia riepilogo"}</button>
          </div>

          <div className="scenario-status"><span className="live-dot" /> Calcolo aggiornato · Regole fiscali 2026</div>

          <div className="result-summary">
            <div>
              <p className="result-label">Netto medio mensile</p>
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

          <div className="withholding-table" aria-label="Riepilogo del calcolo annuale">
            <div className="table-heading"><span>Passaggio</span><span>Importo annuale</span></div>
            <div><span><i className="calc-sign gross-sign">+</i> Retribuzione lorda</span><strong>{formatCurrency(calculated.grossAnnual)}</strong></div>
            <div><span><i className="calc-sign">−</i> Contributi previdenziali</span><strong>− {formatCurrency(result.employeeContributions)}</strong></div>
            <div><span><i className="calc-sign">−</i> Tasse complessive</span><strong>− {formatCurrency(result.totalTaxes)}</strong></div>
            {result.cashBenefits > 0 && <div><span><i className="calc-sign benefit-sign">+</i> Benefici fiscali</span><strong>+ {formatCurrency(result.cashBenefits)}</strong></div>}
            <div className="table-total"><span>Netto annuale stimato</span><strong>{formatCurrency(result.netAnnual)}</strong></div>
          </div>

          <div className="result-kpis">
            <div><span>Tasse</span><strong>{formatCurrency(result.totalTaxes)}</strong><small>{pct(taxShare)} della RAL</small></div>
            <div><span>Contributi</span><strong>{formatCurrency(result.employeeContributions)}</strong><small>{pct(contributionShare)} della RAL</small></div>
            <div><span>Imponibile fiscale</span><strong>{formatCurrency(result.taxableIncome)}</strong><small>Dopo i contributi</small></div>
          </div>

          <div className="results-footer">
            <div className="raise-insight">
              <span className="trend-icon">↗</span>
              <p>Con <strong>1.000 € di RAL in più</strong>, il netto crescerebbe di circa <strong>{formatCurrency(nextResult.netAnnual - result.netAnnual, 0)} l’anno</strong>.</p>
            </div>
            <a href="#dettaglio">Vedi tutte le voci ↓</a>
          </div>
        </section>
      </section>

      <section className="breakdown-section" id="dettaglio">
        <div className="section-intro">
          <div>
            <span className="section-kicker">La composizione</span>
            <h2>Dove va la tua RAL</h2>
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
            <p>Contributi a tuo carico</p>
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
          <span className="section-kicker">Trasparenza prima di tutto</span>
          <h2>Come arriviamo al risultato</h2>
          <p>Il modello descrive un caso standard, non tenta di simulare un cedolino completo. Ogni passaggio è isolato e verificabile.</p>
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
          <div className="sources-column">
            <h3>Fonti primarie</h3>
            <a href="https://www.lavoro.gov.it/notizie/pagine/legge-di-bilancio-2026-le-principali-misure-lavoratori-imprese-e-famiglie" target="_blank" rel="noreferrer"><span>IRPEF 2026</span><b>Ministero del Lavoro ↗</b></a>
            <a href="https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.lavoratori-dipendenti-limite-minimo-di-retribuzione-giornaliera-2026.html" target="_blank" rel="noreferrer"><span>Contributi</span><b>INPS ↗</b></a>
            <a href="https://www.regione.lombardia.it/bollo-auto-e-tributi-regionali/red-addizionale-regionale-irpef" target="_blank" rel="noreferrer"><span>Addizionale regionale</span><b>Regione Lombardia ↗</b></a>
            <a href="https://www.comune.milano.it/aree-tematiche/tributi/addizionale-comunale-irpef" target="_blank" rel="noreferrer"><span>Addizionale comunale</span><b>Comune di Milano ↗</b></a>
          </div>
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
              <div><span className="section-kicker">Scenario</span><h2 id="settings-title">Personalizza</h2></div>
              <button type="button" className="drawer-close" onClick={() => setSettingsOpen(false)} aria-label="Chiudi">×</button>
            </div>
            <p className="drawer-copy">Modifica le poche variabili che incidono sul caso standard. Il calcolo si aggiorna premendo “Applica”.</p>

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

            <div className="setting-group two-inputs">
              <label htmlFor="contribution">Contributi dipendente</label>
              <div className="suffix-input"><input id="contribution" type="number" min="5" max="15" step="0.01" value={draft.employeeContributionRate} onChange={(e) => setDraft({ ...draft, employeeContributionRate: Number(e.target.value) })} /><span>%</span></div>
              <small>9,19% è l’assunzione standard del prototipo.</small>
            </div>

            <div className="setting-group locked-setting">
              <span>Residenza fiscale</span>
              <strong>Milano, Lombardia <i>Default</i></strong>
            </div>

            <div className="setting-group two-inputs">
              <label htmlFor="municipal">Addizionale comunale</label>
              <div className="suffix-input"><input id="municipal" type="number" min="0" max="3" step="0.1" value={draft.municipalRate} onChange={(e) => setDraft({ ...draft, municipalRate: Number(e.target.value) })} /><span>%</span></div>
              <small>A Milano è 0,8%, con esenzione fino a 23.000 €.</small>
            </div>

            <button className="calculate-button drawer-apply" type="button" onClick={() => { setCalculated(draft); setSettingsOpen(false); }}>Applica allo scenario <span>→</span></button>
            <button className="reset-button" type="button" onClick={() => setDraft(DEFAULT_INPUT)}>Ripristina valori predefiniti</button>
          </aside>
        </div>
      )}
    </main>
  );
}
