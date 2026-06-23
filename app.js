const STORAGE_KEYS = {
  records: "bowlingPracticeRecords:v1",
  balls: "bowlingPracticeBalls:v1",
  introSeen: "bowlingPracticeIntroSeen:v1",
  lastJsonBackupAt: "bowlingPracticeLastJsonBackupAt:v1"
};

const TESSERACT_LOCAL_PATHS = {
  workerPath: "./vendor/tesseract/worker.min.js",
  corePath: "./vendor/tesseract/core",
  langPath: "./vendor/tesseract/lang"
};

const DEFAULT_BALLS = [
  { id: "ball-main", name: "メインボール", note: "", createdAt: new Date().toISOString() },
  { id: "ball-spare", name: "スペアボール", note: "", createdAt: new Date().toISOString() }
];

const state = {
  records: [],
  balls: [],
  selectedScreen: "home",
  selectedAiMode: "today",
  restoreMode: "merge",
  editingRecordId: null,
  currentImage: null,
  pendingOcr: null
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  loadState();
  renderPracticeScoreInputs(["", "", "", ""]);
  renderOcrScoreInputs(["", "", "", ""]);
  bindEvents();
  fillPracticeDefaults();
  renderAll();
  showScreen("home");
  showWelcomeIfNeeded();
  registerServiceWorker();
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-nav]");
    if (nav) {
      showScreen(nav.dataset.nav);
      return;
    }

    const deleteRecord = event.target.closest("[data-delete-record]");
    if (deleteRecord) {
      removeRecord(deleteRecord.dataset.deleteRecord);
      return;
    }

    const editRecord = event.target.closest("[data-edit-record]");
    if (editRecord) {
      beginEditRecord(editRecord.dataset.editRecord);
      return;
    }

    const promptRecord = event.target.closest("[data-prompt-record]");
    if (promptRecord) {
      showAiForRecord(promptRecord.dataset.promptRecord);
      return;
    }

    const deleteBall = event.target.closest("[data-delete-ball]");
    if (deleteBall) {
      removeBall(deleteBall.dataset.deleteBall);
    }
  });

  document.getElementById("practice-form").addEventListener("submit", savePracticeRecord);
  document.getElementById("add-score").addEventListener("click", addPracticeScoreInput);
  document.getElementById("clear-pins").addEventListener("click", clearPins);
  document.getElementById("prompt-from-form").addEventListener("click", buildPromptFromForm);
  document.getElementById("cancel-edit").addEventListener("click", cancelEditRecord);

  document.getElementById("pin-deck").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pin]");
    if (button) toggleSelected(button);
  });

  document.getElementById("tag-buttons").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tag]");
    if (button) toggleSelected(button);
  });

  document.getElementById("condition-buttons").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-condition]");
    if (button) selectOne(button, "#condition-buttons button");
  });

  document.getElementById("sheet-image").addEventListener("change", handleImageSelection);
  document.getElementById("sheet-image-library").addEventListener("change", handleImageSelection);
  document.getElementById("apply-image").addEventListener("click", () => {
    if (drawProcessedImage()) setStatus("ocr-status", "画像を調整しました。");
  });
  document.getElementById("brightness-range").addEventListener("input", drawProcessedImage);
  document.getElementById("contrast-range").addEventListener("input", drawProcessedImage);
  document.getElementById("bw-toggle").addEventListener("change", drawProcessedImage);
  document.getElementById("run-ocr").addEventListener("click", runOcr);

  document.getElementById("ocr-confirm-form").addEventListener("submit", saveOcrRecord);
  document.getElementById("add-ocr-score").addEventListener("click", addOcrScoreInput);
  document.getElementById("ocr-score-inputs").addEventListener("input", updateOcrSummary);

  document.getElementById("ai-modes").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    state.selectedAiMode = button.dataset.mode;
    selectOne(button, "#ai-modes button");
    renderAiPrompt();
  });
  document.getElementById("ai-record-select").addEventListener("change", renderAiPrompt);
  document.getElementById("copy-prompt").addEventListener("click", copyPrompt);
  document.getElementById("save-ai-comment").addEventListener("click", saveAiComment);

  document.getElementById("ball-form").addEventListener("submit", saveBall);

  document.getElementById("export-json").addEventListener("click", exportJson);
  document.getElementById("export-csv").addEventListener("click", exportCsv);
  document.getElementById("restore-mode").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-restore-mode]");
    if (!button) return;
    state.restoreMode = button.dataset.restoreMode;
    selectOne(button, "#restore-mode button");
  });
  document.getElementById("restore-data").addEventListener("click", restoreData);
  document.getElementById("close-welcome").addEventListener("click", closeWelcome);
}

function loadState() {
  state.records = readJson(STORAGE_KEYS.records, []).map(sanitizeRecord);
  const storedBalls = readJson(STORAGE_KEYS.balls, null);
  state.balls = Array.isArray(storedBalls) && storedBalls.length
    ? storedBalls.map(sanitizeBall)
    : DEFAULT_BALLS.map(sanitizeBall);
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(state.records));
  localStorage.setItem(STORAGE_KEYS.balls, JSON.stringify(state.balls));
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn("保存データを読み込めませんでした", error);
    return fallback;
  }
}

