/**
 * Motore di calcolo RAL -> netto, anno d'imposta 2026.
 *
 * Caso modellato: impiegato del settore privato, tempo indeterminato, full time,
 * residenza fiscale a Milano, unico reddito, nessun familiare a carico.
 *
 * Il modulo non contiene nulla di grafico: espone i numeri e la fonte normativa
 * di ogni voce, così che l'interfaccia possa mostrarli senza duplicare costanti.
 */

export type SalaryInput = {
  /** Retribuzione annua lorda (imponibile previdenziale). */
  grossAnnual: number;
  /** Mensilità contrattuali: 12, 13 o 14. Le eccedenti la 12ª sono le "aggiuntive". */
  months: number;
  /** Giorni di calendario coperti dal rapporto di lavoro nell'anno. */
  workDays: number;
  /** Aliquota contributiva IVS a carico del dipendente. */
  employeeContributionRate: number;
  /** Aliquota addizionale comunale del comune di residenza. */
  municipalRate: number;
  /** Aliquota contributiva complessiva a carico del datore. */
  employerContributionRate: number;
  /** Tasso INAIL applicato alla posizione assicurativa. */
  inailRate: number;
};

export const DEFAULT_INPUT: SalaryInput = {
  grossAnnual: 35000,
  months: 13,
  workDays: 365,
  employeeContributionRate: 9.19,
  municipalRate: 0.8,
  employerContributionRate: 29.4,
  inailRate: 0.5,
};

export const RAL_MIN = 15000;
export const RAL_MAX = 100000;

const RULES = {
  /** Oltre la prima fascia di retribuzione pensionabile scatta l'1% aggiuntivo. */
  additionalContributionThreshold: 56224,
  additionalContributionRate: 0.01,
  /** Milano esenta l'addizionale comunale sotto questa soglia di imponibile. */
  municipalExemption: 23000,
  /** Divisore convenzionale della quota TFR annua (retribuzione / 13,5). */
  tfrDivisor: 13.5,
  irpef: [
    { cap: 28000, rate: 0.23 },
    { cap: 50000, rate: 0.33 },
    { cap: Number.POSITIVE_INFINITY, rate: 0.43 },
  ],
  regional: [
    { cap: 15000, rate: 0.0123 },
    { cap: 28000, rate: 0.0158 },
    { cap: 50000, rate: 0.0172 },
    { cap: Number.POSITIVE_INFINITY, rate: 0.0173 },
  ],
};

/**
 * Registro delle fonti: ogni voce del risultato punta alla norma che la produce.
 * L'interfaccia legge da qui, così la fonte non può divergere dal calcolo.
 */
export type Source = {
  /** Etichetta breve mostrata accanto alla voce. */
  label: string;
  /** Riferimento normativo puntuale. */
  norm: string;
  /** Formula effettivamente applicata dal motore. */
  formula: string;
  url?: string;
};

