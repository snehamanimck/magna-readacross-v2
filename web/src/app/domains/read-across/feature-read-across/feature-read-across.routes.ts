import { Routes } from '@angular/router';

export const READ_ACROSS_FEATURE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'buckets',
  },
  {
    path: 'buckets',
    loadComponent: () =>
      import('../../../features/buckets/buckets-page.component').then(
        m => m.BucketsPageComponent,
      ),
  },
  {
    path: 'heatmap',
    loadComponent: () =>
      import('../../../features/heatmap/heatmap-page.component').then(
        m => m.HeatmapPageComponent,
      ),
  },
  {
    path: 'insights',
    loadComponent: () =>
      import('../../../features/insights/insights-page.component').then(
        m => m.InsightsPageComponent,
      ),
  },
  {
    path: 'feedback',
    loadComponent: () =>
      import('../../../features/feedback/feedback-page.component').then(
        m => m.FeedbackPageComponent,
      ),
  },
];
