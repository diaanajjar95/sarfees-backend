import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { FaqItem } from '@/lib/types';
import { deleteFaqAction, toggleFaqAction } from './actions';
import CreateFaqForm from './_CreateFaqForm';

export default async function FaqPage() {
  let rows: FaqItem[] = [];
  let error: string | null = null;
  try {
    rows = await apiFetch<FaqItem[]>('/admin/faq');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load FAQ entries';
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-extrabold">FAQ</h1>
        <p
          className="mt-1 text-sm"
          style={{ color: 'var(--color-sarfees-muted)' }}
        >
          Bilingual help-center entries. Active items appear in the passenger
          app, localised to the request&apos;s Accept-Language header.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <h2
            className="text-[11px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--color-sarfees-gold)' }}
          >
            New FAQ entry
          </h2>
          <CreateFaqForm />
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
              No FAQ entries yet.
            </div>
          )}

          {rows.map((f) => (
            <div key={f.id} className="surface-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="status-pill"
                      style={{ color: 'var(--color-sarfees-gold)' }}
                    >
                      {f.categoryEn}
                    </span>
                    <span
                      className="status-pill"
                      style={{
                        color: f.isActive
                          ? '#2E7D32'
                          : 'var(--color-sarfees-muted)',
                        border: f.isActive
                          ? '1px solid rgba(46,125,50,0.35)'
                          : '1px solid var(--color-sarfees-border)',
                      }}
                    >
                      {f.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span
                      className="status-pill"
                      style={{ color: 'var(--color-sarfees-soft)' }}
                    >
                      order {f.displayOrder}
                    </span>
                    <span
                      className="text-[10px] font-mono"
                      style={{ color: 'var(--color-sarfees-soft)' }}
                    >
                      #{f.slug}
                    </span>
                  </div>

                  <h3 className="mt-2 font-extrabold">{f.questionEn}</h3>
                  <p
                    className="mt-1 text-sm whitespace-pre-wrap line-clamp-3"
                    style={{ color: 'var(--color-sarfees-muted)' }}
                  >
                    {f.answerEn}
                  </p>

                  <div
                    className="mt-3 pt-3"
                    style={{
                      borderTop: '1px solid var(--color-sarfees-border)',
                    }}
                    dir="rtl"
                  >
                    <h3 className="font-extrabold">{f.questionAr}</h3>
                    <p
                      className="mt-1 text-sm whitespace-pre-wrap line-clamp-3"
                      style={{ color: 'var(--color-sarfees-muted)' }}
                    >
                      {f.answerAr}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <Link
                    href={`/faq/${f.id}/edit`}
                    className="btn-secondary text-xs px-3 py-1.5 text-center"
                  >
                    Edit
                  </Link>
                  <form
                    action={async () => {
                      'use server';
                      await toggleFaqAction(f.id, !f.isActive);
                    }}
                  >
                    <button
                      type="submit"
                      className="btn-secondary text-xs px-3 py-1.5 w-full"
                    >
                      {f.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </form>
                  <form
                    action={async () => {
                      'use server';
                      await deleteFaqAction(f.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="btn-danger text-xs px-3 py-1.5 w-full"
                    >
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
