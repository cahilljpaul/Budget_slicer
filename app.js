const {
  formatMoney,
  formatPayday,
  formatShortDate,
  loadState,
  saveState,
  startOfDay,
  getNextPayday,
  getSpendingDaysLeft,
  describePaydayConfig,
  getSpendForDate,
  addSpendEntry,
  removeSpendEntry,
  lastBusinessDayOfMonth,
} = BudgetSlice;

let paydayConfig = null;

const els = {
  paydayDate: document.getElementById("payday-date"),
  paydayMeta: document.getElementById("payday-meta"),
  changePayday: document.getElementById("change-payday"),
  paydayModal: document.getElementById("payday-modal"),
  paydaySave: document.getElementById("payday-save"),
  paydayDay: document.getElementById("payday-day"),
  paydayWeekendAdjust: document.getElementById("payday-weekend-adjust"),
  paydayAnchor: document.getElementById("payday-anchor"),
  dayOfMonthFields: document.getElementById("day-of-month-fields"),
  anchorDateFields: document.getElementById("anchor-date-fields"),
  moneyLeft: document.getElementById("money-left"),
  moneyLeftNum: document.getElementById("money-left-num"),
  moneyLeftDisplay: document.getElementById("money-left-display"),
  targetDaily: document.getElementById("target-daily"),
  targetDailyNum: document.getElementById("target-daily-num"),
  targetDailyDisplay: document.getElementById("target-daily-display"),
  daysLeft: document.getElementById("days-left"),
  sustainableDaily: document.getElementById("sustainable-daily"),
  gapDaily: document.getElementById("gap-daily"),
  zeroDays: document.getElementById("zero-days"),
  extraNeeded: document.getElementById("extra-needed"),
  verdict: document.getElementById("verdict"),
  verdictText: document.getElementById("verdict-text"),
  results: document.getElementById("results"),
  whatIfDaily: document.getElementById("what-if-daily"),
  whatIfDisplay: document.getElementById("what-if-display"),
  whatIfResult: document.getElementById("what-if-result"),
  spendAmount: document.getElementById("spend-amount"),
  spendAdd: document.getElementById("spend-add"),
  spendTodayTotal: document.getElementById("spend-today-total"),
  spendTodayStatus: document.getElementById("spend-today-status"),
  spendList: document.getElementById("spend-list"),
};

function syncRangeAndNumber(rangeEl, numEl, value) {
  const max = Number(rangeEl.max);
  const clamped = Math.min(Math.max(0, value), max);
  rangeEl.value = String(clamped);
  numEl.value = String(clamped);
  return clamped;
}

function bindPair(rangeEl, numEl, displayEl, onChange) {
  const update = (value) => {
    const v = syncRangeAndNumber(rangeEl, numEl, value);
    if (displayEl) displayEl.textContent = formatMoney(v);
    onChange(v);
  };

  rangeEl.addEventListener("input", () => update(Number(rangeEl.value)));
  numEl.addEventListener("input", () => update(Number(numEl.value) || 0));
  numEl.addEventListener("change", () => update(Number(numEl.value) || 0));

  return update;
}

function expandMoneySlider(maxNeeded) {
  const floor = 3000;
  const nextMax = Math.max(floor, Math.ceil(maxNeeded / 100) * 100);
  if (Number(els.moneyLeft.max) < nextMax) {
    els.moneyLeft.max = String(nextMax);
  }
}

function persistBudget(partial) {
  saveState({ ...partial, paydayConfig });
}

function getSelectedPaydayType() {
  const selected = document.querySelector('input[name="payday-type"]:checked');
  return selected?.value ?? "last-weekday";
}

function updatePaydayOptionVisibility() {
  const type = getSelectedPaydayType();
  els.dayOfMonthFields.hidden = type !== "day-of-month";
  els.anchorDateFields.hidden = type !== "anchor-date";
}

function defaultAnchorDate() {
  const payday = getNextPayday(new Date(), { type: "last-weekday" });
  return payday.toISOString().slice(0, 10);
}

