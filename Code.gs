/**
 * サイバー防犯チャレンジ - 回答保存API
 *
 * スプレッドシートの「拡張機能 > Apps Script」に貼り付けて使用してください。
 * デプロイ: 「デプロイ > 新しいデプロイ > 種類: ウェブアプリ」
 *   - 次のユーザーとして実行: 自分
 *   - アクセスできるユーザー: 全員
 *
 * 列（見出し）は送られてきた問題に合わせて自動で作るため、
 * 問題の内容を変えてもこのファイルを直す必要はありません。
 */

// 書き込みを許可するシート名（questions.js の sheetName と一致させる）
// コース（問題セット）を追加したときだけ、ここに追記してください。
const ALLOWED_SHEETS = ['回答_小学生', '回答_中高大学生'];

// 1回の送信で受け付ける問題数の上限
const MAX_QUESTIONS = 50;

// スプレッドシートの1セルに入る文字数の上限
const MAX_CELL_LENGTH = 50000;

function doPost(e) {
  return saveResponse(e, ALLOWED_SHEETS);
}

function saveResponse(e, allowedSheets) {
  const lock = LockService.getScriptLock();
  try {
    const data = JSON.parse(e.postData.contents);

    const sheetName = String(data.sheet_name || '');
    if (allowedSheets.indexOf(sheetName) < 0) {
      throw new Error('許可されていないシート名: ' + sheetName);
    }

    const answers = Array.isArray(data.answers) ? data.answers.slice(0, MAX_QUESTIONS) : [];
    const score = Number(data.score);
    const impressions = Array.isArray(data.impression_select) ? data.impression_select : [];

    const headers = ['タイムスタンプ']
      .concat(answers.map(function (a) { return sanitize(a && a.label); }))
      .concat([sanitize(data.score_label) || 'スコア', '判定', '年齢層', '感想_選択', '感想_自由記述']);

    const row = [new Date()]
      .concat(answers.map(function (a) { return sanitize(a && a.value); }))
      .concat([
        Number.isInteger(score) && score >= 0 && score <= answers.length ? score : '',
        sanitize(data.rank),
        sanitize(data.age),
        sanitize(impressions.map(String).join(', ')),
        sanitize(data.impression_text),
      ]);

    // 同時アクセス時の書き込み競合を防ぐ
    lock.waitLock(10000);
    getSheet(sheetName, headers).appendRow(row);

    return ContentService.createTextOutput('OK');
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput('ERROR');
  } finally {
    lock.releaseLock();
  }
}

/**
 * 見出しが一致するシートを返す。
 * 問題の変更などで見出しが変わった場合は「回答_小学生_2」のような新しいシートを作る。
 */
function getSheet(baseName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (let i = 1; i <= 20; i++) {
    const name = i === 1 ? baseName : baseName + '_' + i;
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.getRange('A:A').setNumberFormat('yyyy/MM/dd HH:mm:ss');
      return sheet;
    }
    if (sheet.getLastColumn() === headers.length) {
      const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0].map(String);
      if (current.join('\n') === headers.join('\n')) return sheet;
    }
  }
  throw new Error('書き込み先のシートが見つかりません: ' + baseName);
}

/**
 * 文字列化し、先頭が = + - @ の場合は ' を付けて数式として解釈されるのを防ぐ
 */
function sanitize(value) {
  if (value === undefined || value === null) return '';
  const str = String(value).slice(0, MAX_CELL_LENGTH - 1);
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}

/**
 * 動作確認用: エディタから実行すると「動作テスト_小学生」「動作テスト_中高大学生」シートに
 * テスト行が1行ずつ追加されます（本番のシートには書き込みません）。確認後はシートごと削除してOKです。
 */
function testDoPost() {
  const testSheets = ['動作テスト_小学生', '動作テスト_中高大学生'];
  const samples = [
    {
      sheet_name: '動作テスト_小学生',
      answers: [
        { label: 'Q1_写真や動画の背景', value: 'C○' },
        { label: 'Q2_位置情報', value: 'A×' },
      ],
      score_label: '正解数',
      score: 1,
      rank: '修行中',
      age: '10代未満',
      impression_select: ['とても勉強になった！'],
      impression_text: 'テスト送信です',
    },
    {
      sheet_name: '動作テスト_中高大学生',
      answers: [
        { label: 'Q1_離席時の画面ロック', value: 'はい' },
        { label: 'Q2_パスワードの使い回し', value: 'いいえ' },
      ],
      score_label: 'はいの数',
      score: 1,
      rank: '安全',
      age: '20代',
      impression_select: ['パスワードや設定を見直そうと思った'],
      impression_text: '',
    },
  ];
  samples.forEach(function (payload) {
    const res = saveResponse({ postData: { contents: JSON.stringify(payload) } }, testSheets);
    Logger.log(payload.sheet_name + ': ' + res.getContent());
  });
}
