import { expect, test, type Page } from '@playwright/test';

async function addCustomCombatants(page: Page) {
  await page.getByRole('button', { name: 'Create Custom Combatant' }).click();
  await page.getByText('Custom Combatant', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Custom' }).click();
  await page.getByText('Custom Combatant', { exact: true }).click();
  await page.getByLabel('Name').fill('Cave Wolf');
  await page.getByRole('button', { name: 'Add Custom' }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main[data-hydrated="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Build your first encounter' })).toBeVisible();
});

test('runs the primary table session and lifecycle workflow', async ({ page }) => {
  await addCustomCombatants(page);
  await expect(page.getByRole('heading', { name: 'Goblin Warrior' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cave Wolf' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Cave Wolf' })).toBeVisible();
  await page.getByRole('button', { name: 'Roll all initiative' }).click();
  await page.getByRole('button', { name: 'Start Encounter' }).click();

  await expect(page.getByText('Combat is live. Changes save automatically on this device.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Combat is live. Changes save automatically on this device.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Library / Add Reinforcement' })).toBeVisible();

  const hpButton = page.getByRole('button', { name: /HP 18 of 18/ }).first();
  await hpButton.click();
  const hpInput = page.getByLabel(/Edit HP/).first();
  await hpInput.fill('-5');
  await hpInput.press('Enter');

  await page.getByRole('button', { name: 'Add condition' }).first().click();
  await page.getByRole('combobox', { name: 'Condition' }).first().selectOption('frightened');
  await page.getByRole('button', { name: 'Apply', exact: true }).first().click();
  await page.getByRole('button', { name: 'End turn', exact: true }).first().click();
  await expect(page.getByText('Awaiting resolution').first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Awaiting resolution').first()).toBeVisible();
  await page.getByRole('button', { name: /Decrement by 1/ }).first().click();

  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Redo' }).click();

  await page.getByRole('button', { name: 'Complete Encounter' }).click();
  await expect(page.getByText('Encounter complete', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Encounter complete', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare Rematch' }).click();
  await expect(page.getByRole('button', { name: 'Start Encounter' })).toBeVisible();
});

test('safe discard requires confirmation and cancellation preserves the encounter', async ({ page }) => {
  await addCustomCombatants(page);
  await page.getByRole('button', { name: 'Discard Encounter…' }).click();
  await page.getByRole('button', { name: 'Keep Encounter' }).click();
  await expect(page.getByRole('heading', { name: 'Goblin Warrior' })).toBeVisible();

  await page.getByRole('button', { name: 'Discard Encounter…' }).click();
  await page.getByRole('button', { name: 'Discard Encounter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Build your first encounter' })).toBeVisible();
});

test('layout has no horizontal overflow and tablet controls use real hit areas', async ({ page }, testInfo) => {
  await addCustomCombatants(page);
  const firstCard = page.locator('article.combatant-card').first();
  await expect(firstCard).not.toHaveAttribute('role');
  await expect(firstCard).not.toHaveAttribute('tabindex');
  await expect(page.getByRole('button', { name: 'Manage effects' })).toHaveCount(0);
  const headingButton = page.getByRole('button', { name: 'Goblin Warrior', exact: true });
  await headingButton.focus();
  await expect(headingButton).toBeFocused();
  const overflowButton = page.getByRole('button', { name: /More actions for Goblin Warrior/ });
  await overflowButton.focus();
  await overflowButton.press('Enter');
  const manageEffects = page.getByRole('button', { name: 'Manage effects' });
  await expect(manageEffects).toBeVisible();
  await manageEffects.focus();
  await expect(manageEffects).toBeFocused();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  if (testInfo.project.name.startsWith('tablet')) {
    const controls = [
      page.getByRole('button', { name: /HP 18 of 18/ }).first(),
      page.getByRole('button', { name: /Roll Goblin Warrior Fortitude/ }).first(),
      page.getByRole('button', { name: /More actions for Goblin Warrior/ }).first(),
      page.getByRole('button', { name: /Move Goblin Warrior down/ }).first()
    ];
    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box, `missing box for ${await control.getAttribute('aria-label')}`).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
});
