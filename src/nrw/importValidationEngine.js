export function validateImportedReads(rows = []) {
  const issues = [];
  const seenAccountPeriods = new Set();

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    if (!row.account_number) {
      issues.push(issue(rowNumber, 'Missing account number', 'high'));
    }

    if (!row.meter_number) {
      issues.push(issue(rowNumber, 'Missing meter number', 'medium'));
    }

    if (!row.billing_month && !row.period && !row.reading_date && !row.timestamp) {
      issues.push(issue(rowNumber, 'Missing billing month or timestamp', 'high'));
    }

    if (!row.usage_unit) {
      issues.push(issue(rowNumber, 'Missing usage unit', 'medium'));
    }

    if (Number(row.current_read || 0) < Number(row.previous_read || 0)) {
      issues.push(issue(rowNumber, 'Current read is less than previous read', 'high'));
    }

    if (Number(row.multiplier || 1) <= 0) {
      issues.push(issue(rowNumber, 'Invalid meter multiplier', 'high'));
    }

    if (Number(row.register_factor || 1) <= 0) {
      issues.push(issue(rowNumber, 'Invalid register factor', 'high'));
    }

    if (!row.dma_code) {
      issues.push(issue(rowNumber, 'Missing DMA code', 'low'));
    }

    if (Number(row.adjusted_usage || row.usage || 0) === 0) {
      issues.push(issue(rowNumber, 'Zero usage record', 'low'));
    }

    const period =
      row.billing_month ||
      row.period ||
      row.reading_date ||
      row.timestamp ||
      '';

    const duplicateKey =
      `${row.account_number || ''}|${period}`;

    if (row.account_number && period) {
      if (seenAccountPeriods.has(duplicateKey)) {
        issues.push(issue(rowNumber, 'Duplicate account-period record', 'high'));
      }

      seenAccountPeriods.add(duplicateKey);
    }
  });

  const score = calculateQualityScore(rows.length, issues);

  return {
    score,
    readiness: {
      nrw: score >= 70,
      trend: score >= 65,
      dma: score >= 75 && !issues.some((item) => item.message === 'Missing DMA code')
    },
    issues,
    summary: summarizeIssues(issues)
  };
}

export function validateProductionRows(rows = []) {
  const issues = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    if (!row.period) {
      issues.push(issue(rowNumber, 'Missing production period', 'high'));
    }

    if (!row.source_name) {
      issues.push(issue(rowNumber, 'Missing source name', 'medium'));
    }

    if (
      Number(row.production_volume || 0) === 0 &&
      Number(row.purchased_water || 0) === 0
    ) {
      issues.push(issue(rowNumber, 'No production or purchased water volume', 'high'));
    }

    if (Number(row.multiplier || 1) <= 0) {
      issues.push(issue(rowNumber, 'Invalid production multiplier', 'high'));
    }
  });

  const score = calculateQualityScore(rows.length, issues);

  return {
    score,
    readiness: {
      nrw: score >= 70,
      trend: score >= 65,
      dma: false
    },
    issues,
    summary: summarizeIssues(issues)
  };
}

function issue(rowNumber, message, severity = 'medium') {
  return {
    rowNumber,
    message,
    severity
  };
}

function calculateQualityScore(rowCount, issues = []) {
  if (!rowCount) return 0;

  const penalty = issues.reduce((sum, item) => {
    if (item.severity === 'high') return sum + 5;
    if (item.severity === 'medium') return sum + 3;
    return sum + 1;
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

function summarizeIssues(issues = []) {
  return issues.reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.severity] += 1;
      return summary;
    },
    {
      total: 0,
      high: 0,
      medium: 0,
      low: 0
    }
  );
}