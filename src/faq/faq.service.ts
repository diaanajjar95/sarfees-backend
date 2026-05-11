import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { I18nContext } from 'nestjs-i18n';
import { FaqItem } from './faq-item.entity';
import { FaqItemDto } from './dto/faq-item.dto';
import {
  AdminFaqItemDto,
  CreateFaqItemDto,
  UpdateFaqItemDto,
} from './dto/admin-faq.dto';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(FaqItem)
    private readonly repo: Repository<FaqItem>,
  ) {}

  /**
   * Public passenger endpoint. Returns ACTIVE entries only, localized to the
   * request's Accept-Language header (en or ar; defaults to en).
   */
  async listPublic(): Promise<FaqItemDto[]> {
    const rows = await this.repo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
    const lang = (I18nContext.current()?.lang ?? 'en') === 'ar' ? 'ar' : 'en';
    return rows.map<FaqItemDto>((f) => ({
      id: f.slug,
      category: lang === 'ar' ? f.categoryAr : f.categoryEn,
      question: lang === 'ar' ? f.questionAr : f.questionEn,
      answer: lang === 'ar' ? f.answerAr : f.answerEn,
    }));
  }

  /** Admin: all entries (active + inactive), bilingual, sorted by displayOrder. */
  async listAdmin(): Promise<AdminFaqItemDto[]> {
    const rows = await this.repo.find({
      order: { displayOrder: 'ASC', id: 'ASC' },
    });
    return rows.map(AdminFaqItemDto.from);
  }

  async findById(id: number): Promise<AdminFaqItemDto> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('FAQ item not found');
    return AdminFaqItemDto.from(row);
  }

  async create(dto: CreateFaqItemDto): Promise<AdminFaqItemDto> {
    try {
      const created = this.repo.create({
        slug: dto.slug,
        categoryEn: dto.categoryEn,
        categoryAr: dto.categoryAr,
        questionEn: dto.questionEn,
        questionAr: dto.questionAr,
        answerEn: dto.answerEn,
        answerAr: dto.answerAr,
        displayOrder: dto.displayOrder ?? 0,
        isActive: dto.isActive ?? true,
      });
      const saved = await this.repo.save(created);
      return AdminFaqItemDto.from(saved);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(
          `An FAQ item with slug "${dto.slug}" already exists`,
        );
      }
      throw err;
    }
  }

  async update(id: number, dto: UpdateFaqItemDto): Promise<AdminFaqItemDto> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ item not found');
    await this.repo.update(id, dto);
    const refreshed = await this.repo.findOne({ where: { id } });
    return AdminFaqItemDto.from(refreshed as FaqItem);
  }

  async remove(id: number): Promise<{ id: number }> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ item not found');
    await this.repo.delete(id);
    return { id };
  }
}
