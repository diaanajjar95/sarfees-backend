import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * Which app audience an endpoint serves. Determined purely by the path prefix
 * — keep URL prefixes and audience aligned and you never have to touch this
 * file when adding a new controller.
 */
export type Audience = 'passenger' | 'driver' | 'admin';

/**
 * Classify a single OpenAPI path string into the audiences it belongs to.
 * Returned as a Set so endpoints visible to multiple audiences (e.g. `/faq`,
 * `/app/init`) can opt into more than one doc.
 *
 * Convention:
 *   - `/admin/**`               → admin only
 *   - `/auth/driver/**`         → driver only
 *   - `/drivers/**`             → driver only (incl `/drivers/trips`, `/drivers/notifications`)
 *   - `/auth/**` (rest)         → passenger only (request-otp, verify-otp, refresh, logout, login)
 *   - `/users/**`               → passenger only (incl `/users/notifications`)
 *   - `/trips/**` / `/packages/**` / `/cities/**`
 *                               → passenger only
 *   - `/app/**` / `/faq`        → passenger + driver (public, both apps consume)
 *   - anything else             → all three (defensive; surfaces in every doc)
 */
export function audiencesForPath(path: string): Set<Audience> {
  const out = new Set<Audience>();

  // Strip any trailing slash for consistent matching.
  const p = path.replace(/\/+$/, '') || '/';

  // Admin first — the broadest prefix wins.
  if (p === '/admin' || p.startsWith('/admin/')) {
    out.add('admin');
    return out;
  }

  // Driver-specific auth + driver app surface.
  if (p === '/auth/driver' || p.startsWith('/auth/driver/')) {
    out.add('driver');
    return out;
  }
  if (p === '/drivers' || p.startsWith('/drivers/')) {
    out.add('driver');
    return out;
  }

  // Passenger-side auth (after we've already excluded /auth/driver above).
  if (p === '/auth' || p.startsWith('/auth/')) {
    out.add('passenger');
    return out;
  }

  // Passenger-only surfaces.
  if (
    p === '/users' ||
    p.startsWith('/users/') ||
    p === '/trips' ||
    p.startsWith('/trips/') ||
    p === '/packages' ||
    p.startsWith('/packages/') ||
    p === '/cities' ||
    p.startsWith('/cities/')
  ) {
    out.add('passenger');
    return out;
  }

  // Shared public surface — both passenger and driver apps consume these.
  if (
    p === '/app' ||
    p.startsWith('/app/') ||
    p === '/faq' ||
    p.startsWith('/faq/')
  ) {
    out.add('passenger');
    out.add('driver');
    return out;
  }

  // Anything unclassified shows up in all three docs so it's never invisible.
  // If you see something here, add a prefix rule above.
  out.add('passenger');
  out.add('driver');
  out.add('admin');
  return out;
}

/**
 * Return a shallow clone of an OpenAPI document with `paths` filtered to
 * only those visible to the given audience. Tags get filtered too so the
 * UI sidebar stays tidy.
 */
export function filterDocumentForAudience(
  doc: OpenAPIObject,
  audience: Audience,
): OpenAPIObject {
  const filteredPaths: OpenAPIObject['paths'] = {};
  const usedTags = new Set<string>();

  for (const [path, ops] of Object.entries(doc.paths)) {
    if (!audiencesForPath(path).has(audience)) continue;
    filteredPaths[path] = ops;
    // Collect tag names referenced by the kept operations
    for (const op of Object.values(ops as Record<string, unknown>)) {
      const tags = (op as { tags?: string[] } | undefined)?.tags;
      if (Array.isArray(tags)) tags.forEach((t) => usedTags.add(t));
    }
  }

  return {
    ...doc,
    paths: filteredPaths,
    tags: (doc.tags ?? []).filter((t) => usedTags.has(t.name)),
  };
}
