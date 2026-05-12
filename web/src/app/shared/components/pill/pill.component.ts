import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type Variant = 'default' | 'cosma' | 'pt' | 'ext';

/**
 * Filter chip / toggle. Matches the Digi DS "pill" anatomy:
 *   - default off : white surface, Digi Gray D0 outline, Gray-3 label.
 *   - default on  : Digi Aqua-derived btn-primary (#295D6E) fill, white label.
 *   - workstream variants keep semantic accent colors when active so users
 *     can read the workstream group at a glance, but inherit the same
 *     muted "off" treatment as default pills.
 */
@Component({
  selector: 'mra-pill',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="pill"
      [class.pill-off]="!active && variant === 'default'"
      [class.pill-on]="active && variant === 'default'"
      [class.pill-cosma-off]="!active && variant === 'cosma'"
      [class.pill-cosma-on]="active && variant === 'cosma'"
      [class.pill-pt-off]="!active && variant === 'pt'"
      [class.pill-pt-on]="active && variant === 'pt'"
      [class.pill-ext-off]="!active && variant === 'ext'"
      [class.pill-ext-on]="active && variant === 'ext'">
      @if (active) {
        <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor"
             stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2.5 6.5 5 9l4.5-5.5" />
        </svg>
      }
      <ng-content />
    </button>
  `,
})
export class PillComponent {
  @Input() active = false;
  @Input() variant: Variant = 'default';
}