export const SOURCES = {
  employeeContributions: {
    label: "Contributi IVS dipendente",
    norm: "L. 335/1995 art. 3-ter · aliquote FPLD, circolare INPS annuale",
    formula: "RAL × 9,19% + 1% sulla quota oltre 56.224 €",
    url: "https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html",
  },
  taxableIncome: {
    label: "Imponibile fiscale",
    norm: "TUIR art. 51 c. 2 lett. a — i contributi obbligatori non concorrono al reddito",
    formula: "RAL − contributi a carico del dipendente",
  },
  grossIrpef: {
    label: "IRPEF lorda",
    norm: "TUIR art. 11, scaglioni come rideterminati dalla Legge di Bilancio 2026",
    formula: "23% fino a 28.000 € · 33% da 28.000 a 50.000 € · 43% oltre",
    url: "https://www.lavoro.gov.it/notizie/pagine/legge-di-bilancio-2026-le-principali-misure-lavoratori-imprese-e-famiglie",
  },
  employeeDeduction: {
    label: "Detrazione da lavoro dipendente",
    norm: "TUIR art. 13 c. 1, importi vigenti dal 2025",
    formula: "1.955 € fino a 15.000 € · decalage fino a 50.000 € · +65 € tra 25.000 e 35.000 €, rapportata ai giorni",
  },
  additionalDeduction: {
    label: "Ulteriore detrazione (ex taglio del cuneo)",
    norm: "L. 207/2024 art. 1 cc. 6-9",
    formula: "1.000 € da 20.000 a 32.000 € di reddito, azzerata linearmente fino a 40.000 €",
  },
  taxCutCashSum: {
    label: "Somma integrativa in busta",
    norm: "L. 207/2024 art. 1 cc. 4-5 — somma non imponibile",
    formula: "7,1% / 5,3% / 4,8% del reddito da lavoro dipendente fino a 20.000 €",
  },
  treatmentCredit: {
    label: "Trattamento integrativo",
    norm: "D.L. 3/2020 art. 1, come modificato dalla L. 234/2021",
    formula: "1.200 € se il reddito è ≤ 15.000 € e l'IRPEF lorda supera la detrazione ridotta di 75 €",
  },
  regionalTax: {
    label: "Addizionale regionale Lombardia",
    norm: "D.Lgs. 446/1997 art. 50 · legge regionale Lombardia, scaglioni progressivi",
    formula: "1,23% · 1,58% · 1,72% · 1,73% per scaglioni sull'imponibile",
    url: "https://www.regione.lombardia.it/bollo-auto-e-tributi-regionali/red-addizionale-regionale-irpef",
  },
  municipalTax: {
    label: "Addizionale comunale Milano",
    norm: "D.Lgs. 360/1998 · delibera del Comune di Milano",
    formula: "0,8% sull'intero imponibile, esente se l'imponibile è ≤ 23.000 €",
    url: "https://www.comune.milano.it/aree-tematiche/tributi/addizionale-comunale-irpef",
  },
  employerContributions: {
    label: "Contributi a carico del datore",
    norm: "Aliquote INPS per aziende del terziario, gestione FPLD",
    formula: "RAL × 29,4% (IVS, ASpI, malattia, maternità, CUAF, fondi minori)",
  },
  inail: {
    label: "Premio INAIL",
    norm: "D.P.R. 1124/1965 · tariffa dei premi, voce impiegati amministrativi",
    formula: "RAL × 0,5% (tasso medio d'ufficio, interamente a carico del datore)",
  },
  tfr: {
    label: "Quota TFR maturata",
    norm: "Codice civile art. 2120",
    formula: "RAL ÷ 13,5 accantonata ogni anno, erogata alla cessazione",
  },
  extraMonth: {
    label: "Mensilità aggiuntive",
    norm: "TUIR art. 13 c. 1 e D.Lgs. 360/1998 — prassi di conguaglio",
    formula: "Tassata come scaglione più alto dell'anno, senza detrazioni e senza addizionali",
  },
} as const satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;

type Bracket = { cap: number; rate: number };

/** Imposta progressiva per scaglioni: ogni fetta di reddito paga la propria aliquota. */
function progressiveTax(income: number, brackets: Bracket[]) {
  let total = 0;
  let previous = 0;
  for (const bracket of brackets) {
    const taxableSlice = Math.max(0, Math.min(income, bracket.cap) - previous);
    total += taxableSlice * bracket.rate;
    if (income <= bracket.cap) break;
    previous = bracket.cap;
  }
  return total;
}

function employeeTaxDeduction(income: number, dayRatio: number) {
  let deduction = 0;
  if (income <= 15000) deduction = 1955;
  else if (income <= 28000) deduction = 1910 + 1190 * ((28000 - income) / 13000);
  else if (income <= 50000) deduction = 1910 * ((50000 - income) / 22000);
  if (income > 25000 && income <= 35000) deduction += 65;
  return Math.max(0, deduction * dayRatio);
}

