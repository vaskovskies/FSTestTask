import { Component, signal } from '@angular/core';
import { SearchComponent } from './components/search/search';

@Component({
  selector: 'app-root',
  imports: [SearchComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('lumana-task-v3');
}