function renderAll() {
  renderBallOptions();
  renderVenueOptions();
  renderHome();
  renderHistory();
  renderAnalysis();
  renderBallList();
  renderAiRecordOptions();
  renderAiPrompt();
}

function showScreen(screenName) {
  state.selectedScreen = screenName;
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === screenName);
  });
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    if (button.dataset.nav === screenName) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  if (screenName === "record") fillPracticeDefaults();
  if (screenName === "history") renderHistory();
  if (screenName === "analysis") renderAnalysis();
  if (screenName === "balls") renderBallList();
  if (screenName === "ai") {
    renderAiRecordOptions();
    renderAiPrompt();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function fillPracticeDefaults() {
  const dateInput = document.getElementById("practice-date");
  if (!dateInput.value) dateInput.value = todayString();
}

function todayString() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeRecord(record) {
  return {
    id: String(record.id || createId("record")),
    createdAt: record.createdAt || new Date().toISOString(),
    date: normalizeDate(record.date) || todayString(),
    venue: cleanText(record.venue),
    lane: cleanText(record.lane),
    scores: Array.isArray(record.scores)
      ? record.scores.map(Number).filter((score) => Number.isFinite(score) && score >= 0 && score <= 300)
      : [],
    ballName: cleanText(record.ballName || record.ball),
    pins: Array.isArray(record.pins)
      ? record.pins.map(Number).filter((pin) => Number.isInteger(pin) && pin >= 1 && pin <= 10)
      : [],
    tags: Array.isArray(record.tags) ? record.tags.map(cleanText).filter(Boolean) : [],
    condition: cleanText(record.condition || "普通"),
    memo: cleanText(record.memo),
    aiComment: cleanText(record.aiComment),
    source: cleanText(record.source || "manual")
  };
}

function sanitizeBall(ball) {
  return {
    id: String(ball.id || createId("ball")),
    name: cleanText(ball.name) || "名前なし",
    note: cleanText(ball.note),
    createdAt: ball.createdAt || new Date().toISOString()
  };
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeDate(value) {
  const text = cleanText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/(\d{2,4})[\/.\-年\s]+(\d{1,2})[\/.\-月\s]+(\d{1,2})/);
  if (!match) return "";
  const year = Number(match[1]) < 100 ? 2000 + Number(match[1]) : Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function renderPracticeScoreInputs(values) {
  renderScoreInputs("score-inputs", values, 4);
}

function renderOcrScoreInputs(values) {
  renderScoreInputs("ocr-score-inputs", values, 4);
  updateOcrSummary();
}

function renderScoreInputs(containerId, values, minimumCount) {
  const container = document.getElementById(containerId);
  const count = Math.max(minimumCount, values.length);
  container.innerHTML = "";
  for (let index = 0; index < count; index += 1) {
    const label = document.createElement("label");
    label.className = "score-input";
    label.innerHTML = `
      <span>${index + 1}G</span>
      <input type="number" inputmode="numeric" min="0" max="300" step="1" value="${escapeHtml(values[index] ?? "")}" aria-label="${index + 1}ゲーム目のスコア">
    `;
    container.appendChild(label);
  }
}

function addPracticeScoreInput() {
  const current = getRawScoreValues("score-inputs");
  current.push("");
  renderPracticeScoreInputs(current);
}

function addOcrScoreInput() {
  const current = getRawScoreValues("ocr-score-inputs");
  current.push("");
  renderOcrScoreInputs(current);
}

function getRawScoreValues(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input`)).map((input) => input.value);
}

function readScores(containerId) {
  const errors = [];
  const scores = [];
  document.querySelectorAll(`#${containerId} input`).forEach((input, index) => {
    const value = cleanText(input.value);
    input.removeAttribute("aria-invalid");
    if (!value) return;
    const score = Number(value);
    if (!Number.isInteger(score) || score < 0 || score > 300) {
      input.setAttribute("aria-invalid", "true");
      errors.push(`${index + 1}Gは0〜300点で入力してください。`);
      return;
    }
    scores.push(score);
  });
  return { scores, errors };
}

function collectPracticeForm(allowEmptyScores = false, existingRecord = null) {
  const scoreResult = readScores("score-inputs");
  const errors = [...scoreResult.errors];
  if (!allowEmptyScores && scoreResult.scores.length === 0) {
    errors.push("スコアを1つ以上入力してください。");
  }

  const record = {
    id: existingRecord?.id || createId("record"),
    createdAt: existingRecord?.createdAt || new Date().toISOString(),
    date: document.getElementById("practice-date").value || todayString(),
    venue: cleanText(document.getElementById("practice-venue").value),
    lane: cleanText(document.getElementById("practice-lane").value),
    scores: scoreResult.scores,
    ballName: document.getElementById("practice-ball").value,
    pins: getSelectedValues("#pin-deck button.is-selected", "pin").map(Number),
    tags: getSelectedValues("#tag-buttons button.is-selected", "tag"),
    condition: document.querySelector("#condition-buttons button.is-selected")?.dataset.condition || "普通",
    memo: cleanText(document.getElementById("practice-memo").value),
    source: existingRecord?.source || "manual",
    aiComment: existingRecord?.aiComment || ""
  };

  return { record: sanitizeRecord(record), errors };
}

