"use strict";

// ===== 設定 =====
// GASをWebアプリとしてデプロイした後、発行されたURLをここに貼り付けてください。
// 空のままの場合、データ送信は行わず診断結果の表示のみ行います。
const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzMc8sEuJDVy35eWM8a_2PJa4SE8yNCYmomkH7gZSh_EskyCgC4OtwsGcIsDfrqsKU0/exec";

// 選択肢をタップしてから次の問題へ進むまでの時間（ミリ秒）
const AUTO_ADVANCE_MS = 300;

// 問題データ（QUIZ_SETS / AGE_OPTIONS / IMPRESSION_OPTIONS）は questions.js で定義

const APP_TITLE = "サイバー防犯チャレンジ";
const APP_SUBTITLE = "あなたに合ったコースを選んでね！";

const TONE_CLASS = {
  danger: "tone-danger",
  caution: "tone-caution",
  safe: "tone-safe",
};

// ===== 状態 =====
const state = {
  set: null,
  index: 0,
  answers: [],
};
let advanceTimer = null;

// ===== DOM参照 =====
const $ = (id) => document.getElementById(id);
const screens = ["course-screen", "quiz-screen", "survey-screen", "result-screen"];
const surveyForm = $("survey-form");

// ===== ユーティリティ =====
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showScreen(id) {
  screens.forEach((s) => {
    $(s).hidden = s !== id;
  });
  window.scrollTo({ top: 0 });
}

function setHeader(title, subtitle) {
  $("header-title").textContent = title;
  $("header-subtitle").textContent = subtitle;
  document.title = title;
}

function clearAdvanceTimer() {
  clearTimeout(advanceTimer);
  advanceTimer = null;
}

// ===== コース選択 =====
function renderCourses() {
  const list = $("course-list");
  QUIZ_SETS.forEach((set) => {
    const btn = el("button", "course-btn");
    btn.type = "button";
    btn.append(
      el("span", "course-icon", set.courseIcon || ""),
      el("span", "course-label", set.courseLabel),
      el("span", "course-note", set.courseNote || ""),
    );
    btn.addEventListener("click", () => startSet(set));
    list.appendChild(btn);
  });
}

function startSet(set) {
  state.set = set;
  state.index = 0;
  state.answers = new Array(set.questions.length).fill("");
  surveyForm.reset();
  setHeader(set.title, set.subtitle || "");
  $("quiz-rule").textContent = set.rule || "";
  renderQuestion();
  showScreen("quiz-screen");
}

// ===== 質問（1問ずつ） =====
function getOptions(set, q) {
  if (set.type === "choice") {
    return Object.entries(q.choices).map(([key, text]) => ({
      value: key,
      label: key,
      text,
    }));
  }
  return [
    { value: "はい", text: "はい" },
    { value: "いいえ", text: "いいえ" },
  ];
}

function renderQuestion() {
  const { set, index } = state;
  const q = set.questions[index];
  const total = set.questions.length;

  $("quiz-rule-card").hidden = index !== 0 || !set.rule;
  $("progress-fill").style.width = `${((index + 1) / total) * 100}%`;
  $("progress-text").textContent = `${index + 1} / ${total} 問`;

  const card = $("question-card");
  card.innerHTML = "";
  if (q.category) card.appendChild(el("p", "q-category", q.category));
  const head = el("p", "q-head");
  head.append(el("span", "q-num", `Q${index + 1}`), document.createTextNode(q.title || ""));
  card.append(head, el("p", "q-text", q.text));

  const options = el("div", set.type === "choice" ? "options" : "options yesno");
  getOptions(set, q).forEach((opt) => {
    const btn = el("button", "option");
    btn.type = "button";
    btn.dataset.value = opt.value;
    btn.setAttribute("aria-pressed", String(state.answers[index] === opt.value));
    if (opt.label) btn.appendChild(el("span", "option-label", opt.label));
    btn.appendChild(el("span", "option-text", opt.text));
    btn.addEventListener("click", () => selectAnswer(opt.value));
    options.appendChild(btn);
  });
  card.appendChild(options);

  $("prev-btn").textContent = index === 0 ? "← コース選択" : "← 前へ";
  $("next-btn").textContent = index === total - 1 ? "アンケートへ →" : "次へ →";
  $("next-btn").disabled = !state.answers[index];
}

function selectAnswer(value) {
  state.answers[state.index] = value;
  $("question-card")
    .querySelectorAll(".option")
    .forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.value === value)));
  $("next-btn").disabled = false;

  clearAdvanceTimer();
  advanceTimer = setTimeout(goNext, AUTO_ADVANCE_MS);
}

function goNext() {
  clearAdvanceTimer();
  if (!state.answers[state.index]) return;
  if (state.index < state.set.questions.length - 1) {
    state.index += 1;
    renderQuestion();
    window.scrollTo({ top: 0 });
  } else {
    showScreen("survey-screen");
  }
}

function goPrev() {
  clearAdvanceTimer();
  if (state.index === 0) {
    backToCourses();
    return;
  }
  state.index -= 1;
  renderQuestion();
  window.scrollTo({ top: 0 });
}

