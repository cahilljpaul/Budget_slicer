const MS_PER_DAY = 86_400_000;
const STORAGE_KEY = "budget-slice-v2";

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
};

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function lastBusinessDayOfMonth(year, monthIndex) {
  const d = new Date(year, monthIndex + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return startOfDay(d);
}

function paydayOnDayOfMonth(year, monthIndex, dayOfMonth, adjustWeekend) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(dayOfMonth, lastDay);
  const d = new Date(year, monthIndex, day);

  if (adjustWeekend) {
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() - 1);
    }
  }

  return startOfDay(d);
}

function getDayOfMonthFromConfig(config) {
  if (config.type === "anchor-date") {
    return new Date(config.anchorDate + "T12:00:00").getDate();
  }
  return config.dayOfMonth;
}

function getNextPayday(from = new Date(), config = paydayConfig) {
  if (!config) return null;

  const today = startOfDay(from);

  if (config.type === "last-weekday") {
    let payday = lastBusinessDayOfMonth(today.getFullYear(), today.getMonth());
    if (today.getTime() > payday.getTime()) {
      const month = today.getMonth();
      const year = month === 11 ? today.getFullYear() + 1 : today.getFullYear();
      const nextMonth = month === 11 ? 0 : month + 1;
      payday = lastBusinessDayOfMonth(year, nextMonth);
    }
    return payday;
  }

  if (config.type === "anchor-date" && config.anchorDate) {
    const anchor = startOfDay(new Date(`${config.anchorDate}T12:00:00`));
    if (anchor.getTime() >= today.getTime()) {
      return anchor;
    }
  }

  const dayOfMonth = getDayOfMonthFromConfig(config);
  const adjustWeekend = Boolean(config.adjustWeekend);

  let payday = paydayOnDayOfMonth(today.getFullYear(), today.getMonth(), dayOfMonth, adjustWeekend);

  if (today.getTime() > payday.getTime()) {
    const month = today.getMonth();
    const year = month === 11 ? today.getFullYear() + 1 : today.getFullYear();
    const nextMonth = month === 11 ? 0 : month + 1;
    payday = paydayOnDayOfMonth(year, nextMonth, dayOfMonth, adjustWeekend);
  }

  return payday;
}

function getSpendingDaysLeft(today, payday) {
  const diff = Math.floor((startOfDay(payday) - startOfDay(today)) / MS_PER_DAY);
  return Math.max(0, diff);
}

function describePaydayConfig(config) {
  if (!config) return "";

  if (config.type === "last-weekday") {
    return "Last weekday of each month";
  }

  const day = getDayOfMonthFromConfig(config);
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";

  let text = `${day}${suffix} of each month`;
  if (config.adjustWeekend) {
    text += " (Friday if weekend)";
  }
  return text;
}

function formatMoney(amount) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPayday(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("budget-slice-v1");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(partial) {
  try {
    const existing = loadState() || {};
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...existing,
        ...partial,
        paydayConfig,
      }),
    );
  } catch {
    /* ignore quota errors */
  }
}

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

function validatePaydayForm() {
  const config = readPaydayConfigFromForm();
  if (!config) {
    els.paydayAnchor.focus();
    return null;
  }
  return config;
}

function savePaydayFromModal() {
  const config = validatePaydayForm();
  if (!config) return;

  paydayConfig = config;
  saveState({});
  closePaydayModal();
  calculate();
}

function calculate() {
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
    saveState({ moneyLeft: money, targetDaily: target, whatIfDaily: whatIf });
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
  saveState({ moneyLeft: money, targetDaily: target, whatIfDaily: whatIf });
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
