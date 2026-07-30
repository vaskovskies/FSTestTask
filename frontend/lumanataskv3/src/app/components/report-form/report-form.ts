import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ApiService } from '../../services/api/api';
import { catchError, finalize } from 'rxjs';

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

@Component({
  selector: 'app-report-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './report-form.html',
  styleUrl: './report-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportFormComponent {
  private apiService = inject(ApiService);

  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  reportForm = new FormGroup({
    start: new FormControl(toDatetimeLocal(new Date(Date.now() - 24 * 60 * 60 * 1000)), Validators.required),
    end: new FormControl(toDatetimeLocal(new Date()), Validators.required),
  });

  submit() {
    if (this.reportForm.invalid) return;

    const startVal = this.reportForm.value.start;
    const endVal = this.reportForm.value.end;
    if (!startVal || !endVal) return;

    const startMs = new Date(startVal).getTime();
    const endMs = new Date(endVal).getTime();

    if (startMs >= endMs) {
      this.error.set('End time must be after start time.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);

    this.apiService.generateReport(startMs, endMs).pipe(
      catchError((err) => {
        this.error.set('Failed to generate report. Please try again.');
        return [];
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${startMs}_${endMs}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      this.success.set(true);
    });
  }
}
