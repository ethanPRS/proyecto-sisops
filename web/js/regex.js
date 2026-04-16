/**
 * regex.js — Regex Data Extraction UI
 *
 * Sends text to the backend for regex extraction and displays
 * categorized results (dates, emails, phones, names, addresses)
 * with category filters and match highlights.
 */

/* ═══════════════════════════════════════════════════════════════════════
   Extract Regex
   ═══════════════════════════════════════════════════════════════════════ */
async function extractRegex() {
  const text = document.getElementById('regex-input').value.trim();
  if (!text) {
    showToast('Ingresa texto para analizar', 'warning');
    return;
  }

  // Get active category filter
  const activeFilter = document.querySelector('.filter-chip.active');
  const filterCat = activeFilter ? activeFilter.dataset.cat : 'all';
  const categories = filterCat === 'all' ? null : [filterCat];

  const btn = document.getElementById('btn-extract');
  btn.disabled = true;
  btn.textContent = '⏳ Extrayendo...';

  try {
    const result = await apiCall('/api/regex/extract', {
      text: text,
      categories: categories,
    });

    displayRegexResults(result);
    showToast(`${result.total_matches} coincidencias encontradas`, 'success');
  } catch (err) {
    // handled by apiCall
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Extraer Datos';
  }
}


/* ═══════════════════════════════════════════════════════════════════════
   Display Results
   ═══════════════════════════════════════════════════════════════════════ */
function displayRegexResults(result) {
  const matches = result.matches || [];

  // Update match count
  document.getElementById('regex-match-count').textContent = `${result.total_matches} matches`;

  // Count by category
  const counts = { date: 0, email: 0, phone: 0, name: 0, address: 0 };
  for (const m of matches) {
    if (counts[m.category] !== undefined) {
      counts[m.category]++;
    }
  }

  document.getElementById('regex-dates').textContent = counts.date;
  document.getElementById('regex-emails').textContent = counts.email;
  document.getElementById('regex-phones').textContent = counts.phone;
  document.getElementById('regex-names').textContent = counts.name;
  document.getElementById('regex-addresses').textContent = counts.address;

  // Render table
  const tbody = document.getElementById('regex-tbody');

  if (matches.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="text-center text-muted" style="padding:var(--space-xl);">
          No se encontraron coincidencias
        </td>
      </tr>
    `;
    return;
  }

  const categoryIcons = {
    date: '📅',
    email: '📧',
    phone: '📞',
    name: '👤',
    address: '🏠',
  };

  tbody.innerHTML = matches.map((m, i) => `
    <tr style="animation: fadeSlideIn 0.3s ease ${i * 0.03}s both;">
      <td>
        <span class="badge badge-${getCategoryBadgeClass(m.category)}">
          ${categoryIcons[m.category] || '📎'} ${m.category}
        </span>
      </td>
      <td>
        <span class="match-highlight ${m.category}">${escapeHtml(m.value)}</span>
      </td>
      <td class="text-mono text-muted">${m.line_number}</td>
    </tr>
  `).join('');
}

function getCategoryBadgeClass(category) {
  const map = {
    date: 'purple',
    email: 'pink',
    phone: 'purple',
    name: 'success',
    address: 'warning',
  };
  return map[category] || 'purple';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


/* ═══════════════════════════════════════════════════════════════════════
   Sample Text Loader
   ═══════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Load sample text if textarea is empty
  const textarea = document.getElementById('regex-input');
  if (!textarea.value.trim()) {
    textarea.value = `Juan Pérez nació el 15/03/1990 en Monterrey.
Su correo es juan.perez@company.com y su teléfono es +52 (81) 1234-5678.
Vive en 456 Avenida Col. Del Valle, Monterrey.

María García contactó el 2024-01-20.
Email: maria.garcia@email.org
Teléfono: (81) 9876-5432
Dirección: 789 Calle Hidalgo Col. Centro

La reunión fue programada para January 15, 2025.
Enviar documentos a docs@universidad.edu
Contacto alternativo: +1 555-123-4567

Roberto Martínez trabaja en 100 Main St, Suite 200.
Su información: roberto@tech.io, 15/06/1985.`;
  }

  // Filter chips re-extract on click
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      // If there's text, re-extract with new filter
      const text = document.getElementById('regex-input').value.trim();
      if (text) {
        setTimeout(extractRegex, 100);
      }
    });
  });
});

window.extractRegex = extractRegex;
