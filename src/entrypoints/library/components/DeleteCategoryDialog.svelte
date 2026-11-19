<script lang="ts">
  import { deleteCategory } from '../../../lib/db/bookmarks';
  import type { Category } from '../../../lib/db/schema';
  import { plural } from '../format';
  import { library } from '../state.svelte';
  import Dialog from './Dialog.svelte';

  // Deleting a category asks first, because it moves many links at once (F3.5).
  let { category, count, onclose }: { category: Category; count: number; onclose: () => void } = $props();
  let busy = $state(false);
  let error = $state('');

  async function confirm() {
    busy = true;
    try {
      const moved = await deleteCategory(category.id);
      library.showToast(
        moved
          ? `Deleted “${category.name}”. ${plural(moved, 'link', 'links')} moved to Unsorted.`
          : `Deleted “${category.name}”.`,
        { ms: 5000 },
      );
      onclose();
    } catch {
      error = "Couldn't delete the category. Try again.";
    } finally {
      busy = false;
    }
  }
</script>

<Dialog id="delete-category" title="Delete the “{category.name}” category?" {onclose} {busy}>
  <p>
    {#if count > 0}
      Its <span class="num">{count}</span> {count === 1 ? 'link moves' : 'links move'} to Unsorted. You can sort them again later.
    {:else}
      It has no links.
    {/if}
  </p>
  {#if error}<p class="errtext" role="alert">{error}</p>{/if}
  <div class="actions">
    <button class="btn btn-ghost" type="button" onclick={onclose} disabled={busy}>Cancel</button>
    <button class="btn btn-danger" type="button" onclick={confirm} disabled={busy}>{busy ? 'Deleting…' : 'Delete category'}</button>
  </div>
</Dialog>