function readPaydayConfigFromForm() {
  const type = getSelectedPaydayType();

  if (type === "last-weekday") {
    return { type: "last-weekday" };
  }

  if (type === "day-of-month") {
    const dayOfMonth = Math.min(31, Math.max(1, Number(els.paydayDay.value) || 1));
    return {
      type: "day-of-month",
      dayOfMonth,
      adjustWeekend: els.paydayWeekendAdjust.checked,
    };
  }

  const anchorDate = els.paydayAnchor.value;
  if (!anchorDate) return null;

  return {
    type: "anchor-date",
    anchorDate,
    adjustWeekend: false,
  };
}

function fillPaydayForm(config) {
  const type = config?.type ?? "last-weekday";
  const radio = document.querySelector(`input[name="payday-type"][value="${type}"]`);
  if (radio) radio.checked = true;

  if (config?.dayOfMonth != null) {
    els.paydayDay.value = String(config.dayOfMonth);
  }
  if (config?.adjustWeekend != null) {
    els.paydayWeekendAdjust.checked = config.adjustWeekend;
  }
  if (config?.anchorDate) {
    els.paydayAnchor.value = config.anchorDate;
  } else if (!els.paydayAnchor.value) {
    els.paydayAnchor.value = defaultAnchorDate();
  }

  updatePaydayOptionVisibility();
}

function openPaydayModal(config = paydayConfig) {
  fillPaydayForm(config);
  els.paydayModal.hidden = false;
  els.paydayModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  els.paydaySave.focus();
}

