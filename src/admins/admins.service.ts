import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Admin } from './admin.entity';
import { AdminRole } from '../shared/enums/admin-role.enum';

@Injectable()
export class AdminsService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminsRepo: Repository<Admin>,
  ) {}

  findByEmail(email: string): Promise<Admin | null> {
    return this.adminsRepo.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  findById(id: number): Promise<Admin | null> {
    return this.adminsRepo.findOneBy({ id });
  }

  async update(id: number, attrs: Partial<Admin>): Promise<Admin> {
    await this.adminsRepo.update(id, attrs);
    const updated = await this.findById(id);
    if (!updated) throw new NotFoundException('Admin not found');
    return updated;
  }

  list(): Promise<Admin[]> {
    return this.adminsRepo.find({ order: { id: 'DESC' } });
  }

  /**
   * Super-admin-only account creation (sellers, finance, ops…). The
   * temp password is set with mustChangePassword=true — the portal
   * forces a change on first login.
   */
  async create(attrs: {
    email: string;
    fullName: string;
    role: AdminRole;
    tempPassword: string;
  }): Promise<Admin> {
    const email = attrs.email.toLowerCase().trim();
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Email already in use');

    const admin = this.adminsRepo.create({
      email,
      fullName: attrs.fullName.trim(),
      role: attrs.role,
      passwordHash: await bcrypt.hash(attrs.tempPassword, 10),
      isActive: true,
      mustChangePassword: true,
    });
    return this.adminsRepo.save(admin);
  }
}
