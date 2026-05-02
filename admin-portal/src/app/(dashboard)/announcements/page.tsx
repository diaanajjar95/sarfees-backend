import { apiFetch } from '@/lib/api';
import type { Announcement } from '@/lib/types';
import {
  deleteAnnouncementAction,
  toggleAnnouncementAction,
} from './actions';
import CreateAnnouncementForm from './_CreateAnnouncementForm';

export default async function AnnouncementsPage() {
  let rows: Announcement[] = [];
  let error: string | null = null;
  try {
    rows = await apiFetch<Announcement[]>('/admin/announcements');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load announcements';
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-extrabold">Announcements</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
          Active announcements appear in the driver home-screen carousel (highest priority first).
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h2
            className="text-[11px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-sarfees-gold)' }}
          >
            New announcement
          </h2>
          <CreateAnnouncementForm />
        </div>

        <div className="lg:col-span-2 space-y-3">
          {error && (
            <div
              className="surface-card px-5 py-4 text-sm"
              style={{ color: 'var(--color-sarfees-error)' }}
            >
              {error}
            </div>
          )}

          {rows.length === 0 && !error && (
            <div
              className="surface-card px-5 py-8 text-center text-sm"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              No announcements yet.
            </div>
          )}

          {rows.map((a) => (
            <div key={a.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold">{a.title}</h3>
                    <span
                      className="status-pill"
                      style={{
                        color: a.isActive ? '#2E7D32' : 'var(--color-sarfees-muted)',
                        border: a.isActive
                          ? '1px solid rgba(46,125,50,0.35)'
                          : '1px solid var(--color-sarfees-border)',
                      }}
                    >
                      {a.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span
                      className="status-pill"
                      style={{ color: 'var(--color-sarfees-gold)' }}
                    >
                      priority {a.priority}
                    </span>
                  </div>
                  <p
                    className="mt-2 text-sm whitespace-pre-wrap"
                    style={{ color: 'var(--color-sarfees-muted)' }}
                  >
                    {a.body}
                  </p>
                  {a.ctaUrl && (
                    <a
                      href={a.ctaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs"
                      style={{ color: 'var(--color-sarfees-gold)' }}
                    >
                      {a.ctaUrl}
                    </a>
                  )}
                  {(a.startsAt || a.endsAt) && (
                    <div
                      className="mt-2 text-[11px]"
                      style={{ color: 'var(--color-sarfees-soft)' }}
                    >
                      {a.startsAt
                        ? `From ${new Date(a.startsAt).toLocaleString()}`
                        : 'No start'}
                      {' · '}
                      {a.endsAt
                        ? `Until ${new Date(a.endsAt).toLocaleString()}`
                        : 'No end'}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <form
                    action={async () => {
                      'use server';
                      await toggleAnnouncementAction(a.id, !a.isActive);
                    }}
                  >
                    <button
                      type="submit"
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      {a.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      'use server';
                      await deleteAnnouncementAction(a.id);
                    }}
                  >
                    <button type="submit" className="btn-danger text-xs px-3 py-1.5">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
