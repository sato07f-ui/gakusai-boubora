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
    const visual = el("span", "course-visual");
    if (set.courseImage) {
      const img = el("img");
      img.src = set.courseImage;
      img.alt = "";
      visual.appendChild(img);
    } else {
      visual.appendChild(el("span", "course-icon", set.courseIcon || ""));
    }
    btn.append(
      visual,
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

// ===== 結果URL（QRコードから結果を再表示するため） =====
// 例: ?c=elementary&a=BBACBBBBCB （はい/いいえ は Y/N）
function encodeAnswers(set, answers) {
  if (set.type === "choice") return answers.join("");
  return answers.map((a) => (a === "はい" ? "Y" : "N")).join("");
}

function decodeAnswers(set, code) {
  const chars = Array.from(code || "");
  if (chars.length !== set.questions.length) return null;
  const answers = chars.map((ch, i) => {
    if (set.type === "choice") return ch in set.questions[i].choices ? ch : null;
    if (ch === "Y") return "はい";
    if (ch === "N") return "いいえ";
    return null;
  });
  return answers.includes(null) ? null : answers;
}

function buildResultUrl(set, answers) {
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("c", set.id);
  url.searchParams.set("a", encodeAnswers(set, answers));
  return url.toString();
}

function clearResultUrl() {
  if (location.search) history.replaceState(null, "", location.pathname);
  $("revisit-note").hidden = true;
}

// URLに結果が含まれていれば、その結果画面を表示する（データ送信はしない）
function restoreFromUrl() {
  const params = new URLSearchParams(location.search);
  const set = QUIZ_SETS.find((s) => s.id && s.id === params.get("c"));
  if (!set) return false;
  const answers = decodeAnswers(set, params.get("a"));
  if (!answers) return false;

  state.set = set;
  state.answers = answers;
  setHeader(set.title, set.subtitle || "");
  renderResult(set, evaluate(set, answers));
  $("revisit-note").hidden = false;
  return true;
}

// ===== 結果描画 =====
function renderResult(set, evaluation) {
  const { items, score, result } = evaluation;
  state.evaluation = evaluation;
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

  renderLinks(set);
  showScreen("result-screen");
}

function renderLinks(set) {
  const links = Array.isArray(set.links) ? set.links : [];
  $("links-card").hidden = links.length === 0;
  $("links-title").textContent = set.linksTitle || "参考リンク";
  const list = $("links-list");
  list.innerHTML = "";
  links.forEach((link) => {
    const li = el("li");
    const a = el("a", "", link.title);
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    li.appendChild(a);
    if (link.note) li.appendChild(el("p", "link-note", link.note));
    list.appendChild(li);
  });
}

// ===== 結果画像（認定カード） =====
const CARD_WIDTH = 1080;
const CARD_PADDING = 64;
const CARD_FONT = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", "Yu Gothic", Meiryo, sans-serif';
const CARD_TONES = {
  danger: { bg: "#fef2f2", accent: "#dc2626" },
  caution: { bg: "#fefce8", accent: "#a16207" },
  safe: { bg: "#f0fdf4", accent: "#16a34a" },
};

// 行頭に来てはいけない文字（閉じかっこ・句読点など）
const NO_LINE_START = "」』）)］】、。，．・！？!?ー…";

function wrapLines(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  Array.from(text || "").forEach((ch) => {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      if (NO_LINE_START.includes(ch) && Array.from(line).length > 1) {
        // 直前の1文字ごと次の行へ送る
        const chars = Array.from(line);
        const last = chars.pop();
        lines.push(chars.join(""));
        line = last + ch;
      } else {
        lines.push(line);
        line = ch;
      }
    } else {
      line += ch;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && ctx.measureText(chars.join("") + "…").width > maxWidth) chars.pop();
  return chars.join("") + "…";
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatDate(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

// draw=false で高さだけを計算し、draw=true で実際に描く
function layoutCard(ctx, draw, { set, evaluation, url }) {
  const { items, score, result } = evaluation;
  const tone = CARD_TONES[result.tone] || CARD_TONES.safe;
  const inner = CARD_WIDTH - CARD_PADDING * 2;
  let y = 0;

  const text = (str, x, ty, font, color, align = "left") => {
    ctx.font = font;
    if (!draw) return;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.fillText(str, x, ty);
  };
  const lines = (str, font, maxWidth) => {
    ctx.font = font;
    return wrapLines(ctx, str, maxWidth);
  };

  // --- ヘッダー ---
  const titleFont = `bold 34px ${CARD_FONT}`;
  const setTitleLines = lines(set.title, titleFont, inner);
  const headerH = 56 + 56 + setTitleLines.length * 48 + 20 + 30 + 48;
  if (draw) {
    const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, headerH);
    grad.addColorStop(0, "#1e3a8a");
    grad.addColorStop(1, "#172554");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_WIDTH, headerH);
  }
  y = 56;
  text(APP_TITLE, CARD_WIDTH / 2, y, `bold 44px ${CARD_FONT}`, "#ffffff", "center");
  y += 56;
  setTitleLines.forEach((l) => {
    text(l, CARD_WIDTH / 2, y, titleFont, "#dbeafe", "center");
    y += 48;
  });
  y += 20;
  text(`${formatDate(new Date())} の結果`, CARD_WIDTH / 2, y, `26px ${CARD_FONT}`, "#bfdbfe", "center");
  y = headerH + 40;

  // --- 判定 ---
  const rankFont = `bold 46px ${CARD_FONT}`;
  const stateFont = `28px ${CARD_FONT}`;
  const rankLines = lines(result.title, rankFont, inner - 64);
  const stateLines = lines(result.state || "", stateFont, inner - 64);
  const boxH = 40 + 44 + 16 + rankLines.length * 62 + 12 + stateLines.length * 44 + 40;
  if (draw) {
    roundRect(ctx, CARD_PADDING, y, inner, boxH, 28);
    ctx.fillStyle = tone.bg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = tone.accent;
    ctx.fillRect(CARD_PADDING, y, inner, 12);
    ctx.restore();
  }
  let by = y + 40;
  text(`${set.scoreLabel}　${score} / ${items.length}`, CARD_WIDTH / 2, by, `bold 34px ${CARD_FONT}`, "#4b5563", "center");
  by += 44 + 16;
  rankLines.forEach((l) => {
    text(l, CARD_WIDTH / 2, by, rankFont, tone.accent, "center");
    by += 62;
  });
  by += 12;
  stateLines.forEach((l) => {
    text(l, CARD_PADDING + 32, by, stateFont, "#1f2937");
    by += 44;
  });
  y += boxH + 48;

  // --- 1問ずつの結果 ---
  text("1問ずつの結果", CARD_PADDING, y, `bold 34px ${CARD_FONT}`, "#1e3a8a");
  y += 60;
  const colGap = 24;
  const colW = (inner - colGap) / 2;
  const rowH = 72;
  const rows = Math.ceil(items.length / 2);
  items.forEach(({ q, good }, i) => {
    const col = i < rows ? 0 : 1;
    const row = i < rows ? i : i - rows;
    const x = CARD_PADDING + col * (colW + colGap);
    const ry = y + row * rowH;
    if (draw) {
      roundRect(ctx, x, ry, colW, rowH - 12, 14);
      ctx.fillStyle = good ? "#f0fdf4" : "#fef2f2";
      ctx.fill();
      roundRect(ctx, x + 12, ry + 12, 64, 36, 8);
      ctx.fillStyle = good ? "#1e3a8a" : "#dc2626";
      ctx.fill();
    }
    text(`Q${i + 1}`, x + 44, ry + 16, `bold 24px ${CARD_FONT}`, "#ffffff", "center");
    const mark = set.type === "choice" ? (good ? "○" : "×") : good ? "OK" : "注意";
    const markColor = good ? "#16a34a" : "#dc2626";
    ctx.font = `bold 30px ${CARD_FONT}`;
    const markW = ctx.measureText(mark).width;
    text(mark, x + colW - 20, ry + 13, `bold 30px ${CARD_FONT}`, markColor, "right");
    ctx.font = `26px ${CARD_FONT}`;
    const title = fitText(ctx, q.title || "", colW - 92 - markW - 36);
    text(title, x + 92, ry + 15, `26px ${CARD_FONT}`, "#1f2937");
  });
  y += rows * rowH + 36;

  // --- QRコード ---
  const qrSize = 360;
  const qrBoxH = 40 + 56 + 20 + qrSize + 24 + 40 + 40;
  if (draw) {
    roundRect(ctx, CARD_PADDING, y, inner, qrBoxH, 28);
    ctx.fillStyle = "#eff6ff";
    ctx.fill();
    ctx.strokeStyle = "#93c5fd";
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  let qy = y + 40;
  text("📘 解説はこちらから！", CARD_WIDTH / 2, qy, `bold 44px ${CARD_FONT}`, "#1e3a8a", "center");
  qy += 56 + 20;
  if (draw) drawQr(ctx, url, (CARD_WIDTH - qrSize) / 2, qy, qrSize);
  qy += qrSize + 24;
  text("カメラで読み取ると、全問の解説をもう一度見られます", CARD_WIDTH / 2, qy, `28px ${CARD_FONT}`, "#374151", "center");
  y += qrBoxH + 40;

  // --- フッター ---
  const footer = document.querySelector(".site-footer").textContent.trim();
  text(footer, CARD_WIDTH / 2, y, `24px ${CARD_FONT}`, "#6b7280", "center");
  y += 24 + 48;

  return y;
}

function drawQr(ctx, url, x, y, size) {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const cell = Math.floor(size / (count + quiet * 2));
  const total = cell * (count + quiet * 2);
  const ox = x + Math.floor((size - total) / 2);
  const oy = y + Math.floor((size - total) / 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#000000";
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(ox + (c + quiet) * cell, oy + (r + quiet) * cell, cell, cell);
    }
  }
}

function createResultCard() {
  const data = {
    set: state.set,
    evaluation: state.evaluation,
    url: buildResultUrl(state.set, state.answers),
  };
  const measure = document.createElement("canvas").getContext("2d");
  const height = layoutCard(measure, false, data);

  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#eef2f7";
  ctx.fillRect(0, 0, CARD_WIDTH, height);
  layoutCard(ctx, true, data);
  return canvas;
}

let cardFile = null;
let cardObjectUrl = null;

function openSaveModal() {
  if (!state.set || !state.evaluation) return;
  const canvas = createResultCard();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const fileName = `cyber-check-${state.set.id || "result"}-${stamp}.png`;
    cardFile = new File([blob], fileName, { type: "image/png" });
    if (cardObjectUrl) URL.revokeObjectURL(cardObjectUrl);
    cardObjectUrl = URL.createObjectURL(blob);

    $("save-preview").src = cardObjectUrl;
    $("download-link").href = cardObjectUrl;
    $("download-link").download = fileName;

    const canShare = !!(navigator.canShare && navigator.canShare({ files: [cardFile] }));
    $("share-btn").hidden = !canShare;
    $("download-link").className = canShare ? "btn btn-secondary" : "btn btn-primary";

    $("save-modal").hidden = false;
    document.body.style.overflow = "hidden";
  }, "image/png");
}

function closeSaveModal() {
  $("save-modal").hidden = true;
  document.body.style.overflow = "";
}

async function shareCard() {
  if (!cardFile) return;
  try {
    await navigator.share({ files: [cardFile] });
  } catch (err) {
    if (err.name !== "AbortError") {
      console.warn("共有に失敗しました", err);
      $("share-btn").hidden = true;
      $("download-link").className = "btn btn-primary";
    }
  }
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
  clearResultUrl();
  state.set = null;
  state.evaluation = null;
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

$("save-image-btn").addEventListener("click", openSaveModal);
$("share-btn").addEventListener("click", shareCard);
$("modal-close-btn").addEventListener("click", closeSaveModal);
$("save-modal").addEventListener("click", (e) => {
  if (e.target === $("save-modal")) closeSaveModal();
});

renderCourses();
renderSurvey();
restoreFromUrl();
