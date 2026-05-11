import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import type { FaqItem } from '@/lib/types';
import { updateFaqAction, type FaqActionResult } from '../../actions';
import EditFaqForm from './_EditFaqForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditFaqPage({ params }: PageProps) {
  const { id } = await params;
  const faqId = Number(id);
  if (!Number.isFinite(faqId)) notFound();

  let item: FaqItem;
  try {
    item = await apiFetch<FaqItem>(`/admin/faq/${faqId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const action = async (
    prev: FaqActionResult | null,
    formData: FormData,
  ): Promise<FaqActionResult> => {
    'use server';
    return updateFaqAction(faqId, prev, formData);
  };

  return (
    <div className="max-w-3xl">
      <Link
        href="/faq"
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        <ChevronLeft size={14} /> Back to FAQ
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold">Edit FAQ entry</h1>
      <p
        className="mt-1 text-sm"
        style={{ color: 'var(--color-sarfees-muted)' }}
      >
        Updates apply instantly to the passenger help-center for the matching
        Accept-Language header.
      </p>
      <div className="mt-6">
        <EditFaqForm initial={item} action={action} />
      </div>
    </div>
  );
}
