import { Injectable, signal } from '@angular/core';

import { IInitiative } from '@app/models';

/**
 * Optional context about the drill the dialog is showing — used by the
 * future "Open in Insights" / "Save filter" affordances. Today the dialog
 * just renders a flat list, but the source taxonomy is preserved so the
 * subtitle copy can read like the offline dashboard's.
 */
export interface IDrilldownContext {
  spendCategory?: string;
  mfgProcess?: string;
  lever?: string;
  subLever?: string;
  workstream?: string;
  site?: string;
}

/**
 * Context attached when a drilldown is opened from a P&L-Informed
 * Recommendation card. Renders a banner above the initiative table with the
 * recommendation text, est. opportunity, and archetype scope so the user
 * keeps the "why" visible while reviewing the supporting initiative.
 */
export interface IDrilldownPnlContext {
  workstream: string;
  site: string;
  archetype?: string;
  opportunityAmount?: number;
  recommendationText: string;
  priorityRank?: number;
}

export interface IDrilldownState {
  title: string;
  subtitle?: string;
  items: readonly IInitiative[];
  context?: IDrilldownContext;
  pnlContext?: IDrilldownPnlContext;
}

/**
 * Global, signal-based store for the drilldown dialog. Page components push
 * an `open(...)` payload, the dialog component reads `state()` and renders.
 * Keeping the dialog mounted once at the app shell (instead of per-page)
 * lets us preserve scroll/sort state and avoid double-mount races.
 */
@Injectable({ providedIn: 'root' })
export class DrilldownService {
  private readonly _state = signal<IDrilldownState | undefined>(undefined);
  private readonly _isOpen = signal(false);
  private readonly _sortBySite = signal(false);

  readonly state = this._state.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();
  readonly sortBySite = this._sortBySite.asReadonly();

  open(payload: IDrilldownState): void {
    this._sortBySite.set(false);
    this._state.set(payload);
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }

  toggleSortBySite(): void {
    this._sortBySite.update(v => !v);
  }
}