function savePracticeRecord(event) {
  event.preventDefault();
  const editingRecord = state.editingRecordId
    ? state.records.find((item) => item.id === state.editingRecordId)
    : null;
  const { record, errors } = collectPracticeForm(false, editingRecord);
  if (errors.length) {
    setStatus("record-status", errors[0], true);
    return;
  }

  if (editingRecord) {
    const ok = window.confirm("この内容で記録を更新します。よろしいですか？");
    if (!ok) return;
    state.records = state.records.map((item) => item.id === editingRecord.id ? record : item);
  } else {
    state.records.push(record);
  }
  saveState();
  renderAll();
  setStatus("record-status", editingRecord ? "更新しました。" : "保存しました。");
  resetPracticeForm();
}

function resetPracticeForm() {
  document.getElementById("practice-form").reset();
  document.getElementById("practice-date").value = todayString();
  renderPracticeScoreInputs(["", "", "", ""]);
  clearPins();
  document.querySelectorAll("#tag-buttons button").forEach((button) => button.classList.remove("is-selected"));
  selectOne(document.querySelector("#condition-buttons button[data-condition='普通']"), "#condition-buttons button");
  renderBallOptions();
  state.editingRecordId = null;
  updateRecordEditUi();
}

function beginEditRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;

  state.editingRecordId = id;
  showScreen("record");
  renderBallOptions();
  ensureBallOption(record.ballName);
  document.getElementById("practice-date").value = record.date || todayString();
  document.getElementById("practice-venue").value = record.venue || "";
  document.getElementById("practice-lane").value = record.lane || "";
  document.getElementById("practice-ball").value = record.ballName || "";
  renderPracticeScoreInputs(record.scores.length ? record.scores.map(String) : ["", "", "", ""]);

  clearPins();
  record.pins.forEach((pin) => {
    const button = document.querySelector(`#pin-deck button[data-pin="${pin}"]`);
    if (button) {
      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");
    }
  });

  document.querySelectorAll("#tag-buttons button").forEach((button) => {
    const isSelected = record.tags.includes(button.dataset.tag);
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });

  const conditionButton = Array.from(document.querySelectorAll("#condition-buttons button"))
    .find((button) => button.dataset.condition === (record.condition || "普通"))
    || document.querySelector("#condition-buttons button[data-condition='普通']");
  selectOne(conditionButton, "#condition-buttons button");
  document.getElementById("practice-memo").value = record.memo || "";
  updateRecordEditUi();
  setStatus("record-status", "編集する内容を確認してください。");
}

function cancelEditRecord() {
  state.editingRecordId = null;
  resetPracticeForm();
  setStatus("record-status", "編集をやめました。");
}

function updateRecordEditUi() {
  const editing = Boolean(state.editingRecordId);
  document.getElementById("record-title").textContent = editing ? "記録を編集" : "今日の記録";
  document.getElementById("practice-save-button").textContent = editing ? "更新する" : "保存";
  document.getElementById("editing-notice").hidden = !editing;
  document.getElementById("cancel-edit").hidden = !editing;
}

function ensureBallOption(ballName) {
  if (!ballName) return;
  const select = document.getElementById("practice-ball");
  if (Array.from(select.options).some((option) => option.value === ballName)) return;
  const option = document.createElement("option");
  option.value = ballName;
  option.textContent = ballName;
  select.appendChild(option);
}

function getSelectedValues(selector, dataName) {
  return Array.from(document.querySelectorAll(selector)).map((element) => element.dataset[dataName]);
}

function toggleSelected(button) {
  button.classList.toggle("is-selected");
  button.setAttribute("aria-pressed", button.classList.contains("is-selected") ? "true" : "false");
}

