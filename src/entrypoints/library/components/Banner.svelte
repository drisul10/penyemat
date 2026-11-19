<script lang="ts">
  let { title, body, action, onaction }: { title: string; body: string; action?: string; onaction?: () => void } =
    $props();
</script>

<div class="banner" role="alert">
  <h3>{title}</h3>
  <p>{body}</p>
  {#if action}<p class="act"><button class="btn" type="button" onclick={onaction}>{action}</button></p>{/if}
</div>

<style>
  .banner {
    background: var(--color-alert);
    border: 1px solid var(--color-alert-line);
    padding: var(--spacing-s4);
    border-radius: var(--radius-sm);
    margin: var(--spacing-s5) 0;
  }
  h3 {
    font-size: 15px;
    font-weight: 600;
  }
  p {
    font-size: 14px;
    color: var(--color-body);
  }
  .act {
    margin-top: var(--spacing-s3);
  }
</style>
