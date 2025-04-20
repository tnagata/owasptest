import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false }); // headless: trueで非表示モード
  const page = await browser.newPage();

  // アプリのURL
  const appUrl = 'http://localhost:8000';

  try {
    // ユーザー登録テスト（失敗してもOK、既に登録済みの場合のメッセージが表示される）
    await page.goto(appUrl);
    console.log('Navigated to the app (registration).');

    await page.type('form[action="/register/"] input[name="username"]', 'tiger12');
    await page.type('form[action="/register/"] input[name="password"]', '34tiger12');
    await page.click('form[action="/register/"] button[type="submit"]');
    console.log('Submitted registration form.');

    // 登録成功またはエラーメッセージを取得
    await page.waitForSelector('ul li', { visible: true });
    const registrationMessage = await page.$eval('ul li', el => el.textContent);
    console.log('Registration message:', registrationMessage);

    // ログインテスト開始前にページを再読み込みして前回のメッセージをクリアする
    await page.goto(appUrl);
    console.log('Navigated to the app (login).');

    // ログインフォームに入力
    await page.type('form[action="/login/"] input[name="username"]', 'tiger12');

    // ここでテストシナリオを切り替え
    const isSuccessTest = false; // true: 成功テスト　false: 失敗テスト

    if (isSuccessTest) {
      // 正しいパスワードを入力（登録時と同じ値）
      await page.type('form[action="/login/"] input[name="password"]', '34tiger12456');
      // 正しいパスワードの場合はページ遷移が発生するので、待つ
      await Promise.all([
        page.click('form[action="/login/"] button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 })
      ]);
      // 画面遷移後、例えば h1 タグに成功メッセージが出る前提
      const successHeader = await page.$eval('h1', el => el.textContent);
      console.log('Success message:', successHeader);
      console.log('Login test passed.');
    } else {
      // 間違ったパスワードを入力
      await page.type('form[action="/login/"] input[name="password"]', 'wrong_password');
      // ページ遷移は発生しないはずなので、エラーメッセージを待つ
      await page.click('form[action="/login/"] button[type="submit"]');
      console.log('Submitted login form.');
      await page.waitForSelector('ul li', { visible: true, timeout: 5000 });
      const errorMessage = await page.$eval('ul li', el => el.textContent);
      console.log('Login error message:', errorMessage);
      console.log('Login test failed as expected.');
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();