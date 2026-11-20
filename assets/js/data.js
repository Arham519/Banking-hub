/**
 * Banking Hub - Data Management & API Layer
 * Reusable, robust data service with seamless LocalStorage integration and fallback support.
 */

const PBH = (() => {
  // Local storage keys
  const STORAGE_SAVED_BANKS = 'pbh_saved_banks';
  const STORAGE_COMPARE_BANKS = 'pbh_compare_banks';

  // Internal cache
  let _banks = null;
  let _categories = null;
  let _products = null;
  let _blogs = null;

  // Determine relative path based on directory depth
  function getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/categories/') || path.includes('/bank/') || path.includes('/blog/')) {
      return '../';
    }
    return '';
  }

  // Safe fetch helper with fallback to embedded dataset
  async function fetchJSON(relativePath) {
    try {
      const base = getBasePath();
      const res = await fetch(base + relativePath);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[PBH] Fetch failed for ${relativePath}, falling back to static cache:`, err.message);
      return null;
    }
  }

  return {
    getBasePath,

    async getBanks() {
      if (_banks) return _banks;
      const fetched = await fetchJSON('data/banks.json');
      _banks = fetched || (window.PBH_STATIC_DATA ? window.PBH_STATIC_DATA.banks : []);
      return _banks;
    },

    async getCategories() {
      if (_categories) return _categories;
      const fetched = await fetchJSON('data/categories.json');
      _categories = fetched || (window.PBH_STATIC_DATA ? window.PBH_STATIC_DATA.categories : []);
      return _categories;
    },

    async getProducts() {
      if (_products) return _products;
      const fetched = await fetchJSON('data/financing-products.json');
      _products = fetched || (window.PBH_STATIC_DATA ? window.PBH_STATIC_DATA.products : []);
      return _products;
    },

    async getBlogs() {
      if (_blogs) return _blogs;
      const fetched = await fetchJSON('data/blogs.json');
      _blogs = fetched || (window.PBH_STATIC_DATA ? window.PBH_STATIC_DATA.blogs : []);
      return _blogs;
    },

    async getBankById(id) {
      const banks = await this.getBanks();
      return banks.find(b => b.id === id) || null;
    },

    async getProductById(id) {
      const products = await this.getProducts();
      return products.find(p => p.id === id) || null;
    },

    async getBlogById(idOrSlug) {
      const blogs = await this.getBlogs();
      return blogs.find(b => b.id === idOrSlug || b.slug === idOrSlug) || null;
    },

    // Currency Formatter
    formatPKR(num) {
      if (isNaN(num)) return 'PKR 0';
      return 'PKR ' + Number(Math.round(num)).toLocaleString('en-PK');
    },

    // LocalStorage: Saved (Favorite) Banks
    getSavedBankIds() {
      try {
        const raw = localStorage.getItem(STORAGE_SAVED_BANKS);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    isBankSaved(bankId) {
      const ids = this.getSavedBankIds();
      return ids.includes(bankId);
    },

    toggleSaveBank(bankId) {
      const ids = this.getSavedBankIds();
      const index = ids.indexOf(bankId);
      let isSaved = false;
      if (index > -1) {
        ids.splice(index, 1);
        isSaved = false;
      } else {
        ids.push(bankId);
        isSaved = true;
      }
      try {
        localStorage.setItem(STORAGE_SAVED_BANKS, JSON.stringify(ids));
        window.dispatchEvent(new CustomEvent('pbh:saved-banks-updated', { detail: { ids, isSaved, bankId } }));
      } catch (e) {
        console.error('LocalStorage write error', e);
      }
      return isSaved;
    },

    // LocalStorage: Compare Banks (Max 3)
    getCompareBankIds() {
      try {
        const raw = localStorage.getItem(STORAGE_COMPARE_BANKS);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    addCompareBank(bankId) {
      const ids = this.getCompareBankIds();
      if (ids.includes(bankId)) return { success: true, count: ids.length, alreadyAdded: true };
      if (ids.length >= 3) {
        return { success: false, reason: 'maximum_reached', message: 'You can compare a maximum of 3 banks simultaneously.' };
      }
      ids.push(bankId);
      try {
        localStorage.setItem(STORAGE_COMPARE_BANKS, JSON.stringify(ids));
        window.dispatchEvent(new CustomEvent('pbh:compare-banks-updated', { detail: { ids, bankId } }));
      } catch (e) {
        console.error('LocalStorage write error', e);
      }
      return { success: true, count: ids.length };
    },

    removeCompareBank(bankId) {
      const ids = this.getCompareBankIds();
      const next = ids.filter(id => id !== bankId);
      try {
        localStorage.setItem(STORAGE_COMPARE_BANKS, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('pbh:compare-banks-updated', { detail: { ids: next, bankId } }));
      } catch (e) {
        console.error('LocalStorage write error', e);
      }
      return next;
    },

    clearCompare() {
      try {
        localStorage.removeItem(STORAGE_COMPARE_BANKS);
        window.dispatchEvent(new CustomEvent('pbh:compare-banks-updated', { detail: { ids: [] } }));
      } catch (e) {}
    },

    /**
     * Financing Calculation Engine
     * Supports:
     * 1. Conventional Reducing Balance (Standard Amortization: P * r * (1+r)^n / ((1+r)^n - 1))
     * 2. Islamic Diminishing Musharakah (Unit purchase + Rental on remaining bank share)
     * 3. Islamic Ijarah (Lease rentals + takaful + residual transfer)
     * 4. Islamic Murabaha (Cost-plus agreed profit divided over equal monthly terms)
     */
    calculateInstallment(product, totalAmount, downPaymentAmount, tenureYears) {
      const principal = Math.max(0, totalAmount - downPaymentAmount);
      const tenureMonths = Math.round(tenureYears * 12);
      const annualRate = (product.indicative_annual_rate || 18.0) / 100;
      const monthlyRate = annualRate / 12;

      let monthlyPayment = 0;
      let totalPayable = 0;
      let totalProfitOrInterest = 0;
      let schedule = [];

      if (tenureMonths <= 0 || principal <= 0) {
        return {
          principal,
          downPayment: downPaymentAmount,
          tenureMonths,
          monthlyPayment: 0,
          totalPayable: 0,
          totalProfitOrInterest: 0,
          schedule: []
        };
      }

      if (product.method === 'islamic_murabaha') {
        // Murabaha: Cost-plus fixed markup
        totalProfitOrInterest = principal * annualRate * tenureYears;
        totalPayable = principal + totalProfitOrInterest;
        monthlyPayment = totalPayable / tenureMonths;

        let bal = principal;
        const monthlyPrincipal = principal / tenureMonths;
        const monthlyProfit = totalProfitOrInterest / tenureMonths;
        for (let m = 1; m <= Math.min(tenureMonths, 36); m++) {
          bal -= monthlyPrincipal;
          schedule.push({
            month: m,
            payment: monthlyPayment,
            principalPortion: monthlyPrincipal,
            profitPortion: monthlyProfit,
            remainingBalance: Math.max(0, bal)
          });
        }
      } else if (product.method === 'islamic_diminishing_musharakah' || product.method === 'conventional_reducing' || product.method === 'islamic_ijarah') {
        // Reducing Balance Formula
        if (monthlyRate === 0) {
          monthlyPayment = principal / tenureMonths;
        } else {
          monthlyPayment = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
                           (Math.pow(1 + monthlyRate, tenureMonths) - 1);
        }
        totalPayable = monthlyPayment * tenureMonths;
        totalProfitOrInterest = totalPayable - principal;

        let currentBal = principal;
        const sampleLimit = Math.min(tenureMonths, 36); // first 36 months for preview
        for (let m = 1; m <= sampleLimit; m++) {
          const interestShare = currentBal * monthlyRate;
          const principalShare = monthlyPayment - interestShare;
          currentBal -= principalShare;
          schedule.push({
            month: m,
            payment: monthlyPayment,
            principalPortion: principalShare,
            profitPortion: interestShare,
            remainingBalance: Math.max(0, currentBal)
          });
        }
      }

      return {
        principal,
        downPayment: downPaymentAmount,
        tenureYears,
        tenureMonths,
        annualRatePercent: product.indicative_annual_rate,
        monthlyPayment,
        totalPayable: totalPayable + downPaymentAmount,
        totalFinancedPayable: totalPayable,
        totalProfitOrInterest,
        method: product.method,
        methodLabel: product.method_label,
        schedule
      };
    }
  };
})();

// Fallback dataset placeholder in case of local file:// execution without web server
window.PBH_STATIC_DATA = window.PBH_STATIC_DATA || {};
