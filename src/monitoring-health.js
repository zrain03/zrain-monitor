import {nowISO} from './validation.js';

// The Worker being reachable is not proof that the scheduler and D1 are healthy.
// Public response is deliberately minimal; admin-only detail is in /api/admin/system.
export async function getMonitoringHealth(db) {
  if (!db) return {healthy:false,reason:'database_unavailable',last_run:null};
  try {
    const [ping,last,overdue] = await Promise.all([
      db.prepare('SELECT 1 AS ok').first(),
      db.prepare('SELECT started_at,finished_at,claimed,succeeded,failed,error FROM scheduler_runs ORDER BY started_at DESC LIMIT 1').first(),
      db.prepare(`SELECT COUNT(*) AS n FROM monitors WHERE state='ACTIVE' AND next_check_at<?`).bind(new Date(Date.now()-15*60*1000).toISOString()).first()
    ]);
    if (ping?.ok !== 1) return {healthy:false,reason:'database_unavailable',last_run:null};
    const age=last?.finished_at ? Date.parse(nowISO())-Date.parse(last.finished_at) : Infinity;
    if (!last || !Number.isFinite(age) || age>4*60*1000 || age < -30000)
      return {healthy:false,reason:'scheduler_stale',last_run:last||null};
    if ((overdue?.n||0)>0) return {healthy:false,reason:'checks_overdue',last_run:last};
    if (last.error || last.failed>0)
      return {healthy:false,reason:'scheduler_error',last_run:last};
    return {healthy:true,reason:'healthy',last_run:last};
  } catch {
    // No SQL, token or provider detail is exposed to anonymous callers.
    return {healthy:false,reason:'database_unavailable',last_run:null};
  }
}
export function publicMonitoringResponse(result) {
  return new Response(JSON.stringify({service:'zrain-monitor',monitoring:result.healthy?'healthy':'unhealthy',
    // Limit detail available to unauthenticated clients.
    state:result.healthy?'operational':'degraded'}),{
    status:result.healthy?200:503,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}
