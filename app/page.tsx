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
        <div className="topbar-actions">
          <span className="year-pill"><span className="live-dot" /> Regole 2026</span>
          <button className="icon-button" type="button" onClick={() => setSettingsOpen(true)} aria-label="Apri impostazioni avanzate">
            <span aria-hidden="true">☰</span>
            <span className="desktop-only">Personalizza</span>
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span>Product exercise</span><i /> Jet HR</div>
        <h1>Dalla RAL al netto,<br /><em>senza scatole nere.</em></h1>
        <p className="hero-copy">Una stima trasparente dello stipendio: vedi quanto resta a te, quanto va in contributi e quante tasse paghi davvero.</p>
      </section>

      <section className="calculator-shell" aria-label="Calcolatore stipendio netto">
        <form className="input-panel" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <span className="step">01</span>
              <h2>Inserisci la tua RAL</h2>
            </div>
            <button type="button" className="text-button" onClick={() => setSettingsOpen(true)}>Opzioni avanzate <span>↗</span></button>
          </div>

          <label className="ral-label" htmlFor="ral">Retribuzione annua lorda</label>
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

          <div className="assumption-line">
            <span className="assumption-icon">◎</span>
            <p><strong>Scenario standard</strong><br />Dipendente privato · Milano · {draft.months} mensilità · Nessuna agevolazione</p>
          </div>

          <button className="calculate-button" type="submit">
            Calcola il mio netto <span aria-hidden="true">→</span>
          </button>
        </form>

        <section className="result-panel" aria-live="polite">
          <div className="result-topline">
            <span className="step step-dark">02</span>
            <button type="button" className="copy-button" onClick={copySummary}>{copied ? "Copiato ✓" : "Copia riepilogo"}</button>
          </div>
          <p className="result-label">Il tuo netto medio mensile</p>
          <div className="hero-result">
            <strong>{formatCurrency(result.netMonthly, 0)}</strong>
            <span>/ mese</span>
          </div>
          <p className="result-context">su {calculated.months} mensilità · stima annuale 2026</p>

          <div className="result-grid">
            <div>
              <span>Netto annuale</span>
              <strong>{formatCurrency(result.netAnnual)}</strong>
            </div>
            <div>
              <span>Tasse annuali</span>
              <strong>{formatCurrency(result.totalTaxes)}</strong>
            </div>
            <div>
              <span>Contributi INPS</span>
              <strong>{formatCurrency(result.employeeContributions)}</strong>
            </div>
            <div className="accent-stat">
              <span>Resta a te</span>
              <strong>{pct(netShare)}</strong>
            </div>
          </div>

          <div className="raise-insight">
            <span className="trend-icon">↗</span>
            <p>Con <strong>1.000 € di RAL in più</strong>, il tuo netto crescerebbe di circa <strong>{formatCurrency(nextResult.netAnnual - result.netAnnual, 0)} l’anno</strong>.</p>
          </div>
        </section>
      </section>

      <section className="breakdown-section">
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
