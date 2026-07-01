import { test, expect } from './fixtures';
import { ROUTES } from '../src/constants';

// Functional flow that requires a reachable MModel server WITH data. Opt in by
// setting E2E_MMODEL_API_URL to a URL reachable from the Grafana *container*
// (e.g. http://host.docker.internal:18080 or http://192.168.31.128:18080).
// Optionally set E2E_WORKSPACE to pick a specific workspace by label; otherwise
// the first workspace is used.
const API_URL = process.env.E2E_MMODEL_API_URL;
const WORKSPACE = process.env.E2E_WORKSPACE;

test.describe('query flow (needs a reachable MModel server)', () => {
  test.skip(!API_URL, 'set E2E_MMODEL_API_URL to a reachable MModel server to run this flow');

  test('configure -> select workspace -> run SPL -> rows', async ({ appConfigPage, gotoPage, page }) => {
    // 1. Point the plugin at the MModel server (the config page is already open
    //    via the appConfigPage fixture). The Go backend re-reads apiUrl after the
    //    settings are saved.
    await page.getByRole('textbox', { name: 'API Url' }).clear();
    await page.getByRole('textbox', { name: 'API Url' }).fill(API_URL!);
    const saveResponse = appConfigPage.waitForSettingsResponse();
    await page.getByRole('button', { name: /Save API settings/i }).click();
    await expect(saveResponse).toBeOK();

    // 2. Open the Query page and select a workspace from the header selector.
    //    The selector is populated from the MModel server via the Go proxy.
    await gotoPage(`/${ROUTES.Query}`);
    const option = WORKSPACE ? page.getByRole('option', { name: WORKSPACE }) : page.getByRole('option').first();
    // The list is fetched on mount; if the plugin settings are still settling from
    // a concurrent save, reload once to re-fetch before failing.
    await page.getByPlaceholder('Select workspace').click();
    try {
      await option.waitFor({ state: 'visible', timeout: 8000 });
    } catch {
      await page.reload();
      await page.getByPlaceholder('Select workspace').click();
    }
    await expect(option).toBeVisible({ timeout: 15000 });
    await option.click();

    // 3. Run the default SPL query (.mmodel | sort name | limit 50).
    await page.getByRole('button', { name: 'Run', exact: true }).click();

    // 4. The results table should render at least one row.
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });
  });
});