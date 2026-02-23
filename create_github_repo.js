const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
    slowMo: 400,
    ignoreDefaultArgs: ['--use-mock-keychain'],
    args: ['--profile-directory=Default', '--password-store=keychain'],
  });

  const page = await context.newPage();

  console.log('Navigating to GitHub new repository page...');
  await page.goto('https://github.com/new', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('Filling in repo name...');
  await page.fill('#repository-name-input', 'ClaudeCode_1');
  await page.waitForTimeout(500);

  console.log('Clicking Create repository...');
  await page.click('button[type="submit"]:has-text("Create repository")');

  await page.waitForTimeout(5000);

  const finalUrl = page.url();
  console.log('Final URL:', finalUrl);

  if (finalUrl.includes('ClaudeCode_1')) {
    console.log('✅ Repository created successfully!');
    console.log('URL:', finalUrl);
  } else {
    console.log('⚠️  Check the browser window.');
  }

  await page.waitForTimeout(5000);
  await context.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
})();
