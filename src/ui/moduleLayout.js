export function modulePage({ header = '', kpis = '', body = '' }) {
  return `
    <section class="module-page">
      ${header}
      ${kpis}
      ${body}
    </section>
  `;
}

export function moduleToolbar({ eyebrow = '', title = '', description = '', actions = '' }) {
  return `
    <div class="module-toolbar">
      <div class="module-title-block">
        ${eyebrow ? `<div class="module-eyebrow">${safe(eyebrow)}</div>` : ''}
        <h2>${safe(title)}</h2>
        ${description ? `<p>${safe(description)}</p>` : ''}
      </div>

      ${actions ? `<div class="module-actions">${actions}</div>` : ''}
    </div>
  `;
}

export function modulePanel({ title = '', subtitle = '', body = '', className = '' }) {
  return `
    <section class="module-panel ${className}">
      ${
        title || subtitle
          ? `
            <div class="module-panel-header">
              <div>
                ${title ? `<h3 class="module-panel-title">${safe(title)}</h3>` : ''}
                ${subtitle ? `<p class="module-panel-subtitle">${safe(subtitle)}</p>` : ''}
              </div>
            </div>
          `
          : ''
      }

      ${body}
    </section>
  `;
}

export function moduleKpis(items = []) {
  return `
    <div class="module-kpis">
      ${items.map((item) => `
        <div class="kpi-card">
          <div class="kpi-label">${safe(item.label)}</div>
          <div class="kpi-value">${safe(item.value)}</div>
          ${item.note ? `<div class="kpi-note">${safe(item.note)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

export function emptyState(message) {
  return `<div class="module-empty">${safe(message)}</div>`;
}

export function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}