/**
 * Banking Hub - Advanced Loan & Financing Calculator
 * 7-Step workflow supporting Conventional Reducing Balance, Islamic Murabaha,
 * Islamic Ijarah, and Diminishing Musharakah.
 */

const PBH_Calculator = (() => {
  let products = [];
  let banks = [];
  let selectedCategory = 'home-financing';
  let selectedProduct = null;

  function initElements() {
    return {
      categorySelect: document.getElementById('calcCategorySelect'),
      bankSelect: document.getElementById('calcBankSelect'),
      productSelect: document.getElementById('calcProductSelect'),
      amountInput: document.getElementById('calcAmountInput'),
      amountRange: document.getElementById('calcAmountRange'),
      downPaymentInput: document.getElementById('calcDownPaymentInput'),
      downPaymentRange: document.getElementById('calcDownPaymentRange'),
      downPaymentGroup: document.getElementById('downPaymentGroup'),
      tenureInput: document.getElementById('calcTenureInput'),
      tenureRange: document.getElementById('calcTenureRange'),
      minMaxAmountText: document.getElementById('calcAmountMinMax'),
      minMaxDownText: document.getElementById('calcDownMinMax'),
      minMaxTenureText: document.getElementById('calcTenureMinMax'),
      
      // Output Elements
      displayInstallment: document.getElementById('calcMonthlyInstallment'),
      displayBankName: document.getElementById('calcResultBankName'),
      displayProductName: document.getElementById('calcResultProductName'),
      displayMethodBadge: document.getElementById('calcResultMethodBadge'),
      displayFinancedAmount: document.getElementById('calcResultFinancedAmount'),
      displayDownPayment: document.getElementById('calcResultDownPayment'),
      displayDuration: document.getElementById('calcResultDuration'),
      displayProfitRate: document.getElementById('calcResultProfitRate'),
      displayProfitCost: document.getElementById('calcResultTotalProfit'),
      displayProfitLabel: document.getElementById('calcResultProfitLabel'),
      displayTotalPayable: document.getElementById('calcResultTotalPayable'),
      displayEligibility: document.getElementById('calcResultEligibility'),
      displaySource: document.getElementById('calcResultSource'),
      displayLastUpdated: document.getElementById('calcResultLastUpdated'),
      scheduleTableBody: document.getElementById('calcScheduleBody')
    };
  }

  // Populate bank dropdown based on category
  function populateBanksForCategory(category) {
    const els = initElements();
    if (!els.bankSelect) return;

    // Filter products for category
    const catProducts = products.filter(p => p.category === category);
    const availableBankIds = [...new Set(catProducts.map(p => p.bank_id))];

    els.bankSelect.innerHTML = '<option value="">-- Select Bank --</option>';
    availableBankIds.forEach(bId => {
      const bank = banks.find(b => b.id === bId);
      if (bank) {
        const opt = document.createElement('option');
        opt.value = bank.id;
        opt.textContent = `${bank.name} (${bank.is_full_islamic ? 'Islamic' : 'Conventional'})`;
        els.bankSelect.appendChild(opt);
      }
    });

    if (availableBankIds.length > 0) {
      els.bankSelect.selectedIndex = 1;
      populateProductsForBank(els.bankSelect.value);
    } else {
      els.productSelect.innerHTML = '<option value="">No products available</option>';
    }
  }

  // Populate product dropdown based on selected bank & category
  function populateProductsForBank(bankId) {
    const els = initElements();
    if (!els.productSelect) return;

    const matchedProducts = products.filter(p => p.bank_id === bankId && p.category === selectedCategory);
    els.productSelect.innerHTML = '';

    matchedProducts.forEach(prod => {
      const opt = document.createElement('option');
      opt.value = prod.id;
      opt.textContent = `${prod.product_name} (${prod.method_label.split('(')[0].trim()})`;
      els.productSelect.appendChild(opt);
    });

    if (matchedProducts.length > 0) {
      selectedProduct = matchedProducts[0];
      syncProductConstraints(selectedProduct);
      recalculate();
    }
  }

  // Adjust sliders and min/max bounds to match product terms
  function syncProductConstraints(product) {
    const els = initElements();
    if (!product || !els.amountInput) return;

    // Amount limits
    const minAmt = product.min_amount || 100000;
    const maxAmt = product.max_amount || 20000000;
    els.amountInput.min = minAmt;
    els.amountInput.max = maxAmt;
    els.amountRange.min = minAmt;
    els.amountRange.max = maxAmt;
    els.amountRange.step = 50000;
    
    // Sensible default within range
    const defAmt = Math.min(Math.max(minAmt * 2, 2500000), maxAmt);
    els.amountInput.value = defAmt;
    els.amountRange.value = defAmt;
    if (els.minMaxAmountText) {
      els.minMaxAmountText.textContent = `Min: ${PBH.formatPKR(minAmt)} | Max: ${PBH.formatPKR(maxAmt)}`;
    }

    // Down Payment
    const minDownPct = product.min_down_payment_percent || 0;
    if (minDownPct === 0 && els.downPaymentGroup) {
      // Optional/Zero down payment
      els.downPaymentInput.value = 0;
      els.downPaymentRange.value = 0;
      els.downPaymentRange.max = defAmt * 0.5;
      if (els.minMaxDownText) els.minMaxDownText.textContent = `0% minimum required`;
    } else {
      const minDown = Math.round(defAmt * (minDownPct / 100));
      els.downPaymentInput.min = minDown;
      els.downPaymentInput.max = defAmt * 0.7;
      els.downPaymentRange.min = minDown;
      els.downPaymentRange.max = defAmt * 0.7;
      els.downPaymentRange.step = 25000;
      els.downPaymentInput.value = minDown;
      els.downPaymentRange.value = minDown;
      if (els.minMaxDownText) {
        els.minMaxDownText.textContent = `Min ${minDownPct}%: ${PBH.formatPKR(minDown)}`;
      }
    }

    // Tenure limits
    const minTenure = product.min_tenure_years || 1;
    const maxTenure = product.max_tenure_years || 20;
    els.tenureInput.min = minTenure;
    els.tenureInput.max = maxTenure;
    els.tenureRange.min = minTenure;
    els.tenureRange.max = maxTenure;
    const defTenure = Math.min(Math.max(minTenure, 5), maxTenure);
    els.tenureInput.value = defTenure;
    els.tenureRange.value = defTenure;
    if (els.minMaxTenureText) {
      els.minMaxTenureText.textContent = `Min: ${minTenure} Yrs | Max: ${maxTenure} Yrs`;
    }
  }

  // Recalculate monthly installment & update display
  function recalculate() {
    const els = initElements();
    if (!selectedProduct || !els.amountInput) return;

    const totalAmt = parseFloat(els.amountInput.value) || 0;
    const downAmt = parseFloat(els.downPaymentInput.value) || 0;
    const tenureYrs = parseFloat(els.tenureInput.value) || 1;

    const result = PBH.calculateInstallment(selectedProduct, totalAmt, downAmt, tenureYrs);

    // Update Result Panel
    if (els.displayInstallment) {
      els.displayInstallment.textContent = PBH.formatPKR(result.monthlyPayment);
      els.displayInstallment.style.animation = 'none';
      void els.displayInstallment.offsetHeight;
      els.displayInstallment.style.animation = 'installmentBounce 0.4s ease';
    }
    if (els.displayBankName) {
      els.displayBankName.textContent = selectedProduct.bank_name;
    }
    if (els.displayProductName) {
      els.displayProductName.textContent = selectedProduct.product_name;
    }
    if (els.displayMethodBadge) {
      const isIslamic = selectedProduct.method.startsWith('islamic');
      els.displayMethodBadge.className = `badge ${isIslamic ? 'badge-islamic' : 'badge-conventional'}`;
      els.displayMethodBadge.innerHTML = `<i class="fa-solid fa-${isIslamic ? 'moon' : 'scale-balanced'}"></i> ${selectedProduct.method_label}`;
    }
    if (els.displayFinancedAmount) {
      els.displayFinancedAmount.textContent = PBH.formatPKR(result.principal);
    }
    if (els.displayDownPayment) {
      els.displayDownPayment.textContent = PBH.formatPKR(result.downPayment);
    }
    if (els.displayDuration) {
      els.displayDuration.textContent = `${tenureYrs} Years (${result.tenureMonths} Months)`;
    }
    if (els.displayProfitRate) {
      els.displayProfitRate.textContent = `${selectedProduct.indicative_annual_rate}% p.a. (${selectedProduct.profit_structure})`;
    }
    if (els.displayProfitLabel) {
      const isIslamic = selectedProduct.method.startsWith('islamic');
      els.displayProfitLabel.textContent = isIslamic ? 'Total Estimated Profit / Rent' : 'Total Estimated Interest (Markup)';
    }
    if (els.displayProfitCost) {
      els.displayProfitCost.textContent = PBH.formatPKR(result.totalProfitOrInterest);
    }
    if (els.displayTotalPayable) {
      els.displayTotalPayable.textContent = PBH.formatPKR(result.totalFinancedPayable);
    }
    if (els.displayEligibility) {
      els.displayEligibility.textContent = selectedProduct.eligibility || 'Standard SBP credit qualification applies.';
    }
    if (els.displaySource) {
      els.displaySource.textContent = selectedProduct.source || 'Bank official disclosure';
    }
    if (els.displayLastUpdated) {
      els.displayLastUpdated.textContent = selectedProduct.last_updated || 'Latest Schedule of Charges';
    }

    // Populate Schedule Preview Table
    if (els.scheduleTableBody) {
      els.scheduleTableBody.innerHTML = result.schedule.slice(0, 12).map(item => `
        <tr>
          <td style="padding: 0.5rem; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08);">Month ${item.month}</td>
          <td style="padding: 0.5rem; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.08);">${PBH.formatPKR(item.payment)}</td>
          <td style="padding: 0.5rem; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.08);">${PBH.formatPKR(item.principalPortion)}</td>
          <td style="padding: 0.5rem; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.08);">${PBH.formatPKR(item.profitPortion)}</td>
          <td style="padding: 0.5rem; text-align: right; border-bottom: 1px solid rgba(255,255,255,0.08);">${PBH.formatPKR(item.remainingBalance)}</td>
        </tr>
      `).join('');
    }
  }

  // Bind bidirectional slider-input synchronization
  function bindSync(input, range, onChange) {
    if (!input || !range) return;
    input.addEventListener('input', () => {
      range.value = input.value;
      if (onChange) onChange();
    });
    range.addEventListener('input', () => {
      input.value = range.value;
      if (onChange) onChange();
    });
  }

  return {
    async init() {
      products = await PBH.getProducts();
      banks = await PBH.getBanks();
      const els = initElements();

      if (!els.categorySelect) return;

      // Category tab / select listener
      els.categorySelect.addEventListener('change', (e) => {
        selectedCategory = e.target.value;
        populateBanksForCategory(selectedCategory);
      });

      // Bank select listener
      els.bankSelect.addEventListener('change', (e) => {
        populateProductsForBank(e.target.value);
      });

      // Product select listener
      els.productSelect.addEventListener('change', (e) => {
        const prod = products.find(p => p.id === e.target.value);
        if (prod) {
          selectedProduct = prod;
          syncProductConstraints(selectedProduct);
          recalculate();
        }
      });

      // Inputs & Sliders
      bindSync(els.amountInput, els.amountRange, recalculate);
      bindSync(els.downPaymentInput, els.downPaymentRange, recalculate);
      bindSync(els.tenureInput, els.tenureRange, recalculate);

      // Handle category pills if on page
      const catPills = document.querySelectorAll('.calc-cat-pill');
      catPills.forEach(pill => {
        pill.addEventListener('click', () => {
          catPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          selectedCategory = pill.dataset.category;
          if (els.categorySelect) els.categorySelect.value = selectedCategory;
          populateBanksForCategory(selectedCategory);
        });
      });

      // Check URL query params for initial preselection
      const urlParams = new URLSearchParams(window.location.search);
      const preCategory = urlParams.get('category');
      const preBank = urlParams.get('bank');

      if (preCategory && products.some(p => p.category === preCategory)) {
        selectedCategory = preCategory;
        if (els.categorySelect) els.categorySelect.value = selectedCategory;
      }

      populateBanksForCategory(selectedCategory);

      if (preBank && els.bankSelect) {
        els.bankSelect.value = preBank;
        populateProductsForBank(preBank);
      }
    },
    recalculate
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('calcCategorySelect')) {
    PBH_Calculator.init();
  }
});