function selectOne(button, selector) {
  if (!button) return;
  document.querySelectorAll(selector).forEach((item) => {
    const isSelected = item === button;
    item.classList.toggle("is-selected", isSelected);
    item.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function clearPins() {
  document.querySelectorAll("#pin-deck button").forEach((button) => {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });
}

function renderBallOptions() {
  const select = document.getElementById("practice-ball");
  const current = select.value;
  select.innerHTML = `<option value="">未選択</option>`;
  state.balls.forEach((ball) => {
    const option = document.createElement("option");
    option.value = ball.name;
    option.textContent = ball.name;
    select.appendChild(option);
  });
  select.value = current;
}

function renderVenueOptions() {
  const datalist = document.getElementById("venue-options");
  const venues = unique(state.records.map((record) => record.venue).filter(Boolean));
  datalist.innerHTML = venues.map((venue) => `<option value="${escapeHtml(venue)}"></option>`).join("");
}

function renderHome() {
  const allScores = state.records.flatMap((record) => record.scores);
  document.getElementById("home-average").textContent = allScores.length ? Math.round(average(allScores)) : "--";
}

function showWelcomeIfNeeded() {
  if (localStorage.getItem(STORAGE_KEYS.introSeen) === "1") return;
  document.getElementById("welcome-modal").hidden = false;
}

function closeWelcome() {
  localStorage.setItem(STORAGE_KEYS.introSeen, "1");
  document.getElementById("welcome-modal").hidden = true;
}

function renderHistory() {
  const container = document.getElementById("history-list");
  const records = getRecordsByDate();
  if (!records.length) {
    container.innerHTML = `<p class="empty-state">まだ記録がありません。</p>`;
    return;
  }

  container.innerHTML = records.map((record) => {
    const scoreChips = record.scores.length
      ? record.scores.map((score, index) => `<span class="score-chip">${index + 1}G ${score}</span>`).join("")
      : `<span class="score-chip">スコアなし</span>`;
    const pins = record.pins.length ? `${record.pins.join("・")}ピン` : "なし";
    const tags = record.tags.length ? record.tags.join(" / ") : "なし";
    const comment = record.aiComment
      ? `
        <details class="comment-details">
          <summary>AIコーチコメントを見る</summary>
          <p>${escapeHtml(record.aiComment)}</p>
        </details>
      `
      : "";
    return `
      <article class="record-card">
        <header>
          <div>
            <h3>${formatDate(record.date)} ${escapeHtml(record.venue || "")}</h3>
            <p>${escapeHtml(record.ballName || "ボール未選択")} / 調子：${escapeHtml(record.condition || "普通")}</p>
          </div>
        </header>
        <div class="score-line">${scoreChips}</div>
        <p>残りピン：${escapeHtml(pins)}</p>
        <p>ミス傾向：${escapeHtml(tags)}</p>
        ${record.memo ? `<p>メモ：${escapeHtml(record.memo)}</p>` : ""}
        ${comment}
        <div class="record-actions">
          <button class="secondary-action" type="button" data-edit-record="${escapeHtml(record.id)}">編集</button>
          <button class="danger-button" type="button" data-delete-record="${escapeHtml(record.id)}">削除</button>
        </div>
        <button class="secondary-action full" type="button" data-prompt-record="${escapeHtml(record.id)}">この記録で相談文を作る</button>
      </article>
    `;
  }).join("");
}

function removeRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  const ok = window.confirm(`${formatDate(record.date)}の記録を削除します。よろしいですか？`);
  if (!ok) return;
  state.records = state.records.filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function renderAnalysis() {
  const summary = document.getElementById("analysis-summary");
  const details = document.getElementById("analysis-details");
  const records = getRecordsByDate();
  const allScores = records.flatMap((record) => record.scores);

  if (!records.length || !allScores.length) {
    summary.innerHTML = "";
    details.innerHTML = `<p class="empty-state">スコアを保存すると分析が表示されます。</p>`;
    return;
  }

  const recentFiveScores = records.slice(0, 5).flatMap((record) => record.scores);
  const lateDrop = calculateLateDrop(records);

  summary.innerHTML = [
    metricCard("平均スコア", Math.round(average(allScores))),
    metricCard("最高スコア", Math.max(...allScores)),
    metricCard("直近5回平均", recentFiveScores.length ? Math.round(average(recentFiveScores)) : "--"),
    metricCard("後半の傾向", lateDrop.label)
  ].join("");

  details.innerHTML = [
    rankingBlock("よく残るピンランキング", countPins(records), "回"),
    rankingBlock("使用ボール別の平均スコア", groupAverage(records, "ballName"), "点"),
    rankingBlock("会場別平均スコア", groupAverage(records, "venue"), "点"),
    lateDrop.detail
  ].join("");
}

function metricCard(label, value) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function rankingBlock(title, rows, unit) {
  if (!rows.length) {
    return `
      <section class="ranking-list">
        <h3>${escapeHtml(title)}</h3>
        <p class="hint">まだ十分な記録がありません。</p>
      </section>
    `;
  }

  return `
    <section class="ranking-list">
      <h3>${escapeHtml(title)}</h3>
      ${rows.slice(0, 8).map((row) => `
        <div class="ranking-row">
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)}${escapeHtml(unit)}</strong>
        </div>
      `).join("")}
    </section>
  `;
}

function countPins(records) {
  const counts = new Map();
  records.forEach((record) => {
    record.pins.forEach((pin) => counts.set(pin, (counts.get(pin) || 0) + 1));
  });
  return Array.from(counts.entries())
    .map(([pin, count]) => ({ label: `${pin}ピン`, value: count }))
    .sort((a, b) => b.value - a.value);
}

function groupAverage(records, key) {
  const groups = new Map();
  records.forEach((record) => {
    const label = record[key] || "未入力";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(...record.scores);
  });
  return Array.from(groups.entries())
    .map(([label, scores]) => ({ label, value: Math.round(average(scores)) }))
    .sort((a, b) => b.value - a.value);
}

function calculateLateDrop(records) {
  const targets = records.filter((record) => record.scores.length >= 2);
  if (!targets.length) {
    return {
      label: "--",
      detail: `<section class="ranking-list"><h3>後半ゲームで落ちる傾向</h3><p class="hint">2ゲーム以上の記録が増えると表示されます。</p></section>`
    };
  }

  const drops = targets.map((record) => {
    const middle = Math.ceil(record.scores.length / 2);
    const first = average(record.scores.slice(0, middle));
    const second = average(record.scores.slice(middle));
    return second - first;
  }).filter(Number.isFinite);

  const averageDiff = average(drops);
  const dropCount = drops.filter((diff) => diff < 0).length;
  const label = averageDiff < -1 ? `${Math.abs(Math.round(averageDiff))}点低下` : "大きな低下なし";
  const message = averageDiff < -1
    ? `${targets.length}回中${dropCount}回で後半が下がっています。後半は平均で約${Math.abs(Math.round(averageDiff))}点低いです。`
    : `${targets.length}回分を見る限り、後半に大きく落ちる傾向は弱めです。`;

  return {
    label,
    detail: `<section class="ranking-list"><h3>後半ゲームで落ちる傾向</h3><p>${escapeHtml(message)}</p></section>`
  };
}

function saveBall(event) {
  event.preventDefault();
  const nameInput = document.getElementById("ball-name");
  const noteInput = document.getElementById("ball-note");
  const name = cleanText(nameInput.value);
  if (!name) {
    setStatus("ball-status", "ボール名を入力してください。", true);
    return;
  }
  if (state.balls.some((ball) => ball.name === name)) {
    setStatus("ball-status", "同じ名前のボールがあります。", true);
    return;
  }

  state.balls.push(sanitizeBall({
    id: createId("ball"),
    name,
    note: noteInput.value,
    createdAt: new Date().toISOString()
  }));
  saveState();
  nameInput.value = "";
  noteInput.value = "";
  renderAll();
  setStatus("ball-status", "追加しました。");
}

function renderBallList() {
  const container = document.getElementById("ball-list");
  if (!state.balls.length) {
    container.innerHTML = `<p class="empty-state">ボールはまだ登録されていません。</p>`;
    return;
  }

  container.innerHTML = state.balls.map((ball) => `
    <article class="record-card">
      <header>
        <div>
          <h3>${escapeHtml(ball.name)}</h3>
          ${ball.note ? `<p>${escapeHtml(ball.note)}</p>` : `<p>メモなし</p>`}
        </div>
        <button class="danger-button" type="button" data-delete-ball="${escapeHtml(ball.id)}">削除</button>
      </header>
    </article>
  `).join("");
}

function removeBall(id) {
  const ball = state.balls.find((item) => item.id === id);
  if (!ball) return;
  const ok = window.confirm(`${ball.name}を削除します。過去の記録に残ったボール名はそのままです。`);
  if (!ok) return;
  state.balls = state.balls.filter((item) => item.id !== id);
  saveState();
  renderAll();
}

function buildPromptFromForm() {
  const { record, errors } = collectPracticeForm(true);
  if (errors.length) {
    setStatus("record-status", errors[0], true);
    return;
  }
  showScreen("ai");
  setPromptText(buildAiPrompt("today", record, state.records));
  setStatus("copy-status", "未保存の内容から相談文を作りました。");
}

function showAiForRecord(id) {
  showScreen("ai");
  document.getElementById("ai-record-select").value = id;
  state.selectedAiMode = "today";
  selectOne(document.querySelector("#ai-modes button[data-mode='today']"), "#ai-modes button");
  renderAiPrompt();
}

function renderAiRecordOptions() {
  const select = document.getElementById("ai-record-select");
  const current = select.value;
  const records = getRecordsByDate();
  select.innerHTML = "";
  if (!records.length) {
    select.innerHTML = `<option value="">記録がありません</option>`;
    return;
  }
  records.forEach((record) => {
    const option = document.createElement("option");
    option.value = record.id;
    option.textContent = `${formatDate(record.date)} ${record.venue || ""} ${record.scores.join(" / ")}`;
    select.appendChild(option);
  });
  select.value = current || records[0].id;
}

function renderAiPrompt() {
  const select = document.getElementById("ai-record-select");
  const record = state.records.find((item) => item.id === select.value) || getRecordsByDate()[0] || null;
  document.getElementById("ai-comment").value = record?.aiComment || "";
  setPromptText(buildAiPrompt(state.selectedAiMode, record, state.records));
}

function buildAiPrompt(mode, record, records) {
  const intro = "あなたはボウリングのコーチです。専門用語は少なめにして、スマホで読みやすい日本語で答えてください。";
  const today = record ? recordToPrompt(record) : "まだ練習記録がありません。";
  const recent = getRecordsByDate(records).slice(0, 8).map(recordToPrompt).join("\n\n") || "まだ練習記録がありません。";

  if (mode === "recent") {
    return `${intro}

最近の練習記録から、スコアが伸びない原因と良くなっている点を見つけてください。

${recent}

答えてほしいこと：
1. 最近の良い傾向
2. 直したほうがよい傾向
3. 次の練習で意識することを3つ
4. 1ゲーム目から最後まで崩れにくくする工夫`;
  }

  if (mode === "form") {
    return `${intro}

フォーム画像を見てアドバイスしてください。これから画像を添付します。

見てほしい場面：
1. 構え
2. バックスイング上部
3. リリース直前
4. フォロースルー

今日の記録：
${today}

答えてほしいこと：
1. 良いところ
2. スコアを落としていそうな動き
3. 次回1つだけ直すなら何か
4. 家で確認できる簡単なチェック`;
  }

  if (mode === "menu") {
    return `${intro}

次回の練習メニューを作ってください。1人でスマホを見ながら実行できる内容にしてください。

参考にする記録：
${recent}

作ってほしい内容：
1. ウォーミングアップ
2. 3ゲーム分の練習メニュー
3. 残りピン対策
4. 最後に確認すること
5. 練習後に記録する項目`;
  }

  if (mode === "match") {
    return `${intro}

大会前の作戦を相談したいです。緊張しても実行しやすい、シンプルな作戦にしてください。

参考にする記録：
${recent}

答えてほしいこと：
1. 最初の1ゲーム目の入り方
2. レーンが変わった時の考え方
3. ミスが続いた時の立て直し方
4. 使うボールの考え方
5. 当日のチェックリスト`;
  }

  return `${intro}

今日の練習を分析してください。

${today}

答えてほしいこと：
1. 今日の良かった点
2. スコアを落とした原因の候補
3. よく残ったピンへの対策
4. 次回の練習で試すことを3つ
5. 1番大事な意識ポイント`;
}

function recordToPrompt(record) {
  if (!record) return "記録なし";
  const total = record.scores.reduce((sum, score) => sum + score, 0);
  const avg = record.scores.length ? Math.round(total / record.scores.length) : "--";
  return [
    `日付：${formatDate(record.date)}`,
    `会場：${record.venue || "未入力"}`,
    `レーン：${record.lane || "未入力"}`,
    `ゲーム別スコア：${record.scores.length ? record.scores.map((score, index) => `${index + 1}G ${score}`).join("、") : "未入力"}`,
    `合計：${record.scores.length ? total : "--"}、平均：${avg}`,
    `使用ボール：${record.ballName || "未入力"}`,
    `よく残ったピン：${record.pins.length ? record.pins.join("、") : "未入力"}`,
    `ミス傾向：${record.tags.length ? record.tags.join("、") : "未入力"}`,
    `今日の調子：${record.condition || "普通"}`,
    `メモ：${record.memo || "なし"}`
  ].join("\n");
}

function setPromptText(text) {
  document.getElementById("prompt-output").value = text;
}

async function copyPrompt() {
  const textarea = document.getElementById("prompt-output");
  const text = textarea.value;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("copy-status", "コピーしました。ChatGPTに貼り付けてください。");
  } catch (error) {
    textarea.removeAttribute("readonly");
    textarea.select();
    document.execCommand("copy");
    textarea.setAttribute("readonly", "readonly");
    setStatus("copy-status", "コピーしました。");
  }
}

