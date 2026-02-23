const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PUBLIC_KEY = fs.readFileSync(path.join(process.env.HOME, '.ssh/id_ed25519.pub'), 'utf8').trim();
const KEY_TITLE = 'MacBook - allion106094@gmail.com';

(async () => {
  const chromeProfile = path.join(process.env.HOME, 'Library/Application Support/Google/Chrome');
  const tmpDir = path.join(os.tmpdir(), 'playwright-chrome-profile-' + Date.now());

  fs.mkdirSync(path.join(tmpDir, 'Default'), { recursive: true });
  for (const f of ['Cookies', 'Local State']) {
    try { fs.copyFileSync(path.join(chromeProfile, 'Default', f), path.join(tmpDir, 'Default', f)); } catch (e) {}
  }
  try { fs.copyFileSync(path.join(chromeProfile, 'Local State'), path.join(tmpDir, 'Local State')); } catch (e) {}

  const context = await chromium.launchPersistentContext(tmpDir, {
    channel: 'chrome',
    headless: false,
    slowMo: 500,
    ignoreDefaultArgs: ['--use-mock-keychain'],
    args: ['--profile-directory=Default', '--password-store=keychain'],
  });

  const page = await context.newPage();

  console.log('Navigating to GitHub SSH keys settings...');
  await page.goto('https://github.com/settings/ssh/new', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('Filling in SSH key details...');
  await page.fill('#ssh_key_title', KEY_TITLE);
  await page.fill('#ssh_key_key', PUBLIC_KEY);

  console.log('Clicking "Add SSH key" button...');
  await page.click('button[type="submit"]:has-text("Add SSH key")');

  console.log('Waiting for result (30s)... complete any authorization in the browser if prompted.');
  await page.waitForTimeout(30000);

  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);

  if (!finalUrl.includes('/new')) {
    console.log('✅ SSH key added successfully!');
  } else {
    const error = await page.evaluate(() => {
      const err = document.querySelector('.flash-error, [class*="error"]');
      return err ? err.innerText.trim() : null;
    });
    if (error) {
      console.log('❌ Error:', error);
    } else {
      console.log('⚠️  Still on form page - may need manual action.');
    }
  }

  await page.waitForTimeout(5000);
  await context.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
})();
