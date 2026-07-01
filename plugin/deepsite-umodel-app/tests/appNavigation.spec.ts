import { test, expect } from './fixtures';
import { ROUTES } from '../src/constants';

// Pages behind the workspace gate: with no workspace selected they render the
// MModelPage shell (a workspace selector in the header + a "No workspace selected"
// alert). This assertion is stable regardless of whether the MModel backend is
// reachable, because the provider never auto-selects a workspace.
const GATED_ROUTES = [
  ROUTES.Explorer,
  ROUTES.Topo,
  ROUTES.Query,
  ROUTES.Data,
  ROUTES.Imports,
  ROUTES.Agent,
  ROUTES.Settings,
];

test.describe('navigating app', () => {
  for (const route of GATED_ROUTES) {
    test(`"${route}" renders the workspace shell`, async ({ gotoPage, page }) => {
      await gotoPage(`/${route}`);
      await expect(page.getByText(/no workspace selected/i)).toBeVisible();
    });
  }

  test('workspace selector is present in the page header', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Query}`);
    await expect(page.getByPlaceholder('Select workspace')).toBeVisible();
  });

  test('API map page renders without a workspace', async ({ gotoPage, page }) => {
    await gotoPage(`/${ROUTES.Docs}`);
    await expect(page.getByText('Frontend API map')).toBeVisible();
  });
});