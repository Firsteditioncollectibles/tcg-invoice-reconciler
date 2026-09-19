import { expect, test } from '@playwright/test';

test.describe('TCG Invoice Reconciler critical smoke tests', () => {
  test('loads the reconciler without browser errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', error => errors.push(error.message));

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'TCG Invoice Reconciler' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1. Import TCGplayer order' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2. Reconcile line items' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '3. Output' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('accepts a TCGplayer PDF input without crashing', async ({ page }) => {
    await page.goto('/');

    const upload = page.locator('input[type="file"]');
    await upload.setInputFiles({
      name: 'sample-tcgplayer-order.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 QA fixture'),
    });

    await expect(upload).toHaveValue(/sample-tcgplayer-order\.pdf/);
    await expect(page.getByText('Scanner extraction is the next build milestone. The editor below is live.')).toBeVisible();
  });

  test('edits price and quantity and recalculates subtotal', async ({ page }) => {
    await page.goto('/');

    const row = page.locator('.row').first();
    const numberInputs = row.locator('input[type="number"]');

    await numberInputs.nth(0).fill('10.00');
    await numberInputs.nth(1).fill('3');

    await expect(page.locator('.total')).toHaveText('Subtotal: $30.00');
  });

  test('deletes a line item and subtotal becomes zero', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.locator('.row')).toHaveCount(0);
    await expect(page.locator('.total')).toHaveText('Subtotal: $0.00');
  });

  test('adds a new line item with safe defaults', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '+ Add line' }).click();

    await expect(page.locator('.row')).toHaveCount(2);
    const newRow = page.locator('.row').nth(1);
    await expect(newRow.locator('input').nth(0)).toHaveValue('Pokemon trading cards');
    await expect(newRow.locator('input[type="number"]').nth(0)).toHaveValue('0');
    await expect(newRow.locator('input[type="number"]').nth(1)).toHaveValue('1');
  });

  test('keeps the reconciled-document disclaimer visible', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Save / Print PDF' })).toBeVisible();
    await expect(
      page.getByText('Generated output is a reconciled shipment document, not a seller-issued replacement invoice.')
    ).toBeVisible();
  });
});
