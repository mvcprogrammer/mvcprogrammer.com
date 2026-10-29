import { Routes } from '@angular/router';
import { Explorer } from './pages/explorer/explorer';
import { NotFound } from './pages/not-found/not-found';

/** The explorer is the one page; every other path CloudFront hands to index.html gets the not-found page. */
export const routes: Routes = [
  { path: '', component: Explorer },
  { path: '**', component: NotFound },
];
