export const GAL_PER_CCF = 748;

export function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function ccfToGallons(ccf) {
  return numberOrZero(ccf) * GAL_PER_CCF;
}

export function gallonsToCcf(gallons) {
  return numberOrZero(gallons) / GAL_PER_CCF;
}

export function calculateUsage({ previousRead = 0, currentRead = 0, unit = 'CCF' }) {
  const previous = numberOrZero(previousRead);
  const current = numberOrZero(currentRead);
  const rawUsage = Math.max(current - previous, 0);

  const usageCcf =
    unit === 'Gallons' || unit === 'GAL'
      ? gallonsToCcf(rawUsage)
      : unit === 'kGal'
        ? gallonsToCcf(rawUsage * 1000)
        : rawUsage;

  const usageGal =
    unit === 'Gallons' || unit === 'GAL'
      ? rawUsage
      : unit === 'kGal'
        ? rawUsage * 1000
        : ccfToGallons(rawUsage);

  return {
    rawUsage,
    usageCcf,
    usageGal
  };
}

export function formatUsage({ usageCcf = 0, usageGal = 0 }) {
  return `${numberOrZero(usageCcf).toFixed(2)} CCF / ${Math.round(numberOrZero(usageGal)).toLocaleString()} gal`;
}

export function calculateTieredCharge(usageCcf, tiers = []) {
  const usage = numberOrZero(usageCcf);
  let total = 0;

  tiers.forEach((tier) => {
    const from = numberOrZero(tier.from);
    const to =
      tier.to === null || tier.to === undefined || tier.to === ''
        ? Infinity
        : numberOrZero(tier.to);

    const rate = numberOrZero(tier.rate);
    const billable = Math.max(Math.min(usage, to) - from, 0);

    total += billable * rate;
  });

  return total;
}

export function calculateNrw({
  masterFlowGal = 0,
  billedUsageGal = 0,
  authorizedUnbilledGal = 0,
  knownLossesGal = 0
}) {
  const input = numberOrZero(masterFlowGal);

  const authorized =
    numberOrZero(billedUsageGal) +
    numberOrZero(authorizedUnbilledGal) +
    numberOrZero(knownLossesGal);

  const nrwGal = Math.max(input - authorized, 0);
  const nrwPercent = input > 0 ? (nrwGal / input) * 100 : 0;

  return {
    masterFlowGal: input,
    authorizedGal: authorized,
    nrwGal,
    nrwPercent
  };
}

export function getNrwStatus(percent) {
  const value = numberOrZero(percent);

  if (value >= 30) return 'High Loss';
  if (value >= 15) return 'Moderate Loss';

  return 'Healthy';
}

export function getNrwStatusClass(percent) {
  const value = numberOrZero(percent);

  if (value >= 30) return 'status-bad';
  if (value >= 15) return 'status-warn';

  return 'status-ok';
}

export function formatGallons(value) {
  return `${Math.round(numberOrZero(value)).toLocaleString()} gal`;
}

export function formatPercent(value) {
  return `${numberOrZero(value).toFixed(2)}%`;
}

export function getUsageException({ previousRead = 0, currentRead = 0 }) {
  const previous = numberOrZero(previousRead);
  const current = numberOrZero(currentRead);
  const usage = current - previous;

  if (!current) return '';
  if (usage < 0) return 'Negative Usage';
  if (usage === 0) return 'Zero Usage';
  if (usage > 100) return 'High Usage';

  return '';
}