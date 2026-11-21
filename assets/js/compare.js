/**
 * Banking Hub - Bank Comparison System
 * Side-by-side comparative analysis of up to three financial institutions.
 */

const PBH_Compare = (() => {
  let allBanks = [];

  // Render comparison matrix
  function renderMatrix(selectedBanks) {
    const container = document.getElementById('compareMatrixContainer');
    const emptyState = document.getElementById('compareEmptyState');
    if (!container) return;

    if (selectedBanks.length === 0) {
      container.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    container.style.display = 'block';

    const basePath = PBH.getBasePath();

    // Table Header
    let headersHTML = `<th>Features &amp; Specifications</th>`;
    selectedBanks.forEach(bank => {
      headersHTML += `
        <td class="compare-bank-header">
          <button class="compare-remove-btn" title="Remove bank" onclick="PBH_Compare.removeBank('${bank.id}')">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <div style="margin: 0 auto 0.75rem auto; display: flex; justify-content: center;">
            ${PBH.renderBankLogo(bank, basePath)}
          </div>
          <h3 class="bank-name">${bank.name}</h3>
          <span class="badge ${bank.is_full_islamic ? 'badge-islamic' : 'badge-conventional'} mt-1">
            ${bank.is_full_islamic ? 'Full-Fledged Islamic' : 'Conventional'}
          </span>
          <div style="margin-top: 1rem;">
            <a href="${basePath}bank/profile.html?id=${bank.id}" class="btn btn-primary btn-sm" style="width: 100%;">
              View Profile
            </a>
          </div>
        </td>
      `;
    });

    // Helper row generator
    const makeRow = (label, renderCell) => {
      let row = `<tr><th>${label}</th>`;
      selectedBanks.forEach(b => {
        row += `<td>${renderCell(b)}</td>`;
      });
      row += `</tr>`;
      return row;
    };

    let bodyHTML = '';

    bodyHTML += makeRow('Classification &amp; Shariah', b => `
      <strong>${b.type}</strong>
      ${b.has_islamic_window ? `<br><small class="text-emerald"><i class="fa-solid fa-shield"></i> Window: ${b.islamic_window_name}</small>` : ''}
    `);

    bodyHTML += makeRow('Credit Rating (PACRA / VIS)', b => `
      <span class="badge badge-gold" style="font-size: 0.85rem;"><i class="fa-solid fa-star"></i> ${b.rating}</span>
    `);

    bodyHTML += makeRow('Established Year', b => `<strong>${b.established}</strong> (${new Date().getFullYear() - b.established} years in service)`);

    bodyHTML += makeRow('Branch &amp; ATM Presence', b => `
      <div><i class="fa-solid fa-location-dot text-emerald"></i> ${b.branches}</div>
      <div style="margin-top: 0.35rem;"><i class="fa-solid fa-money-bill-transfer text-navy"></i> ${b.atms}</div>
    `);

    bodyHTML += makeRow('Online &amp; Digital Banking', b => `
      <ul style="padding-left: 1.1rem; list-style-type: disc;">
        ${b.online_banking_features.slice(0, 4).map(f => `<li style="margin-bottom: 0.25rem;">${f}</li>`).join('')}
      </ul>
    `);

    bodyHTML += makeRow('Account Offerings', b => `
      <ul style="padding-left: 1.1rem; list-style-type: disc;">
        ${b.account_types.slice(0, 4).map(a => `<li style="margin-bottom: 0.25rem;">${a}</li>`).join('')}
      </ul>
    `);

    bodyHTML += makeRow('Payment Cards', b => `
      <ul style="padding-left: 1.1rem; list-style-type: disc;">
        ${b.cards_offered.map(c => `<li style="margin-bottom: 0.25rem;">${c}</li>`).join('')}
      </ul>
    `);

    bodyHTML += makeRow('Financing Products Available', b => `
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${b.financing_products.map(fp => `
          <div style="background: var(--bg-light); padding: 0.45rem 0.65rem; border-radius: 6px;">
            <strong>${fp.name}</strong><br>
            <small style="color: var(--text-muted);">${fp.model} &bull; ${fp.tenure}</small>
          </div>
        `).join('')}
      </div>
    `);

    bodyHTML += makeRow('Eligibility Requirements', b => `
      <ul style="padding-left: 1.1rem; list-style-type: disc; font-size: 0.85rem;">
        ${b.eligibility_criteria.map(e => `<li style="margin-bottom: 0.25rem;">${e}</li>`).join('')}
      </ul>
    `);

    bodyHTML += makeRow('Official Contact &amp; Support', b => `
      <div><i class="fa-solid fa-phone text-emerald"></i> <strong>${b.helpline}</strong></div>
      <div style="margin-top: 0.25rem;"><i class="fa-solid fa-envelope text-navy"></i> <small>${b.email}</small></div>
      <div style="margin-top: 0.5rem;">
        <a href="${b.website}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" style="width: 100%;">
          Visit Website <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    `);

    container.innerHTML = `
      <div class="compare-table-wrapper">
        <table class="compare-table">
          <thead>
            <tr>${headersHTML}</tr>
          </thead>
          <tbody>
            ${bodyHTML}
          </tbody>
        </table>
      </div>
    `;
  }

  // Populate selection drop-downs (up to 3)
  function setupSelectors(selectedIds) {
    const slots = [
      document.getElementById('compareSlot1'),
      document.getElementById('compareSlot2'),
      document.getElementById('compareSlot3')
    ];

    slots.forEach((slot, index) => {
      if (!slot) return;
      slot.innerHTML = `<option value="">-- Add Bank ${index + 1} --</option>`;
      allBanks.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.name} (${b.is_full_islamic ? 'Islamic' : 'Conventional'})`;
        if (selectedIds[index] === b.id) {
          opt.selected = true;
        }
        slot.appendChild(opt);
      });

      slot.addEventListener('change', (e) => {
        const newBankId = e.target.value;
        const currentIds = PBH.getCompareBankIds();
        if (newBankId) {
          if (!currentIds.includes(newBankId)) {
            currentIds[index] = newBankId;
          }
        } else {
          currentIds.splice(index, 1);
        }
        localStorage.setItem('pbh_compare_banks', JSON.stringify(currentIds.filter(Boolean)));
        refreshView();
      });
    });
  }

  function removeBank(bankId) {
    PBH.removeCompareBank(bankId);
    refreshView();
  }

  function refreshView() {
    const ids = PBH.getCompareBankIds();
    const selectedBanks = ids.map(id => allBanks.find(b => b.id === id)).filter(Boolean);
    setupSelectors(ids);
    renderMatrix(selectedBanks);
    PBH_UI.updateNavBadges();
  }

  return {
    async init() {
      allBanks = await PBH.getBanks();
      
      // If no banks selected yet, initialize with default top 2 for showcase (Meezan & HBL)
      let currentIds = PBH.getCompareBankIds();
      if (currentIds.length === 0) {
        currentIds = ['meezan-bank', 'hbl-pakistan'];
        localStorage.setItem('pbh_compare_banks', JSON.stringify(currentIds));
      }

      refreshView();

      const clearBtn = document.getElementById('clearCompareBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          PBH.clearCompare();
          refreshView();
          PBH_UI.showToast('Comparison cleared.', 'info');
        });
      }
    },
    removeBank
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('compareMatrixContainer')) {
    PBH_Compare.init();
  }
});
