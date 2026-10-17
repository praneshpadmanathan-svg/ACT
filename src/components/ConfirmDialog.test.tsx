import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './TestSectionView';

vi.mock('@/lib/sfx', () => ({ sfx: { select: vi.fn() } }));

const roots: Root[] = [];
afterEach(() => {
  roots.splice(0).forEach((root) => act(() => root.unmount()));
  document.body.innerHTML = '';
});

function open(extra?: { onCancel?: () => void; onConfirm?: () => void }) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  const onCancel = extra?.onCancel ?? vi.fn();
  const onConfirm = extra?.onConfirm ?? vi.fn();
  act(() =>
    root.render(
      <ConfirmDialog
        title="Submit this section?"
        body="You cannot come back."
        confirmLabel="Submit section"
        cancelLabel="Keep working"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    ),
  );
  const dialog = [...document.querySelectorAll<HTMLElement>('[role="alertdialog"]')].at(-1)!;
  return { root, dialog, onCancel, onConfirm };
}

const press = (down: Element, up: Element) => {
  down.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  // A click is dispatched on the nearest common ancestor of down and up.
  let common: Element | null = up;
  while (common && !common.contains(down)) common = common.parentElement;
  common?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

it('cancels on a tap that starts and ends on the backdrop', () => {
  const { dialog, onCancel } = open();
  act(() => press(dialog, dialog));
  expect(onCancel).toHaveBeenCalledOnce();
});

it('does not cancel when a press inside the panel is released over the backdrop', () => {
  const { dialog, onCancel } = open();
  const body = dialog.querySelector('p')!;
  act(() => press(body, dialog));
  expect(onCancel).not.toHaveBeenCalled();
});

it('confirms once however fast the button is pressed again', () => {
  const { dialog, onConfirm } = open();
  const confirm = [...dialog.querySelectorAll('button')].find((b) =>
    b.textContent?.includes('Submit section'),
  )!;
  act(() => {
    confirm.click();
    confirm.click();
  });
  expect(onConfirm).toHaveBeenCalledOnce();
});

it('lets Escape close only the newest of two stacked dialogs', () => {
  const below = open();
  const above = open();
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(above.onCancel).toHaveBeenCalledOnce();
  expect(below.onCancel).not.toHaveBeenCalled();
  act(() => above.root.unmount());
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  expect(below.onCancel).toHaveBeenCalledOnce();
});
