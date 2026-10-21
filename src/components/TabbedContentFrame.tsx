import React, { useRef } from 'react';
import { getAdjacentTab, type NavItem, type TabType } from './BottomNav';

interface TabbedContentFrameProps {
  tabs: readonly NavItem[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
}

type PointerStart = { id: number; x: number; y: number; at: number };

const MIN_SWIPE_DISTANCE = 72;
const MAX_SWIPE_DURATION = 650;
const HORIZONTAL_DOMINANCE = 1.35;
const EDGE_GUARD = 24;
const INTERACTIVE_SELECTOR = [
  'button', 'a', 'input', 'textarea', 'select', 'option', 'label',
  '[contenteditable="true"]', '[role="slider"]', '[role="scrollbar"]',
  '[role="combobox"]', '[role="listbox"]', '[role="dialog"]', '[aria-modal="true"]',
  '[draggable="true"]', '[data-swipe-ignore]',
].join(',');

function targetAllowsSwipe(target: EventTarget | null, root: HTMLElement): boolean {
  if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return false;
  for (let node: Element | null = target; node && node !== root; node = node.parentElement) {
    const overflowX = getComputedStyle(node).overflowX;
    if (/^(auto|scroll|overlay)$/.test(overflowX) && node.scrollWidth > node.clientWidth + 1) return false;
  }
  return true;
}

/**
 * Défilement horizontal de navigation uniquement dans l'espace de contenu.
 * Aucun preventDefault : le scroll vertical et les interactions des écrans
 * terrain restent natifs. Les zones de saisie et de slider sont exclues.
 */
export const TabbedContentFrame: React.FC<TabbedContentFrameProps> = ({ tabs, activeTab, onTabChange, children }) => {
  const pointerStart = useRef<PointerStart | null>(null);

  const clearPointer = () => { pointerStart.current = null; };
  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const root = event.currentTarget;
    const bounds = root.getBoundingClientRect();
    const nearSystemEdge = event.clientX - bounds.left < EDGE_GUARD || bounds.right - event.clientX < EDGE_GUARD;
    if (!event.isPrimary || (event.pointerType !== 'touch' && event.pointerType !== 'pen') || nearSystemEdge || !targetAllowsSwipe(event.target, root)) return;
    pointerStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() };
  };
  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    clearPointer();
    if (!start || start.id !== event.pointerId || !targetAllowsSwipe(event.target, event.currentTarget)) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const elapsed = performance.now() - start.at;
    if (elapsed > MAX_SWIPE_DURATION || Math.abs(dx) < MIN_SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_DOMINANCE) return;
    const nextTab = getAdjacentTab(tabs, activeTab, dx < 0 ? 'next' : 'previous');
    if (nextTab) onTabChange(nextTab);
  };

  return (
    <main
      className="app-main-content flex-1 min-h-0 px-3 sm:px-4 pt-3 pb-32 max-w-2xl mx-auto w-full overflow-y-auto overflow-x-hidden"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={clearPointer}
      aria-label="Contenu de l’application"
    >
      {children}
    </main>
  );
};
