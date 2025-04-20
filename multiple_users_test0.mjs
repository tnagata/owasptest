import puppeteer from 'puppeteer';

// 管理者認証情報
const ADMIN_USER = 'admin';  // 作成した管理者のユーザー名
const ADMIN_PASS = 'admin123';  // 作成した管理者のパスワード

// テストユーザーのデータ（8文字以上のパスワード）
const testUsers = [
  { username: 'user1', password: 'password1234', shouldSucceed: true },
  { username: 'user2', password: 'password5678', shouldSucceed: true },
  { username: 'user1', password: 'wrongpass123', shouldSucceed: false },
  { username: 'nonexistent', password: 'password7890', shouldSucceed: false },
];

// データベースクリア用の関数
async function clearDatabase() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // 管理サイトにアクセス
    await page.goto('http://localhost:8000/admin/');
    
    // 管理者としてログイン
    await page.type('#id_username', ADMIN_USER);
    await page.type('#id_password', ADMIN_PASS);
    await Promise.all([
      page.click('input[type="submit"]'),
      page.waitForNavigation()
    ]);

    // ユーザー一覧ページへ移動
    await page.goto('http://localhost:8000/admin/auth/user/');
    
    // テスト用ユーザーの削除
    await page.evaluate(() => {
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
      checkboxes.forEach(checkbox => {
        if (checkbox.value !== '1') {  // admin以外を選択
          checkbox.checked = true;
        }
      });
    });

    // 一括削除の実行
    await page.select('select[name="action"]', 'delete_selected');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation()
    ]);

    // 削除の確認
    await Promise.all([
      page.click('input[type="submit"]'),
      page.waitForNavigation()
    ]);

  } catch (error) {
    console.error('データベースのクリアに失敗:', error);
  } finally {
    await browser.close();
  }
}

// メインのテスト関数
(async () => {
  // テスト開始前にDBをクリア
  await clearDatabase();

  const browser = await puppeteer.launch({ headless: false });
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
          await Promise.all([
            page.click('form[action="/login/"] button[type="submit"]'),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 })
          ]);

          const messageElement = await page.waitForSelector('h1, ul li', { visible: true, timeout: 5000 });
          const loginMessage = await messageElement.evaluate(el => el.textContent);
          console.log(`Login result: ${loginMessage}`);
          
          if (loginMessage.includes('ログインに成功しました')) {
            console.log('✅ Test passed: Login successful as expected');
          } else {
            console.log('❌ Test failed: Expected successful login');
          }
        } catch (error) {
          console.log('❌ Test failed: Expected successful login but got error');
          console.error(error.message);
        }
      } else {
        try {
          await page.click('form[action="/login/"] button[type="submit"]');
          
          // エラーメッセージの表示を待つ（loginに失敗する場合のみul liを待つ）
          const messageElement = await page.waitForSelector('ul li', { visible: true, timeout: 5000 });
          const errorMessage = await messageElement.evaluate(el => el.textContent);
          console.log(`Login error message: ${errorMessage}`);
          
          // 失敗を期待するケースなので、エラーメッセージが表示されればテスト成功
          if (errorMessage.includes('正しくありません')) {
            console.log('✅ Test passed: Login failed as expected');
          } else {
            console.log('❌ Test failed: Unexpected error message:', errorMessage);
          }
        } catch (error) {
          // エラーメッセージが表示されない場合（ログイン成功の場合）
          console.log('❌ Test failed: Expected error message but got success');
          console.error(error.message);
        }
      }

      // ページの状態が安定するまで少し待機
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();