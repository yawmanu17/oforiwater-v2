import jsPDF from 'jspdf';

export function downloadReceiptPdf({ utility, receipt }) {
  const customer = receipt.customers || {};
  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const primaryRgb = hexToRgb(utility?.primary_color || '#0e7490');

  let y = 16;

  doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.rect(0, 0, pageWidth, 30, 'F');

  let textStartX = margin;

  if (utility?.logo_url) {
    try {
      doc.addImage(utility.logo_url, 'PNG', margin, 6, 18, 18);
      textStartX = margin + 24;
    } catch (error) {
      console.warn('Logo could not be added to PDF:', error.message);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text(utility?.name || 'Water Utility', textStartX, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${utility?.address || ''}`, textStartX, y);

  y += 5;
  doc.text(
    `Phone: ${utility?.phone || 'N/A'}  |  Email: ${utility?.billing_email || 'N/A'}`,
    textStartX,
    y
  );

  y = 42;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Water Utility Billing Receipt', margin, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt #: ${safe(receipt.receipt_number)}`, 125, y);
  y += 7;
  doc.text(`Billing Month: ${safe(receipt.billing_month)}`, 125, y);
  y += 7;
  doc.text(`Issue Date: ${safe(receipt.issue_date)}`, 125, y);
  y += 7;
  doc.text(`Due Date: ${safe(receipt.due_date)}`, 125, y);

  y = 62;
  sectionTitle(doc, 'Customer Information', margin, y);
  y += 7;

  infoBox(doc, margin, y, pageWidth - margin * 2, 30);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Account: ${safe(customer.account_number)}`, margin + 4, y);
  y += 6;
  doc.text(`Name: ${safe(customer.customer_name)}`, margin + 4, y);
  y += 6;
  doc.text(`Class: ${safe(customer.customer_class || '—')}`, margin + 4, y);
  y += 6;
  doc.text(`Service Address: ${safe(customer.service_address)}`, margin + 4, y);

  y += 14;
  sectionTitle(doc, 'Meter Reading Summary', margin, y);
  y += 7;

  infoBox(doc, margin, y, pageWidth - margin * 2, 28);
  y += 7;

  twoColumnText(
    doc,
    margin + 4,
    y,
    'Previous Read',
    formatNumber(receipt.previous_read),
    'Current Read',
    formatNumber(receipt.current_read)
  );

  y += 7;

  twoColumnText(
    doc,
    margin + 4,
    y,
    'Usage CCF',
    `${formatNumber(receipt.usage_ccf)} CCF`,
    'Usage Gallons',
    `${formatNumber(receipt.usage_gal)} gal`
  );

  y += 16;
  sectionTitle(doc, 'Charge Breakdown', margin, y);
  y += 7;

  const rows = [
    ['Water Charge', money(receipt.water_charge)],
    ['Sewer Charge', money(receipt.sewer_charge)],
    ['Fees', money(receipt.fees)],
    ['Adjustments', money(receipt.adjustments)],
    ['Taxes', money(receipt.taxes)]
  ];

  chargeTable(doc, margin, y, pageWidth - margin * 2, rows);
  y += 44;

  doc.setFillColor(240, 253, 255);
  doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 4, 4, 'FD');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.text('TOTAL DUE', margin + 4, y + 12);

  doc.setFontSize(16);
  doc.text(money(receipt.total_due), pageWidth - margin - 4, y + 12, {
    align: 'right'
  });

  y += 28;

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Please remit payment by the due date. Contact the utility billing office for questions about this receipt.',
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 }
  );

  doc.save(`${receipt.receipt_number || 'receipt'}.pdf`);
}

function sectionTitle(doc, title, x, y) {
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x, y);
}

function infoBox(doc, x, y, width, height) {
  doc.setFillColor(251, 253, 254);
  doc.setDrawColor(219, 234, 254);
  doc.roundedRect(x, y, width, height, 4, 4, 'FD');
}

function twoColumnText(doc, x, y, leftLabel, leftValue, rightLabel, rightValue) {
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(leftLabel.toUpperCase(), x, y);
  doc.text(rightLabel.toUpperCase(), 112, y);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(String(leftValue || '0'), x, y + 5);
  doc.text(String(rightValue || '0'), 112, y + 5);
}

function chargeTable(doc, x, y, width, rows) {
  const rowHeight = 7;
  const tableHeight = rows.length * rowHeight + 8;

  doc.setDrawColor(219, 234, 254);
  doc.setFillColor(251, 253, 254);
  doc.roundedRect(x, y, width, tableHeight, 4, 4, 'FD');

  let currentY = y + 8;

  rows.forEach(([label, value]) => {
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 4, currentY);

    doc.setFont('helvetica', 'bold');
    doc.text(value, x + width - 4, currentY, {
      align: 'right'
    });

    currentY += rowHeight;
  });
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });
}

function safe(value) {
  return String(value ?? '');
}

function hexToRgb(hex) {
  const clean = String(hex || '#0e7490').replace('#', '');

  const value =
    clean.length === 3
      ? clean.split('').map((char) => char + char).join('')
      : clean;

  const num = parseInt(value, 16);

  if (Number.isNaN(num)) {
    return { r: 14, g: 116, b: 144 };
  }

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}