"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_INPUT,
  RAL_MAX,
  RAL_MIN,
  SOURCES,
  calculateSalary,
  formatCurrency,
  formatPercent,
  marginalSeries,
  type MarginalPoint,
  type SalaryInput,
  type SourceKey,
} from "./tax-2026";

const quickRal = [25000, 35000, 50000];
const RAISE_STEP = 1000;

function pct(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

/**
 * Ogni voce economica porta con sé la norma che la genera e la formula
 * applicata. Usa <details> così resta leggibile anche senza JavaScript.
 */
function SourceNote({ id }: { id: SourceKey }) {
  const source = SOURCES[id];
  return (
    <details className="source-note">
      <summary title={`Fonte e formula per ${source.label}`}>fonte</summary>
      <div className="source-body">
        <p className="source-formula">{source.formula}</p>
        <p className="source-norm">{source.norm}</p>
        {"url" in source && source.url ? (
          <a href={source.url} target="_blank" rel="noreferrer">
            Documento ufficiale ↗
          </a>
        ) : null}
      </div>
    </details>
  );
}

type ChartGeometry = {
  path: string;
  area: string;
  zeroY: number;
  yTicks: { value: number; y: number }[];
  xTicks: { value: number; x: number }[];
  phaseOut: { x: number; width: number } | null;
  cliff: { x: number; gross: number; kept: number; label: string };
  marker: { x: number; y: number; kept: number };
  showZero: boolean;
};

const CHART = { width: 720, height: 250, left: 46, right: 14, top: 14, bottom: 30 };

function buildGeometry(points: MarginalPoint[], currentGross: number): ChartGeometry {
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;

  const values = points.map((point) => point.marginalKept);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(...values);
  const min = Math.floor(rawMin * 10) / 10;
  const max = Math.ceil(rawMax * 10) / 10;

  const x = (gross: number) => CHART.left + ((gross - RAL_MIN) / (RAL_MAX - RAL_MIN)) * plotWidth;
  const y = (value: number) => CHART.top + (1 - (value - min) / (max - min)) * plotHeight;

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(point.gross).toFixed(1)} ${y(point.marginalKept).toFixed(1)}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const area = `${path} L${x(last.gross).toFixed(1)} ${y(min).toFixed(1)} L${x(first.gross).toFixed(1)} ${y(min).toFixed(1)} Z`;

  const yTicks: { value: number; y: number }[] = [];
  for (let value = min; value <= max + 1e-9; value += 0.2) {
    yTicks.push({ value, y: y(value) });
  }

  const xTicks = [15000, 30000, 45000, 60000, 80000, 100000].map((value) => ({ value, x: x(value) }));

  // Fascia in cui si azzera l'ulteriore detrazione: imponibile fra 32k e 40k.
  const contributionFactor = 1 - DEFAULT_INPUT.employeeContributionRate / 100;
  const phaseOutFrom = x(32000 / contributionFactor);
  const phaseOutTo = x(Math.min(RAL_MAX, 40000 / contributionFactor));

  // Punto peggiore della curva: è lì che un aumento rende meno di ovunque.
  const worst = points.reduce((acc, point) => (point.marginalKept < acc.marginalKept ? point : acc));
  const municipalCliff = 23000 / contributionFactor;
  const worstLabel =
    Math.abs(worst.gross - municipalCliff) <= 600 ? "soglia comunale" : "punto peggiore";

  const nearest = points.reduce((acc, point) =>
    Math.abs(point.gross - currentGross) < Math.abs(acc.gross - currentGross) ? point : acc,
  );

  return {
    path,
    area,
    zeroY: y(0),
    showZero: min < 0,
    yTicks,
    xTicks,
    phaseOut: phaseOutTo > phaseOutFrom ? { x: phaseOutFrom, width: phaseOutTo - phaseOutFrom } : null,
    cliff: { x: x(worst.gross), gross: worst.gross, kept: worst.marginalKept, label: worstLabel },
    marker: { x: x(nearest.gross), y: y(nearest.marginalKept), kept: nearest.marginalKept },
  };
}

