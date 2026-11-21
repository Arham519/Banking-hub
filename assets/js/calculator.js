/**
 * Banking Hub - Advanced Loan & Financing Calculator
 * 7-Step workflow supporting Conventional Reducing Balance, Islamic Murabaha,
 * Islamic Ijarah, and Diminishing Musharakah.
 * Supports all 16 Pakistani banking institutions with persistent user state.
 */

const PBH_Calculator = (() => {
  let products = [];
  let banks = [];
  let selectedCategory = 'home-financing';
  let selectedProduct = null;

  // Track user-entered custom values so they never drift or get overwritten
  let userEditedDownPayment = false;
  let customDownPaymentValue = null;
  let userEditedAmount = false;
  let customAmountValue = null;
  let userEditedTenure = false;
  let customTenureValue = null;

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
      displayRateMeta: document.getElementById('calcRateUpdatedMeta'),
      scheduleTableBody: document.getElementById('calcScheduleBody')
    };
  }

  // Update dynamic down payment bounds and label based on current financing amount
  function updateDynamicDownPaymentLimits() {
    const els = initElements();
    if (!els.amountInput || !els.downPaymentInput) return;

    const currentAmt = parseFloat(els.amountInput.value) || 0;
    const minDownPct = selectedProduct ? (selectedProduct.min_down_payment_percent || 0) : 15;
    const dynamicMinDown = Math.round(currentAmt * (minDownPct / 100));
    const dynamicMaxDown = Math.round(currentAmt * 0.75);

    els.downPaymentInput.min = dynamicMinDown;
    els.downPaymentInput.max = dynamicMaxDown;
    els.downPaymentRange.min = dynamicMinDown;
    els.downPaymentRange.max = dynamicMaxDown;

    if (els.minMaxDownText) {
      if (minDownPct === 0) {
        els.minMaxDownText.textContent = '0% minimum required';
      } else {
        els.minMaxDownText.textContent = `Min ${minDownPct}%: ${PBH.formatPKR(dynamicMinDown)}`;
      }
    }

    // If user has explicitly typed a down payment, preserve it
    if (userEditedDownPayment && customDownPaymentValue !== null) {
      els.downPaymentInput.value = customDownPaymentValue;
      els.downPaymentRange.value = customDownPaymentValue;
    }
  }

  // Populate bank dropdown based on category
  function populateBanksForCategory(category, preserveBank = false) {
    const els = initElements();
    if (!els.bankSelect) return;

    // Filter products for category
    const catProducts = products.filter(p => p.category === category);
    const availableBankIds = [...new Set(catProducts.map(p => p.bank_id))];

    const currentBankId = els.bankSelect.value;
    els.bankSelect.innerHTML = '<option value="">-- Select Bank --</option>';

    // Sort banks for clean alphabetical listing
    const matchedBanks = availableBankIds
      .map(bId => banks.find(b => b.id === bId))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    matchedBanks.forEach(bank => {
      const opt = document.createElement('option');
      opt.value = bank.id;
      opt.textContent = `${bank.name} (${bank.is_full_islamic ? 'Full-Fledged Islamic' : 'Conventional'})`;
      els.bankSelect.appendChild(opt);
    });

    if (preserveBank && availableBankIds.includes(currentBankId)) {
      els.bankSelect.value = currentBankId;
      populateProductsForBank(currentBankId);
    } else if (availableBankIds.length > 0) {
      // Default to Meezan Bank if available in category, otherwise first
      if (availableBankIds.includes('meezan-bank')) {
        els.bankSelect.value = 'meezan-bank';
      } else {
        els.bankSelect.selectedIndex = 1;
      }
      populateProductsForBank(els.bankSelect.value);
    } else {
      if (els.productSelect) {
        els.productSelect.innerHTML = '<option value="">No products available</option>';
      }
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

  // Adjust sliders and min/max bounds to match product terms while preserving user inputs
  function syncProductConstraints(product) {
    const els = initElements();
    if (!product || !els.amountInput) return;

    // Amount limits
    const minAmt = product.min_amount || 100000;
    const maxAmt = product.max_amount || 60000000;
    els.amountInput.min = minAmt;
    els.amountInput.max = maxAmt;
    els.amountRange.min = minAmt;
    els.amountRange.max = maxAmt;
    els.amountRange.step = 50000;

    if (els.minMaxAmountText) {
      els.minMaxAmountText.textContent = `Min: ${PBH.formatPKR(minAmt)} | Max: ${PBH.formatPKR(maxAmt)}`;
    }

    // Determine current amount value
    let currentAmt;
    if (userEditedAmount && customAmountValue !== null) {
      currentAmt = Math.min(Math.max(customAmountValue, minAmt), maxAmt);
    } else {
      const existingVal = parseFloat(els.amountInput.value);
      if (existingVal && existingVal >= minAmt && existingVal <= maxAmt) {
        currentAmt = existingVal;
      } else {
        currentAmt = Math.min(Math.max(minAmt * 2, 2500000), maxAmt);
      }
    }
    els.amountInput.value = currentAmt;
    els.amountRange.value = currentAmt;

    // Down Payment bounds & label
    const minDownPct = product.min_down_payment_percent || 0;
    const dynamicMinDown = Math.round(currentAmt * (minDownPct / 100));
    const dynamicMaxDown = Math.round(currentAmt * 0.75);

    els.downPaymentInput.min = dynamicMinDown;
    els.downPaymentInput.max = dynamicMaxDown;
    els.downPaymentRange.min = dynamicMinDown;
    els.downPaymentRange.max = dynamicMaxDown;
    els.downPaymentRange.step = 25000;

    if (els.minMaxDownText) {
      if (minDownPct === 0) {
        els.minMaxDownText.textContent = '0% minimum required';
      } else {
        els.minMaxDownText.textContent = `Min ${minDownPct}%: ${PBH.formatPKR(dynamicMinDown)}`;
      }
    }

    // Preserve user typed down payment
    if (userEditedDownPayment && customDownPaymentValue !== null) {
      els.downPaymentInput.value = customDownPaymentValue;
      els.downPaymentRange.value = customDownPaymentValue;
    } else {
      const existingDown = parseFloat(els.downPaymentInput.value);
      if (existingDown && existingDown >= dynamicMinDown) {
        els.downPaymentInput.value = existingDown;
        els.downPaymentRange.value = existingDown;
      } else {
        els.downPaymentInput.value = dynamicMinDown;
        els.downPaymentRange.value = dynamicMinDown;
      }
    }

    // Tenure limits
    const minTenure = product.min_tenure_years || 1;
    const maxTenure = product.max_tenure_years || 25;
    els.tenureInput.min = minTenure;
    els.tenureInput.max = maxTenure;
    els.tenureRange.min = minTenure;
    els.tenureRange.max = maxTenure;

    if (els.minMaxTenureText) {
      els.minMaxTenureText.textContent = `Min: ${minTenure} Yrs | Max: ${maxTenure} Yrs`;
    }

    if (userEditedTenure && customTenureValue !== null) {
      els.tenureInput.value = Math.min(Math.max(customTenureValue, minTenure), maxTenure);
      els.tenureRange.value = els.tenureInput.value;
    } else {
      const existingTenure = parseFloat(els.tenureInput.value);
      if (existingTenure && existingTenure >= minTenure && existingTenure <= maxTenure) {
        els.tenureInput.value = existingTenure;
        els.tenureRange.value = existingTenure;
      } else {
        const defTenure = Math.min(Math.max(minTenure, 5), maxTenure);
        els.tenureInput.value = defTenure;
        els.tenureRange.value = defTenure;
      }
    }
  }

  // Recalculate monthly installment & update display
  function recalculate() {
    const els = initElements();
    if (!selectedProduct || !els.amountInput) return;

    const totalAmt = parseFloat(els.amountInput.value) || 0;
    const downAmt = parseFloat(els.downPaymentInput.value) || 0;
    const tenureYrs = parseFloat(els.tenureInput.value) || 1;

    // Update dynamic min down payment label whenever recalculating
    const minDownPct = selectedProduct.min_down_payment_percent || 0;
    const dynamicMinDown = Math.round(totalAmt * (minDownPct / 100));
    if (els.minMaxDownText) {
      if (minDownPct === 0) {
        els.minMaxDownText.textContent = '0% minimum required';
      } else {
        els.minMaxDownText.textContent = `Min ${minDownPct}%: ${PBH.formatPKR(dynamicMinDown)}`;
      }
    }

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
      els.displayLastUpdated.textContent = selectedProduct.last_updated || 'Last updated: 20 Nov 2026. Source: SBP';
    }
    if (els.displayRateMeta) {
      els.displayRateMeta.textContent = `Last updated: 20 Nov 2026. Source: ${selectedProduct.bank_name} / SBP`;
    }

    // Populate Schedule Preview Table
    if (els.scheduleTableBody && result.schedule) {
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
  function bindSync(input, range, onValueChange, customHandler) {
    if (!input || !range) return;
    
    // Prevent mouse wheel scrolling on number inputs
    input.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

    input.addEventListener('input', () => {
      range.value = input.value;
      if (customHandler) customHandler(parseFloat(input.value));
      if (onValueChange) onValueChange();
    });

    range.addEventListener('input', () => {
      input.value = range.value;
      if (customHandler) customHandler(parseFloat(range.value));
      if (onValueChange) onValueChange();
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

      // Amount synchronization
      bindSync(els.amountInput, els.amountRange, () => {
        updateDynamicDownPaymentLimits();
        recalculate();
      }, (val) => {
        userEditedAmount = true;
        customAmountValue = val;
      });

      // Down Payment synchronization (preserves user value strictly)
      bindSync(els.downPaymentInput, els.downPaymentRange, recalculate, (val) => {
        userEditedDownPayment = true;
        customDownPaymentValue = val;
      });

      // Tenure synchronization
      bindSync(els.tenureInput, els.tenureRange, recalculate, (val) => {
        userEditedTenure = true;
        customTenureValue = val;
      });

      // Category pills handler
      const catPills = document.querySelectorAll('.calc-cat-pill');
      catPills.forEach(pill => {
        pill.addEventListener('click', () => {
          catPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          selectedCategory = pill.dataset.category;
          if (els.categorySelect) els.categorySelect.value = selectedCategory;
          populateBanksForCategory(selectedCategory, true);
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

      // Check if default values are pre-set in HTML
      if (els.downPaymentInput && els.downPaymentInput.value) {
        customDownPaymentValue = parseFloat(els.downPaymentInput.value);
      }
      if (els.amountInput && els.amountInput.value) {
        customAmountValue = parseFloat(els.amountInput.value);
      }
      if (els.tenureInput && els.tenureInput.value) {
        customTenureValue = parseFloat(els.tenureInput.value);
      }

      populateBanksForCategory(selectedCategory);

      if (preBank && els.bankSelect) {
        els.bankSelect.value = preBank;
        populateProductsForBank(preBank);
      }

      // Prevent any tab-switching or visibility changes from resetting inputs
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && els.downPaymentInput && customDownPaymentValue !== null && userEditedDownPayment) {
          els.downPaymentInput.value = customDownPaymentValue;
          els.downPaymentRange.value = customDownPaymentValue;
        }
      });
    },
    recalculate,
    setValues(amount, downPayment, tenureYears) {
      const els = initElements();
      if (els.amountInput) {
        els.amountInput.value = amount;
        els.amountRange.value = amount;
        userEditedAmount = true;
        customAmountValue = amount;
      }
      if (els.downPaymentInput) {
        els.downPaymentInput.value = downPayment;
        els.downPaymentRange.value = downPayment;
        userEditedDownPayment = true;
        customDownPaymentValue = downPayment;
      }
      if (els.tenureInput) {
        els.tenureInput.value = tenureYears;
        els.tenureRange.value = tenureYears;
        userEditedTenure = true;
        customTenureValue = tenureYears;
      }
      updateDynamicDownPaymentLimits();
      recalculate();
    }
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('calcCategorySelect')) {
    PBH_Calculator.init();
  }
});
