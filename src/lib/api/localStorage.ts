/**
 * Local Storage API - Fallback storage for offline mode
 */

import { STORAGE_KEYS } from './client';

// --- Local Storage Utilities ---

export const localStorageGet = <T = unknown>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const localStorageSave = <T = unknown>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('[localStorage] Failed to save:', key, error);
  }
};

export const localStorageRemove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore errors
  }
};

export const resetLocalStorageCache = (): void => {
  Object.values(STORAGE_KEYS).forEach(key => localStorageRemove(key));
};

// --- Type-safe storage accessors ---

export const storage = {
  sessions: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.SESSIONS) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.SESSIONS, data),
  },
  exercises: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.EXERCISES) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.EXERCISES, data),
  },
  strengthSessions: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.STRENGTH_SESSIONS) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.STRENGTH_SESSIONS, data),
  },
  swimSessions: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.SWIM_SESSIONS) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.SWIM_SESSIONS, data),
  },
  assignments: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.ASSIGNMENTS) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.ASSIGNMENTS, data),
  },
  strengthRuns: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.STRENGTH_RUNS) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.STRENGTH_RUNS, data),
  },
  notifications: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.NOTIFICATIONS) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.NOTIFICATIONS, data),
  },
  oneRm: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.ONE_RM) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.ONE_RM, data),
  },
  swimRecords: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.SWIM_RECORDS) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.SWIM_RECORDS, data),
  },
  timesheetShifts: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.TIMESHEET_SHIFTS) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.TIMESHEET_SHIFTS, data),
  },
  timesheetLocations: {
    get: () => localStorageGet<unknown[]>(STORAGE_KEYS.TIMESHEET_LOCATIONS) ?? [],
    save: (data: unknown[]) => localStorageSave(STORAGE_KEYS.TIMESHEET_LOCATIONS, data),
  },
};
