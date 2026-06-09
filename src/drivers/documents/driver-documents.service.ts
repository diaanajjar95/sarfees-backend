import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { DriverDocument } from './driver-document.entity';
import { Driver } from '../driver.entity';
import {
  DOCUMENT_EXPIRING_SOON_DAYS,
  DriverDocumentDisplayStatus,
  DriverDocumentStatus,
  DriverDocumentType,
} from '../../shared/enums/driver-document-type.enum';
import { UploadDriverDocumentDto } from './dto/upload-driver-document.dto';
import {
  DriverDocumentDto,
  DriverDocumentsSummaryDto,
  ListDriverDocumentsResponseDto,
} from './dto/driver-document-response.dto';

interface UploadedFileInfo {
  path: string;
  originalname?: string;
  size?: number;
  mimetype?: string;
}

@Injectable()
export class DriverDocumentsService {
  constructor(
    @InjectRepository(DriverDocument)
    private readonly repo: Repository<DriverDocument>,
  ) {}

  /**
   * Upload (or replace) a document of the given type. If the driver
   * already has a document of this type, the old row is hard-deleted
   * and its file removed from disk — the table only ever holds the
   * current document per (driver, type) pair.
   */
  async upload(
    driverId: number,
    file: UploadedFileInfo | undefined,
    dto: UploadDriverDocumentDto,
  ): Promise<DriverDocumentDto> {
    if (!file) {
      throw new BadRequestException(
        'File is required. Send it under the `file` form field.',
      );
    }

    const fileUrl = this.fileUrlFor(file.path);

    // Replace any existing document of the same type.
    const existing = await this.repo.findOne({
      where: { driver: { id: driverId }, type: dto.type },
    });
    if (existing) {
      this.removeFile(existing.fileUrl);
      await this.repo.remove(existing);
    }

    const created = this.repo.create({
      driver: { id: driverId } as Driver,
      type: dto.type,
      fileUrl,
      originalFilename: file.originalname,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      documentNumber: dto.documentNumber,
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      status: DriverDocumentStatus.PENDING_REVIEW,
    } as DriverDocument);
    const saved = await this.repo.save(created);
    return this.toDto(saved);
  }

  /**
   * List all documents for this driver. Empty types still show up in
   * `summary.expectedTypeCount` so the UI can render placeholder cards.
   */
  async list(driverId: number): Promise<ListDriverDocumentsResponseDto> {
    const rows = await this.repo.find({
      where: { driver: { id: driverId } },
      order: { type: 'ASC', createdAt: 'DESC' },
    });

    const data = rows.map((r) => this.toDto(r));
    const summary = this.buildSummary(data);
    return { data, summary };
  }

  async getOne(
    driverId: number,
    documentId: number,
  ): Promise<DriverDocumentDto> {
    const row = await this.repo.findOne({
      where: { id: documentId, driver: { id: driverId } },
    });
    if (!row) throw new NotFoundException('Document not found');
    return this.toDto(row);
  }

  async remove(driverId: number, documentId: number): Promise<{ id: number }> {
    const row = await this.repo.findOne({
      where: { id: documentId, driver: { id: driverId } },
    });
    if (!row) throw new NotFoundException('Document not found');
    this.removeFile(row.fileUrl);
    await this.repo.remove(row);
    return { id: documentId };
  }

  // ─── internals ──────────────────────────────────────────────

  private toDto(row: DriverDocument): DriverDocumentDto {
    const expiresAt = row.expiresAt ? new Date(row.expiresAt) : null;
    const days = this.daysUntil(expiresAt);
    const displayStatus = this.deriveDisplayStatus(row.status, days);
    return {
      id: row.id,
      type: row.type,
      fileUrl: row.fileUrl,
      status: row.status,
      displayStatus,
      documentNumber: row.documentNumber ?? null,
      issuedAt: row.issuedAt ?? null,
      expiresAt,
      daysUntilExpiry: days,
      reviewedAt: row.reviewedAt ?? null,
      rejectionReason: row.rejectionReason ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private buildSummary(items: DriverDocumentDto[]): DriverDocumentsSummaryDto {
    const expectedTypeCount = Object.keys(DriverDocumentType).length;
    const uploadedTypeCount = new Set(items.map((i) => i.type)).size;
    const needsAttentionCount = items.filter(
      (i) => i.displayStatus !== DriverDocumentDisplayStatus.VERIFIED,
    ).length;
    const reviewedTimestamps = items
      .map((i) => i.reviewedAt)
      .filter((t): t is Date => t != null)
      .map((t) => new Date(t).getTime());
    const lastReviewedAt = reviewedTimestamps.length
      ? new Date(Math.max(...reviewedTimestamps))
      : null;
    return {
      needsAttentionCount,
      lastReviewedAt,
      expectedTypeCount,
      uploadedTypeCount,
    };
  }

  private daysUntil(expiresAt: Date | null): number | null {
    if (!expiresAt) return null;
    const msPerDay = 86_400_000;
    return Math.floor((expiresAt.getTime() - Date.now()) / msPerDay);
  }

  private deriveDisplayStatus(
    status: DriverDocumentStatus,
    daysUntilExpiry: number | null,
  ): DriverDocumentDisplayStatus {
    if (status === DriverDocumentStatus.REJECTED) {
      return DriverDocumentDisplayStatus.REJECTED;
    }
    if (status === DriverDocumentStatus.PENDING_REVIEW) {
      return DriverDocumentDisplayStatus.PENDING_REVIEW;
    }
    // status is VERIFIED — let expiry drive the badge.
    if (daysUntilExpiry == null) {
      return DriverDocumentDisplayStatus.VERIFIED;
    }
    if (daysUntilExpiry < 0) {
      return DriverDocumentDisplayStatus.EXPIRED;
    }
    if (daysUntilExpiry <= DOCUMENT_EXPIRING_SOON_DAYS) {
      return DriverDocumentDisplayStatus.EXPIRING_SOON;
    }
    return DriverDocumentDisplayStatus.VERIFIED;
  }

  /**
   * fileUrlFor turns the multer disk path (e.g.
   * `uploads/driver-documents/<file>`) into the public-facing URL
   * (e.g. `/uploads/driver-documents/<file>`). Mirrors the pattern in
   * users.controller.ts so existing static-asset middleware serves both.
   */
  private fileUrlFor(diskPath: string): string {
    const norm = diskPath.replace(/\\/g, '/');
    return norm.startsWith('/') ? norm : `/${norm}`;
  }

  private removeFile(publicUrl: string | null | undefined): void {
    if (!publicUrl) return;
    // Strip the leading slash to convert the public URL back to a
    // relative disk path under the cwd.
    const relative = publicUrl.replace(/^\/+/, '');
    const abs = join(process.cwd(), relative);
    if (existsSync(abs)) {
      try {
        unlinkSync(abs);
      } catch {
        // Best-effort cleanup — never break the API call if disk fails.
      }
    }
  }
}
