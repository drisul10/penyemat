import type { Action } from 'svelte/action';
import type { Bookmark } from '../../lib/db/schema';
import type { LockedItem } from '../../lib/search/protocol';
import { askMoveToLocked, moveFromLocked, moveLink } from './actions';

// Drag a card onto another shelf to move it. Pointer events, so it works with mouse and touch:
// a mouse drags after 6 px; touch and pen need a long press, so shelf rails still scroll.
// The ⋯ menu stays the keyboard and screen-reader way to move a card.

export type DragItem = { kind: 'plain'; bookmark: Bookmark } | { kind: 'locked'; item: LockedItem };

/** Shelf id a card is dropped on: a category id, or "locked". */
export const LOCKED_TARGET = 'locked';

const MOUSE_THRESHOLD = 6;
const TOUCH_SLOP = 8;
const LONG_PRESS_MS = 350;
const EDGE = 64;
const EDGE_SPEED = 14;

class DragState {
  item = $state<DragItem | null>(null);
  x = $state(0);
  y = $state(0);
  over = $state<string | null>(null);

  title = $derived(
    this.item ? (this.item.kind === 'plain' ? this.item.bookmark.title : this.item.item.bookmark.title) : '',
  );

  /** Where the dragged card sits now, so dropping it there does nothing. */
  home = $derived(this.item ? (this.item.kind === 'plain' ? this.item.bookmark.categoryId : LOCKED_TARGET) : null);
}

export const drag = new DragState();

let scrollFrame = 0;
let suppressClick = false;

function targetAt(x: number, y: number): string | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-target]');
  const id = element?.dataset.dropTarget ?? null;
  return id && id !== drag.home ? id : null;
}

function autoScroll() {
  cancelAnimationFrame(scrollFrame);
  if (!drag.item) return;
  const step = drag.y < EDGE ? -EDGE_SPEED : drag.y > window.innerHeight - EDGE ? EDGE_SPEED : 0;
  if (step) {
    window.scrollBy(0, step);
    drag.over = targetAt(drag.x, drag.y);
  }
  scrollFrame = requestAnimationFrame(autoScroll);
}

function end() {
  cancelAnimationFrame(scrollFrame);
  drag.item = null;
  drag.over = null;
  document.documentElement.classList.remove('is-dragging');
}

async function drop(item: DragItem, target: string) {
  if (item.kind === 'plain') {
    if (target === LOCKED_TARGET) askMoveToLocked(item.bookmark);
    else await moveLink(item.bookmark, target);
  } else if (target !== LOCKED_TARGET) {
    await moveFromLocked(item.item, target);
  }
}

if (typeof document !== 'undefined') {
  // While a touch drag runs, the page must not scroll under the finger.
  document.addEventListener(
    'touchmove',
    (event) => {
      if (drag.item) event.preventDefault();
    },
    { passive: false },
  );
  // A drag ends with a click on the card's link; it must not open the page.
  document.addEventListener(
    'click',
    (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drag.item) {
      event.preventDefault();
      end();
    }
  });
}

/** Makes a card draggable. The parameter is undefined where cards can't move (search, See all). */
export const dragSource: Action<HTMLElement, DragItem | undefined> = (node, initial) => {
  let item = initial;
  let start: { x: number; y: number; id: number; touch: boolean } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const begin = (x: number, y: number) => {
    if (!item) return;
    drag.item = item;
    drag.x = x;
    drag.y = y;
    drag.over = null;
    window.getSelection()?.removeAllRanges();
    document.documentElement.classList.add('is-dragging');
    if (start?.touch) {
      navigator.vibrate?.(10);
      // Chrome cancels the pointer once the finger moves (it hands the gesture to scrolling),
      // so a touch drag follows touch events, whose default the document listener blocks.
      window.addEventListener('touchmove', touchMove, { passive: false });
      window.addEventListener('touchend', touchEnd);
      window.addEventListener('touchcancel', touchCancel);
    }
    autoScroll();
  };

  const track = (x: number, y: number) => {
    drag.x = x;
    drag.y = y;
    drag.over = targetAt(x, y);
  };

  const finish = () => {
    const dragged = drag.item;
    const target = drag.over;
    if (dragged) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
    }
    cleanup();
    end();
    if (dragged && target) void drop(dragged, target);
  };

  const touchMove = (event: TouchEvent) => {
    const point = event.touches[0];
    if (!drag.item || !point) return;
    event.preventDefault();
    track(point.clientX, point.clientY);
  };

  const touchEnd = () => finish();

  const touchCancel = () => {
    cleanup();
    end();
  };

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    start = null;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('touchmove', touchMove);
    window.removeEventListener('touchend', touchEnd);
    window.removeEventListener('touchcancel', touchCancel);
  };

  const move = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id) return;
    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (!drag.item) {
      if (start.touch) {
        // Moving before the long press ends is a scroll, not a drag.
        if (distance > TOUCH_SLOP) cleanup();
        return;
      }
      if (distance < MOUSE_THRESHOLD) return;
      begin(event.clientX, event.clientY);
    }
    track(event.clientX, event.clientY);
  };

  const up = (event: PointerEvent) => {
    if (!start || event.pointerId !== start.id) return;
    finish();
  };

  const cancel = () => {
    // A touch drag carries on through touch events (see begin).
    if (drag.item && start?.touch) return;
    cleanup();
    end();
  };

  const down = (event: PointerEvent) => {
    if (!item || event.button !== 0 || drag.item) return;
    if ((event.target as Element).closest('button, input, [role="menu"]')) return;
    const touch = event.pointerType !== 'mouse';
    start = { x: event.clientX, y: event.clientY, id: event.pointerId, touch };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    if (touch) timer = setTimeout(() => start && begin(start.x, start.y), LONG_PRESS_MS);
  };

  // A long press on a link opens the browser's link menu; a drag replaces it.
  const contextmenu = (event: Event) => {
    if (drag.item || timer) event.preventDefault();
  };

  // Links and images are natively draggable; that would compete with this drag.
  const nativeDrag = (event: DragEvent) => event.preventDefault();

  node.addEventListener('pointerdown', down);
  node.addEventListener('contextmenu', contextmenu);
  node.addEventListener('dragstart', nativeDrag);

  return {
    update(next) {
      item = next;
    },
    destroy() {
      cleanup();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('contextmenu', contextmenu);
      node.removeEventListener('dragstart', nativeDrag);
    },
  };
};
