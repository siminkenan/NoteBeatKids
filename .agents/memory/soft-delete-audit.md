---
name: Soft Delete & Audit Logs
description: Classes use soft delete; resetInstitutionQuota no longer auto-triggers on license date change; audit_logs table logs critical operations.
---

## Rule
`deleteClass()` now does `UPDATE classes SET deleted_at = NOW()` — never physically deletes students, progress, or codes. All existing class queries filter `WHERE deleted_at IS NULL`.

## New tables / columns (schema.ts)
- `classes.deleted_at TIMESTAMP NULL` — null = active, non-null = soft-deleted
- `audit_logs` table — logs action, userType, userId, institutionId, teacherId, classId, studentId, details, ipAddress, createdAt

## New storage methods
- `restoreClass(id)` — sets deleted_at = NULL, invalidates Redis cache
- `getDeletedClasses(institutionId?)` — returns soft-deleted classes with teacher/institution info
- `createAuditLog(data)` — inserts into audit_logs; failure is silently swallowed (never breaks main flow)

## Routes removed / added
- **REMOVED**: `isRenewal` auto-trigger of `resetInstitutionQuota` inside `PATCH /api/admin/institutions/:id` — license date changes NEVER delete classes anymore
- **ADDED**: `GET /api/admin/classes/deleted` — list deleted classes
- **ADDED**: `POST /api/admin/classes/:classId/restore` — restore a deleted class

## Console.log pattern for Render
Every critical op logs: `[DELETE_CLASS]`, `[RESTORE_CLASS]`, `[RESET_QUOTA]`, `[LICENSE_UPDATE]`

## Admin dashboard
New "Çöp Kutusu" tab (value="deleted-classes") shows deleted classes with Restore button. Badge count on tab shows number of deleted classes.

**Why:** A class with ~100 students disappeared in production. Root cause: either accidental teacher delete or silent isRenewal resetQuota trigger. Both paths are now safe.

**How to apply:** Any future class-list query must include `isNull(classes.deletedAt)` filter. Never add physical deletes of student data.
