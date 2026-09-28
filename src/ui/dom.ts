type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** Tiny hyperscript helper: h('button', { class: 'x', onclick }, 'Label'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  // Icon buttons get their tooltip as accessible name (screen readers, tests).
  if (el.classList.contains('icon') && el.title && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.title);
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

let toastTimer = 0;
export function toast(msg: string): void {
  const el = document.getElementById('toast')!;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 1600);
}

export const gold = (n: number) => `${Math.floor(n).toLocaleString('en-US')}`;
export const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
