const GAL_PER_CCF = 748;

export function calculateBill({ usageCcf = 0, profile }) {
  if (!profile) {
    throw new Error('Billing profile is required.');
  }

  const usage = numberOrZero(usageCcf);
  const mode = profile.billing_mode || 'tiered';

  const waterVariableCharge = calculateWaterCharge(usage, profile);
  const fixedWaterCharge = getFixedWaterCharge(profile, mode);

  const waterCharge = fixedWaterCharge + waterVariableCharge;

  const sewerCharge =
    numberOrZero(profile.sewer_fixed_charge) +
    usage * numberOrZero(profile.sewer_volumetric_rate);

  const subtotalBeforeMinimum = waterCharge + sewerCharge;

  const minimumBill = numberOrZero(profile.minimum_bill);
  const subtotal = Math.max(subtotalBeforeMinimum, minimumBill);

  const tax = subtotal * (numberOrZero(profile.utility_tax_percent) / 100);
  const total = subtotal + tax;

  return {
    usage_ccf: roundMoney(usage),
    usage_gal: Math.round(usage * GAL_PER_CCF),
    water_charge: roundMoney(waterCharge),
    sewer_charge: roundMoney(sewerCharge),
    taxes: roundMoney(tax),
    total_due: roundMoney(total),
    billing_mode: mode
  };
}

function calculateWaterCharge(usage, profile) {
  const mode = profile.billing_mode || 'tiered';

  if (mode === 'flat') {
    return 0;
  }

  if (mode === 'uniform') {
    return usage * numberOrZero(profile.usage_rate || profile.water_rate);
  }

  if (mode === 'tiered' || mode === 'decreasing_block') {
    return calculateTieredCharge(usage, profile.tiers || []);
  }

  if (mode === 'base_plus_usage') {
    return usage * numberOrZero(profile.usage_rate || profile.water_rate);
  }

  if (mode === 'minimum_bill') {
    return usage * numberOrZero(profile.usage_rate || profile.water_rate);
  }

  if (mode === 'seasonal') {
    const season = profile.season || 'winter';
    const rate =
      season === 'summer'
        ? numberOrZero(profile.summer_rate)
        : numberOrZero(profile.winter_rate);

    return usage * rate;
  }

  if (mode === 'drought_surcharge') {
    const baseCharge = usage * numberOrZero(profile.usage_rate || profile.water_rate);
    const threshold = numberOrZero(profile.surcharge_threshold_ccf);
    const excessUsage = Math.max(usage - threshold, 0);
    const surcharge = excessUsage * numberOrZero(profile.surcharge_rate);

    return baseCharge + surcharge;
  }

  if (mode === 'budget_rate') {
    const budget = numberOrZero(profile.monthly_budget_ccf);
    const insideUsage = Math.min(usage, budget);
    const excessUsage = Math.max(usage - budget, 0);

    return (
      insideUsage * numberOrZero(profile.inside_budget_rate) +
      excessUsage * numberOrZero(profile.excess_budget_rate)
    );
  }

  if (mode === 'ny_style') {
    return usage * numberOrZero(profile.usage_rate || profile.water_rate);
  }

  return usage * numberOrZero(profile.water_rate || profile.usage_rate);
}

function getFixedWaterCharge(profile, mode) {
  if (mode === 'flat') {
    return numberOrZero(profile.fixed_water_charge || profile.flat_rate);
  }

  if (mode === 'base_plus_usage') {
    return numberOrZero(profile.fixed_water_charge);
  }

  if (mode === 'ny_style') {
    return (
      numberOrZero(profile.fixed_service_charge) +
      numberOrZero(profile.frontage_charge)
    );
  }

  return numberOrZero(profile.fixed_water_charge);
}

function calculateTieredCharge(usageCcf, tiers = []) {
  const usage = numberOrZero(usageCcf);
  let charge = 0;

  tiers.forEach((tier) => {
    const from = numberOrZero(tier.from);
    const to =
      tier.to === null || tier.to === undefined || tier.to === ''
        ? Infinity
        : numberOrZero(tier.to);

    const rate = numberOrZero(tier.rate);
    const billableUsage = Math.max(Math.min(usage, to) - from, 0);

    charge += billableUsage * rate;
  });

  return charge;
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 100) / 100;
}