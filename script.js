"use strict";

// ===== 設定 =====
// GASをWebアプリとしてデプロイした後、発行されたURLをここに貼り付けてください。
// 空のままの場合、データ送信は行わず診断結果の表示のみ行います。
const GAS_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzMc8sEuJDVy35eWM8a_2PJa4SE8yNCYmomkH7gZSh_EskyCgC4OtwsGcIsDfrqsKU0/exec";

// ===== 定義データ =====
const QUESTIONS = [
  {
    id: "q1",
    text: "複数のアプリやWebサイトで、同じ（または似た）パスワードを使い回している",
    advice:
      "アプリごとに違うパスワードを設定するか、パスワード管理アプリを使いましょう。",
  },
  {
    id: "q2",
    text: "SNSに写真を投稿するとき、撮影場所の「位置情報（GPS）」がついたまま投稿することがある",
    advice:
      "スマホのカメラ設定から「位置情報を保存する」機能をオフにしましょう。",
  },
  {
    id: "q3",
    text: "SNSで面識のない人から届いたメッセージやフレンド申請に、あまり警戒せず返信・承認したことがある",
    advice:
      "知らない人からの連絡は詐欺の入り口です。安易にリンクを踏んだり個人情報を教えたりしないように。",
  },
  {
    id: "q4",
    text: "自分のSNSアカウントは、誰でも見られる「公開（オープン）状態」にしている",
    advice:
      "プライベートな投稿をするアカウントは「非公開（鍵垢）」に設定し、承認した友人だけが見られるようにしましょう。",
  },
  {
    id: "q5",
    text: "カフェや街中の「鍵がかかっていない無料Wi-Fi（フリーWi-Fi）」に、よく考えず接続している",
    advice:
      "鍵なしWi-Fiは通信内容を盗み見られる危険があります。重要なログインや決済はキャリア回線で行いましょう。",
  },
];

const AGE_OPTIONS = ["10代未満", "10代", "20代", "30代〜50代", "60代以上"];

const IMPRESSION_OPTIONS = [
  "とても勉強になった！",
  "パスワードや設定を見直そうと思った",
  "家族や友達にも教えたい",
  "すでに知っている内容が多かった",
];

const RANKS = {
  max: {
    key: "MAX",
    className: "rank-max",
    title: "🔴 危険度：MAX ⚠️ すぐに防犯対策見直しレベル！",
    state:
      "いつアカウント乗っ取りや個人情報特定にあってもおかしくない危険な状態です。",
    advice:
      "パスワードの使い回しをやめ、「二段階認証」を今すぐ設定しましょう！位置情報の共有設定もオフに。",
  },
  caution: {
    key: "注意",
    className: "rank-caution",
    title: "🟡 危険度：注意 ⚠️ ちょっとした油断が危ないレベル！",
    state: "普段は気をつけていても、ふとした瞬間に隙が生まれやすい状態です。",
    advice:
      "知らない人からのDMは無視・ブロックする勇気を。投稿前の写真の背景（自宅の近くや電柱など）にも気を配りましょう。",
  },
  safe: {
    key: "安全",
    className: "rank-safe",
    title: "🟢 危険度：安全 🛡️ この調子で鉄壁をキープ！",
    state: "素晴らしい防犯意識です！セキュリティへの意識が高く保たれています。",
    advice:
      "手口は日々進化しています。周囲の友人にもぜひ、今日の気づきをシェアしてあげてください！",
  },
};

// ===== DOM参照 =====
const form = document.getElementById("diagnosis-form");
const formScreen = document.getElementById("form-screen");
const resultScreen = document.getElementById("result-screen");
const formError = document.getElementById("form-error");

