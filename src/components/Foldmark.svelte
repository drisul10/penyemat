<script lang="ts">
  // The brand mark: a page with its top-right corner folded. `animate` plays the save fold.
  let { width = 28, animate = false }: { width?: number; animate?: boolean } = $props();
</script>

<span class="foldmark" class:animate style:width="{width}px" style:height="{Math.round(width * 1.21)}px" aria-hidden="true"></span>

<style>
  .foldmark {
    position: relative;
    flex: none;
    display: inline-block;
  }
  .foldmark::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color-leaf);
    clip-path: polygon(0 0, 62% 0, 100% 30%, 100% 100%, 0 100%);
    box-shadow: inset 0 0 0 2px var(--color-ink);
  }
  .foldmark::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    width: 38%;
    height: 30%;
    background: linear-gradient(225deg, var(--color-field) 50%, var(--color-ink) 50%);
  }
  .animate::before {
    animation: fold-page var(--fold-ms) var(--ease-out-fold) both;
  }
  .animate::after {
    animation: fold-corner var(--fold-ms) var(--ease-out-fold) both;
  }
  @keyframes fold-page {
    from {
      clip-path: polygon(0 0, 100% 0, 100% 0, 100% 100%, 0 100%);
    }
  }
  @keyframes fold-corner {
    from {
      transform: scale(0);
      transform-origin: top right;
    }
  }
</style>