export default function Home() {
  const [draft, setDraft] = useState<SalaryInput>(DEFAULT_INPUT);
  const [settingsDraft, setSettingsDraft] = useState<SalaryInput>(DEFAULT_INPUT);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const calculated = draft;
  const result = useMemo(() => calculateSalary(calculated), [calculated]);
  const raised = useMemo(
    () => calculateSalary({ ...calculated, grossAnnual: calculated.grossAnnual + RAISE_STEP }),
    [calculated],
  );
  const series = useMemo(() => marginalSeries(calculated, RAL_MIN, RAL_MAX, 500), [calculated]);
  const geometry = useMemo(() => buildGeometry(series, calculated.grossAnnual), [series, calculated.grossAnnual]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function openSettings() {
    setSettingsDraft(draft);
    setSettingsOpen(true);
  }

  function confirmSettings() {
    setDraft((current) => ({
      ...current,
      months: settingsDraft.months,
      workDays: settingsDraft.workDays,
      employerContributionRate: settingsDraft.employerContributionRate,
      inailRate: settingsDraft.inailRate,
    }));
    setSettingsOpen(false);
  }

  async function copySummary() {
    const lines = [
      `RAL ${formatCurrency(calculated.grossAnnual)}`,
      `Costo azienda ${formatCurrency(result.employerCost)}`,
      `Netto annuo ${formatCurrency(result.netAnnual)}`,
      `Mese ordinario ${formatCurrency(result.ordinaryMonth.net)}`,
      result.extraMonth ? `Mensilità aggiuntiva ${formatCurrency(result.extraMonth.net)}` : null,
      `Trattenute ${formatCurrency(result.totalWithholdings)}`,
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join(" · "));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  const netShare = result.netOnGross * 100;
  const allocationBase = result.employerCost;
  const netAllocation = (result.netAnnual / allocationBase) * 100;
  const employeeContributionAllocation = (result.employeeContributions / allocationBase) * 100;
  const taxAllocation = (result.totalTaxes / allocationBase) * 100;
  const employerAllocation = ((result.employerContributions + result.inail) / allocationBase) * 100;
  const tfrAllocation = (result.tfr / allocationBase) * 100;

  const raiseNet = raised.netAnnual - result.netAnnual;
  const raiseCost = raised.employerCost - result.employerCost;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Chiaro, torna all'inizio">
          <span className="brand-mark">C</span>
          <span>chiaro</span>
        </a>
        <nav className="nav-links" aria-label="Navigazione principale">
          <a href="#calcolatore">Calcolatore</a>
          <a href="#cedolino">Cedolino</a>
          <a href="#dettaglio">Dettaglio</a>
          <a href="#curva">Curva</a>
          <a href="#metodo">Metodo</a>
        </nav>
        <div className="topbar-actions">
          <span className="year-pill"><span className="live-dot" /> Regole 2026</span>
        </div>
      </header>

      <section className="workspace-intro" id="top">
        <div className="intro-copy">
          <div className="eyebrow"><span>Calcolatore aziende</span></div>
          <h1>Dal costo azienda<br /><em>alla busta paga</em></h1>
          <p>
            Inserisci la RAL del dipendente: vedi quanto costa davvero all&apos;azienda, quanto arriva
            netto ogni mese e dove finisce ogni euro trattenuto.
          </p>
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
                min={RAL_MIN}
                max={RAL_MAX}
                step="500"
                value={draft.grossAnnual}
                onChange={(event) => setDraft({ ...draft, grossAnnual: Number(event.target.value) })}
                onBlur={() =>
                  setDraft({
                    ...draft,
                    grossAnnual: Math.min(RAL_MAX, Math.max(RAL_MIN, Number(draft.grossAnnual) || RAL_MIN)),
                  })
                }
                aria-describedby="ral-help"
              />
            </div>
            <p className="field-help">Retribuzione annua lorda indicata nella proposta o nel contratto.</p>
          </div>

          <input
            className="ral-slider"
            type="range"
            min={RAL_MIN}
            max={RAL_MAX}
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
              <button type="button" onClick={openSettings} aria-label="Modifica i parametri utilizzati" title="Modifica parametri">✎</button>
            </div>
            <div className="parameter-grid">
              <div><span>Contratto</span><strong>Tempo indeterminato</strong></div>
              <div><span>Residenza fiscale</span><strong>Milano</strong></div>
              <div><span>Mensilità</span><strong>{draft.months}</strong></div>
              <div><span>Giorni lavorati</span><strong>{draft.workDays}</strong></div>
              <div><span>Contributi dipendente</span><strong>{pct(draft.employeeContributionRate)}</strong></div>
              <div><span>Contributi datore</span><strong>{pct(draft.employerContributionRate)}</strong></div>
              <div className="parameter-wide"><span>Premio INAIL a carico azienda</span><strong>{pct(draft.inailRate)}</strong></div>
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

          {/* La catena completa: quello che l'azienda spende, quello che è scritto
              nel contratto, quello che il dipendente incassa. */}
          <ol className="value-chain" aria-label="Dal costo aziendale al netto">
            <li>
              <span>Costa all&apos;azienda</span>
              <strong>{formatCurrency(result.employerCost)}</strong>
              <small>{pct((result.employerCost / result.grossAnnual - 1) * 100)} sopra la RAL</small>
            </li>
            <li className="chain-arrow" aria-hidden="true">→</li>
            <li>
              <span>RAL da contratto</span>
              <strong>{formatCurrency(result.grossAnnual)}</strong>
              <small>{draft.months} mensilità</small>
            </li>
            <li className="chain-arrow" aria-hidden="true">→</li>
            <li className="chain-final">
              <span>Netto al dipendente</span>
              <strong>{formatCurrency(result.netAnnual)}</strong>
              <small>{pct(netShare)} della RAL</small>
            </li>
          </ol>

          <div className="payslip-preview">
            <div>
              <p className="result-label">Mese ordinario</p>
              <div className="hero-result">
                <strong>{formatCurrency(result.ordinaryMonth.net)}</strong>
                <span>netti</span>
              </div>
              <p className="result-context">Gennaio–dicembre, detrazioni e addizionali incluse</p>
            </div>
            {result.extraMonth ? (
              <div className="annual-result">
                <span>{draft.months === 14 ? "13ª e 14ª" : "Tredicesima"}</span>
                <strong>{formatCurrency(result.extraMonth.net)}</strong>
                <small>Stesso lordo, {formatCurrency(result.ordinaryMonth.net - result.extraMonth.net)} in meno</small>
              </div>
            ) : (
              <div className="annual-result">
                <span>Mensilità</span>
                <strong>12</strong>
                <small>Nessuna mensilità aggiuntiva</small>
              </div>
            )}
          </div>

          <div className="result-grid employer-results">
            <div><span>Trattenute totali</span><strong>{formatCurrency(result.totalWithholdings)}</strong></div>
            <div><span>Imposte</span><strong>{formatCurrency(result.totalTaxes)}</strong></div>
            <div><span>Contributi dipendente</span><strong>{formatCurrency(result.employeeContributions)}</strong></div>
            <div className="accent-stat"><span>Costo per 1 € netto</span><strong>{result.costPerNetEuro.toFixed(2).replace(".", ",")} €</strong></div>
          </div>

          {/* Il numero che serve a chi decide un aumento. */}
          <div className="raise-simulation">
            <p>
              Un aumento di <strong>{formatCurrency(RAISE_STEP)}</strong> di RAL costa all&apos;azienda{" "}
              <strong>{formatCurrency(raiseCost)}</strong> e lascia al dipendente{" "}
              <strong>{formatCurrency(raiseNet)}</strong> netti.
            </p>
            <span className="raise-badge">{formatPercent(raiseNet / raiseCost)} del costo arriva a destinazione</span>
          </div>

          <div className="results-footer">
            <a href="#cedolino">Vedi il cedolino ↓</a>
          </div>
        </section>
      </section>

      <section className="breakdown-section" id="cedolino">
        <div className="section-intro">
          <div>
            <span className="section-kicker">Distribuzione sui cedolini</span>
            <h2>Non tutti i mesi sono uguali</h2>
          </div>
          <p>
            Dividere il netto annuo per le mensilità dà un numero che non compare in nessuna busta paga.
            Sulla mensilità aggiuntiva non spettano le detrazioni e non si trattengono le addizionali:
            stesso lordo, netto diverso. <SourceNote id="extraMonth" />
          </p>
        </div>

        <div className="payslip-table" role="table" aria-label="Confronto fra mensilità ordinaria e aggiuntiva">
          <div className="payslip-row payslip-head" role="row">
            <span role="columnheader">Voce</span>
            <span role="columnheader">Mese ordinario</span>
            <span role="columnheader">{draft.months === 12 ? "Non prevista" : "Mensilità aggiuntiva"}</span>
          </div>
          <div className="payslip-row" role="row">
            <span role="cell">Lordo</span>
            <b role="cell">{formatCurrency(result.ordinaryMonth.gross, 2)}</b>
            <b role="cell">{result.extraMonth ? formatCurrency(result.extraMonth.gross, 2) : "—"}</b>
          </div>
          <div className="payslip-row" role="row">
            <span role="cell">Contributi INPS</span>
            <b role="cell">− {formatCurrency(result.ordinaryMonth.contributions, 2)}</b>
            <b role="cell">{result.extraMonth ? `− ${formatCurrency(result.extraMonth.contributions, 2)}` : "—"}</b>
          </div>
          <div className="payslip-row" role="row">
            <span role="cell">IRPEF netta</span>
            <b role="cell">− {formatCurrency(result.ordinaryMonth.irpef, 2)}</b>
            <b role="cell">{result.extraMonth ? `− ${formatCurrency(result.extraMonth.irpef, 2)}` : "—"}</b>
          </div>
          <div className="payslip-row" role="row">
            <span role="cell">Addizionali locali</span>
            <b role="cell">− {formatCurrency(result.ordinaryMonth.localTaxes, 2)}</b>
            <b role="cell" className="muted-cell">{result.extraMonth ? "non trattenute" : "—"}</b>
          </div>
          <div className="payslip-row" role="row">
            <span role="cell">Somme integrative</span>
            <b role="cell">+ {formatCurrency(result.ordinaryMonth.benefits, 2)}</b>
            <b role="cell" className="muted-cell">{result.extraMonth ? "non erogate" : "—"}</b>
          </div>
          <div className="payslip-row payslip-total" role="row">
            <span role="cell">Netto in busta</span>
            <b role="cell">{formatCurrency(result.ordinaryMonth.net, 2)}</b>
            <b role="cell">{result.extraMonth ? formatCurrency(result.extraMonth.net, 2) : "—"}</b>
          </div>
        </div>
        <p className="payslip-check">
          Controllo di quadratura: {formatCurrency(result.ordinaryMonth.net, 2)} × 12
          {result.extraMonth ? ` + ${formatCurrency(result.extraMonth.net, 2)} × ${result.extraMonths}` : ""} ={" "}
          <strong>{formatCurrency(result.netAnnual, 2)}</strong>, pari al netto annuo.
          La media aritmetica sarebbe {formatCurrency(result.netMonthlyAverage, 2)}: non è quanto si incassa in nessun mese.
        </p>
      </section>

      <section className="breakdown-section" id="dettaglio">
        <div className="section-intro">
          <div>
            <span className="section-kicker">Dettaglio annuale</span>
            <h2>Dove finisce ogni euro</h2>
          </div>
          <p>
            La barra parte dal costo aziendale, non dalla RAL: è l&apos;unico modo per vedere il peso
            reale dei contributi a carico del datore.
          </p>
        </div>

        <div className="allocation-card">
          <div className="allocation-bar" aria-label="Ripartizione del costo aziendale">
            <span className="bar-net" style={{ width: `${netAllocation}%` }} />
            <span className="bar-taxes" style={{ width: `${taxAllocation}%` }} />
            <span className="bar-contributions" style={{ width: `${employeeContributionAllocation}%` }} />
            <span className="bar-employer" style={{ width: `${employerAllocation}%` }} />
            <span className="bar-tfr" style={{ width: `${tfrAllocation}%` }} />
          </div>
          <div className="allocation-legend">
            <div><i className="dot dot-net" /><span>Netto</span><strong>{pct(netAllocation)}</strong></div>
            <div><i className="dot dot-taxes" /><span>Imposte</span><strong>{pct(taxAllocation)}</strong></div>
            <div><i className="dot dot-contributions" /><span>Contributi dipendente</span><strong>{pct(employeeContributionAllocation)}</strong></div>
            <div><i className="dot dot-employer" /><span>Contributi datore</span><strong>{pct(employerAllocation)}</strong></div>
            <div><i className="dot dot-tfr" /><span>TFR</span><strong>{pct(tfrAllocation)}</strong></div>
          </div>
        </div>

        <div className="detail-grid">
          <article className="detail-card cost-card">
            <div className="card-title-row"><span>00</span><h3>Costo azienda</h3></div>
            <p>Oltre la RAL</p>
            <strong>{formatCurrency(result.employerContributions + result.inail + result.tfr)}</strong>
            <div className="formula-line">
              <span>Contributi datore <SourceNote id="employerContributions" /></span>
              <b>{formatCurrency(result.employerContributions)}</b>
            </div>
            <div className="formula-line">
              <span>INAIL <SourceNote id="inail" /></span>
              <b>{formatCurrency(result.inail)}</b>
            </div>
            <div className="formula-line">
              <span>TFR accantonato <SourceNote id="tfr" /></span>
              <b>{formatCurrency(result.tfr)}</b>
            </div>
          </article>

          <article className="detail-card dark-card">
            <div className="card-title-row"><span>01</span><h3>Previdenza</h3></div>
            <p>Contributi a carico del dipendente</p>
            <strong>{formatCurrency(result.employeeContributions)}</strong>
            <div className="formula-line">
              <span>Aliquota base <SourceNote id="employeeContributions" /></span>
              <b>{pct(calculated.employeeContributionRate)}</b>
            </div>
            <div className="formula-line">
              <span>Quota aggiuntiva 1%</span>
              <b>{formatCurrency(result.additionalContribution)}</b>
            </div>
          </article>

          <article className="detail-card">
            <div className="card-title-row"><span>02</span><h3>IRPEF</h3></div>
            <p>Imposta nazionale netta</p>
            <strong>{formatCurrency(result.netIrpef)}</strong>
            <div className="formula-line">
              <span>IRPEF lorda <SourceNote id="grossIrpef" /></span>
              <b>{formatCurrency(result.grossIrpef)}</b>
            </div>
            <div className="formula-line positive">
              <span>Detrazione lavoro dip. <SourceNote id="employeeDeduction" /></span>
              <b>− {formatCurrency(result.employeeDeduction)}</b>
            </div>
            <div className="formula-line positive">
              <span>Ulteriore detrazione <SourceNote id="additionalDeduction" /></span>
              <b>− {formatCurrency(result.additionalDeduction)}</b>
            </div>
          </article>

          <article className="detail-card">
            <div className="card-title-row"><span>03</span><h3>Territorio</h3></div>
            <p>Addizionali locali</p>
            <strong>{formatCurrency(result.localTaxes)}</strong>
            <div className="formula-line">
              <span>Regione Lombardia <SourceNote id="regionalTax" /></span>
              <b>{formatCurrency(result.regionalTax)}</b>
            </div>
            <div className="formula-line">
              <span>Comune di Milano <SourceNote id="municipalTax" /></span>
              <b>{formatCurrency(result.municipalTax)}</b>
            </div>
          </article>

          <article className="detail-card benefit-card">
            <div className="card-title-row"><span>04</span><h3>Benefici</h3></div>
            <p>Somme e crediti riconosciuti</p>
            <strong>+ {formatCurrency(result.cashBenefits)}</strong>
            <div className="formula-line">
              <span>Somma integrativa <SourceNote id="taxCutCashSum" /></span>
              <b>{formatCurrency(result.taxCutCashSum)}</b>
            </div>
            <div className="formula-line">
              <span>Trattamento integrativo <SourceNote id="treatmentCredit" /></span>
              <b>{formatCurrency(result.treatmentCredit)}</b>
            </div>
          </article>
        </div>
      </section>

      <section className="breakdown-section" id="curva">
        <div className="section-intro">
          <div>
            <span className="section-kicker">Aliquota marginale effettiva</span>
            <h2>Quanto rende l&apos;aumento</h2>
          </div>
          <p>
            Per ogni euro lordo in più, quanto arriva davvero in tasca. Le soglie e i decalage delle
            detrazioni creano gradini: ci sono fasce in cui aumentare la RAL rende meno che nello
            scaglione al 43%.
          </p>
        </div>

        <figure className="chart-card">
          <svg
            viewBox={`0 0 ${CHART.width} ${CHART.height}`}
            className="marginal-chart"
            role="img"
            aria-label={`Curva dell'aliquota marginale effettiva da ${RAL_MIN} a ${RAL_MAX} euro di RAL. Alla RAL selezionata ogni euro lordo aggiuntivo lascia ${formatPercent(geometry.marker.kept)} netto. Il minimo della curva è ${formatPercent(geometry.cliff.kept)} intorno a ${geometry.cliff.gross} euro.`}
          >
            {geometry.phaseOut ? (
              <rect
                x={geometry.phaseOut.x}
                y={CHART.top}
                width={geometry.phaseOut.width}
                height={CHART.height - CHART.top - CHART.bottom}
                className="chart-band"
              />
            ) : null}

            {geometry.yTicks.map((tick) => (
              <g key={tick.value}>
                <line x1={CHART.left} x2={CHART.width - CHART.right} y1={tick.y} y2={tick.y} className="chart-grid" />
                <text x={CHART.left - 8} y={tick.y + 3} className="chart-label chart-label-y">
                  {Math.round(tick.value * 100)}%
                </text>
              </g>
            ))}

            {geometry.showZero ? (
              <line
                x1={CHART.left}
                x2={CHART.width - CHART.right}
                y1={geometry.zeroY}
                y2={geometry.zeroY}
                className="chart-zero"
              />
            ) : null}

            <path d={geometry.area} className="chart-area" />
            <path d={geometry.path} className="chart-line" />

            <g>
              <line
                x1={geometry.cliff.x}
                x2={geometry.cliff.x}
                y1={CHART.top}
                y2={CHART.height - CHART.bottom}
                className="chart-cliff"
              />
              <text x={geometry.cliff.x + 5} y={CHART.top + 12} className="chart-label chart-cliff-label">
                {geometry.cliff.label} · {formatPercent(geometry.cliff.kept, 0)}
              </text>
            </g>

            <g>
              <line
                x1={geometry.marker.x}
                x2={geometry.marker.x}
                y1={CHART.top}
                y2={CHART.height - CHART.bottom}
                className="chart-marker-line"
              />
              <circle cx={geometry.marker.x} cy={geometry.marker.y} r="5" className="chart-marker" />
            </g>

            {geometry.xTicks.map((tick) => (
              <text key={tick.value} x={tick.x} y={CHART.height - 10} className="chart-label chart-label-x">
                {tick.value / 1000}k
              </text>
            ))}
          </svg>
          <figcaption>
            Alla RAL di {formatCurrency(calculated.grossAnnual)} ogni euro lordo aggiuntivo lascia{" "}
            <strong>{formatPercent(geometry.marker.kept)}</strong> di netto. La fascia evidenziata è
            quella in cui si azzera l&apos;ulteriore detrazione da 1.000 €: lì il rendimento scende a{" "}
            <strong>39,3%</strong>, sotto il <strong>48,9%</strong> dello scaglione al 43%. Il minimo
            assoluto è <strong>{formatPercent(geometry.cliff.kept)}</strong>, sul salto
            dell&apos;addizionale comunale.
          </figcaption>
        </figure>

        <aside className="cliff-callout">
          <h3>La trappola dei 23.000 €</h3>
          <p>
            L&apos;addizionale comunale di Milano è una <strong>soglia di esenzione, non una franchigia</strong>:
            appena l&apos;imponibile supera 23.000 €, lo 0,8% colpisce l&apos;intero importo, non solo
            l&apos;eccedenza. Passando da 25.325 € a 25.350 € di RAL il netto annuo <strong>scende di 169 €</strong>,
            e servono circa 310 € lordi in più per tornare al netto di partenza. <SourceNote id="municipalTax" />
          </p>
          <div className="cliff-figures">
            <div>
              <span>RAL 25.325 €</span>
              <strong>{formatCurrency(calculateSalary({ ...calculated, grossAnnual: 25325 }).netAnnual)}</strong>
              <small>imponibile sotto soglia</small>
            </div>
            <i aria-hidden="true">→</i>
            <div className="cliff-worse">
              <span>RAL 25.350 €</span>
              <strong>{formatCurrency(calculateSalary({ ...calculated, grossAnnual: 25350 }).netAnnual)}</strong>
              <small>imponibile sopra soglia</small>
            </div>
          </div>
        </aside>
      </section>

      <section className="method-section" id="metodo">
        <div className="method-heading">
          <span className="section-kicker">Note sul calcolo</span>
          <h2>Metodo di calcolo</h2>
          <p>Stima annuale per il caso standard indicato. Non sostituisce un cedolino.</p>
        </div>

        <div className="calculation-flow">
          <div><span>Costo azienda</span><strong>{formatCurrency(result.employerCost)}</strong></div>
          <i>−</i>
          <div><span>Oneri datore</span><strong>{formatCurrency(result.employerContributions + result.inail + result.tfr)}</strong></div>
          <i>=</i>
          <div className="highlight-flow"><span>RAL</span><strong>{formatCurrency(result.grossAnnual)}</strong></div>
          <i>−</i>
          <div><span>Contributi</span><strong>{formatCurrency(result.employeeContributions)}</strong></div>
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
              <li>Impiegato del settore privato a tempo indeterminato, full time</li>
              <li>Unico reddito e lavoro per l&apos;intero anno</li>
              <li>Residenza fiscale a Milano</li>
              <li>Nessun familiare a carico o onere detraibile</li>
              <li>Aliquota datore 29,4% e INAIL 0,5%, tipiche del terziario</li>
              <li>RAL supportata da 15.000 € a 100.000 €</li>
            </ul>
          </div>
          <div>
            <h3>Semplificazioni note</h3>
            <ul>
              <li>Le addizionali sono trattenute nell&apos;anno, non rateizzate su acconto e saldo</li>
              <li>L&apos;IRPEF è calcolata sull&apos;anno intero, senza conguaglio progressivo mese per mese</li>
              <li>Premi, straordinari, welfare e fringe benefit non sono considerati</li>
              <li>Il TFR è mostrato come costo, non come quota destinata a fondo pensione</li>
              <li>Nessuna agevolazione contributiva o regime agevolato</li>
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
        <div className="modal-layer" role="presentation">
          <button className="modal-backdrop" aria-label="Annulla modifica parametri" onClick={() => setSettingsOpen(false)} />
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-header">
              <div><span className="section-kicker">Parametri</span><h2 id="settings-title">Modifica</h2></div>
              <div className="modal-actions">
                <button type="button" className="modal-action modal-cancel" onClick={() => setSettingsOpen(false)} aria-label="Annulla">×</button>
                <button type="button" className="modal-action modal-confirm" onClick={confirmSettings} aria-label="Conferma parametri">✓</button>
              </div>
            </div>
            <p className="modal-copy">Conferma le modifiche per aggiornare la simulazione.</p>

            <div className="setting-group">
              <label htmlFor="months">Mensilità</label>
              <div className="segmented">
                {[12, 13, 14].map((months) => <button type="button" key={months} className={settingsDraft.months === months ? "active" : ""} onClick={() => setSettingsDraft({ ...settingsDraft, months })}>{months}</button>)}
              </div>
              <small>Le mensilità oltre la dodicesima sono tassate senza detrazioni e senza addizionali.</small>
            </div>

            <div className="setting-group two-inputs">
              <label htmlFor="days">Giorni lavorati</label>
              <input id="days" type="number" min="1" max="365" value={settingsDraft.workDays} onChange={(e) => setSettingsDraft({ ...settingsDraft, workDays: Math.min(365, Math.max(1, Number(e.target.value))) })} />
              <small>Incidono sulle detrazioni da lavoro dipendente.</small>
            </div>

            <div className="setting-group two-inputs">
              <label htmlFor="employer-rate">Aliquota contributiva a carico del datore (%)</label>
              <input id="employer-rate" type="number" min="20" max="40" step="0.1" value={settingsDraft.employerContributionRate} onChange={(e) => setSettingsDraft({ ...settingsDraft, employerContributionRate: Math.min(40, Math.max(20, Number(e.target.value))) })} />
              <small>Varia con settore e dimensione aziendale. 29,4% è un valore tipico del terziario.</small>
            </div>

            <div className="setting-group two-inputs">
              <label htmlFor="inail-rate">Tasso INAIL (%)</label>
              <input id="inail-rate" type="number" min="0" max="5" step="0.1" value={settingsDraft.inailRate} onChange={(e) => setSettingsDraft({ ...settingsDraft, inailRate: Math.min(5, Math.max(0, Number(e.target.value))) })} />
              <small>Dipende dalla lavorazione assicurata. 0,5% è indicativo per il lavoro d&apos;ufficio.</small>
            </div>

            <div className="setting-group locked-setting contribution-setting">
              <span>Contributi previdenziali a carico del dipendente</span>
              <strong>{pct(DEFAULT_INPUT.employeeContributionRate)} <i>Fisso</i></strong>
              <small>Aliquota standard FPLD. L&apos;1% aggiuntivo oltre 56.224 € è applicato automaticamente.</small>
            </div>

            <div className="setting-group locked-setting">
              <span>Residenza fiscale</span>
              <strong>Milano, Lombardia <i>Fisso</i></strong>
            </div>

            <button className="reset-button" type="button" onClick={() => setSettingsDraft({ ...settingsDraft, ...DEFAULT_INPUT, grossAnnual: settingsDraft.grossAnnual })}>Ripristina parametri predefiniti</button>
          </section>
        </div>
      )}
    </main>
  );
}
