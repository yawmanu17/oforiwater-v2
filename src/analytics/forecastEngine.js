export function forecastUsage(history = []) {
  const values = history
    .map(Number)
    .filter(Number.isFinite);

  if (!values.length) {
    return {
      forecast: 0,
      trend: 'No Data'
    };
  }

  if (values.length < 3) {
    return {
      forecast: values[values.length - 1],
      trend: 'Insufficient History'
    };
  }

  const recent = values.slice(-3);

  const forecast =
    recent.reduce((a, b) => a + b, 0) /
    recent.length;

  const first = recent[0];
  const last = recent[recent.length - 1];

  let trend = 'Stable';

  if (last > first * 1.1) trend = 'Increasing';
  if (last < first * 0.9) trend = 'Decreasing';

  return {
    forecast,
    trend
  };
}