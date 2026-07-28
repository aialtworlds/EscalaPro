// Snapshots da semana: rede de segurança antes de operações em massa
// (auto-preenchimento, duplicação, restauração). Guardamos os turnos crus.
import type { SupabaseClient } from "@supabase/supabase-js";

const SNAPSHOT_FIELDS =
  "employee_id, sector_id, shift_date, start_time, end_time, is_freelancer, freelancer_label, is_extra, status";

const MAX_PER_WEEK = 10;

export type SnapshotShift = {
  employee_id: string | null;
  sector_id: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  is_freelancer: boolean;
  freelancer_label: string | null;
  is_extra: boolean;
  status: string;
};

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Fotografa a semana e devolve o id do snapshot (null se a semana estava vazia). */
export async function snapshotWeek(
  supabase: SupabaseClient,
  ownerId: string,
  weekStart: string,
  label: string,
): Promise<string | null> {
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select(SNAPSHOT_FIELDS)
    .gte("shift_date", weekStart)
    .lt("shift_date", addDays(weekStart, 7));
  if (error) throw new Error(error.message);
  if (!shifts?.length) return null;

  const { data: snap, error: e2 } = await supabase
    .from("schedule_snapshots")
    .insert({ owner_id: ownerId, week_start: weekStart, label, payload: shifts })
    .select("id")
    .single();
  if (e2) throw new Error(e2.message);

  // Mantém só os mais recentes para não virar depósito.
  const { data: old } = await supabase
    .from("schedule_snapshots")
    .select("id")
    .eq("week_start", weekStart)
    .order("created_at", { ascending: false })
    .range(MAX_PER_WEEK, MAX_PER_WEEK + 50);
  if (old?.length) {
    await supabase
      .from("schedule_snapshots")
      .delete()
      .in("id", old.map((o) => o.id));
  }
  return snap.id;
}