function taxCutBenefit(income: number, dayRatio: number) {
  if (income <= 20000) {
    const annualizedIncome = income / Math.max(dayRatio, 1 / 365);
    const rate = annualizedIncome <= 8500 ? 0.071 : annualizedIncome <= 15000 ? 0.053 : 0.048;
    return { cashSum: income * rate, deduction: 0 };
  }
  if (income <= 32000) return { cashSum: 0, deduction: 1000 * dayRatio };
  if (income < 40000) return { cashSum: 0, deduction: 1000 * ((40000 - income) / 8000) * dayRatio };
  return { cashSum: 0, deduction: 0 };
}

export type PayrollMonth = {
  /** Lordo della singola mensilità. */
  gross: number;
  contributions: number;
  irpef: number;
  localTaxes: number;
  benefits: number;
  net: number;
};

export type SalaryResult = ReturnType<typeof calculateSalary>;

export function calculateSalary(input: SalaryInput) {
  const grossAnnual = Math.max(0, input.grossAnnual);
  const months = Math.max(12, Math.round(input.months));
  const dayRatio = Math.min(1, Math.max(1 / 365, input.workDays / 365));

  // --- Previdenza a carico del dipendente -----------------------------------
  const baseContributions = grossAnnual * (input.employeeContributionRate / 100);
  const additionalContribution =
    Math.max(0, grossAnnual - RULES.additionalContributionThreshold) * RULES.additionalContributionRate;
  const employeeContributions = baseContributions + additionalContribution;
  const taxableIncome = Math.max(0, grossAnnual - employeeContributions);

  // --- IRPEF e detrazioni ----------------------------------------------------
  const grossIrpef = progressiveTax(taxableIncome, RULES.irpef);
  const employeeDeduction = Math.min(grossIrpef, employeeTaxDeduction(taxableIncome, dayRatio));
  const taxCut = taxCutBenefit(taxableIncome, dayRatio);
  const additionalDeduction = Math.min(Math.max(0, grossIrpef - employeeDeduction), taxCut.deduction);
  const totalDeductions = employeeDeduction + additionalDeduction;
  const netIrpef = Math.max(0, grossIrpef - totalDeductions);

  const treatmentThreshold = Math.max(0, employeeDeduction - 75 * dayRatio);
  const treatmentCredit = taxableIncome <= 15000 && grossIrpef > treatmentThreshold ? 1200 * dayRatio : 0;

  // --- Addizionali locali ----------------------------------------------------
  const regionalTax = progressiveTax(taxableIncome, RULES.regional);
  const municipalTax = taxableIncome <= RULES.municipalExemption ? 0 : taxableIncome * (input.municipalRate / 100);
  const localTaxes = regionalTax + municipalTax;

  const totalTaxes = netIrpef + localTaxes;
  const cashBenefits = taxCut.cashSum + treatmentCredit;
  const netAnnual = grossAnnual - employeeContributions - totalTaxes + cashBenefits;
  const totalWithholdings = employeeContributions + totalTaxes;

  // --- Costo per l'azienda ---------------------------------------------------
  const employerContributions = grossAnnual * (input.employerContributionRate / 100);
  const inail = grossAnnual * (input.inailRate / 100);
  const tfr = grossAnnual / RULES.tfrDivisor;
  const employerCost = grossAnnual + employerContributions + inail + tfr;

  // --- Distribuzione sui cedolini -------------------------------------------
  // Le mensilità aggiuntive sono l'ultima fetta di reddito dell'anno: pagano
  // l'aliquota marginale, non ricevono detrazioni e non subiscono addizionali,
  // che il sostituto trattiene sulle sole mensilità ordinarie.
  const extraMonths = months - 12;
  const extraShare = extraMonths / months;

  const extraGrossTotal = grossAnnual * extraShare;
  const extraTaxableTotal = taxableIncome * extraShare;
  const extraContributions = employeeContributions * extraShare;

  const extraGrossIrpef = grossIrpef - progressiveTax(Math.max(0, taxableIncome - extraTaxableTotal), RULES.irpef);
  const ordinaryGrossIrpef = grossIrpef - extraGrossIrpef;

  // Le detrazioni si consumano prima sulle mensilità ordinarie; l'eventuale
  // eccedenza scala l'IRPEF delle aggiuntive, così la somma resta pari al netto annuo.
  const ordinaryDeductions = Math.min(totalDeductions, ordinaryGrossIrpef);
  const extraDeductions = totalDeductions - ordinaryDeductions;

  const ordinaryIrpef = ordinaryGrossIrpef - ordinaryDeductions;
  const extraIrpef = Math.max(0, extraGrossIrpef - extraDeductions);

  const ordinaryGross = grossAnnual - extraGrossTotal;
  const ordinaryContributions = employeeContributions - extraContributions;
  const ordinaryNetTotal = ordinaryGross - ordinaryContributions - ordinaryIrpef - localTaxes + cashBenefits;
  const extraNetTotal = extraGrossTotal - extraContributions - extraIrpef;

  const ordinaryMonth: PayrollMonth = {
    gross: ordinaryGross / 12,
    contributions: ordinaryContributions / 12,
    irpef: ordinaryIrpef / 12,
    localTaxes: localTaxes / 12,
    benefits: cashBenefits / 12,
    net: ordinaryNetTotal / 12,
  };

  const extraMonth: PayrollMonth | null = extraMonths > 0
    ? {
        gross: extraGrossTotal / extraMonths,
        contributions: extraContributions / extraMonths,
        irpef: extraIrpef / extraMonths,
        localTaxes: 0,
        benefits: 0,
        net: extraNetTotal / extraMonths,
      }
    : null;

  return {
    grossAnnual,
    months,
    extraMonths,

    baseContributions,
    additionalContribution,
    employeeContributions,
    taxableIncome,

    grossIrpef,
    employeeDeduction,
    additionalDeduction,
    totalDeductions,
    netIrpef,

    regionalTax,
    municipalTax,
    localTaxes,

    taxCutCashSum: taxCut.cashSum,
    treatmentCredit,
    cashBenefits,

    totalTaxes,
    totalWithholdings,
    netAnnual,
    /** Media aritmetica: utile per confronti, non è quanto arriva davvero ogni mese. */
    netMonthlyAverage: netAnnual / months,

    ordinaryMonth,
    extraMonth,

    employerContributions,
    inail,
    tfr,
    employerCost,
    /** Quanto costa un euro di netto in mano al dipendente. */
    costPerNetEuro: netAnnual > 0 ? employerCost / netAnnual : 0,
    /** Quota del costo aziendale che arriva in tasca al dipendente. */
    netOnEmployerCost: employerCost > 0 ? netAnnual / employerCost : 0,
    netOnGross: grossAnnual > 0 ? netAnnual / grossAnnual : 0,
  };
}

