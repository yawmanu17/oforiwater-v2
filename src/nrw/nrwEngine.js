export function calculateNrw({
  productionMgd = 0,
  daysInPeriod = 30,
  billedConsumptionGal = 0,
  unbilledAuthorizedGal = 0,
  knownLossesGal = 0,
  revenue = 0,
  energyKwh = 0,
  energyCost = 0
}) {
  const systemInputGal = Number(productionMgd || 0) * 1_000_000 * Number(daysInPeriod || 30);

  const authorizedConsumptionGal =
    Number(billedConsumptionGal || 0) +
    Number(unbilledAuthorizedGal || 0);

  const nrwGal =
    systemInputGal -
    authorizedConsumptionGal -
    Number(knownLossesGal || 0);

  const nrwPercent =
    systemInputGal > 0 ? (nrwGal / systemInputGal) * 100 : 0;

  return {
    production_mgd: round(productionMgd),
    days_in_period: Number(daysInPeriod || 30),
    system_input_gal: round(systemInputGal),
    billed_consumption_gal: round(billedConsumptionGal),
    unbilled_authorized_gal: round(unbilledAuthorizedGal),
    known_losses_gal: round(knownLossesGal),
    authorized_consumption_gal: round(authorizedConsumptionGal),
    nrw_gal: round(nrwGal),
    nrw_percent: round(nrwPercent),
    revenue: round(revenue),
    energy_kwh: round(energyKwh),
    energy_cost: round(energyCost)
  };
}

function round(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}