function saveAiComment() {
  const select = document.getElementById("ai-record-select");
  const record = state.records.find((item) => item.id === select.value);
  const comment = cleanText(document.getElementById("ai-comment").value);
  if (!record) {
    setStatus("ai-comment-status", "保存先の記録がありません。", true);
    return;
  }
  if (!comment) {
    setStatus("ai-comment-status", "ChatGPTの回答を貼り付けてください。", true);
    return;
  }
  if (record.aiComment && record.aiComment !== comment) {
    const ok = window.confirm("すでにAIコーチコメントがあります。上書きしてよろしいですか？");
    if (!ok) return;
  }
  record.aiComment = comment;
  saveState();
  renderAll();
  setStatus("ai-comment-status", "AIコーチコメントを保存しました。");
}

function handleImageSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const image = new Image();
  image.onload = () => {
    state.currentImage = image;
    drawProcessedImage();
    setStatus("ocr-status", "画像を選びました。読み取り開始を押してください。");
  };
  image.onerror = () => setStatus("ocr-status", "画像を読み込めませんでした。", true);
  image.src = URL.createObjectURL(file);
}

function drawProcessedImage() {
  if (!state.currentImage) return "";
  const canvas = document.getElementById("process-canvas");
  const preview = document.getElementById("sheet-preview");
  const wrap = document.getElementById("image-preview-wrap");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(state.currentImage.width, state.currentImage.height));
  canvas.width = Math.max(1, Math.round(state.currentImage.width * scale));
  canvas.height = Math.max(1, Math.round(state.currentImage.height * scale));
  context.drawImage(state.currentImage, 0, 0, canvas.width, canvas.height);

  const brightness = Number(document.getElementById("brightness-range").value);
  const contrast = Number(document.getElementById("contrast-range").value) / 100;
  const blackWhite = document.getElementById("bw-toggle").checked;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    let red = adjustColor(data[index], brightness, contrast);
    let green = adjustColor(data[index + 1], brightness, contrast);
    let blue = adjustColor(data[index + 2], brightness, contrast);

    if (blackWhite) {
      const gray = 0.299 * red + 0.587 * green + 0.114 * blue;
      const value = gray > 150 ? 255 : 0;
      red = value;
      green = value;
      blue = value;
    }

    data[index] = red;
    data[index + 1] = green;
    data[index + 2] = blue;
  }

  context.putImageData(imageData, 0, 0);
  const dataUrl = canvas.toDataURL("image/png");
  preview.src = dataUrl;
  wrap.classList.add("has-image");
  return dataUrl;
}

