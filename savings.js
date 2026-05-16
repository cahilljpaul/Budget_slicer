const { formatMoney, loadState, saveState } = BudgetSlice;

const WAGE_EXAMPLES = [
  {
    title: "Pay yourself first",
    body: "On payday, move your savings % to a separate account before spending. What’s left is your spending money.",
    example: (income, pct) => `${formatMoney(income * (pct / 100))} saved on day one · ${formatMoney(income * (1 - pct / 100))} to live on`,
  },
  {
    title: "50 / 30 / 20",
    body: "50% needs (rent, bills), 30% wants, 20% savings and debt payoff. A classic starting split.",
    example: (income) =>
      `${formatMoney(income * 0.5)} needs · ${formatMoney(income * 0.3)} wants · ${formatMoney(income * 0.2)} save`,
  },
  {
    title: "Envelope pots",
    body: "Named pots for each goal. Put a fixed amount in each pot every month until the target is hit.",
    example: () => "Holiday pot, car pot, emergency pot — each with its own target",
  },
  {
    title: "1/12 rule",
    body: "Divide annual costs (insurance, holidays, Christmas) by 12 and save that amount monthly so nothing surprises you.",
    example: (income) => {
      const annual = income * 0.15;
      return `e.g. ${formatMoney(annual)}/yr irregular costs → ${formatMoney(annual / 12)}/month`;
    },
  },
];

const PRODUCTS = [
  {
    id: "easy-access",
    name: "Easy-access savings",
    rate: 0.045,
    rateLabel: "~4.5% AER",
    horizon: "0+ years",
    risk: "Low",
    blurb: "Emergency fund and money you might need soon. Instant or quick access.",
    minMonths: 0,
  },
  {
    id: "regular-saver",
    name: "Regular saver (12 months)",
    rate: 0.06,
    rateLabel: "~6% AER",
    horizon: "1 year",
    risk: "Low",
    blurb: "Often higher rate if you deposit each month. Good for building habits.",
    minMonths: 0,
  },
  {
    id: "cash-isa",
    name: "Cash ISA",
    rate: 0.042,
    rateLabel: "~4.2% AER",
    horizon: "1+ years",
    risk: "Low",
    blurb: "Tax-free interest up to your annual ISA allowance. Same idea as savings, wrapper differs.",
    minMonths: 12,
  },
  {
    id: "stocks-shares",
    name: "Stocks & shares ISA",
    rate: 0.07,
    rateLabel: "~7% long-term (not guaranteed)",
    horizon: "5+ years",
    risk: "Higher",
    blurb: "For goals years away. Value can fall; historically beats cash over long periods.",
    minMonths: 60,
  },
];

const DEFAULT_POTS = [
  { id: "p1", name: "Holiday", target: 1500 },
  { id: "p2", name: "Emergency buffer", target: 500 },
];

let pots = [];

const els = {
  monthlyIncome: document.getElementById("monthly-income"),
  monthlyIncomeNum: document.getElementById("monthly-income-num"),
  incomeDisplay: document.getElementById("income-display"),
  savePercent: document.getElementById("save-percent"),
  savePercentDisplay: document.getElementById("save-percent-display"),
  saveAmountHint: document.getElementById("save-amount-hint"),
  emergencyMonths: document.getElementById("emergency-months"),
  potsList: document.getElementById("pots-list"),
  addPot: document.getElementById("add-pot"),
  wageExamples: document.getElementById("wage-examples"),
  planSummary: document.getElementById("plan-summary"),
  planBars: document.getElementById("plan-bars"),
  potResults: document.getElementById("pot-results"),
  productGrid: document.getElementById("product-grid"),
};

function syncRangeAndNumber(rangeEl, numEl, value) {
  const max = Number(rangeEl.max);
  const clamped = Math.min(Math.max(Number(rangeEl.min), value), max);
  rangeEl.value = String(clamped);
  numEl.value = String(clamped);
  return clamped;
}

function bindIncomePair() {
  const update = (value) => {
    const v = syncRangeAndNumber(els.monthlyIncome, els.monthlyIncomeNum, value);
    els.incomeDisplay.textContent = formatMoney(v);
    recalculate();
  };
  els.monthlyIncome.addEventListener("input", () => update(Number(els.monthlyIncome.value)));
  els.monthlyIncomeNum.addEventListener("input", () => update(Number(els.monthlyIncomeNum.value) || 0));
  els.monthlyIncomeNum.addEventListener("change", () => update(Number(els.monthlyIncomeNum.value) || 0));
}

function getIncome() {
  return Number(els.monthlyIncome.value);
}

