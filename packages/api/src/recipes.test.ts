import { describe, it, expect, beforeEach, vi } from 'vitest';

// recipes.ts imports the real `supabase`/`freshChannel` from './client', which
// itself imports react-native / expo modules that don't exist in the node
// vitest environment — must be mocked before the module under test is
// imported. vi.hoisted runs its callback (including the dynamic import
// inside it) before vi.mock's factory needs it, and the awaited result is
// still reachable from the test body below to seed/inspect tables.
const fake = await vi.hoisted(async () => {
  const { createFakeSupabaseClient } = await import('./testUtils/fakeSupabaseClient');
  return createFakeSupabaseClient();
});

vi.mock('./client', () => ({
  supabase: fake.client,
  freshChannel: vi.fn(),
}));

vi.mock('./shopping', () => ({
  broadcastShoppingItemsRemoved: vi.fn(),
}));

import { addIngredient, updateIngredient, deleteIngredient } from './recipes';

const RECIPE_ID = 'recipe-1';
const LIST_A = 'list-a';
const LIST_B = 'list-b';

function seedRecipeIngredient(overrides: Record<string, unknown>) {
  fake.seed('recipe_ingredients', [
    { recipe_id: RECIPE_ID, unit: null, sort_order: 0, ...overrides },
  ]);
}

function seedShoppingItem(overrides: Record<string, unknown>) {
  fake.seed('shopping_items', [
    {
      trip_id: 'trip-1',
      notes: null,
      status: 'open',
      created_by: 'fake-user-id',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      position: 0,
      unit: null,
      source_recipe_id: null,
      source_ingredient_id: null,
      ...overrides,
    },
  ]);
}

beforeEach(() => {
  fake.getTable('recipe_ingredients').length = 0;
  fake.getTable('shopping_items').length = 0;
  fake.setSession('fake-user-id');
});

describe('propagateIngredientAdd (via addIngredient) — multiple linked lists', () => {
  it('scales the new ingredient correctly per list, independent of the other lists', () => {
    return (async () => {
      // Flour: 200g in the recipe, already synced into both lists.
      seedRecipeIngredient({ id: 'ing-flour', title: 'Flour', quantity: 200 });
      // List A was synced at the recipe's original size (scale 1).
      seedShoppingItem({
        id: 'item-flour-a', shopping_list_id: LIST_A, title: 'Flour', quantity: 200,
        source_recipe_id: RECIPE_ID, source_ingredient_id: 'ing-flour',
      });
      // List B was synced at double the servings (scale 2).
      seedShoppingItem({
        id: 'item-flour-b', shopping_list_id: LIST_B, title: 'Flour', quantity: 400,
        source_recipe_id: RECIPE_ID, source_ingredient_id: 'ing-flour',
      });

      await addIngredient(RECIPE_ID, { title: 'Sugar', quantity: 100 });

      const items = fake.getTable('shopping_items');
      const sugarA = items.find((i) => i.shopping_list_id === LIST_A && i.title === 'Sugar');
      const sugarB = items.find((i) => i.shopping_list_id === LIST_B && i.title === 'Sugar');

      expect(sugarA?.quantity).toBe(100); // scale 1
      expect(sugarB?.quantity).toBe(200); // scale 2
    })();
  });
});

