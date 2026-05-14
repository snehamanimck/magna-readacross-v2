import { Injectable, signal } from '@angular/core';

/**
 * Context that drives the multi-tab "Lever Insights" dialog (parity with
 * the legacy `openThoughtStarterPanel`). When the user clicks the ★ next
 * to a lever in the Buckets pivot grid or the Heatmap, we capture the
 * full taxonomy slice (spendCategory · mfgProcess · lever · subLever)
 * and surface a focused dialog with three tabs: Thought Starters,
 * Knowledge Center, and Video Library — each pre-filtered to that slice.
 *
 * Mirrors the offline dashboard's behaviour so users never lose context
 * when investigating a lever.
 */
export interface ILeverInsightsContext {
  spendCategory?: string;
  mfgProcess?: string;
  lever: string;
  subLever?: string;
}

@Injectable({ providedIn: 'root' })
export class LeverInsightsService {
  private readonly _context = signal<ILeverInsightsContext | undefined>(undefined);
  private readonly _isOpen  = signal(false);

  readonly context = this._context.asReadonly();
  readonly isOpen  = this._isOpen.asReadonly();

  open(context: ILeverInsightsContext): void {
    if (!context.lever) return;
    this._context.set(context);
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }
}