function getSavePercent() {
  return Number(els.savePercent.value);
}

function persistSavings() {
  saveState({
    savingsProfile: {
      monthlyIncome: getIncome(),
      savePercent: getSavePercent(),
      emergencyMonths: Number(els.emergencyMonths.value),
      pots,
    },
  });
}

function newPotId() {
  return crypto.randomUUID?.() ?? `pot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function renderPotsEditor() {
  els.potsList.innerHTML = "";

  if (!pots.length) {
    const empty = document.createElement("p");
    empty.className = "pots-empty";
    empty.textContent = "Add a pot to see personalised monthly amounts.";
    els.potsList.appendChild(empty);
    return;
  }

  for (const pot of pots) {
    const row = document.createElement("div");
    row.className = "pot-row";
    row.innerHTML = `
      <input type="text" class="num-input pot-name" value="${escapeHtml(pot.name)}" aria-label="Pot name" data-id="${pot.id}" />
      <input type="number" class="num-input pot-target" min="0" step="50" value="${pot.target}" aria-label="Target amount" data-id="${pot.id}" />
      <button type="button" class="icon-btn pot-remove" data-id="${pot.id}" aria-label="Remove pot">×</button>
    `;
    els.potsList.appendChild(row);
  }

  els.potsList.querySelectorAll(".pot-name").forEach((input) => {
    input.addEventListener("input", () => {
      const pot = pots.find((p) => p.id === input.dataset.id);
      if (pot) pot.name = input.value;
      persistSavings();
      recalculate();
    });
  });

  els.potsList.querySelectorAll(".pot-target").forEach((input) => {
    input.addEventListener("input", () => {
      const pot = pots.find((p) => p.id === input.dataset.id);
      if (pot) pot.target = Math.max(0, Number(input.value) || 0);
      persistSavings();
      recalculate();
    });
  });

  els.potsList.querySelectorAll(".pot-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      pots = pots.filter((p) => p.id !== btn.dataset.id);
      persistSavings();
      renderPotsEditor();
      recalculate();
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function computePlan() {
  const income = getIncome();
  const savePct = getSavePercent();
  const monthlySave = income * (savePct / 100);
  const essentialsEstimate = income * 0.5;
  const emergencyMonths = Number(els.emergencyMonths.value);
  const emergencyTarget = essentialsEstimate * emergencyMonths;

  const totalPotTargets = pots.reduce((s, p) => s + p.target, 0);
  const potMonthlyRaw = pots.map((p) => {
    if (totalPotTargets <= 0) return { ...p, monthly: 0, monthsToFill: null };
    const share = p.target / totalPotTargets;
    const monthly = monthlySave * 0.45 * share;
    const monthsToFill = monthly > 0 ? Math.ceil(p.target / monthly) : null;
    return { ...p, monthly, monthsToFill };
  });

  let emergencyMonthly = Math.min(monthlySave * 0.35, emergencyTarget / 12);
  if (emergencyMonthly < 0) emergencyMonthly = 0;

  const potsMonthlyTotal = potMonthlyRaw.reduce((s, p) => s + p.monthly, 0);
  let growthMonthly = Math.max(0, monthlySave - emergencyMonthly - potsMonthlyTotal);

  if (monthlySave > 0 && growthMonthly < monthlySave * 0.15) {
    growthMonthly = monthlySave * 0.15;
    const scale = (monthlySave - growthMonthly) / (emergencyMonthly + potsMonthlyTotal || 1);
    emergencyMonthly *= scale;
    for (const p of potMonthlyRaw) {
      p.monthly *= scale;
    }
  }

  const spending = income - monthlySave;

  return {
    income,
    savePct,
    monthlySave,
    spending,
    essentialsEstimate,
    emergencyTarget,
    emergencyMonthly,
    potMonthlyRaw,
    growthMonthly,
  };
}

function renderWageExamples() {
  const income = getIncome();
  const pct = getSavePercent();
  els.wageExamples.innerHTML = "";

  for (const ex of WAGE_EXAMPLES) {
    const card = document.createElement("article");
    card.className = "example-card";
    card.innerHTML = `
      <h3>${ex.title}</h3>
      <p>${ex.body}</p>
      <p class="example-math">${ex.example(income, pct)}</p>
    `;
    els.wageExamples.appendChild(card);
  }
}

function renderPlanBars(plan) {
  const segments = [
    { label: "Living costs", amount: plan.spending, className: "bar-spend" },
    { label: "Emergency fund", amount: plan.emergencyMonthly, className: "bar-emergency" },
    { label: "Goal pots", amount: plan.potMonthlyRaw.reduce((s, p) => s + p.monthly, 0), className: "bar-pots" },
    { label: "Invest / grow", amount: plan.growthMonthly, className: "bar-grow" },
  ].filter((s) => s.amount > 0);

  els.planBars.innerHTML = "";
  const total = plan.income;

  for (const seg of segments) {
    const pct = total > 0 ? (seg.amount / total) * 100 : 0;
    const row = document.createElement("div");
    row.className = "plan-bar-row";
    row.innerHTML = `
      <div class="plan-bar-label"><span>${seg.label}</span><strong>${formatMoney(seg.amount)}/mo</strong></div>
      <div class="plan-bar-track"><div class="plan-bar-fill ${seg.className}" style="width:${pct.toFixed(1)}%"></div></div>
    `;
    els.planBars.appendChild(row);
  }
}

function renderPotResults(plan) {
  els.potResults.innerHTML = "";

  if (!plan.potMonthlyRaw.length) {
    const li = document.createElement("li");
    li.className = "pot-result-empty";
    li.textContent = "Add goal pots above to see monthly contributions.";
    els.potResults.appendChild(li);
    return;
  }

  for (const p of plan.potMonthlyRaw) {
    const li = document.createElement("li");
    li.className = "pot-result-item";
    const eta =
      p.monthsToFill != null
        ? ` · ~${p.monthsToFill} ${p.monthsToFill === 1 ? "month" : "months"} to reach ${formatMoney(p.target)}`
        : "";
    li.innerHTML = `<strong>${escapeHtml(p.name)}</strong><span>${formatMoney(p.monthly)}/mo${eta}</span>`;
    els.potResults.appendChild(li);
  }
}

function projectGrowth(principal, monthly, annualRate, years) {
  const r = annualRate / 12;
  let balance = principal;
  const months = years * 12;
  for (let i = 0; i < months; i++) {
    balance = balance * (1 + r) + monthly;
  }
  return balance;
}

function renderProducts(plan) {
  els.productGrid.innerHTML = "";

  const monthly = plan.growthMonthly;
  const lump = 0;

  for (const product of PRODUCTS) {
    const projected5 = projectGrowth(lump, monthly, product.rate, 5);
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-head">
        <h4>${product.name}</h4>
        <span class="product-rate">${product.rateLabel}</span>
      </div>
      <p class="product-blurb">${product.blurb}</p>
      <dl class="product-meta">
        <div><dt>Horizon</dt><dd>${product.horizon}</dd></div>
        <div><dt>Risk</dt><dd>${product.risk}</dd></div>
        <div><dt>If you put ${formatMoney(monthly)}/mo for 5 yrs</dt><dd>~${formatMoney(projected5)}</dd></div>
      </dl>
    `;
    els.productGrid.appendChild(card);
  }
}

