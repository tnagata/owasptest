import puppeteer from 'puppeteer';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ファイルパスの設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 管理者認証情報
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

// CSVからテストユーザーデータを読み込む
function loadTestUsers() {
  try {
    const csvFilePath = join(__dirname, 'user_data.csv');
    const fileContent = readFileSync(csvFilePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        if (context.column === 'shouldSucceed') {
          return value.toLowerCase() === 'true';
        }
        return value;
      }
    });
    return records;
  } catch (error) {
    console.error('テストユーザーデータの読み込みに失敗:', error);
    process.exit(1);
  }
}

// テストユーザーのデータを読み込む
const testUsers = loadTestUsers();

// データベースクリア用の関数
async function clearDatabase() {
  const browser = await puppeteer.launch({ 
    headless: true,  // headlessモードを有効化
    args: [
      '--disable-password-manager',
      '--disable-notifications',
      '--no-sandbox',
      '--disable-password-leak-detection'
    ]
  });
  const page = await browser.newPage();
  
  try {
    // 管理サイトにアクセス
    await page.goto('http://localhost:8000/admin/');
    
    // 管理者としてログイン
    await page.waitForSelector('#id_username', { visible: true, timeout: 5000 });
    await page.type('#id_username', ADMIN_USER);
    await page.type('#id_password', ADMIN_PASS);

    // ログインボタンをクリック
    const loginButton = await page.waitForSelector('input[type="submit"][value="ログイン"]', 
      { visible: true, timeout: 5000 });
    await Promise.all([
      loginButton.click(),
      page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);

    // ユーザー一覧ページへ移動
    await page.goto('http://localhost:8000/admin/auth/user/');
    await page.waitForSelector('tbody tr', { visible: true, timeout: 5000 });
    
    // admin以外のユーザーを選択
    const hasUsers = await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      let selected = false;
      checkboxes.forEach(checkbox => {
        const row = checkbox.closest('tr');
        if (row && !row.textContent.includes('admin')) {
          checkbox.checked = true;
          selected = true;
        }
      });
      return selected;
    });

    if (hasUsers) {
      // 削除アクションを選択
      await page.select('select[name="action"]', 'delete_selected');
      
      // 実行ボタンを特定（class="button"を使用）
      const actionButton = await page.waitForSelector('button.button[name="index"]', 
        { visible: true, timeout: 5000 });
      
      if (!actionButton) {
        throw new Error('実行ボタンが見つかりません');
      }

      // 実行ボタンをクリック
      await Promise.all([
        actionButton.click(),
        page.waitForNavigation({ waitUntil: 'networkidle0' })
      ]);

      // 確認ページでの削除ボタンをクリック
      const confirmButton = await page.waitForSelector('input[type="submit"]', 
        { visible: true, timeout: 5000 });
      
      if (confirmButton) {
        await Promise.all([
          confirmButton.click(),
          page.waitForNavigation({ waitUntil: 'networkidle0' })
        ]);
        console.log('✅ データベースのクリア成功');
      } else {
        throw new Error('確認ボタンが見つかりません');
      }
    } else {
      console.log('ℹ️ 削除対象のユーザーが見つかりません');
    }
  } catch (error) {
    console.error('データベースのクリアに失敗:', error);
    
    // エラー時のページ状態を取得
    const errorPageState = await page.evaluate(() => ({
      url: window.location.href,
      content: document.body.innerHTML
    }));
    console.error('エラー時のページ状態:', errorPageState);
  } finally {
    await browser.close();
  }
}

