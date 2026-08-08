import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_INPUT,
  RAL_MAX,
  RAL_MIN,
  SOURCES,
  calculateSalary,
  marginalSeries,
} from "../app/tax-2026.ts";

const EUR = 0.01;

function near(actual, expected, tolerance = EUR, message = "") {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message} atteso ${expected}, ottenuto ${actual} (delta ${Math.abs(actual - expected)})`,
  );
}

function withRal(grossAnnual, overrides = {}) {
  return calculateSalary({ ...DEFAULT_INPUT, grossAnnual, ...overrides });
}

/**
 * Riferimento indipendente: IRPEF lorda ricalcolata con una seconda
 * implementazione (somma esplicita per scaglione, senza il loop del motore).
 * Serve a intercettare errori nella funzione progressiva, non a ripeterla.
 */
function referenceIrpef(taxable) {
  const first = Math.min(taxable, 28000) * 0.23;
  const second = Math.min(Math.max(taxable - 28000, 0), 22000) * 0.33;
  const third = Math.max(taxable - 50000, 0) * 0.43;
  return first + second + third;
}

function referenceRegional(taxable) {
  const a = Math.min(taxable, 15000) * 0.0123;
  const b = Math.min(Math.max(taxable - 15000, 0), 13000) * 0.0158;
  const c = Math.min(Math.max(taxable - 28000, 0), 22000) * 0.0172;
  const d = Math.max(taxable - 50000, 0) * 0.0173;
  return a + b + c + d;
}

/* -------------------------------------------------------------------------
 * 1. Caso di riferimento calcolato a mano
 *
 * RAL 35.000 €, 13 mensilità, 365 giorni, Milano.
 *   contributi   35.000 × 9,19%                          = 3.216,50
 *   imponibile   35.000 − 3.216,50                       = 31.783,50
 *   IRPEF lorda  28.000×23% + 3.783,50×33%               = 7.688,555
 *   detrazione   1.910 × (50.000−31.783,50)/22.000 + 65  = 1.646,5234…
 *   ulteriore    reddito ≤ 32.000                        = 1.000,00
 *   IRPEF netta                                          = 5.042,0316…
 *   regionale    184,50 + 205,40 + 65,0762               =   454,9762
 *   comunale     31.783,50 × 0,8%                        =   254,268
 *   netto        35.000 − 3.216,50 − 5.751,2758          = 26.032,2242…
 * ---------------------------------------------------------------------- */
test("caso di riferimento: RAL 35.000 € a Milano", () => {
  const r = withRal(35000);

  near(r.employeeContributions, 3216.5, EUR, "contributi");
  near(r.taxableIncome, 31783.5, EUR, "imponibile");
  near(r.grossIrpef, 7688.555, EUR, "IRPEF lorda");
  near(r.employeeDeduction, 1646.5234090909, EUR, "detrazione lavoro dipendente");
  near(r.additionalDeduction, 1000, EUR, "ulteriore detrazione");
  near(r.netIrpef, 5042.0315909091, EUR, "IRPEF netta");
  near(r.regionalTax, 454.9762, EUR, "addizionale regionale");
  near(r.municipalTax, 254.268, EUR, "addizionale comunale");
  near(r.cashBenefits, 0, EUR, "benefici in busta");
  near(r.netAnnual, 26032.2242090909, EUR, "netto annuo");
});

test("caso di riferimento: costo azienda su RAL 35.000 €", () => {
  const r = withRal(35000);

  near(r.employerContributions, 10290, EUR, "contributi datore 29,4%");
  near(r.inail, 175, EUR, "INAIL 0,5%");
  near(r.tfr, 35000 / 13.5, EUR, "quota TFR");
  near(r.employerCost, 35000 + 10290 + 175 + 35000 / 13.5, EUR, "costo azienda");

  // Il costo aziendale è circa 1,37× la RAL e circa 1,85× il netto.
  assert.ok(r.employerCost / r.grossAnnual > 1.35 && r.employerCost / r.grossAnnual < 1.4);
  assert.ok(r.costPerNetEuro > 1.8 && r.costPerNetEuro < 1.9);
});

/* -------------------------------------------------------------------------
 * 2. Il netto mensile non è il netto annuo diviso le mensilità
 * ---------------------------------------------------------------------- */
test("la mensilità aggiuntiva è tassata più della ordinaria", () => {
  const r = withRal(35000);

  assert.ok(r.extraMonth, "con 13 mensilità deve esistere la tredicesima");
  // Stesso lordo, netto diverso: sulla tredicesima non spettano detrazioni
  // né si trattengono addizionali.
  near(r.extraMonth.gross, r.ordinaryMonth.gross, EUR, "lordo identico");
  near(r.extraMonth.localTaxes, 0, EUR, "nessuna addizionale sulla tredicesima");
  near(r.extraMonth.benefits, 0, EUR, "nessun bonus sulla tredicesima");

  assert.ok(
    r.extraMonth.net < r.ordinaryMonth.net,
    "la tredicesima deve essere più bassa del mese ordinario",
  );
  // La media aritmetica cade in mezzo: è il numero che i calcolatori
  // semplificati mostrano, e non corrisponde a nessuna busta paga reale.
  assert.ok(r.extraMonth.net < r.netMonthlyAverage);
  assert.ok(r.netMonthlyAverage < r.ordinaryMonth.net);

  near(r.ordinaryMonth.net, 2032.8459597, 0.01, "netto mese ordinario");
  near(r.extraMonth.net, 1638.0726923, 0.01, "netto tredicesima");
});

test("l'IRPEF della mensilità aggiuntiva è l'aliquota marginale", () => {
  const r = withRal(35000);
  // Ultima fetta di reddito dell'anno: 2.444,88 € di imponibile al 33%.
  const extraTaxable = r.taxableIncome / r.months;
  near(r.extraMonth.irpef, extraTaxable * 0.33, EUR, "IRPEF tredicesima al 33%");
});

/* -------------------------------------------------------------------------
 * 3. Invarianti su tutto l'intervallo supportato
 * ---------------------------------------------------------------------- */
const RANGE = [];
for (let gross = RAL_MIN; gross <= RAL_MAX; gross += 250) RANGE.push(gross);

test("identità contabile: lordo − trattenute + benefici = netto", () => {
  for (const gross of RANGE) {
    const r = withRal(gross);
    near(
      r.grossAnnual - r.employeeContributions - r.totalTaxes + r.cashBenefits,
      r.netAnnual,
      EUR,
      `identità annuale a ${gross}`,
    );
    near(r.taxableIncome, r.grossAnnual - r.employeeContributions, EUR, `imponibile a ${gross}`);
    near(r.totalTaxes, r.netIrpef + r.regionalTax + r.municipalTax, EUR, `imposte a ${gross}`);
  }
});

test("i cedolini ricostruiscono esattamente il netto annuo", () => {
  for (const months of [12, 13, 14]) {
    for (const gross of RANGE) {
      const r = withRal(gross, { months });
      const rebuilt = r.ordinaryMonth.net * 12 + (r.extraMonth ? r.extraMonth.net * r.extraMonths : 0);
      near(rebuilt, r.netAnnual, EUR, `ricostruzione a ${gross} con ${months} mensilità`);

      const grossRebuilt = r.ordinaryMonth.gross * 12 + (r.extraMonth ? r.extraMonth.gross * r.extraMonths : 0);
      near(grossRebuilt, r.grossAnnual, EUR, `lordo ricostruito a ${gross} con ${months} mensilità`);
    }
  }
});

test("con 12 mensilità non esiste una mensilità aggiuntiva", () => {
  const r = withRal(35000, { months: 12 });
  assert.equal(r.extraMonth, null);
  assert.equal(r.extraMonths, 0);
  near(r.ordinaryMonth.net, r.netMonthlyAverage, EUR, "media e mese ordinario coincidono");
});

test("IRPEF e addizionale regionale coincidono con il calcolo indipendente", () => {
  for (const gross of RANGE) {
    const r = withRal(gross);
    near(r.grossIrpef, referenceIrpef(r.taxableIncome), EUR, `IRPEF lorda a ${gross}`);
    near(r.regionalTax, referenceRegional(r.taxableIncome), EUR, `regionale a ${gross}`);
  }
});

test("il netto cresce con la RAL ovunque tranne che sulla soglia comunale", () => {
  const inversions = [];
  let previous = null;
  for (const gross of RANGE) {
    const current = withRal(gross);
    if (previous && current.netAnnual < previous.netAnnual) {
      inversions.push({ from: previous.grossAnnual, to: gross });
    }
    previous = current;
  }

  // L'unica discontinuità ammessa è il salto dell'addizionale comunale, che
  // è una soglia di esenzione e non una franchigia: superati 23.000 € di
  // imponibile l'imposta colpisce l'intero importo, non solo l'eccedenza.
  assert.equal(inversions.length, 1, `inversioni inattese: ${JSON.stringify(inversions)}`);
  const [cliff] = inversions;
  assert.ok(withRal(cliff.from).taxableIncome <= 23000);
  assert.ok(withRal(cliff.to).taxableIncome > 23000);
});

test("la soglia comunale crea una zona morta: più lordo, meno netto", () => {
  const before = withRal(25325);
  const after = withRal(25350);

  assert.ok(before.taxableIncome <= 23000 && after.taxableIncome > 23000);
  assert.ok(
    after.netAnnual < before.netAnnual - 100,
    "attesa una perdita netta di oltre 100 € superando la soglia",
  );

  // Serve un aumento sensibilmente maggiore per tornare al netto precedente.
  let breakEven = null;
  for (let gross = 25350; gross <= 26500; gross += 5) {
    if (withRal(gross).netAnnual >= before.netAnnual) {
      breakEven = gross;
      break;
    }
  }
  assert.ok(breakEven !== null, "il netto deve tornare a crescere");
  assert.ok(breakEven - before.grossAnnual > 250, "zona morta attesa di alcune centinaia di euro");
});

test("nessuna trattenuta è negativa e il netto resta sotto il lordo", () => {
  for (const gross of RANGE) {
    const r = withRal(gross);
    for (const [key, value] of Object.entries(r)) {
      if (typeof value === "number") {
        assert.ok(value >= -EUR, `${key} negativo a ${gross}: ${value}`);
      }
    }
    assert.ok(r.netAnnual < r.grossAnnual, `netto ≥ lordo a ${gross}`);
    assert.ok(r.employerCost > r.grossAnnual, `costo azienda ≤ RAL a ${gross}`);
  }
});

test("soglie note: esenzione comunale e contributo aggiuntivo dell'1%", () => {
  // Sotto i 23.000 € di imponibile Milano non trattiene l'addizionale.
  const below = withRal(25000);
  assert.ok(below.taxableIncome < 23000);
  near(below.municipalTax, 0, EUR, "esenzione comunale");

  // Appena sopra, l'imposta colpisce l'intero imponibile: è una soglia, non
  // una franchigia, e produce un gradino nel netto.
  const above = withRal(25500);
  assert.ok(above.taxableIncome > 23000);
  assert.ok(above.municipalTax > 180);

  // L'1% aggiuntivo scatta solo sulla quota oltre 56.224 €.
  near(withRal(56000).additionalContribution, 0, EUR, "nessun 1% sotto soglia");
  near(withRal(60000).additionalContribution, (60000 - 56224) * 0.01, EUR, "1% sulla sola eccedenza");
});

test("sotto i 15.000 € di imponibile spettano bonus e trattamento integrativo", () => {
  const r = withRal(16000);
  assert.ok(r.taxableIncome < 15000);
  assert.ok(r.taxCutCashSum > 0, "somma integrativa in busta");
  assert.ok(r.treatmentCredit > 0, "trattamento integrativo");
  assert.ok(r.netAnnual > r.grossAnnual - r.employeeContributions - r.totalTaxes);
});

/* -------------------------------------------------------------------------
 * 4. Curva marginale: i gradini devono esistere ed essere dove ce li aspettiamo
 * ---------------------------------------------------------------------- */
test("la curva marginale è ben formata", () => {
  const series = marginalSeries(DEFAULT_INPUT, RAL_MIN, RAL_MAX, 500);
  assert.ok(series.length > 100);
  for (const point of series) {
    assert.ok(point.marginalKept < 1, `marginale ≥ 100% a ${point.gross}`);
    assert.ok(point.marginalKept > -1, `marginale fuori scala a ${point.gross}`);
    assert.ok(point.marginalKeptOnCost < point.marginalKept, `costo azienda incoerente a ${point.gross}`);
  }
});

test("esiste una fascia in cui l'aumento rende meno che nello scaglione al 43%", () => {
  const series = marginalSeries(DEFAULT_INPUT, RAL_MIN, RAL_MAX, 500);
  const top = series[series.length - 1];
  const worst = series.reduce((min, point) => (point.marginalKept < min.marginalKept ? point : min));

  assert.ok(
    worst.marginalKept < top.marginalKept,
    "il phase-out delle detrazioni deve creare un marginale peggiore dello scaglione massimo",
  );
  // Il punto peggiore cade nella fascia media, non in cima alla scala.
  assert.ok(worst.gross < 50000, `punto peggiore atteso sotto i 50.000 €, trovato a ${worst.gross}`);
});

/* -------------------------------------------------------------------------
 * 5. Il registro delle fonti deve restare allineato all'interfaccia
 * ---------------------------------------------------------------------- */
test("ogni fonte dichiara norma e formula", () => {
  const keys = Object.keys(SOURCES);
  assert.ok(keys.length >= 12);
  for (const key of keys) {
    const source = SOURCES[key];
    assert.ok(source.label.length > 0, `${key} senza etichetta`);
    assert.match(source.norm, /\d{4}|TUIR|INPS|Codice civile/, `${key} senza riferimento normativo`);
    assert.ok(source.formula.length > 0, `${key} senza formula`);
    if (source.url) assert.match(source.url, /^https:\/\//, `${key} con url non valido`);
  }
});
