import { Routes } from '@angular/router';
import { Ensemble } from './pages/ensemble/ensemble';
import { Home } from './pages/home/home';
import { NotFound } from './pages/not-found/not-found';

/** The one page, an unlisted interview page, and a not-found page for every other path CloudFront hands to index.html. */
export const routes: Routes = [
  { path: '', component: Home },
  { path: 'ensemble', component: Ensemble },
  { path: '**', component: NotFound },
];
