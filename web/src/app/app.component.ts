import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FilterBarComponent } from './shared/components/filter-bar/filter-bar.component';
import { DrilldownDialogComponent } from './shared/components/drilldown-dialog/drilldown-dialog.component';
import { ArchetypeLegendDialogComponent } from './shared/components/archetype-legend-dialog/archetype-legend-dialog.component';
import { DataQualityDialogComponent } from './shared/components/data-quality-dialog/data-quality-dialog.component';
import { LeverInsightsDialogComponent } from './shared/components/lever-insights-dialog/lever-insights-dialog.component';
import { DashboardChromeService } from '@app/core-services';

/**
 * Application shell. Implements the Digi DS layout grid: sticky white
 * header → optional filter rail → content surface on the Digi Gray F9
 * page background, max width 90rem with consistent 24px gutters.
 *
 * Also mounts the singleton drilldown dialog so any page can call
 * `DrilldownService.open(...)` without re-mounting.
 */
@Component({
  selector: 'mra-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FilterBarComponent,
    DrilldownDialogComponent,
    ArchetypeLegendDialogComponent,
    DataQualityDialogComponent,
    LeverInsightsDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mra-header></mra-header>
    <mra-filter-bar></mra-filter-bar>
    <main class="w-full px-6 py-6">
      <router-outlet />
    </main>
    <mra-drilldown-dialog></mra-drilldown-dialog>
    <mra-archetype-legend-dialog></mra-archetype-legend-dialog>
    <mra-data-quality-dialog></mra-data-quality-dialog>
    <mra-lever-insights-dialog></mra-lever-insights-dialog>
  `,
})
export class AppComponent {
  private readonly chrome = inject(DashboardChromeService);

  constructor() {
    // Best-effort boot — never blocks rendering.
    void this.chrome.bootAsync();
  }
}