function adjustColor(value, brightness, contrast) {
  return Math.max(0, Math.min(255, (value - 128) * contrast + 128 + brightness));
}

async function runOcr() {
  if (!state.currentImage) {
    setStatus("ocr-status", "先にスコアシート画像を選んでください。", true);
    return;
  }

  if (!window.Tesseract) {
    setStatus("ocr-status", "読み取り機能を読み込めませんでした。アプリのファイルを確認してください。", true);
    return;
  }

  const button = document.getElementById("run-ocr");
  const imageData = drawProcessedImage();
  button.disabled = true;
  setStatus("ocr-status", "読み取り中です。少し時間がかかります。");

  try {
    const result = await window.Tesseract.recognize(imageData, "eng+jpn", {
      ...TESSERACT_LOCAL_PATHS,
      workerBlobURL: false,
      cacheMethod: "none",
      gzip: true,
      logger: (message) => {
        if (message.status === "recognizing text") {
          const percent = Math.round((message.progress || 0) * 100);
          setStatus("ocr-status", `読み取り中です。${percent}%`);
        }
      }
    });
    const rawText = result.data?.text || "";
    document.getElementById("ocr-raw-text").textContent = rawText || "文字を読み取れませんでした。";
    state.pendingOcr = extractOcrCandidates(rawText);
    renderOcrConfirm();
    showScreen("ocr-confirm");
  } catch (error) {
    console.error(error);
    setStatus("ocr-status", "読み取りに失敗しました。下のボタンから手入力に戻れます。画像を選び直すこともできます。", true);
  } finally {
    button.disabled = false;
  }
}

