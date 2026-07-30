import { Component, signal } from '@angular/core';
import { SearchComponent } from './components/search/search';
import { ReportFormComponent } from './components/report-form/report-form';

type View = 'search' | 'reports';

@Component({
  selector: 'app-root',
  imports: [SearchComponent, ReportFormComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('lumana-task-v3');
  protected readonly currentView = signal<View>('search');

  protected switchView(view: View) {
    this.currentView.set(view);
  }
}
