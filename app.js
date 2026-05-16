const MS_PER_DAY = 86_400_000;
const STORAGE_KEY = "budget-slice-v1";

const els = {
  paydayDate: document.getElementById("payday-date"),
  paydayMeta: document.getElementById("payday-meta"),
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

/** Last weekday (Mon–Fri) of the given calendar month. */
function lastBusinessDayOfMonth(year, monthIndex) {
  const d = new Date(year, monthIndex + 1, 0);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return startOfDay(d);
}

/** Next payday on or after today. */
function getNextPayday(from = new Date()) {
  const today = startOfDay(from);
  let payday = lastBusinessDayOfMonth(today.getFullYear(), today.getMonth());

  if (today.getTime() > payday.getTime()) {
    const month = today.getMonth();
    const year = month === 11 ? today.getFullYear() + 1 : today.getFullYear();
    const nextMonth = month === 11 ? 0 : month + 1;
    payday = lastBusinessDayOfMonth(year, nextMonth);
  }

  return payday;
}

/**
 * Spending days from today through the day before payday (payday excluded).
 * If today is payday, returns 0.
 */
function getSpendingDaysLeft(today, payday) {
  const diff = Math.floor((startOfDay(payday) - startOfDay(today)) / MS_PER_DAY);
  return Math.max(0, diff);
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
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  const update = (value, from) => {
    const v = syncRangeAndNumber(rangeEl, numEl, value);
    if (displayEl) displayEl.textContent = formatMoney(v);
    onChange(v, from);
  };

  rangeEl.addEventListener("input", () => update(Number(rangeEl.value), "range"));
  numEl.addEventListener("input", () => update(Number(numEl.value) || 0, "num"));
  numEl.addEventListener("change", () => update(Number(numEl.value) || 0, "num"));

  return update;
}

function expandMoneySlider(maxNeeded) {
  const floor = 3000;
  const nextMax = Math.max(floor, Math.ceil(maxNeeded / 100) * 100);
  if (Number(els.moneyLeft.max) < nextMax) {
    els.moneyLeft.max = String(nextMax);
  }
}

function calculate() {
  const today = startOfDay(new Date());
  const payday = getNextPayday(today);
  const days = getSpendingDaysLeft(today, payday);

  const money = Number(els.moneyLeft.value);
  const target = Number(els.targetDaily.value);
  const whatIf = Number(els.whatIfDaily.value);

  els.paydayDate.textContent = formatPayday(payday);

  const daysLabel = days === 1 ? "day" : "days";
  if (days === 0) {
    els.paydayMeta.textContent =
      today.getTime() === payday.getTime()
        ? "Today is payday — no spending days left in this cycle"
        : "No spending days left before payday";
  } else {
    const lastSpendingDay = new Date(payday);
    lastSpendingDay.setDate(lastSpendingDay.getDate() - 1);
    els.paydayMeta.textContent = `${days} ${daysLabel} to budget · last spending day ${formatShortDate(lastSpendingDay)}`;
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

  saveState({
    moneyLeft: money,
    targetDaily: target,
    whatIfDaily: whatIf,
  });
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
    els.whatIfResult.textContent = `Money runs out around ${formatShortDate(brokeOn)} — about ${Math.ceil(days - runway)} ${Math.ceil(days - runway) === 1 ? "day" : "days"} before payday.`;
  }
}

function init() {
  const saved = loadState();

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

  calculate();
}

init();