// ===== フォーム描画 =====
function renderForm() {
  const questionsEl = document.getElementById("questions");
  questionsEl.innerHTML = QUESTIONS.map(
    (q, i) => `
    <fieldset class="card question" id="field-${q.id}">
      <legend><span class="q-num">Q${i + 1}</span>${q.text}</legend>
      <div class="yesno">
        <label class="yesno-option yes">
          <input type="radio" name="${q.id}" value="はい"><span>はい</span>
        </label>
        <label class="yesno-option no">
          <input type="radio" name="${q.id}" value="いいえ"><span>いいえ</span>
        </label>
      </div>
    </fieldset>
  `,
  ).join("");

  document.getElementById("age-list").innerHTML = AGE_OPTIONS.map(
    (age) => `
    <label class="choice"><input type="radio" name="age" value="${age}"><span>${age}</span></label>
  `,
  ).join("");

  document.getElementById("impression-list").innerHTML = IMPRESSION_OPTIONS.map(
    (opt) => `
    <label class="choice"><input type="checkbox" name="impression_select" value="${opt}"><span>${opt}</span></label>
  `,
  ).join("");

  // 回答したら未回答の強調を解除
  questionsEl.addEventListener("change", (e) => {
    const fieldset = e.target.closest("fieldset");
    if (fieldset) fieldset.classList.remove("unanswered");
    if (!QUESTIONS.some((q) => !getRadioValue(q.id))) formError.hidden = true;
  });
}

function getRadioValue(name) {
  const checked = form.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

// ===== 診断ロジック =====
function judge(score) {
  if (score >= 4) return RANKS.max;
  if (score >= 2) return RANKS.caution;
  return RANKS.safe;
}

// ===== 結果描画 =====
function renderResult(answers, score, rank) {
  const rankEl = document.getElementById("result-rank");
  rankEl.className = `card result-rank ${rank.className}`;
  document.getElementById("result-score").textContent =
    `「はい」の数：${score} / ${QUESTIONS.length}`;
  document.getElementById("result-title").textContent = rank.title;
  document.getElementById("result-state").textContent = rank.state;
  document.getElementById("result-advice").textContent = rank.advice;

  const yesQuestions = QUESTIONS.filter((q) => answers[q.id] === "はい");
  const individualEl = document.getElementById("individual-advice");
  const listEl = document.getElementById("advice-list");
  listEl.innerHTML = "";
  yesQuestions.forEach((q) => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.className = "advice-q";
    label.textContent = `Q${QUESTIONS.indexOf(q) + 1}`;
    li.append(label, document.createTextNode(q.advice));
    listEl.appendChild(li);
  });
  individualEl.hidden = yesQuestions.length === 0;

  formScreen.hidden = true;
  resultScreen.hidden = false;
  window.scrollTo({ top: 0 });
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

// ===== イベント =====
form.addEventListener("submit", (e) => {
  e.preventDefault();

  // 必須チェック
  const unanswered = QUESTIONS.filter((q) => !getRadioValue(q.id));
  QUESTIONS.forEach((q) => {
    document
      .getElementById(`field-${q.id}`)
      .classList.toggle("unanswered", unanswered.includes(q));
  });
  if (unanswered.length > 0) {
    const names = unanswered
      .map((q) => `Q${QUESTIONS.indexOf(q) + 1}`)
      .join("・");
    formError.textContent = `${names} が未回答です。すべての質問に答えてください。`;
    formError.hidden = false;
    document
      .getElementById(`field-${unanswered[0].id}`)
      .scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  formError.hidden = true;

  const answers = {};
  QUESTIONS.forEach((q) => {
    answers[q.id] = getRadioValue(q.id);
  });
  const score = QUESTIONS.filter((q) => answers[q.id] === "はい").length;
  const rank = judge(score);

  const payload = {
    ...answers,
    score,
    rank: rank.key,
    age: getRadioValue("age"),
    impression_select: Array.from(
      form.querySelectorAll('input[name="impression_select"]:checked'),
    ).map((el) => el.value),
    impression_text: document.getElementById("impression-text").value.trim(),
  };

  // 先に結果を表示し、送信は待たない
  renderResult(answers, score, rank);
  sendData(payload);
});

document.getElementById("restart-btn").addEventListener("click", () => {
  form.reset();
  QUESTIONS.forEach((q) =>
    document.getElementById(`field-${q.id}`).classList.remove("unanswered"),
  );
  formError.hidden = true;
  resultScreen.hidden = true;
  formScreen.hidden = false;
  window.scrollTo({ top: 0 });
});

renderForm();
