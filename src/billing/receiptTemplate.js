export function buildReceiptHtml({ utility, receipt }) {
  const customer = receipt.customers || {};

  return `
    <div>
      <h1>${safe(utility.name)}</h1>
      <p>${safe(utility.address || '')}</p>
      <p>${safe(utility.phone || '')} ${safe(utility.billing_email || '')}</p>

      <hr />

      <h2>Water Utility Billing Receipt</h2>

      <p><strong>Receipt #:</strong> ${safe(receipt.receipt_number)}</p>
      <p><strong>Billing Month:</strong> ${safe(receipt.billing_month)}</p>
      <p><strong>Issue Date:</strong> ${safe(receipt.issue_date)}</p>
      <p><strong>Due Date:</strong> ${safe(receipt.due_date)}</p>

      <h3>Customer</h3>
      <p><strong>Account:</strong> ${safe(customer.account_number)}</p>
      <p><strong>Name:</strong> ${safe(customer.customer_name)}</p>
      <p><strong>Address:</strong> ${safe(customer.service_address)}</p>

      <h3>Meter Reading</h3>
      <p><strong>Previous Read:</strong> ${safe(receipt.previous_read)}</p>
      <p><strong>Current Read:</strong> ${safe(receipt.current_read)}</p>
      <p><strong>Usage:</strong> ${safe(receipt.usage_ccf)} CCF / ${safe(receipt.usage_gal)} gal</p>

      <h3>Charges</h3>
      <p><strong>Water:</strong> ${money(receipt.water_charge)}</p>
      <p><strong>Sewer:</strong> ${money(receipt.sewer_charge)}</p>
      <p><strong>Fees:</strong> ${money(receipt.fees)}</p>
      <p><strong>Adjustments:</strong> ${money(receipt.adjustments)}</p>
      <p><strong>Taxes:</strong> ${money(receipt.taxes)}</p>

      <h2>Total Due: ${money(receipt.total_due)}</h2>
    </div>
  `;
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}