import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from './admin.entity';

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
}