function extractOcrCandidates(rawText) {
  const normalized = normalizeOcrScoreText(rawText);
  const date = findDateCandidate(rawText) || findDateCandidate(normalized) || todayString();
  const venue = findVenueCandidate(rawText);
  const tokens = normalized.match(/\d{1,4}/g) || [];
  const numbers = tokens.map(Number).filter(Number.isFinite);
  const warnings = numbers.filter((number) => number > 300);
  const scoreNumbers = numbers.filter((number) => number >= 0 && number <= 300);
  const likelyScores = [
    ...scoreNumbers.filter((number) => number >= 50),
    ...scoreNumbers.filter((number) => number < 50)
  ].slice(0, 6);

  return {
    rawText,
    normalized,
    date,
    venue,
    scores: likelyScores.length ? likelyScores.slice(0, 4) : ["", "", "", ""],
    warnings
  };
}

function normalizeOcrScoreText(text) {
  return String(text || "")
    .replace(/[ＯｏOo]/g, "0")
    .replace(/[ＩｌｌIi|]/g, "1")
    .replace(/[ＳＳs]/g, "5")
    .replace(/[ＢＢb]/g, "8")
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function findDateCandidate(text) {
  const match = String(text || "").match(/(\d{2,4})[\/.\-年\s]+(\d{1,2})[\/.\-月\s]+(\d{1,2})/);
  return match ? normalizeDate(match[0]) : "";
}

function findVenueCandidate(text) {
  const lines = String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const line = lines.find((item) => {
    const digitCount = (item.match(/\d/g) || []).length;
    return item.length >= 3 && item.length <= 24 && digitCount <= 2 && /[ぁ-んァ-ヶ一-龠A-Za-z]/.test(item);
  });
  return line || "";
}

function renderOcrConfirm() {
  const pending = state.pendingOcr;
  if (!pending) return;

  document.getElementById("ocr-date").value = pending.date || todayString();
  document.getElementById("ocr-venue").value = pending.venue || "";
  renderOcrScoreInputs(pending.scores);
  document.getElementById("ocr-confirm-raw").textContent = pending.rawText || "文字を読み取れませんでした。";
  const warnings = unique(pending.warnings).slice(0, 8);
  document.getElementById("ocr-warnings").innerHTML = warnings.length
    ? warnings.map((number) => `<p>${number} は300点を超えています。点数ではない場合は無視してください。</p>`).join("")
    : "";
}

function updateOcrSummary() {
  const { scores } = readScores("ocr-score-inputs");
  const total = scores.reduce((sum, score) => sum + score, 0);
  document.getElementById("ocr-total").textContent = scores.length ? total : "--";
  document.getElementById("ocr-average").textContent = scores.length ? Math.round(total / scores.length) : "--";
}

function saveOcrRecord(event) {
  event.preventDefault();
  const { scores, errors } = readScores("ocr-score-inputs");
  if (errors.length) {
    setStatus("ocr-confirm-status", errors[0], true);
    return;
  }
  if (!scores.length) {
    setStatus("ocr-confirm-status", "スコアを1つ以上入力してください。", true);
    return;
  }

  const record = sanitizeRecord({
    id: createId("record"),
    createdAt: new Date().toISOString(),
    date: document.getElementById("ocr-date").value || todayString(),
    venue: document.getElementById("ocr-venue").value,
    lane: "",
    scores,
    ballName: "",
    pins: [],
    tags: [],
    condition: "普通",
    memo: "スコアシート画像から読み取り",
    source: "ocr"
  });

  state.records.push(record);
  saveState();
  renderAll();
  setStatus("ocr-confirm-status", "保存しました。");
  showScreen("history");
}

function exportJson() {
  const payload = {
    app: "bowling-practice-pwa",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: state.records,
    balls: state.balls
  };
  downloadText(`bowling-backup-${todayString()}.json`, JSON.stringify(payload, null, 2), "application/json");
  localStorage.setItem(STORAGE_KEYS.lastJsonBackupAt, todayString());
  renderHome();
}

function exportCsv() {
  const headers = [
    "id",
    "date",
    "venue",
    "lane",
    "scores",
    "ballName",
    "pins",
    "tags",
    "condition",
    "memo",
    "aiComment",
    "source",
    "createdAt"
  ];
  const rows = state.records.map((record) => headers.map((header) => {
    if (header === "scores" || header === "pins" || header === "tags") return (record[header] || []).join("|");
    return record[header] || "";
  }));
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadText(`bowling-records-${todayString()}.csv`, `\ufeff${csv}`, "text/csv");
}

async function restoreData() {
  const input = document.getElementById("restore-file");
  const file = input.files?.[0];
  if (!file) {
    setStatus("backup-status", "復元するファイルを選んでください。", true);
    return;
  }

  try {
    const text = await file.text();
    const incoming = file.name.toLowerCase().endsWith(".csv")
      ? { records: csvToRecords(text), balls: [] }
      : parseBackupJson(text);

    if (!incoming.records.length && !incoming.balls.length) {
      setStatus("backup-status", "復元できるデータが見つかりませんでした。", true);
      return;
    }

    if (state.restoreMode === "replace") {
      const ok = window.confirm("今の記録をすべて入れ替えます。バックアップ済みか確認してください。");
      if (!ok) return;
      state.records = incoming.records.map(sanitizeRecord);
      state.balls = incoming.balls.length ? incoming.balls.map(sanitizeBall) : state.balls;
    } else {
      mergeIncomingData(incoming);
    }

    saveState();
    renderAll();
    setStatus("backup-status", "復元しました。");
    input.value = "";
  } catch (error) {
    console.error(error);
    setStatus("backup-status", "復元に失敗しました。ファイルを確認してください。", true);
  }
}

function parseBackupJson(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    return { records: data.map(sanitizeRecord), balls: [] };
  }
  return {
    records: Array.isArray(data.records) ? data.records.map(sanitizeRecord) : [],
    balls: Array.isArray(data.balls) ? data.balls.map(sanitizeBall) : []
  };
}

