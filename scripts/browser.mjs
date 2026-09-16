import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';

export async function launchBrowser() {
  if (process.platform !== 'win32') return chromium.launch({ headless: true });
  const candidates = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'];
  let executable;
  for (const candidate of candidates) {
    try { await access(candidate); executable = candidate; break; } catch {}
  }
  if (!executable) return chromium.launch({ headless: true });
  await mkdir('.debug-screenshots', { recursive: true });
  const profile = await mkdtemp(path.resolve('.debug-screenshots/browser-'));
  const child = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim();
        const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        browser.on('disconnected', () => child.kill());
        return browser;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    throw new Error('Chrome did not expose its test debugging port');
  } catch (error) {
    child.kill();
    throw error;
  }
}