function closePaydayModal() {
  els.paydayModal.hidden = true;
  els.paydayModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function savePaydayFromModal() {
  const config = readPaydayConfigFromForm();
  if (!config) {
    els.paydayAnchor.focus();
    return;
  }

  paydayConfig = config;
  persistBudget({});
  closePaydayModal();
  calculate();
}

function renderSpendLog() {
  const state = loadState() || {};
  const target = Number(els.targetDaily.value);
  const { total, entries } = getSpendForDate(state);

  els.spendTodayTotal.textContent = formatMoney(total);

  if (!entries.length) {
    els.spendTodayStatus.textContent =
      target > 0
        ? `Target ${formatMoney(target)} today — log spend to update money left`
        : "Log spend to subtract from money left";
    els.spendTodayStatus.className = "spend-status";
  } else if (target === 0) {
    els.spendTodayStatus.textContent = `${entries.length} logged today`;
    els.spendTodayStatus.className = "spend-status";
  } else {
    const diff = target - total;
    if (diff > 0) {
      els.spendTodayStatus.textContent = `${formatMoney(diff)} left of today's ${formatMoney(target)} target`;
      els.spendTodayStatus.className = "spend-status spend-status-ok";
    } else if (diff < 0) {
      els.spendTodayStatus.textContent = `${formatMoney(-diff)} over today's target`;
      els.spendTodayStatus.className = "spend-status spend-status-over";
    } else {
      els.spendTodayStatus.textContent = "Exactly on today's target";
      els.spendTodayStatus.className = "spend-status spend-status-ok";
    }
  }

  els.spendList.innerHTML = "";
  els.spendList.hidden = !entries.length;

  if (!entries.length) {
    return;
  }

  for (const entry of [...entries].reverse()) {
    const li = document.createElement("li");
    li.className = "spend-item";

    const amountEl = document.createElement("strong");
    amountEl.textContent = formatMoney(entry.amount);

    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "text-btn spend-undo";
    undo.textContent = "Undo";
    undo.addEventListener("click", () => undoSpend(entry));

    li.append(amountEl, undo);
    els.spendList.appendChild(li);
  }
}

function undoSpend(entry) {
  const state = loadState() || {};
  const spendLog = removeSpendEntry(state, entry.id);
  const moneyLeft = Number(els.moneyLeft.value) + entry.amount;

  els.moneyLeft.value = String(moneyLeft);
  els.moneyLeftNum.value = String(moneyLeft);
  els.moneyLeftDisplay.textContent = formatMoney(moneyLeft);

  persistBudget({
    spendLog,
    moneyLeft,
    targetDaily: Number(els.targetDaily.value),
    whatIfDaily: Number(els.whatIfDaily.value),
  });

  renderSpendLog();
  calculate();
}

function logSpend() {
  const amount = Number(els.spendAmount.value);
  if (!amount || amount <= 0) {
    els.spendAmount.focus();
    return;
  }

  const state = loadState() || {};
  const spendLog = addSpendEntry(state, amount);
  const moneyLeft = Math.max(0, Number(els.moneyLeft.value) - amount);

  els.moneyLeft.value = String(moneyLeft);
  els.moneyLeftNum.value = String(moneyLeft);
  els.moneyLeftDisplay.textContent = formatMoney(moneyLeft);
  els.spendAmount.value = "";

  persistBudget({
    spendLog,
    moneyLeft,
    targetDaily: Number(els.targetDaily.value),
    whatIfDaily: Number(els.whatIfDaily.value),
  });

  renderSpendLog();
  calculate();
}

function calculate() {
  renderSpendLog();

  if (!paydayConfig) {
    els.paydayDate.textContent = "—";
    els.paydayMeta.textContent = "Set your payday to get started";
    return;
  }

  const today = startOfDay(new Date());
  const payday = getNextPayday(today, paydayConfig);
  const days = getSpendingDaysLeft(today, payday);

  const money = Number(els.moneyLeft.value);
  const target = Number(els.targetDaily.value);
  const whatIf = Number(els.whatIfDaily.value);

  els.paydayDate.textContent = formatPayday(payday);
  const schedule = describePaydayConfig(paydayConfig);

  const daysLabel = days === 1 ? "day" : "days";
  if (days === 0) {
    els.paydayMeta.textContent =
      today.getTime() === payday.getTime()
        ? `${schedule} · today is payday`
        : `${schedule} · no spending days left before payday`;
  } else {
    const lastSpendingDay = new Date(payday);
    lastSpendingDay.setDate(lastSpendingDay.getDate() - 1);
    els.paydayMeta.textContent = `${schedule} · ${days} ${daysLabel} to budget · last spending day ${formatShortDate(lastSpendingDay)}`;
  }

  els.daysLeft.textContent = String(days);

  if (days === 0) {
    els.sustainableDaily.textContent = "—";
    els.gapDaily.textContent = "—";
    els.zeroDays.textContent = "—";
    els.extraNeeded.textContent = "—";
    els.verdict.hidden = true;
    els.results.classList.remove("on-track", "short");
    updateWhatIf(days, money, whatIf);
    persistBudget({ moneyLeft: money, targetDaily: target, whatIfDaily: whatIf });
    return;
  }

  const sustainable = money / days;
  const gap = target - sustainable;
  const runwayAtTarget = target > 0 ? money / target : days;
  const zeroDays = target > 0 ? Math.max(0, Math.ceil(days - runwayAtTarget)) : 0;
  const extraNeeded = Math.max(0, target * days - money);

  els.sustainableDaily.textContent = formatMoney(sustainable);
  els.gapDaily.textContent =
    gap === 0 ? "On target" : gap > 0 ? `${formatMoney(gap)} short per day` : `${formatMoney(-gap)} headroom per day`;
  els.zeroDays.textContent = zeroDays === 0 ? "None" : String(zeroDays);
  els.extraNeeded.textContent = extraNeeded === 0 ? "None" : formatMoney(extraNeeded);

  els.gapDaily.classList.toggle("negative", gap > 0);
  els.gapDaily.classList.toggle("positive", gap < 0);
  els.zeroDays.classList.toggle("warning", zeroDays > 0);

  const onTrack = sustainable >= target;
  els.results.classList.toggle("on-track", onTrack);
  els.results.classList.toggle("short", !onTrack);
  els.verdict.hidden = false;

  if (onTrack) {
    els.verdictText.textContent = `You can afford your ${formatMoney(target)} target for every day until payday.`;
    els.verdict.className = "verdict verdict-ok";
  } else if (zeroDays > 0) {
    els.verdictText.textContent = `At ${formatMoney(target)} per day you'd run out ${zeroDays} ${zeroDays === 1 ? "day" : "days"} before payday. Stick to ${formatMoney(sustainable)} per day, or find ${formatMoney(extraNeeded)} more.`;
    els.verdict.className = "verdict verdict-warn";
  } else {
    els.verdictText.textContent = `Target is slightly above what you can afford — sustainable spend is ${formatMoney(sustainable)} per day.`;
    els.verdict.className = "verdict verdict-warn";
  }

  expandMoneySlider(target * days);
  updateWhatIf(days, money, whatIf);
  persistBudget({ moneyLeft: money, targetDaily: target, whatIfDaily: whatIf });
}

function updateWhatIf(days, money, rate) {
  els.whatIfDisplay.textContent = formatMoney(rate);

  if (days === 0) {
    els.whatIfResult.textContent = "";
    return;
  }

  if (rate === 0) {
    els.whatIfResult.textContent = `You'd finish with ${formatMoney(money)} on the day before payday.`;
    return;
  }

  const runway = money / rate;
  const leftover = money - rate * days;

  if (runway >= days) {
    const left = Math.max(0, leftover);
    els.whatIfResult.textContent = `You'd have ${formatMoney(left)} left the day before payday.`;
  } else {
    const brokeOn = new Date(startOfDay(new Date()));
    brokeOn.setDate(brokeOn.getDate() + Math.floor(runway));
    const shortDays = Math.ceil(days - runway);
    els.whatIfResult.textContent = `Money runs out around ${formatShortDate(brokeOn)} — about ${shortDays} ${shortDays === 1 ? "day" : "days"} before payday.`;
  }
}

function initPaydayModal() {
  document.querySelectorAll('input[name="payday-type"]').forEach((radio) => {
    radio.addEventListener("change", updatePaydayOptionVisibility);
  });

  els.paydaySave.addEventListener("click", savePaydayFromModal);
  els.changePayday.addEventListener("click", () => openPaydayModal(paydayConfig));

  els.paydayModal.querySelector("[data-close-payday]")?.addEventListener("click", () => {
    if (paydayConfig) closePaydayModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.paydayModal.hidden && paydayConfig) {
      closePaydayModal();
    }
  });

  if (!els.paydayAnchor.value) {
    els.paydayAnchor.value = defaultAnchorDate();
    els.paydayAnchor.min = new Date().toISOString().slice(0, 10);
  }
}

