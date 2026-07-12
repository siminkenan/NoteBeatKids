/**
 * HATA RAPORLAYICI — Merkezi hata köprüsü
 * app.ts → storage.ts döngüsel bağımlılığını önleyen köprü modülü.
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

export function setErrorReporter(fn: ErrorReporterFn): void { _reporter = fn; }

export function reportSystemError(payload: SystemErrorPayload): void {
  if (_reporter) { try { _reporter(payload); } catch {} }
}
