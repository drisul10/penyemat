<script lang="ts">
  // Folded-card shapes hold the layout while the library loads (shown only past 300 ms).
</script>

<div class="skeleton" aria-busy="true" aria-label="Loading your library">
  {#each [4, 2] as count, i (i)}
    <div class="shelf">
      <div class="bar" style:width={i ? '90px' : '120px'}></div>
      <div class="cards">
        {#each Array(count) as _, j (j)}<div class="card"></div>{/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .shelf {
    margin-top: var(--spacing-s5);
  }
  .bar {
    height: 18px;
    background: var(--color-skel);
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-s3);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }
  .card {
    height: 112px;
    background: var(--color-skel);
    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
  }
  @media (max-width: 700px) {
    .cards {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
