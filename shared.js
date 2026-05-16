const BudgetSlice = (() => {
  const MS_PER_DAY = 86_400_000;
  const STORAGE_KEY = "budget-slice-v3";

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function todayKey(date = new Date()) {
    return startOfDay(date).toISOString().slice(0, 10);
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
      return new Date(`${config.anchorDate}T12:00:00`).getDate();
    }
    return config.dayOfMonth;
  }

  function getNextPayday(from = new Date(), config) {
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
      const raw =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem("budget-slice-v2") ||
        localStorage.getItem("budget-slice-v1");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveState(partial) {
    try {
      const existing = loadState() || {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...partial }));
    } catch {
      /* ignore quota errors */
    }
  }

  function getSpendForDate(state, dateKey = todayKey()) {
    const log = state?.spendLog?.[dateKey];
    if (!log?.length) return { total: 0, entries: [] };
    const entries = log;
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    return { total, entries };
  }

  function addSpendEntry(state, amount, note = "") {
    const key = todayKey();
    const spendLog = { ...(state?.spendLog || {}) };
    const entries = [...(spendLog[key] || [])];
    entries.push({
      id: crypto.randomUUID?.() ?? String(Date.now()),
      amount,
      note: note.trim(),
      ts: Date.now(),
    });
    spendLog[key] = entries;
    return spendLog;
  }

  function removeSpendEntry(state, entryId, dateKey = todayKey()) {
    const spendLog = { ...(state?.spendLog || {}) };
    const entries = (spendLog[dateKey] || []).filter((e) => e.id !== entryId);
    if (entries.length) {
      spendLog[dateKey] = entries;
    } else {
      delete spendLog[dateKey];
    }
    return spendLog;
  }

  return {
    MS_PER_DAY,
    STORAGE_KEY,
    startOfDay,
    todayKey,
    lastBusinessDayOfMonth,
    getNextPayday,
    getSpendingDaysLeft,
    describePaydayConfig,
    formatMoney,
    formatPayday,
    formatShortDate,
    loadState,
    saveState,
    getSpendForDate,
    addSpendEntry,
    removeSpendEntry,
  };
})();
