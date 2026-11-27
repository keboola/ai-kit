// Example Playwright recording script for a generic web app demo.
// This is a standalone script (run directly with tsx/ts-node), not a Playwright
// *test* despite the .spec.ts extension — kept for familiarity with Playwright's
// usual file naming. Adapt the selectors and flow to your actual app.
//
// Setup:
//   npm install -D @playwright/test tsx
//   npx playwright install chromium
//
// Run:
//   npx tsx examples/web-demo.spec.ts
//
// Output: recordings/demo.webm — convert to GIF per references/web-capture.md.

import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();

  const context = await browser.newContext({
    recordVideo: {
      dir: 'recordings',
      size: { width: 1280, height: 720 },
    },
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // 1. Load the app.
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000); // let the initial render/animations settle

  // 2. Drive the core flow you want the README to show. Adapt selectors below.
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.waitForTimeout(500);

  await page.getByLabel('Project name').fill('demo-project');
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForSelector('text=Project created');

  // 3. Hold on the final state so the recording doesn't cut off mid-transition
  //    and the GIF loops cleanly.
  await page.waitForTimeout(1500);

  // 4. Finalize. Video is only written to disk after the context closes.
  const video = page.video();
  await context.close();

  if (video) {
    await video.saveAs('recordings/demo.webm');
    console.log('Saved recordings/demo.webm');
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
