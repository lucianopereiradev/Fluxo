import { expect, test } from '@playwright/test';

test('demo → quick entry → the new transaction shows up', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the demo' }).first().click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText('Demo mode')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  // Open quick entry: the floating button on phones, the N shortcut on desktop.
  if (isMobile) {
    await page.getByRole('button', { name: 'New entry' }).last().click();
  } else {
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('n');
  }
  const input = page.getByTestId('quick-entry-input');
  await expect(input).toBeVisible();
  await input.fill('smoke test coffee 12.90 today');

  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview.getByLabel('Amount')).toHaveValue('12.90');
  await expect(preview.getByLabel('Description')).toHaveValue('Smoke test coffee');
  await input.press('Enter');
  await expect(input).toBeHidden();

  await page.goto('/app/transactions');
  const row = page.getByRole('button', { name: /Smoke test coffee/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText('12.90');

  // Every app screen renders with the demo data (charts included).
  for (const [path, heading] of <[string, string][]>[
    ['/app/accounts', 'Accounts'],
    ['/app/cards', 'Credit cards'],
    ['/app/budgets', 'Budgets'],
    ['/app/goals', 'Goals'],
    ['/app/recurring', 'Recurring'],
    ['/app/reports', 'Reports'],
    ['/app/import', 'Import statement'],
    ['/app/settings', 'Settings'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    if (path === '/app/reports') {
      await expect(
        page.getByRole('img', { name: 'Flow from income categories to expense categories' }),
      ).toBeVisible();
    }
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
  }
});

test('the landing, privacy and 404 pages render', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your money, in flow');
  await page.getByRole('link', { name: 'Privacy' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
  await page.goto('/does-not-exist');
  await expect(page.getByText('This page wandered off')).toBeVisible();
});
