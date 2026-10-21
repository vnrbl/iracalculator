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

  // Last computed inputs/results, snapshot for the print report.
  let lastParams = null;
  let lastResults = null;
  let printReportHost = null;

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

  // Top marginal bracket that a given taxable income reaches (used to explain
  // which bracket a withdrawal lands in).
  function getTopBracketRate(taxableIncome, status) {
    const brackets = TAX_BRACKETS_2026[status] || TAX_BRACKETS_2026.single;
    for (let i = 0; i < brackets.length; i++) {
      if (taxableIncome <= brackets[i].max) return Math.round(brackets[i].rate * 100);
    }
    return 37;
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
  // `idSuffix` keeps duplicate gradient IDs apart when a second chart is
  // embedded in the print report.
  function renderSvgChart(results, idSuffix) {
    const s1 = results.scenario1.schedule;
    const s3 = results.scenario3.schedule;
    const maxVal = Math.max(
      ...s1.map(d => d.withdrawal),
      ...s3.map(d => d.withdrawal),
      10000
    );
    const gradBomb = 'barGradRed' + (idSuffix || '');
    const gradOpt = 'barGradGreen' + (idSuffix || '');

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
        <linearGradient id="${gradBomb}" x1="0" y1="0" x2="0" y2="1">
          <stop class="stop-a" offset="0%" stop-color="#C9564A"/>
          <stop class="stop-b" offset="100%" stop-color="#A83328"/>
        </linearGradient>
        <linearGradient id="${gradOpt}" x1="0" y1="0" x2="0" y2="1">
          <stop class="stop-a" offset="0%" stop-color="#1B7A5C"/>
          <stop class="stop-b" offset="100%" stop-color="#0A4A38"/>
        </linearGradient>
      </defs>
      <!-- Reference Gridlines -->
      <line class="chart-gridline" x1="${padLeft}" y1="${y100}" x2="${width - padRight}" y2="${y100}" stroke-dasharray="3 3" stroke-width="1"/>
      <text class="chart-value-label" x="${padLeft - 6}" y="${y100 + 4}" font-size="10" text-anchor="end">${fmtCompact(maxVal)}</text>

      <line class="chart-gridline" x1="${padLeft}" y1="${y50}" x2="${width - padRight}" y2="${y50}" stroke-dasharray="3 3" stroke-width="1"/>
      <text class="chart-value-label" x="${padLeft - 6}" y="${y50 + 4}" font-size="10" text-anchor="end">${fmtCompact(maxVal * 0.5)}</text>

      <!-- Baseline -->
      <line class="chart-axis-line" x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" stroke-width="1.5"/>
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
          <rect x="${xGroup}" y="${y1}" width="${barWidth}" height="${h1}" rx="4" fill="url(#${gradBomb})" class="chart-bar bar-bomb">
            <title>Year ${i + 1} Lump-Sum Bomb: ${fmt(s1[i].withdrawal)} (Tax: ${fmt(s1[i].taxes)})</title>
          </rect>

          <!-- S3 Bar (Optimized Emerald) -->
          <rect x="${xGroup + barWidth + 3}" y="${y3}" width="${barWidth}" height="${h3}" rx="4" fill="url(#${gradOpt})" class="chart-bar bar-opt">
            <title>Year ${i + 1} Smoothed Payout: ${fmt(s3[i].withdrawal)} (Tax: ${fmt(s3[i].taxes)})</title>
          </rect>

          <!-- Year 10 Bomb Callout Tag -->
          ${i === 9 ? `
            <text class="chart-bar-label" x="${xGroup + barWidth * 0.5}" y="${Math.max(14, y1 - 6)}" font-size="9.5" font-weight="800" text-anchor="middle">
              ${fmtCompact(s1[i].withdrawal)}
            </text>
          ` : ''}

          <!-- X-Axis Year label -->
          <text x="${xGroup + barWidth + 1.5}" y="${height - padBottom + 17}" font-size="11" font-weight="600" text-anchor="middle" class="chart-axis-label axis-label">
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
    const y10S1 = results.scenario1.schedule[9].taxes;
    const y10S3 = results.scenario3.schedule[9].taxes;
    const y10Diff = Math.max(0, y10S1 - y10S3);
    const y10Drop = y10S1 > 0 ? Math.round((1 - y10S3 / y10S1) * 100) : 0;

    const kpiSpike = document.getElementById('kpi-spike');
    const kpiSpikeSub = document.getElementById('kpi-spike-sub');
    const kpiRate = document.getElementById('kpi-rate');
    const kpiRetained = document.getElementById('kpi-retained');

    if (kpiSpike) {
      kpiSpike.textContent = y10S1 > 0 ? Math.max(0, y10Drop) + '% lower' : 'Eliminated';
      kpiSpike.className = 'kpi-value text-emerald';
    }
    if (kpiSpikeSub) {
      kpiSpikeSub.textContent = `Year 10 tax: ${fmt(y10S3)} vs ${fmt(y10S1)} — ${fmt(y10Diff)} avoided`;
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
              <span class="myc-stat-label">Effective Rate</span>
              <span class="myc-stat-value">${optWithdrawal > 0 ? ((optTax / optWithdrawal) * 100).toFixed(1) + '%' : '—'}</span>
            </div>
            <div class="myc-stat">
              <span class="myc-stat-label">Top Bracket</span>
              <span class="myc-stat-value">${getTopBracketRate(s3[i].taxableIncome, document.getElementById('input-status').value || 'married')}%</span>
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

  // -----------------------------------------------------------------
  // PRINT REPORT — generated from the latest calculation and printed
  // instead of the marketing page (only `.print-report` shows in print).
  // -----------------------------------------------------------------
  function ensurePrintHost() {
    if (printReportHost && document.body.contains(printReportHost)) {
      return printReportHost;
    }
    printReportHost = document.createElement('section');
    printReportHost.id = 'print-report';
    printReportHost.className = 'print-report';
    printReportHost.setAttribute('aria-hidden', 'true');
    document.body.appendChild(printReportHost);
    return printReportHost;
  }

  function buildPrintReport() {
    if (!lastParams || !lastResults) return;

    const p = lastParams;
    const r = lastResults;
    const host = ensurePrintHost();

    const statusLabel = {
      single: 'Single',
      married: 'Married filing jointly',
      hoh: 'Head of household'
    }[p.filingStatus] || 'Single';
    const stateRate = (STATE_TAX_RATES[p.stateRateKey] || 0) * 100;
    const generated = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    const s1 = r.scenario1;
    const s2 = r.scenario2;
    const s3 = r.scenario3;
    const y10S1 = s1.schedule[9].taxes;
    const y10S3 = s3.schedule[9].taxes;
    const y10Drop = y10S1 > 0 ? Math.max(0, Math.round((1 - y10S3 / y10S1) * 100)) : 0;
    const recommended = s2.totalTax <= s3.totalTax ? 'Equal annual plan' : 'Bracket smoothing';
    const s3Rate = s3.totalWithdrawn > 0 ? ((s3.totalTax / s3.totalWithdrawn) * 100).toFixed(1) : '0.0';
    const s1Rate = s1.totalWithdrawn > 0 ? ((s1.totalTax / s1.totalWithdrawn) * 100).toFixed(1) : '0.0';

    const taxableTotal = s3.schedule.reduce((sum, row) => sum + row.taxableIncome, 0);

    const scheduleRows = s3.schedule.map((row, i) => `
          <tr>
            <td>Year ${i + 1} (age ${row.age})</td>
            <td>${fmt(row.beginningBalance)}</td>
            <td class="col-good">${fmt(row.withdrawal)}</td>
            <td>${fmt(row.taxableIncome)}</td>
            <td>${fmt(row.taxes)}</td>
            <td>${row.withdrawal > 0 ? ((row.taxes / row.withdrawal) * 100).toFixed(1) + '%' : '—'}</td>
            <td>${fmt(row.endingBalance)}</td>
          </tr>`).join('');

    host.innerHTML = `
      <header class="pr-header">
        <div>
          <h1 class="pr-title">Inherited IRA 10-Year Distribution Analysis</h1>
          <p class="pr-meta">Prepared with IRACALCULATOR (iracalculator.online) · Generated ${generated} · Figures are estimates, not tax advice</p>
        </div>
      </header>

      <section class="pr-callout">
        <div class="pr-callout-main">
          <div class="pr-label">Estimated lifetime tax savings — smoothing vs. a single Year 10 liquidation</div>
          <div class="pr-savings">${fmt(r.taxSavings)}</div>
          <p class="pr-sub">Versus ${fmt(s1.totalTax)} of total tax if the balance is left to grow and liquidated entirely in Year 10.</p>
        </div>
        <div class="pr-kpi-row">
          <div class="pr-kpi">
            <span class="pr-label">Effective rate</span>
            <strong>${s3Rate}% vs ${s1Rate}%</strong>
            Smoothing vs. waiting
          </div>
          <div class="pr-kpi">
            <span class="pr-label">Year 10 tax</span>
            <strong>${fmt(y10S3)} vs ${fmt(y10S1)}</strong>
            ${y10Drop > 0 ? y10Drop + '% lower' : 'no change'}
          </div>
          <div class="pr-kpi">
            <span class="pr-label">Lowest-tax plan</span>
            <strong>${recommended}</strong>
            Lowest 10-year total tax
          </div>
        </div>
      </section>

      <h2 class="pr-section-title">Assumptions</h2>
      <div class="pr-assumptions">
        <div class="pr-cell"><span class="pr-label">Starting balance</span><strong>${fmt(p.balance)}</strong></div>
        <div class="pr-cell"><span class="pr-label">Expected annual return</span><strong>${p.annualGrowthRate.toFixed(1)}%</strong></div>
        <div class="pr-cell"><span class="pr-label">Base taxable income</span><strong>${fmt(p.baseIncome)}</strong></div>
        <div class="pr-cell"><span class="pr-label">Filing status</span><strong>${statusLabel}</strong></div>
        <div class="pr-cell"><span class="pr-label">State tax tier</span><strong>${stateRate.toFixed(1)}%</strong></div>
        <div class="pr-cell"><span class="pr-label">RMD window</span><strong>${p.diedAfterRBD ? 'Required, years 1–9' : 'Not required'}</strong></div>
        <div class="pr-cell"><span class="pr-label">Beneficiary age in Year 1</span><strong>${p.beneficiaryAge}</strong></div>
        <div class="pr-cell"><span class="pr-label">Income growth</span><strong>${p.incomeGrowthRate.toFixed(1)}% per year</strong></div>
        <div class="pr-cell"><span class="pr-label">Owner died</span><strong>${p.diedAfterRBD ? 'Age 73 or later' : 'Before age 73'}</strong></div>
      </div>

      <h2 class="pr-section-title">How this is calculated</h2>
      <p class="pr-method">Every year the model recalculates federal tax on <strong>base income + that year's withdrawal</strong> using 2026 ordinary-income brackets for ${statusLabel}, then adds the flat ${stateRate.toFixed(1)}% state rate. The savings figure compares the full 10-year tax of two paths with identical investments and identical dollars distributed by Year 10 — only the timing differs.</p>

      <h2 class="pr-section-title">Strategy comparison — 10-year totals</h2>
      <table class="pr-table">
        <thead>
          <tr>
            <th scope="col">Strategy</th>
            <th scope="col">Total 10-yr tax</th>
            <th scope="col">Year 10 tax</th>
            <th scope="col">Savings vs. Year 10</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Wait for Year 10 (minimums, then full liquidation)</td>
            <td class="col-warn">${fmt(s1.totalTax)}</td>
            <td class="col-warn">${fmt(y10S1)}</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Equal annual plan${recommended === 'Equal annual plan' ? ' <span class="pr-badge">Lowest tax</span>' : ''}</td>
            <td>${fmt(s2.totalTax)}</td>
            <td>${fmt(s2.schedule[9].taxes)}</td>
            <td class="col-good">${fmt(Math.max(0, s1.totalTax - s2.totalTax))}</td>
          </tr>
          <tr>
            <td>Bracket smoothing${recommended === 'Bracket smoothing' ? ' <span class="pr-badge">Lowest tax</span>' : ''}</td>
            <td>${fmt(s3.totalTax)}</td>
            <td>${fmt(y10S3)}</td>
            <td class="col-good">${fmt(Math.max(0, s1.totalTax - s3.totalTax))}</td>
          </tr>
        </tbody>
      </table>

      <h2 class="pr-section-title">Bracket-smoothing schedule, year by year</h2>
      <table class="pr-table">
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Starting balance</th>
            <th scope="col">Withdrawal</th>
            <th scope="col">Taxable income</th>
            <th scope="col">Estimated tax</th>
            <th scope="col">Effective rate</th>
            <th scope="col">Ending balance</th>
          </tr>
        </thead>
        <tbody>${scheduleRows}
        </tbody>
        <tfoot>
          <tr>
            <td>Totals</td>
            <td></td>
            <td>${fmt(s3.totalWithdrawn)}</td>
            <td>${fmt(taxableTotal)}</td>
            <td>${fmt(s3.totalTax)}</td>
            <td>${s3Rate}%</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <h2 class="pr-section-title">Annual withdrawals — the two paths visually</h2>
      <div class="pr-chart">${renderSvgChart(r, 'Print')}</div>
      <p class="pr-caption">Red bars: waiting until Year 10 and draining the account at once. Green bars: the bracket-smoothing plan detailed above. Only the green path is automatic — plan each year's withdrawal deliberately.</p>

      <div class="pr-next-steps">
        <div class="pr-label">Before you act</div>
        <ul>
          <li>Bring the schedule and totals to your CPA or CFP before executing distributions.</li>
          <li>Re-run the calculator with different base income and state tiers — the cheapest plan can change with either.</li>
          <li>Recalculate each year: balances, income, and bracket thresholds all move.</li>
        </ul>
      </div>

      <footer class="pr-footer">
        <p><strong>Method notes.</strong> Federal tax uses 2026 ordinary-income brackets (${statusLabel}). Where RMDs apply, annual minimums follow the IRS single-life expectancy table (Pub 590-B), approximated by age band. The inherited balance compounds at ${p.annualGrowthRate.toFixed(1)}% and baseline income grows ${p.incomeGrowthRate.toFixed(1)}% per year. All distributions are treated as fully taxable ordinary income; deductions, credits, net investment income tax, and penalty rules are outside the model.</p>
        <p>For educational purposes only — not legal, tax, or investment advice. Always consult a licensed CPA or CFP before executing retirement distributions. © ${new Date().getFullYear()} IRACALCULATOR (iracalculator.online).</p>
      </footer>
    `;
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

    // Snapshot for the print report (kept in sync on every recompute).
    lastParams = {
      balance,
      annualGrowthRate,
      baseIncome,
      incomeGrowthRate,
      filingStatus,
      stateRateKey,
      diedAfterRBD,
      beneficiaryAge
    };
    lastResults = results;

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
    const s2Y10El = document.getElementById('s2-year10-tax');
    const s3TotalEl = document.getElementById('s3-total-tax');
    const s3Y10El = document.getElementById('s3-year10-tax');

    if (s1TotalEl) s1TotalEl.textContent = fmt(results.scenario1.totalTax);
    if (s1Y10El) s1Y10El.textContent = fmt(results.scenario1.schedule[9].taxes);
    if (s2TotalEl) s2TotalEl.textContent = fmt(results.scenario2.totalTax);
    if (s2Y10El) s2Y10El.textContent = fmt(results.scenario2.schedule[9].taxes);
    if (s3TotalEl) s3TotalEl.textContent = fmt(results.scenario3.totalTax);
    if (s3Y10El) s3Y10El.textContent = fmt(results.scenario3.schedule[9].taxes);

    // The "lowest tax" badge follows the actual cheapest of the two spread-out
    // plans instead of being hard-coded to bracket smoothing.
    const recommendedScenario = results.scenario2.totalTax <= results.scenario3.totalTax ? 2 : 3;
    document.querySelectorAll('.scenario-card[data-scenario]').forEach(card => {
      const isRecommended = Number(card.getAttribute('data-scenario')) === recommendedScenario;
      card.classList.toggle('recommended', isRecommended);
      const badge = card.querySelector('[data-rec-badge]');
      if (badge) badge.hidden = !isRecommended;
    });
    const comparisonNote = document.getElementById('comparison-note');
    if (comparisonNote) {
      comparisonNote.textContent = `Badge marks the lowest projected 10-year tax of the three paths at these inputs (${recommendedScenario === 2 ? 'equal annual' : 'bracket smoothing'} plan).`;
    }

    // Assumption summary + plain-language arithmetic
    const stateRate = STATE_TAX_RATES[stateRateKey] || 0.055;
    const statusLabels = {
      single: 'Single',
      married: 'Married filing jointly',
      hoh: 'Head of household'
    };
    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('sum-balance', fmt(balance));
    setText('sum-growth', annualGrowthRate.toFixed(1) + '%');
    setText('sum-income', fmt(baseIncome));
    setText('sum-status', statusLabels[filingStatus] || 'Single');
    setText('sum-state', (stateRate * 100).toFixed(1) + '%');
    setText('sum-rbd', diedAfterRBD ? 'Years 1–9' : 'None');
    setText('math-state-rate', (stateRate * 100).toFixed(1) + '%');
    setText('math-bomb-tax', fmt(results.scenario1.totalTax));
    setText('math-plan-tax', fmt(results.scenario3.totalTax));
    setText('math-savings', fmt(results.taxSavings));
    setText('savings-basis', `Versus ${fmt(results.scenario1.totalTax)} of total tax if you wait for Year 10.`);

    // Explain the result in one sentence, using the brackets the numbers actually hit.
    const bombWithdrawal = results.scenario1.schedule[9].withdrawal;
    const bombBracket = getTopBracketRate(
      results.scenario1.schedule[9].taxableIncome,
      filingStatus
    );
    const smoothedTopBracket = results.scenario3.schedule.reduce(
      (max, row) => Math.max(max, getTopBracketRate(row.taxableIncome, filingStatus)),
      0
    );
    const s1Withdrawn = results.scenario1.totalWithdrawn;
    const s3Withdrawn = results.scenario3.totalWithdrawn;
    const s1Rate = s1Withdrawn > 0 ? (results.scenario1.totalTax / s1Withdrawn) * 100 : 0;
    const s3Rate = s3Withdrawn > 0 ? (results.scenario3.totalTax / s3Withdrawn) * 100 : 0;
    const insight = document.getElementById('result-insight');
    if (insight) {
      insight.innerHTML = results.taxSavings > 0
        ? `A single Year 10 withdrawal of <strong>${fmt(bombWithdrawal)}</strong> pushes income into the <strong>${bombBracket}%</strong> federal bracket. Smoothing keeps federal taxable income at or below <strong>${smoothedTopBracket}%</strong>, cutting the blended federal + state rate from <strong>${s1Rate.toFixed(1)}%</strong> to <strong>${s3Rate.toFixed(1)}%</strong>.`
        : 'At these inputs, both paths carry a similar total tax. Use the schedule to compare timing and the remaining balance before deciding.';
    }

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
        const effRate = s3[i].withdrawal > 0
          ? ((s3[i].taxes / s3[i].withdrawal) * 100).toFixed(1) + '%'
          : '—';
        tr.innerHTML = `
          <td><strong>Year ${i + 1}</strong> <span class="sub-age">(Age ${beneficiaryAge + i})</span></td>
          <td>${fmt(s3[i].beginningBalance)}</td>
          <td class="col-highlight col-optimized">${fmt(s3[i].withdrawal)}</td>
          <td class="col-bomb">${fmt(s1[i].withdrawal)}</td>
          <td>${fmt(s3[i].taxableIncome)}</td>
          <td>${fmt(s3[i].taxes)}</td>
          <td>${effRate}</td>
          <td>${fmt(s3[i].endingBalance)}</td>
        `;
        tbody.appendChild(tr);
      }
    }

    // Render Mobile Cards View
    renderMobileCards(results);

    // Keep the print report in sync with the latest numbers.
    buildPrintReport();
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

    // Print Report — refreshes the generated report, then prints only it
    const printBtn = document.getElementById('btn-print-report');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        buildPrintReport();
        window.print();
      });
    }

    // Ctrl+P and the browser menu also print the report, never the page.
    window.addEventListener('beforeprint', buildPrintReport);

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