export type MarginalPoint = {
  gross: number;
  net: number;
  employerCost: number;
  /** Quota di ogni euro lordo aggiuntivo che finisce nel netto. */
  marginalKept: number;
  /** Quota di ogni euro di costo aziendale aggiuntivo che finisce nel netto. */
  marginalKeptOnCost: number;
};

/**
 * Curva dell'aliquota marginale effettiva: quanto rende davvero l'aumento
 * successivo. Rende visibili i gradini creati da soglie e phase-out.
 */
export function marginalSeries(
  base: SalaryInput,
  from = RAL_MIN,
  to = RAL_MAX,
  step = 500,
): MarginalPoint[] {
  const points: MarginalPoint[] = [];
  for (let gross = from; gross <= to; gross += step) {
    const current = calculateSalary({ ...base, grossAnnual: gross });
    const previous = calculateSalary({ ...base, grossAnnual: gross - step });
    points.push({
      gross,
      net: current.netAnnual,
      employerCost: current.employerCost,
      marginalKept: (current.netAnnual - previous.netAnnual) / step,
      marginalKeptOnCost:
        (current.netAnnual - previous.netAnnual) / (current.employerCost - previous.employerCost),
    });
  }
  return points;
}

export function formatCurrency(value: number, decimals = 0) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    // Senza questo Intl adotta il raggruppamento "min2" e scrive 8968 € accanto
    // a 48.058 €: in una tabella di importi la separazione deve essere costante.
    useGrouping: true,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1) {
  return `${(value * 100).toFixed(decimals).replace(".", ",")}%`;
}
