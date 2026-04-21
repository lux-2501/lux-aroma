(function () {
  const config = window.FANGXU_DATA;

  if (!config) {
    console.error("FANGXU_DATA is missing.");
    return;
  }

  const { STORAGE_KEY, OILS, BASE } = config;
  const elements = {
    index: document.querySelector("#idx"),
    card: document.querySelector("#card"),
    liveStatus: document.querySelector("#live-status")
  };

  let formulas = BASE.map(cloneFormula);
  let activeIndex = 0;
  let copyTimer = null;
  let toastTimer = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchInProgress = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const pad = (value) => String(value).padStart(2, "0");
  const total = (formula) => formula.oils.reduce((sum, oil) => sum + oil.d, 0);

  function cloneFormula(item) {
    return {
      ...item,
      oils: item.oils.map((oil) => ({ ...oil }))
    };
  }

  function ensureToast() {
    let toast = document.querySelector("#page-toast");

    if (toast) {
      return toast;
    }

    toast = document.createElement("div");
    toast.id = "page-toast";
    toast.className = "page-toast";
    toast.setAttribute("aria-hidden", "true");
    document.body.appendChild(toast);
    return toast;
  }

  function announce(message, options = {}) {
    const { showToast = true } = options;

    if (elements.liveStatus) {
      elements.liveStatus.textContent = message;
    }

    if (!message || !showToast) {
      return;
    }

    const { isTouch } = detectPlatform();
    if (!isTouch) {
      return;
    }

    const toast = ensureToast();
    toast.textContent = message;
    toast.classList.add("show");

    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }

    toastTimer = window.setTimeout(() => {
      toast.classList.remove("show");
    }, 1600);
  }

  function detectPlatform() {
    const ua = window.navigator.userAgent || "";
    const platform = window.navigator.platform || "";
    const touchPoints = Number(window.navigator.maxTouchPoints) || 0;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const iosLike = /iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && touchPoints > 1);

    return {
      isIOS: iosLike,
      isTouch: coarse || touchPoints > 0
    };
  }

  function applyPlatformClass() {
    const { isIOS } = detectPlatform();
    document.body.classList.toggle("platform-ios", isIOS);
  }

  function parseHashIndex() {
    const match = window.location.hash.match(/^#formula-(\d{1,2})$/);

    if (!match) {
      return null;
    }

    const next = Number(match[1]) - 1;
    return Number.isInteger(next) && next >= 0 && next < BASE.length ? next : null;
  }

  function writeHash() {
    const hash = `#formula-${pad(activeIndex + 1)}`;

    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed.formulas) && parsed.formulas.length === BASE.length) {
        formulas = BASE.map((baseFormula, index) => {
          const savedFormula = parsed.formulas[index];

          if (!savedFormula || !Array.isArray(savedFormula.oils)) {
            return cloneFormula(baseFormula);
          }

          const oils = baseFormula.oils.map((baseOil, oilIndex) => {
            const savedOil =
              savedFormula.oils.find((item) => item && item.n === baseOil.n) || savedFormula.oils[oilIndex];
            const drops = Number.isFinite(savedOil && savedOil.d)
              ? Math.max(0, Math.round(savedOil.d))
              : baseOil.d;

            return { ...baseOil, d: drops };
          });

          return { ...baseFormula, oils };
        });
      }

      if (Number.isInteger(parsed.index) && parsed.index >= 0 && parsed.index < BASE.length) {
        activeIndex = parsed.index;
      }
    } catch (error) {
      console.warn("Failed to load saved state.", error);
    }
  }

  function saveState() {
    try {
      const payload = {
        index: activeIndex,
        formulas: formulas.map((formula) => ({
          nm: formula.nm,
          oils: formula.oils.map((oil) => ({ n: oil.n, d: oil.d }))
        }))
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("Failed to save state.", error);
    }
  }

  function isDirty(index) {
    const current = formulas[index].oils;
    const original = BASE[index].oils;

    if (current.length !== original.length) {
      return true;
    }

    return current.some((oil, oilIndex) => {
      const baseOil = original[oilIndex];
      return !baseOil || oil.d !== baseOil.d || oil.n !== baseOil.n;
    });
  }

  function blendSummary(formula) {
    const drops = total(formula);
    const sorted = [...formula.oils].sort((left, right) => right.d - left.d);
    const [first, second] = sorted;

    if (!first || drops === 0) {
      return "配方尚空，空气仍留白。";
    }

    if (!second || second.d === 0) {
      return `只余${first.n}，气息更直，也更静。`;
    }

    const byNote = { 前调: 0, 中调: 0, 后调: 0 };
    formula.oils.forEach((oil) => {
      byNote[OILS[oil.n].note] += oil.d;
    });

    const dominant = Object.entries(byNote).sort((left, right) => right[1] - left[1])[0][0];
    return `以${first.n}为先，${second.n}在旁承接，骨架略偏${dominant}。`;
  }

  function dosageMessage(formula) {
    const drops = total(formula);
    const [low, high] = formula.rg;

    if (drops < low) {
      return `建议 ${low}–${high} 滴。此刻仍轻，可再添少许。`;
    }

    if (drops > high) {
      return `建议 ${low}–${high} 滴。此刻稍满，香气会更近身。`;
    }

    return `建议 ${low}–${high} 滴。此刻轻重相宜，气息停得住。`;
  }

  function totalState(formula) {
    const drops = total(formula);
    const [low, high] = formula.rg;

    if (drops < low) {
      return "lo";
    }

    if (drops > high) {
      return "hi";
    }

    return "ok";
  }

  function formulaLineText(formula) {
    const drops = total(formula);
    const parts = formula.oils.filter((oil) => oil.d > 0).map((oil) => `${oil.n} ${oil.d}`);
    const oilsText = parts.length ? parts.join(" · ") : "尚空";
    return `${formula.nm} · ${oilsText} · 共 ${drops} 滴`;
  }

  function formulaLineHTML(formula) {
    const drops = total(formula);
    const parts = formula.oils.filter((oil) => oil.d > 0).map((oil) => `${oil.n} ${oil.d}`);
    const body = parts.length ? parts.join('<span class="fl-sep">·</span>') : "尚空";
    return `${formula.nm}<span class="fl-sep">·</span>${body}<span class="fl-sep">·</span>共 ${drops} 滴`;
  }

  function syncIndexScroll() {
    const current = $$(".idx-item", elements.index)[activeIndex];

    if (current) {
      current.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function renderIndex() {
    if (!elements.index) {
      return;
    }

    elements.index.innerHTML = formulas
      .map((item, index) => {
        const current = index === activeIndex;

        return `
          <button
            type="button"
            role="tab"
            class="idx-item${current ? " on" : ""}"
            aria-selected="${current ? "true" : "false"}"
            aria-controls="formula-panel"
            id="tab-${pad(index + 1)}"
            tabindex="${current ? "0" : "-1"}"
            aria-label="查看配方 ${pad(index + 1)}，${item.nm}"
            data-index="${index}"
          >
            <span class="idx-num">${pad(index + 1)}</span>
            <span class="idx-name">${item.nm}</span>
          </button>
        `;
      })
      .join("");
  }

  function updateIndexCurrent() {
    $$(".idx-item", elements.index).forEach((el, index) => {
      const current = index === activeIndex;
      el.classList.toggle("on", current);
      el.setAttribute("aria-selected", current ? "true" : "false");
      el.setAttribute("tabindex", current ? "0" : "-1");
    });
  }

  function renderCard() {
    if (!elements.card) {
      return;
    }

    const formula = formulas[activeIndex];
    const drops = total(formula);
    const state = totalState(formula);
    const dirty = isDirty(activeIndex);

    const oils = formula.oils
      .map((oil, index) => {
        const meta = OILS[oil.n];

        return `
          <div class="orow" data-oil-index="${index}">
            <div class="dot" style="background:${meta.color}"></div>
            <div class="oname">
              <span>${oil.n}</span>
              <span class="onote">${meta.note}</span>
            </div>
            <div class="stp" aria-label="${oil.n}滴数调整">
              <button
                type="button"
                class="stp-minus"
                data-action="adjust"
                data-oil-index="${index}"
                data-delta="-1"
                aria-label="减少 ${oil.n} 一滴"
                ${oil.d <= 0 ? "disabled" : ""}
              >
                −
              </button>
              <div class="cnt" aria-live="polite">${oil.d}</div>
              <button
                type="button"
                class="stp-plus"
                data-action="adjust"
                data-oil-index="${index}"
                data-delta="1"
                aria-label="增加 ${oil.n} 一滴"
              >
                +
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    const segments = formula.oils
      .map((oil) => {
        const meta = OILS[oil.n];
        const width = drops > 0 ? Math.round((oil.d / drops) * 100) : 0;
        return `<div class="seg" style="width:${width}%;background:${meta.color}" aria-hidden="true"></div>`;
      })
      .join("");

    const ratioLegend = formula.oils
      .map((oil) => {
        const meta = OILS[oil.n];
        const pct = drops > 0 ? `${Math.round((oil.d / drops) * 100)}%` : "—";

        return `
          <div class="rli">
            <span class="dot" style="background:${meta.color}"></span>
            <span>${oil.n}</span>
            <span class="rli-p">${pct}</span>
          </div>
        `;
      })
      .join("");

    elements.card.innerHTML = `
      <article class="card" id="formula-panel" role="tabpanel" tabindex="0" aria-labelledby="tab-${pad(activeIndex + 1)}">
        <div class="card-nav" role="group" aria-label="配方切换">
          <button type="button" class="card-nav-btn prev" data-action="prev" aria-label="上一则配方" ${activeIndex === 0 ? "disabled" : ""}>
            上一则
          </button>
          <span class="card-nav-current">${pad(activeIndex + 1)} / ${pad(formulas.length)}</span>
          <button type="button" class="card-nav-btn next" data-action="next" aria-label="下一则配方" ${activeIndex === formulas.length - 1 ? "disabled" : ""}>
            下一则
          </button>
        </div>
        <header class="hdr">
          <div class="card-title-group">
            <div class="card-num">${pad(activeIndex + 1)}</div>
            <h2 class="card-title">${formula.nm}</h2>
            <span class="badge">${formula.dv}</span>
          </div>
          <button type="button" class="rst" data-action="reset" aria-label="恢复为原始配方" ${dirty ? "" : "disabled"}>
            复归
          </button>
        </header>

        <p class="scene">${formula.sc}</p>

        <section aria-labelledby="bench-label">
          <h3 class="section-label" id="bench-label">配伍</h3>
          <p class="bench-summary">${blendSummary(formula)}</p>
          ${oils}
          <div class="ratio" role="group" aria-label="${formula.nm} 当前配伍比例">
            <div class="track">${segments}</div>
            <div class="ratio-legend">${ratioLegend}</div>
          </div>
        </section>

        <footer class="foot">
          <div>
            <p class="tlabel">滴数</p>
            <p class="hint">${dosageMessage(formula)}</p>
          </div>
          <div class="tcount-wrap" aria-label="当前总滴数 ${drops} 滴">
            <span class="tcount ${state}">${drops}</span>
            <span class="tcount-unit">滴</span>
          </div>
        </footer>

        <div class="imprint">
          <p class="formula-line" aria-label="一行配方">${formulaLineHTML(formula)}</p>
          <button type="button" class="copy-btn" data-action="copy" aria-label="抄录此配方至剪贴板">抄录</button>
        </div>
      </article>
    `;
  }

  function updateCardState() {
    const card = $(".card", elements.card);

    if (!card) {
      renderCard();
      return;
    }

    const formula = formulas[activeIndex];
    const drops = total(formula);
    const state = totalState(formula);
    const rows = $$(".orow", card);

    formula.oils.forEach((oil, index) => {
      const row = rows[index];

      if (!row) {
        return;
      }

      const count = $(".cnt", row);
      const minus = $(".stp-minus", row);

      if (count && count.textContent !== String(oil.d)) {
        count.textContent = oil.d;
      }

      if (minus) {
        minus.disabled = oil.d <= 0;
      }
    });

    const segments = $$(".seg", card);
    formula.oils.forEach((oil, index) => {
      const width = drops > 0 ? Math.round((oil.d / drops) * 100) : 0;

      if (segments[index]) {
        segments[index].style.width = `${width}%`;
      }
    });

    const percentages = $$(".rli-p", card);
    formula.oils.forEach((oil, index) => {
      const pct = drops > 0 ? `${Math.round((oil.d / drops) * 100)}%` : "—";

      if (percentages[index]) {
        percentages[index].textContent = pct;
      }
    });

    const summary = $(".bench-summary", card);
    if (summary) {
      summary.textContent = blendSummary(formula);
    }

    const hint = $(".hint", card);
    if (hint) {
      hint.textContent = dosageMessage(formula);
    }

    const totalCount = $(".tcount", card);
    if (totalCount) {
      totalCount.textContent = drops;
      totalCount.classList.remove("ok", "lo", "hi");
      totalCount.classList.add(state);
    }

    const wrap = $(".tcount-wrap", card);
    if (wrap) {
      wrap.setAttribute("aria-label", `当前总滴数 ${drops} 滴`);
    }

    const resetButton = $(".rst", card);
    if (resetButton) {
      resetButton.disabled = !isDirty(activeIndex);
    }

    const line = $(".formula-line", card);
    if (line) {
      line.innerHTML = formulaLineHTML(formula);
    }

    const navCurrent = $(".card-nav-current", card);
    if (navCurrent) {
      navCurrent.textContent = `${pad(activeIndex + 1)} / ${pad(formulas.length)}`;
    }

    const prev = $('.card-nav-btn[data-action="prev"]', card);
    const next = $('.card-nav-btn[data-action="next"]', card);
    if (prev) {
      prev.disabled = activeIndex === 0;
    }
    if (next) {
      next.disabled = activeIndex === formulas.length - 1;
    }
  }

  function go(index, options = {}) {
    const { announceSwitch = true } = options;

    if (index === activeIndex) {
      return;
    }

    if (index < 0 || index >= formulas.length) {
      return;
    }

    activeIndex = index;
    updateIndexCurrent();
    renderCard();
    syncIndexScroll();
    writeHash();
    saveState();

    if (announceSwitch) {
      announce(`已切换到 ${formulas[activeIndex].nm}。`, { showToast: false });
    }
  }

  function adj(oilIndex, delta) {
    const next = formulas[activeIndex].oils[oilIndex].d + delta;

    if (next < 0) {
      return;
    }

    formulas[activeIndex].oils[oilIndex].d = next;
    updateCardState();
    const row = $(`.orow[data-oil-index="${oilIndex}"]`, elements.card);
    const count = row ? $(".cnt", row) : null;
    if (count) {
      count.classList.remove("bump");
      window.requestAnimationFrame(() => {
        count.classList.add("bump");
        window.setTimeout(() => count.classList.remove("bump"), 260);
      });
    }
    saveState();
  }

  function doReset() {
    formulas[activeIndex].oils = BASE[activeIndex].oils.map((oil) => ({ ...oil }));
    updateCardState();
    saveState();
    announce("当前配方已恢复为原始滴数。");
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      console.warn("Clipboard API unavailable.", error);
    }

    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch (error) {
      console.warn("Legacy copy fallback failed.", error);
      return false;
    }
  }

  async function copyFormula() {
    const button = $(".copy-btn", elements.card);

    if (!button || button.disabled) {
      return;
    }

    const text = formulaLineText(formulas[activeIndex]);
    const ok = await copyToClipboard(text);

    if (ok) {
      button.textContent = "已抄";
      button.disabled = true;
      announce("此配方已抄录到剪贴板。");
    } else {
      button.textContent = "请手动抄录";
      const line = $(".formula-line", elements.card);

      if (line) {
        const range = document.createRange();
        range.selectNodeContents(line);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }

      announce("剪贴板不可用，请手动抄录选中的文字。");
    }

    if (copyTimer) {
      window.clearTimeout(copyTimer);
    }

    copyTimer = window.setTimeout(() => {
      button.textContent = "抄录";
      button.disabled = false;
      announce("");
    }, 1800);
  }

  function handleIndexClick(event) {
    const button = event.target.closest(".idx-item");

    if (!button) {
      return;
    }

    go(Number(button.dataset.index));
  }

  function handleIndexKey(event) {
    const button = event.target.closest(".idx-item");
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];

    if (!button || !keys.includes(event.key)) {
      return;
    }

    event.preventDefault();

    const index = Number(button.dataset.index);
    let nextIndex = activeIndex;

    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = formulas.length - 1;
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (index + 1) % formulas.length;
    } else {
      nextIndex = (index - 1 + formulas.length) % formulas.length;
    }

    go(nextIndex);

    window.requestAnimationFrame(() => {
      const items = $$(".idx-item", elements.index);

      if (items[activeIndex]) {
        items[activeIndex].focus();
      }
    });
  }

  function handleCardClick(event) {
    const prevButton = event.target.closest('.card-nav-btn[data-action="prev"]');
    if (prevButton) {
      go(activeIndex - 1);
      return;
    }

    const nextButton = event.target.closest('.card-nav-btn[data-action="next"]');
    if (nextButton) {
      go(activeIndex + 1);
      return;
    }

    const resetButton = event.target.closest('.rst[data-action="reset"]');
    if (resetButton) {
      doReset();
      return;
    }

    const copyButton = event.target.closest('.copy-btn[data-action="copy"]');
    if (copyButton) {
      copyFormula();
      return;
    }

    const adjustButton = event.target.closest('[data-action="adjust"]');
    if (!adjustButton) {
      return;
    }

    const oilIndex = Number(adjustButton.dataset.oilIndex);
    const delta = Number(adjustButton.dataset.delta);

    if (Number.isInteger(oilIndex) && Number.isFinite(delta)) {
      adj(oilIndex, delta);
    }
  }

  function handleCardTouchStart(event) {
    if (!event.touches || event.touches.length !== 1) {
      return;
    }

    const interactiveRoot = event.target.closest("button, a, input, textarea, select, .stp, .imprint");
    if (interactiveRoot) {
      touchInProgress = false;
      return;
    }

    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    touchInProgress = true;
  }

  function handleCardTouchEnd(event) {
    if (!touchInProgress || !event.changedTouches || event.changedTouches.length !== 1) {
      return;
    }

    touchInProgress = false;
    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;
    const dx = endX - touchStartX;
    const dy = endY - touchStartY;

    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.4) {
      return;
    }

    if (dx < 0 && activeIndex < formulas.length - 1) {
      go(activeIndex + 1);
    } else if (dx > 0 && activeIndex > 0) {
      go(activeIndex - 1);
    }
  }

  function handleHashChange() {
    const next = parseHashIndex();

    if (next === null || next === activeIndex) {
      return;
    }

    activeIndex = next;
    updateIndexCurrent();
    renderCard();
    syncIndexScroll();
    saveState();
  }

  function bindEvents() {
    if (elements.index) {
      elements.index.addEventListener("click", handleIndexClick);
      elements.index.addEventListener("keydown", handleIndexKey);
    }

    if (elements.card) {
      elements.card.addEventListener("click", handleCardClick);
      const { isTouch } = detectPlatform();
      if (isTouch) {
        elements.card.addEventListener("touchstart", handleCardTouchStart, { passive: true });
        elements.card.addEventListener("touchend", handleCardTouchEnd, { passive: true });
      }
    }

    window.addEventListener("hashchange", handleHashChange);
  }

  function init() {
    applyPlatformClass();
    loadState();

    const hashIndex = parseHashIndex();
    if (hashIndex !== null) {
      activeIndex = hashIndex;
    }

    renderIndex();
    renderCard();
    syncIndexScroll();
    writeHash();
    saveState();
    bindEvents();
  }

  init();
})();
