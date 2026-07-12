/**
 * HATA RAPORLAYICI — Merkezi hata köprüsü
 * ──────────────────────────────────────────────────────────────────────────────
 * app.ts → storage.ts döngüsel bağımlılığını önlemek için köprü modülü.
 * index.ts içinde setErrorReporter() ile depolama fonksiyonu bağlanır.
 * app.ts global hata yakalayıcısı buradan çağırır.
 *
 * Yalnızca 5xx (beklenmeyen sistem hataları) raporlanır.
 * 4xx (kullanıcı hataları) raporlanmaz.
 */

export interface SystemErrorPayload {
  severity: "warning" | "error" | "critical";
  route?: string | null;
  institutionId?: string | null;
  teacherId?: string | null;
  studentId?: string | null;
  adminId?: string | null;
  message: string;
  stack?: string | null;
  requestId?: string | null;
}

type ErrorReporterFn = (payload: SystemErrorPayload) => void;

let _reporter: ErrorReporterFn | null = null;

/** index.ts içinde çağrılarak storage entegrasyonu sağlanır */
export function setErrorReporter(fn: ErrorReporterFn): void {
  _reporter = fn;
}

/** app.ts global hata handler'ı bu fonksiyonu çağırır */
export function reportSystemError(payload: SystemErrorPayload): void {
  if (_reporter) {
    try {
      _reporter(payload);
    } catch {
      // Reporter kendisi patlamamalı
    }
  }
}