// ===== アンケート =====
function renderSurvey() {
  AGE_OPTIONS.forEach((age) => {
    const label = el("label", "choice");
    const input = el("input");
    input.type = "radio";
    input.name = "age";
    input.value = age;
    label.append(input, el("span", "", age));
    $("age-list").appendChild(label);
  });
  IMPRESSION_OPTIONS.forEach((opt) => {
    const label = el("label", "choice");
    const input = el("input");
    input.type = "checkbox";
    input.name = "impression_select";
    input.value = opt;
    label.append(input, el("span", "", opt));
    $("impression-list").appendChild(label);
  });
}

// ===== 判定 =====
function evaluate(set, answers) {
  const items = set.questions.map((q, i) => {
    const value = answers[i];
    const good = set.type === "choice" ? value === q.answer : value !== q.danger;
    const record = set.type === "choice" ? `${value}${good ? "○" : "×"}` : value;
    return { q, value, good, record };
  });
  const score =
    set.type === "choice"
      ? items.filter((it) => it.good).length
      : items.filter((it) => !it.good).length;
  const sorted = [...set.results].sort((a, b) => b.min - a.min);
  const result = sorted.find((r) => score >= r.min) || sorted[sorted.length - 1];
  return { items, score, result };
}

// ===== 結果描画 =====
function renderResult(set, { items, score, result }) {
  $("result-rank").className = `card result-rank ${TONE_CLASS[result.tone] || ""}`;
  $("result-score").textContent = `${set.scoreLabel}：${score} / ${items.length}`;
  $("result-title").textContent = result.title;
  $("result-state").textContent = result.state || "";
  $("result-advice-box").hidden = !result.advice;
  $("result-advice").textContent = result.advice || "";

  const explanationLabel = set.explanationLabel || "解説";
  const tipLabel = set.tipLabel || "ワンポイント";
  const list = $("review-list");
  list.innerHTML = "";

  items.forEach(({ q, value, good }, i) => {
    const li = el("li", `review-item ${good ? "good" : "bad"}`);

    const head = el("div", "review-head");
    const badgeText =
      set.type === "choice" ? (good ? "○ 正解" : "× 不正解") : good ? "✓ OK" : "⚠ 要注意";
    head.append(
      el("span", "q-num", `Q${i + 1}`),
      el("span", "review-title", q.title || ""),
      el("span", "review-badge", badgeText),
    );
    li.appendChild(head);

    if (set.type === "choice") {
      li.appendChild(el("p", "review-answer", `あなたの答え：${value}. ${q.choices[value]}`));
      if (!good) {
        li.appendChild(
          el("p", "review-correct", `正解：${q.answer}. ${q.choices[q.answer]}`),
        );
      }
    } else {
      li.appendChild(el("p", "review-question", q.text));
      li.appendChild(el("p", "review-answer", `あなたの答え：${value}`));
    }

    if (!good && q.explanation) {
      const box = el("div", "review-box review-explanation");
      box.append(el("h4", "", `📘 ${explanationLabel}`), el("p", "", q.explanation));
      li.appendChild(box);
    }
    if (q.tip) {
      const box = el("div", "review-box review-tip");
      box.append(el("h4", "", `💡 ${tipLabel}`), el("p", "", q.tip));
      li.appendChild(box);
    }
    list.appendChild(li);
  });

  showScreen("result-screen");
}

// ===== データ送信（結果表示をブロックしない） =====
function sendData(payload) {
  if (!GAS_ENDPOINT) return;
  // text/plain + no-cors でプリフライト(OPTIONS)を回避。レスポンスは読まない。
  fetch(GAS_ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((err) => console.warn("データ送信に失敗しました", err));
}

// ===== 画面遷移 =====
function backToCourses() {
  clearAdvanceTimer();
  state.set = null;
  setHeader(APP_TITLE, APP_SUBTITLE);
  showScreen("course-screen");
}

// ===== イベント =====
$("prev-btn").addEventListener("click", goPrev);
$("next-btn").addEventListener("click", goNext);

$("survey-back-btn").addEventListener("click", () => {
  state.index = state.set.questions.length - 1;
  renderQuestion();
  showScreen("quiz-screen");
});

surveyForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const { set, answers } = state;
  if (!set || answers.some((a) => !a)) return;

  const evaluation = evaluate(set, answers);
  const checkedAge = surveyForm.querySelector('input[name="age"]:checked');

  const payload = {
    sheet_name: set.sheetName,
    answers: evaluation.items.map((it, i) => ({
      label: `Q${i + 1}_${it.q.title || ""}`,
      value: it.record,
    })),
    score_label: set.scoreLabel,
    score: evaluation.score,
    rank: evaluation.result.rank,
    age: checkedAge ? checkedAge.value : "",
    impression_select: Array.from(
      surveyForm.querySelectorAll('input[name="impression_select"]:checked'),
    ).map((input) => input.value),
    impression_text: $("impression-text").value.trim(),
  };

  // 先に結果を表示し、送信は待たない
  renderResult(set, evaluation);
  sendData(payload);
});

$("restart-btn").addEventListener("click", () => {
  surveyForm.reset();
  backToCourses();
});

renderCourses();
renderSurvey();
