/**
 * Banking Hub - Bank Directory Controller
 * Handles dynamic bank card rendering, multi-criteria filtering, search, sorting, and comparison hooks.
 */

const PBH_Banks = (() => {
  let allBanks = [];
  let currentFiltered = [];

  // Parse query params
  function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      category: params.get('category') || '',
      search: params.get('search') || '',
      type: params.get('type') || '',
      savedOnly: params.get('saved') === '1'
    };
  }

  // Render bank card HTML
  function createBankCardHTML(bank) {
    const basePath = PBH.getBasePath();
    const isSaved = PBH.isBankSaved(bank.id);
    const compareIds = PBH.getCompareBankIds();
    const isCompared = compareIds.includes(bank.id);

    const typeBadge = bank.is_full_islamic
      ? `<span class="badge badge-islamic"><i class="fa-solid fa-moon"></i> Full-Fledged Islamic</span>`
      : `<span class="badge badge-conventional"><i class="fa-solid fa-building-columns"></i> Conventional</span>`;

    const windowBadge = bank.has_islamic_window
      ? `<span class="badge badge-gold" title="${bank.islamic_window_name}"><i class="fa-solid fa-shield-halved"></i> Islamic Window</span>`
      : '';

    return `
      <div class="bank-card" data-id="${bank.id}">
        <div class="bank-card-header">
          <div class="bank-brand-block">
            ${PBH.renderBankLogo(bank)}
            <div class="bank-identity">
              <h3 class="bank-name">${bank.name}</h3>
              <span class="bank-rating"><i class="fa-solid fa-star text-gold"></i> Rating: ${bank.rating}</span>
            </div>
          </div>
          <div class="bank-action-icons">
            <button class="btn-favorite ${isSaved ? 'active' : ''}" title="${isSaved ? 'Remove from favorites' : 'Save bank'}" onclick="PBH_Banks.toggleSave('${bank.id}', this)">
              <i class="fa-${isSaved ? 'solid' : 'regular'} fa-heart"></i>
            </button>
            <button class="btn-compare-toggle ${isCompared ? 'active' : ''}" title="${isCompared ? 'Remove from compare' : 'Add to compare'}" onclick="PBH_Banks.toggleCompare('${bank.id}', this)">
              <i class="fa-solid fa-code-compare"></i>
            </button>
          </div>
        </div>

        <div class="bank-tags">
          ${typeBadge}
          ${windowBadge}
        </div>

        <p class="bank-card-desc">${bank.short_description}</p>

        <div class="bank-info-table">
          <div class="bank-info-row">
            <span class="bank-info-label">Network</span>
            <span class="bank-info-val">${bank.branches}</span>
          </div>
          <div class="bank-info-row">
            <span class="bank-info-label">Established</span>
            <span class="bank-info-val">${bank.established}</span>
          </div>
          <div class="bank-info-row">
            <span class="bank-info-label">Helpline</span>
            <span class="bank-info-val">${bank.helpline}</span>
          </div>
        </div>

        <div class="bank-card-actions">
          <a href="${basePath}bank/profile.html?id=${bank.id}" class="btn btn-secondary btn-sm">
            <i class="fa-solid fa-circle-info"></i> View Details
          </a>
          <a href="${bank.website}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Official Site
          </a>
        </div>
      </div>
    `;
  }

  // Filter & render execution
  function applyFilters() {
    const searchInput = document.getElementById('bankSearchInput');
    const categoryFilter = document.getElementById('bankCategoryFilter');
    const typeFilter = document.getElementById('bankTypeFilter');
    const financingFilter = document.getElementById('bankFinancingFilter');
    const sortFilter = document.getElementById('bankSortFilter');
    const gridContainer = document.getElementById('banksGrid');
    const countDisplay = document.getElementById('bankResultsCount');

    if (!gridContainer) return;

    const searchTerm = (searchInput ? searchInput.value : '').toLowerCase().trim();
    const catVal = categoryFilter ? categoryFilter.value : '';
    const typeVal = typeFilter ? typeFilter.value : '';
    const financingVal = financingFilter ? financingFilter.value : '';
    const sortVal = sortFilter ? sortFilter.value : 'name-asc';

    currentFiltered = allBanks.filter(bank => {
      // Search matching
      const matchesSearch = !searchTerm ||
        bank.name.toLowerCase().includes(searchTerm) ||
        bank.legal_name.toLowerCase().includes(searchTerm) ||
        bank.short_description.toLowerCase().includes(searchTerm) ||
        (bank.tagline && bank.tagline.toLowerCase().includes(searchTerm));

      // Category matching
      const matchesCategory = !catVal || (bank.categories && bank.categories.includes(catVal));

      // Type matching
      let matchesType = true;
      if (typeVal === 'islamic') matchesType = bank.is_full_islamic === true;
      else if (typeVal === 'conventional') matchesType = bank.is_full_islamic === false;

      // Financing matching
      let matchesFinancing = true;
      if (financingVal === 'home') matchesFinancing = bank.categories && bank.categories.includes('home-financing');
      else if (financingVal === 'auto') matchesFinancing = bank.categories && bank.categories.includes('auto-financing');
      else if (financingVal === 'personal') matchesFinancing = bank.categories && bank.categories.includes('personal-financing');
      else if (financingVal === 'business') matchesFinancing = bank.categories && bank.categories.includes('business-financing');

      return matchesSearch && matchesCategory && matchesType && matchesFinancing;
    });

    // Sorting
    currentFiltered.sort((a, b) => {
      if (sortVal === 'name-asc') return a.name.localeCompare(b.name);
      if (sortVal === 'name-desc') return b.name.localeCompare(a.name);
      if (sortVal === 'est-old') return a.established - b.established;
      if (sortVal === 'est-new') return b.established - a.established;
      return 0;
    });

    // Update counter
    if (countDisplay) {
      countDisplay.textContent = `Showing ${currentFiltered.length} of ${allBanks.length} banks`;
    }

    // Render cards
    if (currentFiltered.length === 0) {
      gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
          <div style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;">
            <i class="fa-solid fa-magnifying-glass"></i>
          </div>
          <h3 style="font-size: 1.4rem; color: var(--navy); margin-bottom: 0.5rem;">No matching banks found</h3>
          <p style="color: var(--text-secondary); max-width: 480px; margin: 0 auto 1.5rem auto;">
            Try clearing filters or searching for another bank name like Meezan, HBL, UBL, or Bank Alfalah.
          </p>
          <button class="btn btn-outline" onclick="PBH_Banks.resetFilters()">Reset All Filters</button>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = currentFiltered.map(createBankCardHTML).join('');
  }

  function resetFilters() {
    const s = document.getElementById('bankSearchInput');
    const c = document.getElementById('bankCategoryFilter');
    const t = document.getElementById('bankTypeFilter');
    const f = document.getElementById('bankFinancingFilter');
    const o = document.getElementById('bankSortFilter');
    if (s) s.value = '';
    if (c) c.value = '';
    if (t) t.value = '';
    if (f) f.value = '';
    if (o) o.value = 'name-asc';
    applyFilters();
  }

  function toggleSave(bankId, btnElement) {
    const isNowSaved = PBH.toggleSaveBank(bankId);
    if (btnElement) {
      btnElement.classList.toggle('active', isNowSaved);
      const icon = btnElement.querySelector('i');
      if (icon) {
        icon.className = `fa-${isNowSaved ? 'solid' : 'regular'} fa-heart`;
      }
    }
  }

  function toggleCompare(bankId, btnElement) {
    const compareIds = PBH.getCompareBankIds();
    if (compareIds.includes(bankId)) {
      PBH.removeCompareBank(bankId);
      if (btnElement) btnElement.classList.remove('active');
      PBH_UI.showToast('Removed from comparison list.', 'warning');
    } else {
      const res = PBH.addCompareBank(bankId);
      if (res.success) {
        if (btnElement) btnElement.classList.add('active');
        PBH_UI.showToast(`Added to comparison (${res.count}/3 banks).`, 'info');
      } else {
        PBH_UI.showToast(res.message, 'warning');
      }
    }
  }

  return {
    async init() {
      allBanks = await PBH.getBanks();
      const params = getQueryParams();

      const searchInput = document.getElementById('bankSearchInput');
      const categoryFilter = document.getElementById('bankCategoryFilter');
      const typeFilter = document.getElementById('bankTypeFilter');

      if (params.search && searchInput) searchInput.value = params.search;
      if (params.category && categoryFilter) categoryFilter.value = params.category;
      if (params.type && typeFilter) typeFilter.value = params.type;

      // Event listeners for real-time filtering
      const inputs = [
        document.getElementById('bankSearchInput'),
        document.getElementById('bankCategoryFilter'),
        document.getElementById('bankTypeFilter'),
        document.getElementById('bankFinancingFilter'),
        document.getElementById('bankSortFilter')
      ];

      inputs.forEach(el => {
        if (el) {
          el.addEventListener('input', applyFilters);
          el.addEventListener('change', applyFilters);
        }
      });

      applyFilters();
    },
    toggleSave,
    toggleCompare,
    resetFilters
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('banksGrid')) {
    PBH_Banks.init();
  }
});