function recalculate() {
  const plan = computePlan();

  els.savePercentDisplay.textContent = `${plan.savePct}%`;
  els.saveAmountHint.textContent = `${formatMoney(plan.monthlySave)}/month into savings, pots & growth`;

  if (plan.monthlySave === 0) {
    els.planSummary.textContent =
      "You chose 0% savings — try 10–20% if you can. Below is how a split would look if you nudge the slider up.";
  } else {
    els.planSummary.textContent = `From ${formatMoney(plan.income)} take-home, save ${formatMoney(plan.monthlySave)} (${plan.savePct}%) and live on ${formatMoney(plan.spending)}.`;
  }

  renderWageExamples();
  renderPlanBars(plan);
  renderPotResults(plan);
  renderProducts(plan);
  persistSavings();
}

function init() {
  const saved = loadState();
  const profile = saved?.savingsProfile;

  if (profile?.monthlyIncome != null) {
    els.monthlyIncome.value = profile.monthlyIncome;
    els.monthlyIncomeNum.value = profile.monthlyIncome;
  }
  if (profile?.savePercent != null) {
    els.savePercent.value = profile.savePercent;
  }
  if (profile?.emergencyMonths != null) {
    els.emergencyMonths.value = String(profile.emergencyMonths);
  }
  pots = profile?.pots?.length ? profile.pots : [...DEFAULT_POTS];

  els.incomeDisplay.textContent = formatMoney(getIncome());

  bindIncomePair();

  els.savePercent.addEventListener("input", recalculate);
  els.emergencyMonths.addEventListener("change", recalculate);

  els.addPot.addEventListener("click", () => {
    pots.push({ id: newPotId(), name: "New goal", target: 500 });
    persistSavings();
    renderPotsEditor();
    recalculate();
  });

  renderPotsEditor();
  recalculate();
}

init();