describe('propagateIngredientUpdate (via updateIngredient) — root cause reproduction', () => {
  it('BUG: updating the only reference ingredient in a list silently reverts to its old quantity', () => {
    return (async () => {
      // Flour is the ONLY recipe ingredient synced into List A — so when
      // deriveRecipeScale looks for a reference item in List A, the only
      // candidate is Flour's own (about-to-be-stale) shopping_items row.
      seedRecipeIngredient({ id: 'ing-flour', title: 'Flour', quantity: 200 });
      seedShoppingItem({
        id: 'item-flour-a', shopping_list_id: LIST_A, title: 'Flour', quantity: 200,
        source_recipe_id: RECIPE_ID, source_ingredient_id: 'ing-flour',
      });

      await updateIngredient('ing-flour', { quantity: 300 });

      const itemA = fake.getTable('shopping_items').find((i) => i.id === 'item-flour-a');
      // Root cause: deriveRecipeScale reads the ALREADY-updated
      // recipe_ingredients.quantity (300) alongside this item's NOT-YET-updated
      // shopping_items.quantity (200, itself), computing scale = 200/300 and
      // reapplying it to 300 -> right back to 200. The edit is silently undone.
      expect(itemA?.quantity).toBe(300);
    })();
  });

  it('BUG: an orphaned (title-matched) item in a second list is never updated when another list has a properly-linked item', () => {
    return (async () => {
      seedRecipeIngredient({ id: 'ing-flour', title: 'Flour', quantity: 200 });
      // List A: properly linked via source_ingredient_id (byId match).
      seedShoppingItem({
        id: 'item-flour-a', shopping_list_id: LIST_A, title: 'Flour', quantity: 200,
        source_recipe_id: RECIPE_ID, source_ingredient_id: 'ing-flour',
      });
      // List B: orphaned — source_ingredient_id was cleared (e.g. by an
      // earlier ingredient delete/recreate) but the title-matched item is
      // still meant to track this ingredient.
      seedShoppingItem({
        id: 'item-flour-b', shopping_list_id: LIST_B, title: 'Flour', quantity: 200,
        source_recipe_id: RECIPE_ID, source_ingredient_id: null,
      });

      await updateIngredient('ing-flour', { quantity: 300 });

      const itemB = fake.getTable('shopping_items').find((i) => i.id === 'item-flour-b');
      // Root cause: findLinkedShoppingItems finds List A's item via the byId
      // query, and — because that query returned >0 rows — never even issues
      // the byTitle fallback query, so List B's orphaned item is left
      // completely untouched: "nothing at all" for that list.
      expect(itemB?.title).toBe('Flour');
      expect(itemB?.source_ingredient_id).toBe('ing-flour'); // re-linked
    })();
  });

  it('scales correctly per list when another (unrelated) ingredient provides a valid reference', () => {
    return (async () => {
      seedRecipeIngredient({ id: 'ing-flour', title: 'Flour', quantity: 200 });
      seedRecipeIngredient({ id: 'ing-sugar', title: 'Sugar', quantity: 100 });
      // List A at scale 1: both ingredients present.
      seedShoppingItem({
        id: 'item-flour-a', shopping_list_id: LIST_A, title: 'Flour', quantity: 200,
        source_recipe_id: RECIPE_ID, source_ingredient_id: 'ing-flour',
      });
      seedShoppingItem({
        id: 'item-sugar-a', shopping_list_id: LIST_A, title: 'Sugar', quantity: 100,
        source_recipe_id: RECIPE_ID, source_ingredient_id: 'ing-sugar',
      });

      await updateIngredient('ing-flour', { quantity: 400 }); // double the flour

      const items = fake.getTable('shopping_items');
      // Flour should scale to the new quantity (Sugar, untouched, is a valid
      // scale-1 reference — the fix must not use Flour's own stale row).
      expect(items.find((i) => i.id === 'item-flour-a')?.quantity).toBe(400);
      expect(items.find((i) => i.id === 'item-sugar-a')?.quantity).toBe(100);
    })();
  });
});

describe('propagateIngredientDelete — same list-matching bug as update', () => {
  it('BUG: an orphaned item in a second list is never soft-deleted when another list has a properly-linked item', () => {
    return (async () => {
      seedRecipeIngredient({ id: 'ing-flour', title: 'Flour', quantity: 200 });
      seedShoppingItem({
        id: 'item-flour-a', shopping_list_id: LIST_A, title: 'Flour', quantity: 200,
        source_recipe_id: RECIPE_ID, source_ingredient_id: 'ing-flour',
      });
      seedShoppingItem({
        id: 'item-flour-b', shopping_list_id: LIST_B, title: 'Flour', quantity: 200,
        source_recipe_id: RECIPE_ID, source_ingredient_id: null,
      });

      await deleteIngredient('ing-flour');

      const items = fake.getTable('shopping_items');
      expect(items.find((i) => i.id === 'item-flour-a')?.deleted_at).not.toBeNull();
      expect(items.find((i) => i.id === 'item-flour-b')?.deleted_at).not.toBeNull();
    })();
  });
});
