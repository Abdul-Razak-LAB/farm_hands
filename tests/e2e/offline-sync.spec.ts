import { test, expect } from '@playwright/test';

test.describe('offline sync flow', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.setItem('farmops.registered', 'true');
      localStorage.setItem('farmops.role', 'MANAGER');
      localStorage.setItem('farmops.farmId', 'farm-e2e');
    });
  });

  test('queues action offline and syncs after reconnect', async ({ page, context }) => {
    await page.goto('/updates');

    await context.setOffline(true);
    await page.getByPlaceholder('Voice transcript will appear here (editable fallback)').fill('Irrigation checks completed for north field');
    await page.getByRole('button', { name: 'Submit Update' }).click();

    await page.goto('/offline');
    await expect(page.getByText('Pending Outbox')).toBeVisible();
    const pendingCount = page.locator('div.rounded-lg.border.bg-card.p-3').first().locator('p.text-xl.font-bold');
    await expect(pendingCount).not.toHaveText('0');

    await context.setOffline(false);
    await page.getByRole('button', { name: 'Sync now' }).first().click();
    await expect(pendingCount).toHaveText('0', { timeout: 30_000 });
  });
});