function init() {
  const saved = loadState();
  paydayConfig = saved?.paydayConfig ?? null;

  if (saved?.moneyLeft != null) {
    els.moneyLeft.value = saved.moneyLeft;
    els.moneyLeftNum.value = saved.moneyLeft;
  }
  if (saved?.targetDaily != null) {
    els.targetDaily.value = saved.targetDaily;
    els.targetDailyNum.value = saved.targetDaily;
  }
  if (saved?.whatIfDaily != null) {
    els.whatIfDaily.value = saved.whatIfDaily;
  }

  const recalc = () => calculate();

  bindPair(els.moneyLeft, els.moneyLeftNum, els.moneyLeftDisplay, recalc);
  bindPair(els.targetDaily, els.targetDailyNum, els.targetDailyDisplay, recalc);
  els.whatIfDaily.addEventListener("input", recalc);

  els.spendAdd.addEventListener("click", logSpend);
  els.spendAmount.addEventListener("keydown", (e) => {
    if (e.key === "Enter") logSpend();
  });

  els.moneyLeftDisplay.textContent = formatMoney(Number(els.moneyLeft.value));
  els.targetDailyDisplay.textContent = formatMoney(Number(els.targetDaily.value));

  initPaydayModal();

  if (paydayConfig) {
    calculate();
  } else {
    openPaydayModal();
  }
}

init();
