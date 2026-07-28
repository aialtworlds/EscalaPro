import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const addDays = (i: string, days: number) => {
  const d = new Date(`${i}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function makeToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 28);
}

export const listShares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ week_start: iso }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("schedule_shares")
      .select("*")
      .eq("week_start", data.week_start)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ week_start: iso, days_valid: z.number().int().min(1).max(180).nullable().default(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const expires = data.days_valid
      ? new Date(Date.now() + data.days_valid * 86400000).toISOString()
      : null;
    const { data: row, error } = await context.supabase
      .from("schedule_shares")
      .insert({
        owner_id: context.userId,
        token: makeToken(),
        week_start: data.week_start,
        expires_at: expires,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("activity_log").insert({
      owner_id: context.userId,
      event_type: "week.shared",
      payload: { week: data.week_start },
    });
    return row;
  });

export const revokeShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("schedule_shares").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Leitura pública da escala por token. Sem sessão: quem tem o link vê a semana.
 * Só devolve nome, setor e horário — nada de dados sensíveis do cadastro.
 */
export const getSharedWeek = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: share } = await supabaseAdmin
      .from("schedule_shares")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!share) return { ok: false as const, reason: "not_found" as const };
    if (share.expires_at && Date.parse(share.expires_at) < Date.now())
      return { ok: false as const, reason: "expired" as const };

    const { data: shifts, error } = await supabaseAdmin
      .from("shifts")
      .select("shift_date, start_time, end_time, status, is_extra, is_freelancer, freelancer_label, employees(name), sectors(name)")
      .eq("owner_id", share.owner_id)
      .gte("shift_date", share.week_start)
      .lt("shift_date", addDays(share.week_start, 7))
      .order("shift_date")
      .order("start_time");
    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      week_start: share.week_start,
      shifts: (shifts ?? []).map((s) => ({
        shift_date: s.shift_date,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
        is_extra: s.is_extra,
        name: s.is_freelancer ? (s.freelancer_label ?? "Freelancer") : (s.employees?.name ?? "—"),
        is_freelancer: s.is_freelancer,
        sector: s.sectors?.name ?? null,
      })),
    };
  });
