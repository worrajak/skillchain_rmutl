/**
 * Job ranking — used for "Featured Top 10" hero strip on /student/jobs.
 *
 * Weight: pay 60% + urgency 30% + small-team 10%
 *
 * Logic kept in one function so it's easy to:
 *   • debug ("why does job X rank above job Y?")
 *   • tweak weights without touching UI
 *   • reuse on other pages (jobs feed, leaderboard, etc.)
 */

export interface RankableJob {
  pay_amount?: number | null;
  deadline?: string | null;
  event_date?: string | null;
  required_workers?: number | null;
}

/**
 * Compute rank score 0..1 for a single job.
 *
 * @param maxPay  largest pay in the dataset — used to normalize so we compare jobs by
 *                "% of max pay" rather than absolute baht. Pass 1 if unknown.
 *
 * Score breakdown (each ∈ [0,1] before weighting):
 *   • payScore  = clamp(pay / maxPay, 0, 1)
 *   • urgency   = 1 - clamp(hoursToDeadline / 168h, 0, 1)
 *                 (168h = 7 days; deadline today → ~1, deadline next week → ~0)
 *   • sizeScore = 1 / required_workers (smaller teams sort up)
 *
 * Total weighted = 0.6*pay + 0.3*urgency + 0.1*size
 */
export function rankJob(job: RankableJob, maxPay = 1): number {
  // ── pay layer (60%) ─────────────────────────────
  const pay = Math.max(0, Number(job.pay_amount ?? 0));
  const payScore = maxPay > 0 ? Math.min(1, pay / maxPay) : 0;

  // ── urgency layer (30%) ─────────────────────────
  // Use event_date if it's an activity, else deadline
  const target = job.event_date ?? job.deadline;
  let urgencyScore = 0; // no deadline → neutral (won't boost the job)
  if (target) {
    const hours = Math.max(0, (new Date(target).getTime() - Date.now()) / 3_600_000);
    urgencyScore = 1 - Math.min(1, hours / 168); // 7-day window
  }

  // ── small-team bonus (10%) ──────────────────────
  const workers = Math.max(1, Number(job.required_workers ?? 1));
  const sizeScore = 1 / workers;

  return payScore * 0.6 + urgencyScore * 0.3 + sizeScore * 0.1;
}

/**
 * Rank a list of jobs (highest score first).
 *
 * Returns a NEW array — does not mutate input.
 */
export function rankJobs<T extends RankableJob>(jobs: T[]): T[] {
  if (jobs.length === 0) return [];
  const maxPay = Math.max(0, ...jobs.map((j) => Number(j.pay_amount ?? 0)));
  return [...jobs].sort((a, b) => rankJob(b, maxPay) - rankJob(a, maxPay));
}

/**
 * Split a ranked list into "featured" (top N) + "more" (the rest).
 */
export function partitionByRank<T extends RankableJob>(
  jobs: T[],
  featuredCount = 10,
): { featured: T[]; more: T[] } {
  const ranked = rankJobs(jobs);
  return {
    featured: ranked.slice(0, featuredCount),
    more: ranked.slice(featuredCount),
  };
}
