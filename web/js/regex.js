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

    await displayRegexResults(result, text);
    showToast(`${result.total_matches} coincidencias encontradas. Click en el texto para editar.`, 'success');
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
async function displayRegexResults(result, rawText) {
  const matches = result.matches || [];

  // Reset counters
  document.getElementById('regex-match-count').textContent = `0 matches`;
  const statIds = ['regex-dates', 'regex-emails', 'regex-phones', 'regex-names', 'regex-addresses'];
  for (const id of statIds) document.getElementById(id).textContent = '0';
  
  const counts = { date: 0, email: 0, phone: 0, name: 0, address: 0 };
  const tbody = document.getElementById('regex-tbody');
  
  // Setup backdrop
  const inputEl = document.getElementById('regex-input');
  const backdrop = document.getElementById('regex-backdrop');
  if (inputEl && backdrop && rawText !== undefined) {
    inputEl.style.display = 'none';
    backdrop.style.display = 'block';
    backdrop.innerHTML = escapeHtml(rawText);
  }
  
  let lines = rawText ? rawText.split('\n').map(escapeHtml) : [];

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

  tbody.innerHTML = ''; // clear table
  
  const categoryIcons = {
    date: '📅',
    email: '📧',
    phone: '📞',
    name: '👤',
    address: '🏠',
  };

  // Helper promise delay
  const delay = ms => new Promise(r => setTimeout(r, ms));

  // Animate adding matches row by row
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    
    // Increment specific counter
    if (counts[m.category] !== undefined) counts[m.category]++;
    const idMap = { date: 'regex-dates', email: 'regex-emails', phone: 'regex-phones', name: 'regex-names', address: 'regex-addresses' };
    if (idMap[m.category]) {
      document.getElementById(idMap[m.category]).textContent = counts[m.category];
    }
    
    // Update total counter
    document.getElementById('regex-match-count').textContent = `${i + 1} matches`;

    // Append row
    const tr = document.createElement('tr');
    tr.style.animation = 'fadeSlideIn 0.3s ease both';
    
    // Phosphor icons for categories (since we replaced emojis in index)
    const pIcons = {
      date: '<i class="ph ph-calendar"></i>',
      email: '<i class="ph ph-envelope"></i>',
      phone: '<i class="ph ph-phone"></i>',
      name: '<i class="ph ph-user"></i>',
      address: '<i class="ph ph-house"></i>',
    };
    
    tr.innerHTML = `
      <td>
        <span class="badge badge-${getCategoryBadgeClass(m.category)}">
          ${pIcons[m.category] || categoryIcons[m.category]} ${m.category}
        </span>
      </td>
      <td>
        <span class="match-highlight ${m.category}">${escapeHtml(m.value)}</span>
      </td>
      <td class="text-mono text-muted">${m.line_number}</td>
    `;
    
    tbody.appendChild(tr);
    
    // Highlight in backdrop
    if (backdrop && lines.length > 0) {
      const l = m.line_number - 1;
      if (l >= 0 && l < lines.length) {
        const escapedVal = escapeHtml(m.value);
        lines[l] = lines[l].replace(escapedVal, `<span class="match-highlight ${m.category}">${escapedVal}</span>`);
        backdrop.innerHTML = lines.join('\n');
      }
    }
    
    // Scroll to bottom
    const wrapper = tbody.closest('.table-wrapper');
    if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
    
    // Scroll backdrop to highlight approx
    if (backdrop) {
      backdrop.scrollTop = (m.line_number - 1) * 20; 
    }
    
    // Wait for the next one (slower)
    await delay(300); 
  }
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
      // Switch back to input before re-extracting
      document.getElementById('regex-backdrop').style.display = 'none';
      document.getElementById('regex-input').style.display = 'block';
      
      const text = document.getElementById('regex-input').value.trim();
      if (text) {
        setTimeout(extractRegex, 100);
      }
    });
  });

  // Switch back to edit mode on backdrop click
  document.getElementById('regex-backdrop').addEventListener('click', () => {
    document.getElementById('regex-backdrop').style.display = 'none';
    const input = document.getElementById('regex-input');
    input.style.display = 'block';
    input.focus();
  });
});

window.extractRegex = extractRegex;
