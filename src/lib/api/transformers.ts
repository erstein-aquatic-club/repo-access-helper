/**
 * API Transformers - Shared data transformation functions
 */

import type { StrengthSessionItem, StrengthCycleType } from './types';

// --- Strength Session Item Payload ---

export interface StrengthItemDbPayload {
  ordre: number;
  exercise_id: number;
  cycle_type: StrengthCycleType;
  sets: number;
  reps: number;
  pct_1rm: number;
  rest_series_s: number;
  notes: string;
}

/**
 * Transform normalized strength items to DB payload format
 * Used in createStrengthSession and updateStrengthSession
 */
export const prepareStrengthItemsPayload = (
  items: StrengthSessionItem[]
): StrengthItemDbPayload[] =>
  items
    .sort((a, b) => a.order_index - b.order_index)
    .map((item) => ({
      ordre: item.order_index,
      exercise_id: item.exercise_id,
      cycle_type: item.cycle_type,
      sets: item.sets,
      reps: item.reps,
      pct_1rm: item.percent_1rm,
      rest_series_s: item.rest_seconds,
      notes: item.notes,
    }));

// --- Strength Run Types ---

export interface StartRunParams {
  assignment_id?: number | null;
  athlete_id?: number | null;
  athleteName?: string;
  session_id?: number;
  cycle_type?: string;
  progress_pct?: number;
}

export interface LocalStrengthRun {
  id: number;
  assignment_id: number | null | undefined;
  athlete_id: number | null;
  athlete_name: string | null;
  session_id: number | null;
  cycle_type: string | null;
  status: string;
  progress_pct: number;
  started_at: string;
  logs: unknown[];
}

/**
 * Create a new strength run object for localStorage
 */
export const createLocalStrengthRun = (data: StartRunParams): LocalStrengthRun => ({
  id: Date.now(),
  assignment_id: data.assignment_id,
  athlete_id: data.athlete_id ?? null,
  athlete_name: data.athleteName ?? null,
  session_id: data.session_id ?? null,
  cycle_type: data.cycle_type ?? null,
  status: 'in_progress',
  progress_pct: data.progress_pct ?? 0,
  started_at: new Date().toISOString(),
  logs: [],
});

// --- Strength Set Log ---

export interface SetLogParams {
  run_id: number;
  exercise_id: number;
  set_index?: number | null;
  reps?: number | null;
  weight?: number | null;
  rpe?: number | null;
  notes?: string | null;
  pct_1rm_suggested?: number | null;
  rest_seconds?: number | null;
}

export interface LocalSetLog extends SetLogParams {
  completed_at: string;
}

/**
 * Create a set log entry for localStorage
 */
export const createLocalSetLog = (payload: SetLogParams): LocalSetLog => ({
  ...payload,
  completed_at: new Date().toISOString(),
});

// --- Supabase Payload Builders ---

export interface StrengthRunDbPayload {
  assignment_id: number | null;
  athlete_id: number | null;
  status: string;
  progress_pct: number;
  started_at: string;
}

/**
 * Create payload for Supabase strength_session_runs insert
 */
export const createStrengthRunDbPayload = (data: StartRunParams): StrengthRunDbPayload => ({
  assignment_id: data.assignment_id ?? null,
  athlete_id: data.athlete_id ?? null,
  status: 'in_progress',
  progress_pct: data.progress_pct ?? 0,
  started_at: new Date().toISOString(),
});

export interface SetLogDbPayload {
  run_id: number;
  exercise_id: number;
  set_index: number | null;
  reps: number | null;
  weight: number | null;
  pct_1rm_suggested: number | null;
  rest_seconds: number | null;
  rpe: number | null;
  notes: string | null;
  completed_at: string;
}

/**
 * Create payload for Supabase strength_set_logs insert
 */
export const createSetLogDbPayload = (payload: SetLogParams): SetLogDbPayload => ({
  run_id: payload.run_id,
  exercise_id: payload.exercise_id,
  set_index: payload.set_index ?? null,
  reps: payload.reps ?? null,
  weight: payload.weight ?? null,
  pct_1rm_suggested: payload.pct_1rm_suggested ?? null,
  rest_seconds: payload.rest_seconds ?? null,
  rpe: payload.rpe ?? null,
  notes: payload.notes ?? null,
  completed_at: new Date().toISOString(),
});

// --- Run Update Helpers ---

export interface RunUpdateParams {
  run_id: number;
  progress_pct?: number;
  status?: 'in_progress' | 'completed' | 'abandoned';
  fatigue?: number;
  comments?: string;
  assignment_id?: number;
}

/**
 * Build update payload for Supabase strength_session_runs
 */
export const buildRunUpdatePayload = (
  update: RunUpdateParams
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (update.progress_pct !== undefined) payload.progress_pct = update.progress_pct;
  if (update.status) payload.status = update.status;
  if (update.status === 'completed') payload.completed_at = new Date().toISOString();
  if (update.fatigue !== undefined) {
    payload.raw_payload = { fatigue: update.fatigue, comments: update.comments };
  }
  return payload;
};
