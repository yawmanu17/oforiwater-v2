export function validateMeterRead({
  previous = 0,
  current = 0,
  usageCcf = 0,
  selectedCustomer = {},
  exceptionCode = '',
  capturedGps = null,
  photoUrl = null,
  readType = 'actual'
} = {}) {
  const issues = [];

  if (current < previous && !exceptionCode) {
    issues.push(issue(
      'REVERSE_READ',
      'Current reading is less than previous reading.',
      'high'
    ));
  }

  if (usageCcf === 0 && !exceptionCode) {
    issues.push(issue(
      'ZERO_USAGE',
      'Usage is zero with no exception code.',
      'medium'
    ));
  }

  if (usageCcf > 100 && selectedCustomer.customer_class === 'Residential') {
    issues.push(issue(
      'HIGH_USAGE',
      'Residential usage is unusually high. Verify reading or possible leak.',
      'high'
    ));
  }

  if (usageCcf > 500 && selectedCustomer.customer_class === 'Commercial') {
    issues.push(issue(
      'HIGH_COMMERCIAL_USAGE',
      'Commercial usage is unusually high. Verify reading.',
      'medium'
    ));
  }

  if (!capturedGps && !selectedCustomer.meter_lat && !selectedCustomer.service_lat) {
    issues.push(issue(
      'MISSING_GPS',
      'No GPS captured and customer does not have saved coordinates.',
      'low'
    ));
  }

  if (exceptionCode && !photoUrl) {
    issues.push(issue(
      'PHOTO_RECOMMENDED',
      'Exception reads should include a photo when possible.',
      'medium'
    ));
  }

  if (readType === 'estimated' && !exceptionCode) {
    issues.push(issue(
      'ESTIMATED_WITHOUT_REASON',
      'Estimated read should include an exception or note.',
      'low'
    ));
  }

  return {
    isBlocked: issues.some((item) => item.severity === 'high'),
    issues
  };
}

function issue(code, message, severity) {
  return {
    code,
    message,
    severity
  };
}