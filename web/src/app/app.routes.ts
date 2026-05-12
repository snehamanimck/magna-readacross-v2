import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./domains/read-across/read-across.routes').then(m => m.READ_ACROSS_ROUTES),
  },
  { path: '**', redirectTo: 'buckets' },
];
