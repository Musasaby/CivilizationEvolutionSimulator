// バランステストの共通部分：Chrome でゲームを ?debug 付きで開く
const path = require('path');
const { chromium } = require('playwright-core');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE = 'file:///' + path.resolve(__dirname, '../../prototype/index.html').replace(/\\/g, '/') + '?debug';

async function openGame() {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
  await page.goto(PAGE);
  await page.waitForFunction(() => window.ces, null, { timeout: 30000 });
  return { browser, page };
}

module.exports = { openGame };
