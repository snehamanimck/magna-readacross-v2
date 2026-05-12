import { Routes } from '@angular/router';

export const READ_ACROSS_ROUTES: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./feature-read-across/feature-read-across.routes').then(
        m => m.READ_ACROSS_FEATURE_ROUTES,
      ),
  },
];