// メインのテスト関数
(async () => {
  // テスト開始前にDBをクリア
  await clearDatabase();

  const browser = await puppeteer.launch({ 
    headless: true,  // headlessモードを有効化
    args: [
      '--disable-password-manager',
      '--disable-notifications',
      '--no-sandbox',
      '--disable-password-leak-detection'
    ]
  });
  const page = await browser.newPage();
  const appUrl = 'http://localhost:8000';

  try {
    // 各ユーザーを登録
    for (const user of testUsers) {
      if (user.shouldSucceed) {
        await page.goto(appUrl);
        console.log(`Registering user: ${user.username}`);

        // フォームが表示されるまで待つ
        await page.waitForSelector('form[action="/register/"]', { visible: true });
        
        // フォームの入力を待つ
        await page.waitForSelector('form[action="/register/"] input[name="username"]', { visible: true });
        await page.waitForSelector('form[action="/register/"] input[name="password"]', { visible: true });
        
        // フォームに入力
        await page.type('form[action="/register/"] input[name="username"]', user.username);
        await new Promise(resolve => setTimeout(resolve, 500)); // 入力後少し待機
        await page.type('form[action="/register/"] input[name="password"]', user.password);
        await new Promise(resolve => setTimeout(resolve, 500)); // 入力後少し待機

        try {
          // フォーム送信と登録完了メッセージの待機
          await Promise.all([
            page.click('form[action="/register/"] button[type="submit"]'),
            // メッセージ要素の表示を待つ（5秒でタイムアウト）
            page.waitForSelector('ul li', { visible: true, timeout: 5000 })
          ]);

          // メッセージ要素を即座に確認
          const messageElement = await page.$('ul li');
          const registrationMessage = await messageElement.evaluate(el => el.textContent);
          console.log(`Registration result for ${user.username}: ${registrationMessage}`);
          
          if (registrationMessage.includes('登録完了')) {
            console.log(`✅ User ${user.username} registered successfully`);
            // 登録成功を確認したら即座に次のユーザーへ
            continue;
          } else {
            console.log(`❌ Failed to register user ${user.username}: ${registrationMessage}`);
          }
        } catch (error) {
          console.log(`Registration error for ${user.username}:`, error.message);
          continue;
        }
      }
    }

    // 各ケースでログインテスト
    for (const user of testUsers) {
      await page.goto(appUrl);
      console.log(`\nTesting login for: ${user.username}`);
      console.log(`Expected result: ${user.shouldSucceed ? 'Success' : 'Failure'}`);

      // ログインフォームが表示されるまで待つ
      await page.waitForSelector('form[action="/login/"]', { visible: true });

      // ログインフォームに入力
      await page.type('form[action="/login/"] input[name="username"]', user.username);
      await page.type('form[action="/login/"] input[name="password"]', user.password);

      if (user.shouldSucceed) {
        try {
          // ログインボタンをクリック
          await Promise.all([
            page.click('form[action="/login/"] button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle0' })
          ]);
          
          // success.htmlのh1タグを待つ
          const messageElement = await page.waitForSelector('h1', 
            { visible: true, timeout: 5000 });
          const message = await messageElement.evaluate(el => el.textContent);
          console.log(`Login result: ${message}`);

          if (message.includes('ログインに成功')) {
            console.log('✅ Test passed: Login successful as expected');
          } else {
            console.log('❌ Test failed: Expected success but got:', message);
          }
        } catch (error) {
          // エラー時のページ状態を確認
          const currentUrl = await page.url();
          console.log('Current URL:', currentUrl);
          
          console.log('❌ Test failed: Expected successful login but got error');
          console.error(error.message);
        }
      } else {
        try {
          // ログインボタンをクリック（ナビゲーションは期待しない）
          await page.click('form[action="/login/"] button[type="submit"]');
          
          // エラーメッセージを待つ
          const messageElement = await page.waitForSelector('ul li', 
            { visible: true, timeout: 5000 });
          const errorMessage = await messageElement.evaluate(el => el.textContent);
          console.log(`Login error message: ${errorMessage}`);
          
          if (errorMessage.includes('正しくありません')) {
            console.log('✅ Test passed: Login failed as expected');
          } else {
            console.log('❌ Test failed: Unexpected error message:', errorMessage);
          }
        } catch (error) {
          console.log('❌ Test failed: Expected error message but got success');
          console.error(error.message);
        }
      }

      // ページの状態が安定するまで少し待機
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();