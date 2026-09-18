import { mkdir, readdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const server = await startServer(0);
const base = `http://127.0.0.1:${server.address().port}/learning-with-arjun/`;
const browser = await launchBrowser();
const results = [];
const failures = [];
const pages = (await readdir('dist')).filter(name => name.endsWith('.html') && name !== 'offline.html');
pages.push('posts/post1.html', 'posts/post2.html');
await mkdir('test-results', { recursive: true });

async function readPageInfo(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await page.evaluate(() => ({
        title: document.title,
        text: document.body.innerText.trim().length,
        overflow: document.documentElement.scrollWidth - innerWidth,
        path: location.pathname,
        dcl: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0),
        fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0)
      }));
    } catch (error) {
      if (!/Execution context was destroyed|navigation/i.test(error.message) || attempt === 2) throw error;
      await page.waitForTimeout(250);
    }
  }
}

async function fixtureContext(role, viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  const user = role === 'guest' ? null : { id: '11111111-1111-4111-8111-111111111111', name: 'Test Learner', email: role === 'admin' ? 'arjungangwariitpkd@gmail.com' : 'learner@example.test', role, provider: 'supabase', joinDate: '2026-01-01' };
  await context.addInitScript(user => {
    if (user) {
      sessionStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('users', JSON.stringify([user]));
    }
  }, user);
  await context.route('**/vendor/supabase.js', route => route.fulfill({ contentType: 'text/javascript', body: `
    const user = ${JSON.stringify(user)};
    export function createClient() {
      const session = user ? { user, access_token: 'test-token' } : null;
      const channel = { on(){return this}, subscribe(){return this}, unsubscribe(){} };
      return { auth: { onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}}}, async getSession(){return {data:{session}}}, async signInWithPassword(){return {data:{},error:{message:'Invalid login credentials'}}} }, channel(){return channel}, removeChannel(){}, storage:{from(){return {getPublicUrl(){return {data:{publicUrl:''}}}}}} };
    }` }));
  await context.route('https://*.supabase.co/**', route => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith('/profiles') ? (user ? [{ ...user, join_date: user.joinDate }] : []) : [];
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  return context;
}

try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    for (const role of ['guest', 'student', 'admin']) {
      const context = await fixtureContext(role, viewport);
      for (const file of pages.filter(file => !process.env.TEST_FILES || process.env.TEST_FILES.split(',').includes(file))) {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => { if (errors.length < 3) errors.push(error.stack || error.message); });
        page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
        const start = Date.now();
        try {
          await page.goto(`${base}${file}`, { waitUntil: 'commit', timeout: 15000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
          await page.waitForTimeout(250);
          const info = await readPageInfo(page);
          if (info.text < 30) errors.push('Empty page');
          if (info.overflow > 2) errors.push(`Horizontal overflow: ${info.overflow}px`);
          if (role === 'guest' && ['admin.html', 'courses.html', 'profile.html'].includes(file) && !info.path.endsWith('login.html')) errors.push('Missing login guard');
          if (role === 'student' && file === 'admin.html' && !info.path.endsWith('roadmap.html') && !info.path.endsWith('login.html')) errors.push('Student allowed on admin page');
          results.push({ viewport: viewport.width, role, file, ...info, elapsed: Date.now() - start, errors });
          if (['index.html', 'admin.html', 'courses.html', 'login.html'].includes(file)) await page.screenshot({ path: `test-results/${role}-${viewport.width}-${file}.png`, fullPage: true });
        } catch (error) { errors.push(error.message); }
        if (errors.length) {
          failures.push({ role, viewport: viewport.width, file, errors });
          console.log(JSON.stringify(failures.at(-1)));
        }
        await writeFile('test-results/pages.json', JSON.stringify({ results, failures }, null, 2));
        await page.close();
      }
      if (viewport.width === 1440 && role !== 'guest') {
        const page = await context.newPage();
        const interactionErrors = [];
        page.on('pageerror', error => interactionErrors.push(error.message));
        page.on('dialog', dialog => dialog.accept());
        if (role === 'student') {
          await page.goto(`${base}quiz.html`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('button', { name: 'Start Quiz Exam', exact: true }).click();
          await page.locator('input[type=radio]').first().waitFor({ state: 'attached', timeout: 15000 });
          const names = await page.locator('input[type=radio]').evaluateAll(inputs => [...new Set(inputs.map(input => input.name))]);
          assert.ok(names.length > 0, 'Quiz must show questions');
          for (const name of names) await page.locator('input[type=radio]').filter({ visible: true }).evaluateAll((inputs, name) => inputs.find(input => input.name === name)?.click(), name);
          await page.getByRole('button', { name: 'Submit Quiz', exact: true }).click();
          await page.locator('#quizResult').waitFor({ state: 'visible' });
          assert.ok(await page.evaluate(() => asgGetQuizAttempts(getCurrentUser()).length > 0));
          if (process.env.RUN_PYTHON === '1') {
            await page.goto(`${base}coding-practice.html`, { waitUntil: 'domcontentloaded' });
            const result = await page.evaluate(async () => {
              const engine = await getPyodideEngine();
              const pythonResult = await engine.runPythonAsync('sum([2, 3])');
              const pandasSubject = practiceSubjects.find(subject => subject.kind === 'pandas');
              selectPracticeSubject(pandasSubject.key);
              await preparePandasWorkspace(engine);
              const payload = JSON.parse(await engine.runPythonAsync(buildPandasHarness('print(df.shape)\ndf.groupby("city")["salary"].mean().round(2)')));
              return { pythonResult, payload, title: codingChallenges[0].title };
            });
            assert.equal(result.pythonResult, 5, 'Python runtime must execute code');
            assert.equal(result.payload.error, '', 'Pandas workspace must run without an error');
            assert.match(result.payload.stdout, /\(308, 8\)/, 'Pandas workspace must load the complete employee dataset');
            assert.match(result.payload.stdout, /Bangalore/, 'Pandas groupby output must be rendered');
            assert.equal(result.title, 'Explore the Employee DataFrame');
            await page.screenshot({ path: 'test-results/student-pandas-workspace.png', fullPage: true });
          }
        } else {
          await page.goto(`${base}coding-practice.html?challenge=topic_pandas_groupby_sum`, { waitUntil: 'domcontentloaded' });
          const pandasTask = await page.evaluate(() => codingChallenges[currentChallengeIndex]);
          assert.equal(pandasTask.id, 'topic_pandas_groupby_sum', 'Deep links must select the requested Pandas task');
          await page.goto(`${base}topic-detail.html?course=${encodeURIComponent(pandasTask.courseId)}&topic=${encodeURIComponent(pandasTask.topicId)}`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('button', { name: 'Coding', exact: true }).click();
          const workspaceLink = page.getByRole('link', { name: 'Open Pandas Workspace', exact: true });
          assert.equal(await workspaceLink.getAttribute('href'), 'coding-practice.html?challenge=topic_pandas_groupby_sum');
          assert.equal(await page.locator('#topicCodingEditor').count(), 0, 'Dataset tasks must not use the solution-function runner');
          await workspaceLink.click();
          await page.waitForURL(/coding-practice\.html\?challenge=topic_pandas_groupby_sum/);
          await page.waitForFunction(() => typeof codingChallenges !== 'undefined' && codingChallenges[currentChallengeIndex]?.id === 'topic_pandas_groupby_sum');
          await page.goto(`${base}admin.html`, { waitUntil: 'domcontentloaded' });
          await page.locator('[data-admin-target="assessments"]').click();
          await page.locator('button[onclick="editCodingChallenge(\'topic_python_files_count_lines\')"]').click();
          await page.locator('#codingTitle').fill('Edited file handling question');
          const saved = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/rest/v1/site_data') && request.postDataJSON()?.key === 'asgCodingChallenges');
          await page.getByRole('button', { name: 'Save Coding Challenge', exact: true }).click();
          await saved;
          const result = await page.evaluate(() => {
            const before = localStorage.getItem(ASG_LEARNING_KEYS.codingChallenges);
            for (let i = 0; i < 5; i++) asgGetStudentProgress(getCurrentUser());
            return { unchanged: before === localStorage.getItem(ASG_LEARNING_KEYS.codingChallenges), title: asgGetCodingChallenges(true).find(item => item.id === 'topic_python_files_count_lines').title };
          });
          assert.ok(result.unchanged, 'Reading progress must not rewrite coding challenges');
          assert.equal(result.title, 'Edited file handling question', 'Admin edits must survive rendering');
          await page.reload({ waitUntil: 'domcontentloaded' });
          assert.equal(await page.evaluate(() => asgGetCodingChallenges(true).find(item => item.id === 'topic_python_files_count_lines').title), 'Edited file handling question');
        }
        assert.deepEqual(interactionErrors, []);
        await page.close();
        console.log(`Passed ${role} interaction checks (isolated backend fixtures)`);
      }
      await context.close();
      console.log(`Checked pages: ${role}, ${viewport.width}px`);
    }
  }
  await writeFile('test-results/pages.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ checks: results.length, failures }, null, 2));
  assert.equal(failures.length, 0, 'Page checks failed; see test-results/pages.json');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
