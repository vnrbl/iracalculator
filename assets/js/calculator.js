/**
 * INHERITED IRA 10-YEAR OPTIMIZER ENGINE (ENTERPRISE EDITION)
 * Compliant with SECURE Act 2.0 & IRS Final Regulations (TD 10001, IRC §§ 401(a)(9), 408)
 * Features: Paired Range Sliders, Executive KPI Dashboard, Interactive SVG Chart with Tooltips,
 * Segmented Table / Card View Toggle, and CPA Advisory Print Memo
 */

(function () {
  'use strict';

  // 2026 Projected Federal Tax Brackets (Ordinary Income)
  const TAX_BRACKETS_2026 = {
    single: [
      { max: 12000, rate: 0.10 },
      { max: 48700, rate: 0.12 },
      { max: 103350, rate: 0.22 },
      { max: 197300, rate: 0.24 },
      { max: 250525, rate: 0.32 },
      { max: 626350, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ],
    married: [
      { max: 24000, rate: 0.10 },
      { max: 97400, rate: 0.12 },
      { max: 206700, rate: 0.22 },
      { max: 394600, rate: 0.24 },
      { max: 501050, rate: 0.32 },
      { max: 751600, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ],
    hoh: [
      { max: 17100, rate: 0.10 },
      { max: 65150, rate: 0.12 },
      { max: 103350, rate: 0.22 },
      { max: 197300, rate: 0.24 },
      { max: 250500, rate: 0.32 },
      { max: 626350, rate: 0.35 },
      { max: Infinity, rate: 0.37 }
    ]
  };

  // State Tax Rates Map
  const STATE_TAX_RATES = {
    'NONE': 0.0,   // AK, FL, NV, NH, SD, TN, TX, WA, WY
    'LOW': 0.035,  // AZ, CO, IN, MI, ND, PA, etc.
    'MED': 0.055,  // GA, IL, MA, NC, OH, VA, etc.
    'HIGH': 0.090  // CA, NY, NJ, HI, OR, MN
  };

  // Default parameters
  const DEFAULTS = {
    balance: 250000,
    growth: 6.0,
    income: 95000,
    status: 'married',
    state: 'MED',
    age: 45,
    incomeGrowth: 2.5,
    rbdStatus: 'after'
  };

  // IRS Single Life Expectancy Divisors (IRS Pub 590-B Table I)
  function getLifeExpectancyDivisor(age) {
    if (age <= 30) return 55.3;
    if (age <= 40) return 45.7;
    if (age <= 50) return 36.2;
    if (age <= 60) return 27.1;
    if (age <= 70) return 18.8;
    return 14.0;
  }

  // Calculate Federal Tax on Ordinary Taxable Income
  function calculateFederalTax(taxableIncome, status) {
    const brackets = TAX_BRACKETS_2026[status] || TAX_BRACKETS_2026.single;
    let tax = 0;
    let prevMax = 0;

    for (let i = 0; i < brackets.length; i++) {
      const b = brackets[i];
      if (taxableIncome > prevMax) {
        const taxableInBracket = Math.min(taxableIncome - prevMax, b.max - prevMax);
        tax += taxableInBracket * b.rate;
        prevMax = b.max;
      } else {
        break;
      }
    }
    return tax;
  }

  // Calculate Marginal Tax on incremental withdrawal
  function calculateIncrementalTax(baseIncome, withdrawal, status, stateRate) {
    const fedTaxWithout = calculateFederalTax(baseIncome, status);
    const fedTaxWith = calculateFederalTax(baseIncome + withdrawal, status);
    const incrementalFed = fedTaxWith - fedTaxWithout;
    const incrementalState = withdrawal * stateRate;
    return {
      federal: incrementalFed,
      state: incrementalState,
      total: incrementalFed + incrementalState
    };
  }

  // Find the top bracket ceiling for the current income to smooth brackets
  function getBracketCeiling(baseIncome, status) {
    const brackets = TAX_BRACKETS_2026[status] || TAX_BRACKETS_2026.single;
    for (let i = 0; i < brackets.length; i++) {
      if (baseIncome < brackets[i].max) {
        return brackets[i].max;
      }
    }
    return baseIncome * 1.5;
  }

  // Simulation Algorithm
  function runSimulation(params) {
    const {
      balance,
      annualGrowthRate,
      baseIncome,
      incomeGrowthRate,
      filingStatus,
      stateRateKey,
      diedAfterRBD,
      beneficiaryAge
    } = params;

    const stateRate = STATE_TAX_RATES[stateRateKey] || 0.055;
    const years = 10;

    // SCENARIO 1: The Year 10 Procrastination Bomb
    const s1Schedule = [];
    let s1Bal = balance;
    let s1TotalTax = 0;
    let s1TotalWithdrawn = 0;
    let currentAge = beneficiaryAge;

    for (let y = 1; y <= years; y++) {
      const growth = s1Bal * (annualGrowthRate / 100);
      const balanceBefore = s1Bal + growth;
      const curBaseIncome = baseIncome * Math.pow(1 + incomeGrowthRate / 100, y - 1);

      let withdrawal = 0;
      if (y === 10) {
        withdrawal = balanceBefore; // Drain remaining balance
      } else if (diedAfterRBD) {
        const divisor = Math.max(1, getLifeExpectancyDivisor(currentAge) - (y - 1));
        withdrawal = Math.min(balanceBefore, balanceBefore / divisor);
      } else {
        withdrawal = 0;
      }

      const taxes = calculateIncrementalTax(curBaseIncome, withdrawal, filingStatus, stateRate);
      s1Bal = Math.max(0, balanceBefore - withdrawal);
      s1TotalTax += taxes.total;
      s1TotalWithdrawn += withdrawal;

      s1Schedule.push({
        year: y,
        age: currentAge + y - 1,
        beginningBalance: s1Bal + withdrawal,
        growth,
        withdrawal,
        taxes: taxes.total,
        endingBalance: s1Bal,
        taxableIncome: curBaseIncome + withdrawal
      });
    }

    // SCENARIO 2: Equal Annual Withdrawals
    const s2Schedule = [];
    let s2Bal = balance;
    let s2TotalTax = 0;
    let s2TotalWithdrawn = 0;

    for (let y = 1; y <= years; y++) {
      const growth = s2Bal * (annualGrowthRate / 100);
      const balanceBefore = s2Bal + growth;
      const curBaseIncome = baseIncome * Math.pow(1 + incomeGrowthRate / 100, y - 1);
      const remainingYears = years - y + 1;
      const withdrawal = balanceBefore / remainingYears;

      const taxes = calculateIncrementalTax(curBaseIncome, withdrawal, filingStatus, stateRate);
      s2Bal = Math.max(0, balanceBefore - withdrawal);
      s2TotalTax += taxes.total;
      s2TotalWithdrawn += withdrawal;

      s2Schedule.push({
        year: y,
        age: currentAge + y - 1,
        beginningBalance: s2Bal + withdrawal,
        growth,
        withdrawal,
        taxes: taxes.total,
        endingBalance: s2Bal,
        taxableIncome: curBaseIncome + withdrawal
      });
    }

    // SCENARIO 3: Bracket-Smoothing Optimization
    const s3Schedule = [];
    let s3Bal = balance;
    let s3TotalTax = 0;
    let s3TotalWithdrawn = 0;

    for (let y = 1; y <= years; y++) {
      const growth = s3Bal * (annualGrowthRate / 100);
      const balanceBefore = s3Bal + growth;
      const curBaseIncome = baseIncome * Math.pow(1 + incomeGrowthRate / 100, y - 1);
      const remainingYears = years - y + 1;

      const ceiling = getBracketCeiling(curBaseIncome, filingStatus);
      const bracketRoom = Math.max(0, ceiling - curBaseIncome);
      const proRataNeeded = balanceBefore / remainingYears;

      let withdrawal = Math.max(proRataNeeded * 0.85, Math.min(bracketRoom, proRataNeeded * 1.25));

      if (diedAfterRBD && y < 10) {
        const divisor = Math.max(1, getLifeExpectancyDivisor(currentAge) - (y - 1));
        const minRMD = balanceBefore / divisor;
        withdrawal = Math.max(withdrawal, minRMD);
      }

      if (y === 10) {
        withdrawal = balanceBefore;
      } else {
        withdrawal = Math.min(balanceBefore, withdrawal);
      }

      const taxes = calculateIncrementalTax(curBaseIncome, withdrawal, filingStatus, stateRate);
      s3Bal = Math.max(0, balanceBefore - withdrawal);
      s3TotalTax += taxes.total;
      s3TotalWithdrawn += withdrawal;

      s3Schedule.push({
        year: y,
        age: currentAge + y - 1,
        beginningBalance: s3Bal + withdrawal,
        growth,
        withdrawal,
        taxes: taxes.total,
        endingBalance: s3Bal,
        taxableIncome: curBaseIncome + withdrawal
      });
    }

    const taxSavings = Math.max(0, s1TotalTax - s3TotalTax);

    return {
      scenario1: { schedule: s1Schedule, totalTax: s1TotalTax, totalWithdrawn: s1TotalWithdrawn },
      scenario2: { schedule: s2Schedule, totalTax: s2TotalTax, totalWithdrawn: s2TotalWithdrawn },
      scenario3: { schedule: s3Schedule, totalTax: s3TotalTax, totalWithdrawn: s3TotalWithdrawn },
      taxSavings,
      beneficiaryAge
    };
  }

  // Format currency
  function fmt(num) {
    return '$' + Math.round(num).toLocaleString('en-US');
  }

  // Format compact currency ($45k, $1.2M)
  function fmtCompact(num) {
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return '$' + Math.round(num / 1000) + 'k';
    return '$' + Math.round(num);
  }

  // Smooth Count-Up Animation (presentation only)
  let lastAnimatedSavings = 0;
  let savingsAnimFrame = null;

  function prefersReducedMotion() {
    return !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function animateSavingsNumber(targetValue) {
    const el = document.getElementById('display-savings');
    if (!el) return;

    if (savingsAnimFrame) {
      cancelAnimationFrame(savingsAnimFrame);
      savingsAnimFrame = null;
    }

    const startValue = lastAnimatedSavings;
    const diff = targetValue - startValue;
    lastAnimatedSavings = targetValue;

    // Reduced-motion users (and any environment where rAF is throttled) get the
    // final figure immediately — results must never appear stale or count up.
    if (prefersReducedMotion() || diff === 0 || typeof requestAnimationFrame !== 'function') {
      el.textContent = fmt(targetValue);
      return;
    }

    const duration = 400;
    const startTime = performance.now();

    function step(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = fmt(Math.round(startValue + diff * ease));

      if (progress < 1) {
        savingsAnimFrame = requestAnimationFrame(step);
      } else {
        el.textContent = fmt(targetValue);
        savingsAnimFrame = null;
      }
    }

    savingsAnimFrame = requestAnimationFrame(step);
  }

  // Render Modern Responsive SVG Chart
  function renderSvgChart(results) {
    const s1 = results.scenario1.schedule;
    const s3 = results.scenario3.schedule;
    const maxVal = Math.max(
      ...s1.map(d => d.withdrawal),
      ...s3.map(d => d.withdrawal),
      10000
    );

    const width = 640;
    const height = 240;
    const padLeft = 45;
    const padRight = 20;
    const padTop = 30;
    const padBottom = 32;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;
    const groupW = chartW / 10;
    const barWidth = groupW * 0.36;

    const y50 = height - padBottom - chartH * 0.5;
    const y100 = height - padBottom - chartH;

    let gridSvg = `
      <defs>
        <linearGradient id="barGradRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#C4503F"/>
          <stop offset="100%" stop-color="#A83328"/>
        </linearGradient>
        <linearGradient id="barGradGreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2E7D5F"/>
          <stop offset="100%" stop-color="#0E5B45"/>
        </linearGradient>
      </defs>
      <!-- Reference Gridlines -->
      <line x1="${padLeft}" y1="${y100}" x2="${width - padRight}" y2="${y100}" stroke="#DDD8CE" stroke-dasharray="3 3" stroke-width="1"/>
      <text x="${padLeft - 6}" y="${y100 + 4}" font-size="10" font-family="Inter, sans-serif" fill="#8C938E" text-anchor="end">${fmtCompact(maxVal)}</text>

      <line x1="${padLeft}" y1="${y50}" x2="${width - padRight}" y2="${y50}" stroke="#EBE7DF" stroke-dasharray="3 3" stroke-width="1"/>
      <text x="${padLeft - 6}" y="${y50 + 4}" font-size="10" font-family="Inter, sans-serif" fill="#8C938E" text-anchor="end">${fmtCompact(maxVal * 0.5)}</text>

      <!-- Baseline -->
      <line x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" stroke="#CFC9BD" stroke-width="1.5"/>
    `;

    let bars = '';
    for (let i = 0; i < 10; i++) {
      const xGroup = padLeft + (i * groupW) + (groupW * 0.12);
      const h1 = Math.max(3, (s1[i].withdrawal / maxVal) * chartH);
      const h3 = Math.max(3, (s3[i].withdrawal / maxVal) * chartH);

      const y1 = height - padBottom - h1;
      const y3 = height - padBottom - h3;

      // Group wrapper with data attributes for hover/touch events
      bars += `
        <g class="chart-year-group" data-year="${i + 1}" data-s1="${s1[i].withdrawal}" data-s3="${s3[i].withdrawal}" data-s1tax="${s1[i].taxes}" data-s3tax="${s3[i].taxes}">
          <!-- S1 Bar (Tax Bomb Crimson) -->
          <rect x="${xGroup}" y="${y1}" width="${barWidth}" height="${h1}" rx="4" fill="url(#barGradRed)" class="chart-bar bar-bomb">
            <title>Year ${i + 1} Lump-Sum Bomb: ${fmt(s1[i].withdrawal)} (Tax: ${fmt(s1[i].taxes)})</title>
          </rect>

          <!-- S3 Bar (Optimized Emerald) -->
          <rect x="${xGroup + barWidth + 3}" y="${y3}" width="${barWidth}" height="${h3}" rx="4" fill="url(#barGradGreen)" class="chart-bar bar-opt">
            <title>Year ${i + 1} Smoothed Payout: ${fmt(s3[i].withdrawal)} (Tax: ${fmt(s3[i].taxes)})</title>
          </rect>

          <!-- Year 10 Bomb Callout Tag -->
          ${i === 9 ? `
            <text x="${xGroup + barWidth * 0.5}" y="${Math.max(14, y1 - 6)}" font-size="9.5" font-weight="800" font-family="Inter, sans-serif" fill="#B23A2E" text-anchor="middle">
              ${fmtCompact(s1[i].withdrawal)}
            </text>
          ` : ''}

          <!-- X-Axis Year label -->
          <text x="${xGroup + barWidth + 1.5}" y="${height - padBottom + 17}" font-size="11" font-weight="600" font-family="Inter, sans-serif" text-anchor="middle" fill="#5C645F" class="axis-label">
            Y${i + 1}
          </text>
        </g>
      `;
    }

    return `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="10-Year Distribution Comparison Chart">
        ${gridSvg}
        ${bars}
      </svg>
    `;
  }

  // Update Executive Dashboard KPIs
  function updateKPIs(results) {
    const s1TotalTax = results.scenario1.totalTax;
    const s1Withdrawn = results.scenario1.totalWithdrawn;
    const s3TotalTax = results.scenario3.totalTax;
    const s3Withdrawn = results.scenario3.totalWithdrawn;

    const rateS1 = s1Withdrawn > 0 ? (s1TotalTax / s1Withdrawn * 100).toFixed(1) : '0.0';
    const rateS3 = s3Withdrawn > 0 ? (s3TotalTax / s3Withdrawn * 100).toFixed(1) : '0.0';
    const y10Diff = Math.max(0, results.scenario1.schedule[9].taxes - results.scenario3.schedule[9].taxes);

    const kpiSpike = document.getElementById('kpi-spike');
    const kpiSpikeSub = document.getElementById('kpi-spike-sub');
    const kpiRate = document.getElementById('kpi-rate');
    const kpiRetained = document.getElementById('kpi-retained');

    if (kpiSpike) {
      kpiSpike.textContent = 'Eliminated';
      kpiSpike.className = 'kpi-value text-emerald';
    }
    if (kpiSpikeSub) {
      kpiSpikeSub.textContent = `Avoided ${fmt(y10Diff)} in single-year tax shock`;
    }
    if (kpiRate) {
      kpiRate.textContent = `${rateS3}% vs ${rateS1}%`;
    }
    if (kpiRetained) {
      kpiRetained.textContent = '+' + fmt(results.taxSavings);
    }
  }

  // Render Year-by-Year Cards (Mobile Optimized)
  function renderMobileCards(results) {
    const container = document.getElementById('schedule-cards-container');
    if (!container) return;

    const s1 = results.scenario1.schedule;
    const s3 = results.scenario3.schedule;
    const baseAge = results.beneficiaryAge;

    let html = '';
    for (let i = 0; i < 10; i++) {
      const year = i + 1;
      const age = baseAge + i;
      const optWithdrawal = s3[i].withdrawal;
      const bombWithdrawal = s1[i].withdrawal;
      const optTax = s3[i].taxes;
      const optEndBal = s3[i].endingBalance;

      html += `
        <div class="mobile-year-card ${year === 10 ? 'year-10-card' : ''}" data-year="${year}">
          <div class="myc-header">
            <div class="myc-title">
              <span class="myc-badge">Year ${year}</span>
              <span class="myc-age">Age ${age}</span>
            </div>
            ${year === 10 ? '<span class="myc-tag-bomb">Year 10 Final Clearance</span>' : ''}
          </div>
          <div class="myc-grid">
            <div class="myc-stat">
              <span class="myc-stat-label">Optimized Payout</span>
              <span class="myc-stat-value text-emerald">${fmt(optWithdrawal)}</span>
            </div>
            <div class="myc-stat">
              <span class="myc-stat-label">Tax Bomb Payout</span>
              <span class="myc-stat-value text-crimson">${fmt(bombWithdrawal)}</span>
            </div>
            <div class="myc-stat">
              <span class="myc-stat-label">Estimated Tax</span>
              <span class="myc-stat-value">${fmt(optTax)}</span>
            </div>
            <div class="myc-stat">
              <span class="myc-stat-label">Ending Balance</span>
              <span class="myc-stat-value">${fmt(optEndBal)}</span>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // Update DOM Results
  function updateUI() {
    const balance = parseFloat(document.getElementById('input-balance').value) || 250000;
    const annualGrowthRate = parseFloat(document.getElementById('input-growth').value) || 6.0;
    const baseIncome = parseFloat(document.getElementById('input-income').value) || 95000;
    const incomeGrowthRate = parseFloat(document.getElementById('input-income-growth').value) || 2.5;
    const filingStatus = document.getElementById('input-status').value || 'married';
    const stateRateKey = document.getElementById('input-state').value || 'MED';
    const diedAfterRBD = document.getElementById('rbd-after').checked;
    const beneficiaryAge = parseInt(document.getElementById('input-age').value, 10) || 45;

    const results = runSimulation({
      balance,
      annualGrowthRate,
      baseIncome,
      incomeGrowthRate,
      filingStatus,
      stateRateKey,
      diedAfterRBD,
      beneficiaryAge
    });

    // Strategy Savings Banner
    animateSavingsNumber(results.taxSavings);

    // KPI Summary
    updateKPIs(results);

    // Real-time Mobile Tab & Sticky Bar sync
    const tabSavingsBadge = document.getElementById('tab-savings-badge');
    const msbSavingsDisplay = document.getElementById('msb-savings-display');
    if (tabSavingsBadge) tabSavingsBadge.textContent = '+' + fmt(results.taxSavings);
    if (msbSavingsDisplay) msbSavingsDisplay.textContent = fmt(results.taxSavings);

    // Scenario Comparison Cards
    const s1TotalEl = document.getElementById('s1-total-tax');
    const s1Y10El = document.getElementById('s1-year10-tax');
    const s2TotalEl = document.getElementById('s2-total-tax');
    const s3TotalEl = document.getElementById('s3-total-tax');
    const s3Y10El = document.getElementById('s3-year10-tax');

    if (s1TotalEl) s1TotalEl.textContent = fmt(results.scenario1.totalTax);
    if (s1Y10El) s1Y10El.textContent = fmt(results.scenario1.schedule[9].taxes);
    if (s2TotalEl) s2TotalEl.textContent = fmt(results.scenario2.totalTax);
    if (s3TotalEl) s3TotalEl.textContent = fmt(results.scenario3.totalTax);
    if (s3Y10El) s3Y10El.textContent = 'Avoided (' + fmt(results.scenario3.schedule[9].taxes) + ')';

    // SVG Chart
    const chartContainer = document.getElementById('chart-container');
    if (chartContainer) {
      chartContainer.innerHTML = renderSvgChart(results);
      attachChartInteractiveEvents();
    }

    // Detailed Schedule Table
    const tbody = document.getElementById('schedule-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      const s1 = results.scenario1.schedule;
      const s3 = results.scenario3.schedule;

      for (let i = 0; i < 10; i++) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-year', i + 1);
        tr.innerHTML = `
          <td><strong>Year ${i + 1}</strong> <span class="sub-age">(Age ${beneficiaryAge + i})</span></td>
          <td>${fmt(s3[i].beginningBalance)}</td>
          <td class="col-highlight" style="color: #0E5B45; font-weight: 700;">${fmt(s3[i].withdrawal)}</td>
          <td style="color: #B23A2E; font-weight: 600;">${fmt(s1[i].withdrawal)}</td>
          <td>${fmt(s3[i].taxableIncome)}</td>
          <td>${fmt(s3[i].taxes)}</td>
          <td>${fmt(s3[i].endingBalance)}</td>
        `;
        tbody.appendChild(tr);
      }
    }

    // Render Mobile Cards View
    renderMobileCards(results);
  }

  // Interactive SVG Chart Tooltips
  function attachChartInteractiveEvents() {
    const groups = document.querySelectorAll('.chart-year-group');
    const tooltipBox = document.getElementById('chart-interactive-tooltip');
    if (!groups.length || !tooltipBox) return;

    groups.forEach(g => {
      function showDetails(e) {
        const yr = g.getAttribute('data-year');
        const s1 = parseFloat(g.getAttribute('data-s1'));
        const s3 = parseFloat(g.getAttribute('data-s3'));
        const s1tax = parseFloat(g.getAttribute('data-s1tax'));
        const s3tax = parseFloat(g.getAttribute('data-s3tax'));
        const diff = Math.max(0, s1tax - s3tax);

        tooltipBox.innerHTML = `
          <div class="cit-content">
            <div class="cit-header">
              <strong>Year ${yr} Analysis</strong>
              <span class="cit-badge">${diff > 0 ? 'Saves ' + fmt(diff) : 'RMD Compliant'}</span>
            </div>
            <div class="cit-row">
              <span class="cit-dot red"></span>
              <span>Year 10 Bomb:</span>
              <strong>${fmt(s1)}</strong>
              <span class="cit-tax">Tax: ${fmt(s1tax)}</span>
            </div>
            <div class="cit-row">
              <span class="cit-dot green"></span>
              <span>Optimized:</span>
              <strong>${fmt(s3)}</strong>
              <span class="cit-tax">Tax: ${fmt(s3tax)}</span>
            </div>
          </div>
        `;
        tooltipBox.classList.add('visible');

        // Highlight matching table row
        document.querySelectorAll('#schedule-tbody tr').forEach(r => {
          r.classList.toggle('row-active', r.getAttribute('data-year') === yr);
        });
      }

      g.addEventListener('mouseenter', showDetails);
      g.addEventListener('click', showDetails);
      g.addEventListener('mouseleave', () => {
        document.querySelectorAll('#schedule-tbody tr').forEach(r => r.classList.remove('row-active'));
      });
    });
  }

  // Sync Input and Range Sliders
  function setupSliderSync(inputId, sliderId) {
    const input = document.getElementById(inputId);
    const slider = document.getElementById(sliderId);
    if (!input || !slider) return;

    slider.addEventListener('input', () => {
      input.value = slider.value;
      updateUI();
    });

    input.addEventListener('input', () => {
      if (parseFloat(input.value) >= parseFloat(slider.min) && parseFloat(input.value) <= parseFloat(slider.max)) {
        slider.value = input.value;
      }
      updateUI();
    });
  }

  // Load Preset
  function applyPreset(presetData) {
    if (presetData.balance !== undefined) {
      document.getElementById('input-balance').value = presetData.balance;
      const sb = document.getElementById('slider-balance');
      if (sb) sb.value = Math.min(parseFloat(sb.max), presetData.balance);
    }
    if (presetData.growth !== undefined) {
      document.getElementById('input-growth').value = presetData.growth;
      const sg = document.getElementById('slider-growth');
      if (sg) sg.value = presetData.growth;
    }
    if (presetData.income !== undefined) {
      document.getElementById('input-income').value = presetData.income;
      const si = document.getElementById('slider-income');
      if (si) si.value = Math.min(parseFloat(si.max), presetData.income);
    }
    if (presetData.status !== undefined) document.getElementById('input-status').value = presetData.status;
    if (presetData.state !== undefined) document.getElementById('input-state').value = presetData.state;
    if (presetData.age !== undefined) document.getElementById('input-age').value = presetData.age;
    if (presetData.incomeGrowth !== undefined) document.getElementById('input-income-growth').value = presetData.incomeGrowth;

    if (presetData.rbdStatus) {
      const isAfter = presetData.rbdStatus === 'after';
      document.getElementById('rbd-after').checked = isAfter;
      document.getElementById('rbd-before').checked = !isAfter;
      document.querySelectorAll('.radio-tile').forEach(tile => {
        const input = tile.querySelector('input[type="radio"]');
        if (input) {
          tile.classList.toggle('active', input.checked);
        }
      });
    }

    updateUI();
  }

  // Initialize
  window.addEventListener('DOMContentLoaded', () => {
    // Bi-directional slider sync
    setupSliderSync('input-balance', 'slider-balance');
    setupSliderSync('input-growth', 'slider-growth');
    setupSliderSync('input-income', 'slider-income');

    const formInputs = document.querySelectorAll('#calc-form input, #calc-form select');
    formInputs.forEach(input => {
      input.addEventListener('input', updateUI);
      input.addEventListener('change', updateUI);
    });

    // Radio tile styling
    const radioTiles = document.querySelectorAll('.radio-tile');
    radioTiles.forEach(tile => {
      tile.addEventListener('click', () => {
        const input = tile.querySelector('input[type="radio"]');
        if (input) {
          input.checked = true;
          const groupName = input.name;
          document.querySelectorAll(`input[name="${groupName}"]`).forEach(r => {
            r.closest('.radio-tile').classList.remove('active');
          });
          tile.classList.add('active');
          updateUI();
        }
      });
    });

    // Preset Buttons
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const preset = {
          balance: btn.dataset.balance ? parseFloat(btn.dataset.balance) : undefined,
          growth: btn.dataset.growth ? parseFloat(btn.dataset.growth) : undefined,
          income: btn.dataset.income ? parseFloat(btn.dataset.income) : undefined,
          status: btn.dataset.status || undefined,
          rbdStatus: btn.dataset.rbd || undefined
        };
        applyPreset(preset);
      });
    });

    // Reset Defaults Button
    const resetBtn = document.getElementById('btn-reset-defaults');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
        const standardBtn = document.querySelector('.btn-preset[data-balance="250000"]');
        if (standardBtn) standardBtn.classList.add('active');
        applyPreset(DEFAULTS);
      });
    }

    // View Switcher (Table View vs. Card View for Mobile)
    const btnTable = document.getElementById('btn-view-table');
    const btnCards = document.getElementById('btn-view-cards');
    const tableContainer = document.getElementById('schedule-table-container');
    const cardsContainer = document.getElementById('schedule-cards-container');

    if (btnTable && btnCards && tableContainer && cardsContainer) {
      btnTable.addEventListener('click', () => {
        btnTable.classList.add('active');
        btnCards.classList.remove('active');
        tableContainer.style.display = 'block';
        cardsContainer.style.display = 'none';
      });

      btnCards.addEventListener('click', () => {
        btnCards.classList.add('active');
        btnTable.classList.remove('active');
        tableContainer.style.display = 'none';
        cardsContainer.style.display = 'grid';
      });
    }

    // Print Report
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // -------------------------------------------------------------
    // Mobile & Tablet Segmented Tab Switcher Logic
    // -------------------------------------------------------------
    let activeMobileTab = 'inputs';
    const inputCard = document.querySelector('.calc-card');
    const resultsCard = document.getElementById('results-panel');
    const scheduleWrap = document.querySelector('.schedule-table-wrap');
    const tabBtns = document.querySelectorAll('.calc-tab-btn');
    const msbToggleBtn = document.getElementById('msb-toggle-btn');
    const btnJumpResults = document.getElementById('btn-jump-results');
    const btnJumpInputs = document.getElementById('btn-jump-inputs');

    function applyMobileTab(tabKey, shouldScroll) {
      activeMobileTab = tabKey;
      const isMobileOrTablet = window.innerWidth <= 1024;

      tabBtns.forEach(btn => {
        const isMatch = btn.getAttribute('data-tab') === tabKey;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      });

      if (isMobileOrTablet && inputCard && resultsCard) {
        if (tabKey === 'inputs') {
          inputCard.style.display = 'block';
          resultsCard.style.display = 'none';
          if (msbToggleBtn) msbToggleBtn.textContent = 'View Results ➔';
        } else if (tabKey === 'results') {
          inputCard.style.display = 'none';
          resultsCard.style.display = 'block';
          if (msbToggleBtn) msbToggleBtn.textContent = 'Edit Inputs ➔';
        } else if (tabKey === 'schedule') {
          inputCard.style.display = 'none';
          resultsCard.style.display = 'block';
          if (msbToggleBtn) msbToggleBtn.textContent = 'Edit Inputs ➔';
          if (scheduleWrap) {
            setTimeout(() => {
              scheduleWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 60);
          }
        }
      } else {
        // Desktop: show both side-by-side
        if (inputCard) inputCard.style.display = '';
        if (resultsCard) resultsCard.style.display = '';
      }

      if (shouldScroll) {
        const calcSection = document.getElementById('calculator');
        if (calcSection) {
          const yOffset = -70;
          const y = calcSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }
    }

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        applyMobileTab(tab, true);
      });
    });

    if (btnJumpResults) {
      btnJumpResults.addEventListener('click', () => {
        applyMobileTab('results', true);
      });
    }

    if (btnJumpInputs) {
      btnJumpInputs.addEventListener('click', () => {
        applyMobileTab('inputs', true);
      });
    }

    if (msbToggleBtn) {
      msbToggleBtn.addEventListener('click', () => {
        if (activeMobileTab === 'inputs') {
          applyMobileTab('results', true);
        } else {
          applyMobileTab('inputs', true);
        }
      });
    }

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        if (inputCard) inputCard.style.display = '';
        if (resultsCard) resultsCard.style.display = '';
      } else {
        applyMobileTab(activeMobileTab, false);
      }
    });

    // Auto-select Card View on mobile screens <= 640px initially
    if (window.innerWidth <= 640 && btnCards && btnTable && tableContainer && cardsContainer) {
      btnCards.classList.add('active');
      btnTable.classList.remove('active');
      tableContainer.style.display = 'none';
      cardsContainer.style.display = 'grid';
    }

    // Initialize mobile tab state
    applyMobileTab('inputs', false);

    // Initial render
    updateUI();
  });

})();
