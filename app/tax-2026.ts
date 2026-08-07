export type SalaryInput = {
  grossAnnual: number;
  months: number;
  workDays: number;
  employeeContributionRate: number;
  municipalRate: number;
};

export const DEFAULT_INPUT: SalaryInput = {
  grossAnnual: 35000,
  months: 13,
  workDays: 365,
  employeeContributionRate: 9.19,
  municipalRate: 0.8,
};

const RULES = {
  additionalContributionThreshold: 56224,
  additionalContributionRate: 0.01,
  municipalExemption: 23000,
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

function progressiveTax(income: number, brackets: { cap: number; rate: number }[]) {
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

export function calculateSalary(input: SalaryInput) {
  const grossAnnual = Math.max(0, input.grossAnnual);
  const dayRatio = Math.min(1, Math.max(1 / 365, input.workDays / 365));
  const baseContributions = grossAnnual * (input.employeeContributionRate / 100);
  const additionalContribution = Math.max(0, grossAnnual - RULES.additionalContributionThreshold) * RULES.additionalContributionRate;
  const employeeContributions = baseContributions + additionalContribution;
  const taxableIncome = Math.max(0, grossAnnual - employeeContributions);

  const grossIrpef = progressiveTax(taxableIncome, RULES.irpef);
  const employeeDeduction = Math.min(grossIrpef, employeeTaxDeduction(taxableIncome, dayRatio));
  const taxCut = taxCutBenefit(taxableIncome, dayRatio);
  const additionalDeduction = Math.min(Math.max(0, grossIrpef - employeeDeduction), taxCut.deduction);
  const netIrpef = Math.max(0, grossIrpef - employeeDeduction - additionalDeduction);

  const treatmentThreshold = Math.max(0, employeeDeduction - 75 * dayRatio);
  const treatmentCredit = taxableIncome <= 15000 && grossIrpef > treatmentThreshold ? 1200 * dayRatio : 0;
  const regionalTax = progressiveTax(taxableIncome, RULES.regional);
  const municipalTax = taxableIncome <= RULES.municipalExemption ? 0 : taxableIncome * (input.municipalRate / 100);

  const totalTaxes = netIrpef + regionalTax + municipalTax;
  const cashBenefits = taxCut.cashSum + treatmentCredit;
  const netAnnual = grossAnnual - employeeContributions - totalTaxes + cashBenefits;
  const totalWithholdings = employeeContributions + totalTaxes;

  return {
    grossAnnual,
    employeeContributions,
    baseContributions,
    additionalContribution,
    taxableIncome,
    grossIrpef,
    employeeDeduction,
    additionalDeduction,
    netIrpef,
    regionalTax,
    municipalTax,
    taxCutCashSum: taxCut.cashSum,
    treatmentCredit,
    cashBenefits,
    totalTaxes,
    totalWithholdings,
    netAnnual,
    netMonthly: netAnnual / input.months,
  };
}

export function formatCurrency(value: number, decimals = 0) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