function csvToRecords(text) {
  const rows = parseCsv(text.replace(/^\ufeff/, ""));
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).filter((row) => row.some((cell) => cleanText(cell))).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] || "";
    });
    return sanitizeRecord({
      id: item.id || createId("record"),
      createdAt: item.createdAt || new Date().toISOString(),
      date: item.date,
      venue: item.venue,
      lane: item.lane,
      scores: splitList(item.scores).map(Number),
      ballName: item.ballName,
      pins: splitList(item.pins).map(Number),
      tags: splitList(item.tags),
      condition: item.condition,
      memo: item.memo,
      aiComment: item.aiComment,
      source: item.source || "csv"
    });
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function splitList(value) {
  return cleanText(value).split(/[|;、\s]+/).map(cleanText).filter(Boolean);
}

function mergeIncomingData(incoming) {
  const recordIds = new Set(state.records.map((record) => record.id));
  incoming.records.map(sanitizeRecord).forEach((record) => {
    if (recordIds.has(record.id)) record.id = createId("record");
    state.records.push(record);
    recordIds.add(record.id);
  });

  const ballNames = new Set(state.balls.map((ball) => ball.name));
  incoming.balls.map(sanitizeBall).forEach((ball) => {
    if (!ballNames.has(ball.name)) {
      state.balls.push(ball);
      ballNames.add(ball.name);
    }
  });
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getRecordsByDate(records = state.records) {
  return [...records].sort((a, b) => {
    const dateCompare = String(b.date).localeCompare(String(a.date));
    if (dateCompare !== 0) return dateCompare;
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

function average(numbers) {
  const valid = numbers.filter(Number.isFinite);
  if (!valid.length) return 0;
  return valid.reduce((sum, number) => sum + number, 0) / valid.length;
}

function unique(values) {
  return [...new Set(values)];
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${Number(month)}月${Number(day)}日`;
}

function setStatus(id, message, isError = false) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = message;
  element.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch((error) => {
      console.warn("Service Worker registration failed", error);
    });
  });
}
