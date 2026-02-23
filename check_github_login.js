const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

(async () => {
  const chromeProfile = path.join(process.env.HOME, 'Library/Application Support/Google/Chrome');
  const tmpDir = path.join(os.tmpdir(), 'playwright-chrome-profile-' + Date.now());

  console.log('Copying Chrome profile to temp dir (preserving cookies/session)...');
  // Copy only essential parts: Default profile cookies & local storage
  fs.mkdirSync(path.join(tmpDir, 'Default'), { recursive: true });
  const filesToCopy = ['Cookies', 'Local State'];
  for (const f of filesToCopy) {
    const src = path.join(chromeProfile, 'Default', f);
    const dst = path.join(tmpDir, 'Default', f);
    try { fs.copyFileSync(src, dst); } catch (e) { /* skip if missing */ }
  }
  // Also copy Local State (login info)
  try {
    fs.copyFileSync(path.join(chromeProfile, 'Local State'), path.join(tmpDir, 'Local State'));
  } catch (e) {}

  const context = await chromium.launchPersistentContext(tmpDir, {
    channel: 'chrome',
    headless: false,
    slowMo: 500,
    // Disable mock keychain so real macOS Keychain is used to decrypt cookies
    ignoreDefaultArgs: ['--use-mock-keychain'],
    args: ['--profile-directory=Default', '--password-store=keychain'],
  });

  const page = await context.newPage();

  console.log('Opening GitHub...');
  await page.goto('https://github.com', { waitUntil: 'domcontentloaded' });

  // Check login status
  const status = await page.evaluate(() => {
    const avatar =
      document.querySelector('img.avatar-user') ||
      document.querySelector('[aria-label="View profile and more"]') ||
      document.querySelector('summary[aria-label="Open user navigation menu"]');

    const signIn = document.querySelector('a[href="/login"]');

    const userMeta = document.querySelector('meta[name="user-login"]');
    const username = userMeta ? userMeta.getAttribute('content') : null;

    return {
      loggedIn: !!avatar,
      signInVisible: !!signIn,
      username: username,
    };
  });

  if (status.loggedIn) {
    console.log('✅ STATUS: LOGGED IN');
    if (status.username) {
      console.log('👤 Username:', status.username);
    }
  } else if (status.signInVisible) {
    console.log('❌ STATUS: NOT LOGGED IN (Sign in button is visible)');
  } else {
    console.log('⚠️  STATUS: UNKNOWN - could not determine login state');
  }

  // Keep browser open for 5 seconds so you can see it
  await page.waitForTimeout(5000);
  await context.close();

  // Clean up temp profile
  fs.rmSync(tmpDir, { recursive: true, force: true });
})();
