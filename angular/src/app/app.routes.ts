import { Routes } from '@angular/router';
import { Ensemble } from './pages/ensemble/ensemble';
import { Home } from './pages/home/home';
import { Nexus } from './pages/nexus/nexus';
import { NotFound } from './pages/not-found/not-found';

/** The one page, two unlisted interview pages, and a not-found page for every other path CloudFront hands to index.html. */
export const routes: Routes = [
  { path: '', component: Home },
  { path: 'ensemble', component: Ensemble },
  { path: 'nexus', component: Nexus },
  { path: '**', component: NotFound },
];
