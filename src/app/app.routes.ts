import { Routes } from '@angular/router';
import { VideoListComponent } from './components/video-list/video-list';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/videos',
    pathMatch: 'full',
  },
  {
    path: 'videos/:id/play',
    loadComponent: () =>
      import('./components/video-player/video-player').then(m => m.VideoPlayerComponent),
  },
  {
    path: 'videos/:id',
    loadComponent: () =>
      import('./components/video-detail/video-detail').then(m => m.VideoDetailComponent),
  },
  {
    path: 'videos',
    component: VideoListComponent,
  },
  {
    path: 'collections/:id',
    loadComponent: () =>
      import('./components/collection-browser/collection-browser').then(m => m.CollectionBrowserComponent),
  },
  {
    path: 'collections',
    loadComponent: () =>
      import('./components/collection-browser/collection-browser').then(m => m.CollectionBrowserComponent),
  },
  {
    path: 'tags',
    loadComponent: () =>
      import('./components/tag-manager/tag-manager').then(m => m.TagManagerComponent),
  },
];
