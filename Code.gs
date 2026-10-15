/**
 * あなたのSNS危険度診断 - 回答保存API
 *
 * スプレッドシートの「拡張機能 > Apps Script」に貼り付けて使用してください。
 * デプロイ: 「デプロイ > 新しいデプロイ > 種類: ウェブアプリ」
 *   - 次のユーザーとして実行: 自分
 *   - アクセスできるユーザー: 全員
 */

// 書き込み先のシート名（存在しなければ自動作成）
const SHEET_NAME = '回答';

const HEADERS = [
  'タイムスタンプ',
  'Q1_パスワード',
  'Q2_位置情報',
  'Q3_DM承認',
  'Q4_公開設定',
  'Q5_フリーWiFi',
  'はいの数',
  '判定ランク',
  '年齢層',
  '感想_選択',
  '感想_自由記述',
];

const YES_NO = ['はい', 'いいえ'];
const RANKS = ['MAX', '注意', '安全'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);

    const answers = ['q1', 'q2', 'q3', 'q4', 'q5'].map(function (key) {
      return YES_NO.indexOf(data[key]) >= 0 ? data[key] : '';
    });
    const score = Number(data.score);
    const impressions = Array.isArray(data.impression_select) ? data.impression_select : [];

    const row = [
      new Date(),
      answers[0],
      answers[1],
      answers[2],
      answers[3],
      answers[4],
      Number.isInteger(score) && score >= 0 && score <= 5 ? score : '',
      RANKS.indexOf(data.rank) >= 0 ? data.rank : '',
      sanitize(data.age),
      sanitize(impressions.map(String).join(', ')),
      sanitize(data.impression_text),
    ];

    // 同時アクセス時の書き込み競合を防ぐ
    lock.waitLock(10000);
    getSheet().appendRow(row);

    return ContentService.createTextOutput('OK');
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput('ERROR');
  } finally {
    lock.releaseLock();
  }
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('yyyy/MM/dd HH:mm:ss');
  }
  return sheet;
}

/**
 * 文字列化し、先頭が = + - @ の場合は ' を付けて数式として解釈されるのを防ぐ
 */
function sanitize(value) {
  if (value === undefined || value === null) return '';
  const str = String(value);
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}

/**
 * 動作確認用: エディタから実行するとテスト行が1行追加されます
 */
function testDoPost() {
  const payload = {
    q1: 'はい', q2: 'いいえ', q3: 'はい', q4: 'いいえ', q5: 'いいえ',
    score: 2, rank: '注意', age: '20代',
    impression_select: ['とても勉強になった！', 'パスワードや設定を見直そうと思った'],
    impression_text: 'テスト送信です',
  };
  const res = doPost({ postData: { contents: JSON.stringify(payload) } });
  Logger.log(res.getContent());
}
