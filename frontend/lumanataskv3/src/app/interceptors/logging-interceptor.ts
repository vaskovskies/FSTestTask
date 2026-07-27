import {
  HttpInterceptorFn,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

export const loggingInterceptor: HttpInterceptorFn = (request, next) => {
  const startTime = Date.now();
  
  console.log(`[HTTP] ${request.method} ${request.url}`);
  
  return next(request).pipe(
    tap((event) => {
      if (event.type === 4) { // HttpResponse
        const duration = Date.now() - startTime;
        console.log(`[HTTP] ${request.method} ${request.url} - Success (${duration}ms)`);
      }
    }),
    catchError((error: HttpErrorResponse) => {
      const duration = Date.now() - startTime;
      console.error(`[HTTP] ${request.method} ${request.url} - Error (${duration}ms):`, error);
      return throwError(() => error);
    })
  );
};
