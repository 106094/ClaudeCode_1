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
    slowMo: 300,
    ignoreDefaultArgs: ['--use-mock-keychain'],
    args: ['--profile-directory=Default', '--password-store=keychain'],
  });

  const page = await context.newPage();

  console.log('Navigating to GitHub SSH keys settings...');
  await page.goto('https://github.com/settings/keys', { waitUntil: 'domcontentloaded' });

  // Extract SSH keys info
  const keys = await page.evaluate(() => {
    const keyItems = document.querySelectorAll('.listgroup-item, [class*="ssh-key"], .Box-row');
    const results = [];

    keyItems.forEach(item => {
      const title = item.querySelector('[class*="key-name"], strong, b, .f4');
      const keyType = item.querySelector('[class*="key-type"], .color-fg-muted, small');
      const added = item.querySelector('relative-time, time');

      if (title || keyType) {
        results.push({
          title: title ? title.innerText.trim() : 'N/A',
          type: keyType ? keyType.innerText.trim() : 'N/A',
          added: added ? (added.getAttribute('datetime') || added.innerText.trim()) : 'N/A',
        });
      }
    });

    return {
      keys: results,
      pageTitle: document.title,
      hasKeys: results.length > 0,
    };
  });

  console.log('\n=== GitHub SSH Keys ===');
  if (keys.keys.length === 0) {
    console.log('No SSH keys found on your GitHub account.');
  } else {
    keys.keys.forEach((k, i) => {
      console.log(`\nKey #${i + 1}`);
      console.log('  Title:', k.title);
      console.log('  Type: ', k.type);
      console.log('  Added:', k.added);
    });
  }

  await page.waitForTimeout(5000);
  await context.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
})();
