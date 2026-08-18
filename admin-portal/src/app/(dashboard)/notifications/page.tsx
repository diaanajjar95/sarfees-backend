import { apiFetch } from '@/lib/api';
import { BroadcastForm, CreateTopicForm } from './_TopicForms';

export const dynamic = 'force-dynamic';

interface Topic {
  id: number;
  name: string;
  description: string | null;
  builtIn: boolean;
  createdAt: string;
}

export default async function NotificationsPage() {
  let topics: Topic[] = [];
  let error: string | null = null;
  try {
    topics = await apiFetch<Topic[]>('/admin/notification-topics');
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load topics';
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Notifications</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--color-sarfees-muted)' }}>
        FCM topics and broadcasts. Devices auto-subscribe to
        all_customers / all_drivers on login; custom topics are opt-in
        from the apps.
      </p>

      <div className="mt-4 surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-wide"
              style={{ color: 'var(--color-sarfees-muted)' }}
            >
              <th className="px-5 py-3">Topic</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Kind</th>
              <th className="px-5 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={4} className="px-5 py-4" style={{ color: 'var(--color-sarfees-error)' }}>
                  {error}
                </td>
              </tr>
            )}
            {topics.map((t) => (
              <tr
                key={t.id}
                className="border-t"
                style={{ borderColor: 'var(--color-sarfees-border)' }}
              >
                <td className="px-5 py-3 font-mono font-semibold">{t.name}</td>
                <td className="px-5 py-3">{t.description ?? '—'}</td>
                <td className="px-5 py-3">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-bold"
                    style={
                      t.builtIn
                        ? { color: 'var(--color-sarfees-gold)', border: '1px solid rgba(250,190,44,0.4)' }
                        : { color: '#64B5F6', border: '1px solid rgba(100,181,246,0.4)' }
                    }
                  >
                    {t.builtIn ? 'built-in' : 'custom'}
                  </span>
                </td>
                <td className="px-5 py-3" style={{ color: 'var(--color-sarfees-muted)' }}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BroadcastForm topics={topics.map((t) => t.name)} />
        <CreateTopicForm />
      </div>
    </div>
  );
}
