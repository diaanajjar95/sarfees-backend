import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A single FAQ entry, with both languages stored side by side. The public
 * `GET /faq` endpoint reads from this table and resolves to one language
 * server-side based on the request `Accept-Language` header.
 *
 * `displayOrder` controls list ordering (ASC). `isActive=false` hides the
 * row from the public endpoint but keeps it visible to admins.
 */
@Entity('faq_items')
@Index(['isActive', 'displayOrder'])
export class FaqItem {
  @PrimaryGeneratedColumn()
  id: number;

  /** Stable string id used by the mobile app for analytics / deep-link anchors */
  @Column({ unique: true })
  slug: string;

  @Column()
  categoryEn: string;

  @Column()
  categoryAr: string;

  @Column()
  questionEn: string;

  @Column()
  questionAr: string;

  @Column({ type: 'text' })
  answerEn: string;

  @Column({ type: 'text' })
  answerAr: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
