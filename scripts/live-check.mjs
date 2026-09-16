import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { launchBrowser } from './browser.mjs';
import { startServer } from './serve.mjs';

const server = process.env.SITE_URL ? null : await startServer(0);
const base = process.env.SITE_URL || `http://127.0.0.1:${server.address().port}/learning-with-arjun/`;
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
const requests = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.url().includes('.supabase.co/')) requests.push({ path: new URL(response.url()).pathname, status: response.status() });
  if (response.status() >= 400 && (response.url().startsWith(base) || response.url().includes('.supabase.co/'))) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
});

try {
  await mkdir('test-results', { recursive: true });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.asg-navbar'));
  const metrics = await page.evaluate(() => ({
    domReadyMs: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),
    firstPaintMs: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0)
  }));
  await page.waitForFunction(() => localStorage.getItem('asgCourses'), { timeout: 15000 });
  await page.evaluate(() => window.ASG_BACKEND.startLearningSync());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/live-home-desktop.png', fullPage: true });
  const courses = await page.evaluate(() => asgGetCourses().map(course => ({ id: course.id, title: course.title, topics: course.topics.length })));
  for (const file of ['about.html', 'blog.html', 'projects.html', 'certificate-verify.html', 'login.html', 'courses.html', 'admin.html']) {
    await page.goto(`${base}${file}`, { waitUntil: 'domcontentloaded' });
    if (['courses.html', 'admin.html'].includes(file)) await page.waitForURL(/login\.html/);
    assert.ok((await page.locator('body').innerText()).length > 100, `${file} is empty`);
  }
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.ok((await page.locator('body').innerText()).includes('ASG Tech'));
  await context.setOffline(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: 'test-results/live-home-mobile.png', fullPage: true });
  const report = { base, metrics, courses, requests, errors };
  await writeFile('test-results/live.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.equal(errors.length, 0, 'Live backend or browser errors');
} finally {
  await context.close();
  await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
