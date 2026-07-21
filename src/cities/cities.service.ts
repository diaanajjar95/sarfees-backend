import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './city.entity';
import { I18nContext } from 'nestjs-i18n';

@Injectable()
export class CitiesService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(City)
    private citiesRepository: Repository<City>,
  ) {}

  async onApplicationBootstrap() {
    const count = await this.citiesRepository.count();
    if (count === 0) {
      await this.citiesRepository.save([
        { nameEn: 'Amman', nameAr: 'عمان' },
        { nameEn: 'Irbid', nameAr: 'إربد' },
      ]);
      console.log('Seeded database with initial Cities limit (Amman, Irbid).');
    }
    await this.backfillGeometry();
  }

  /**
   * Backfills centerLat/Lng, exitGateLat/Lng, and serviceRadiusMeters on
   * cities that don't have them yet. Idempotent — only touches rows
   * where centerLat is still NULL. Exit gates point along the
   * Amman ↔ Irbid corridor.
   */
  private async backfillGeometry(): Promise<void> {
    const defaults: Array<{
      nameEn: string;
      centerLat: string;
      centerLng: string;
      exitGateLat: string;
      exitGateLng: string;
      serviceRadiusMeters: number;
    }> = [
      {
        nameEn: 'Amman',
        centerLat: '31.9539000',
        centerLng: '35.9106000',
        exitGateLat: '32.0750000',
        exitGateLng: '35.8500000',
        serviceRadiusMeters: 5000,
      },
      {
        nameEn: 'Irbid',
        centerLat: '32.5556000',
        centerLng: '35.8500000',
        exitGateLat: '32.4400000',
        exitGateLng: '35.8600000',
        serviceRadiusMeters: 5000,
      },
    ];
    for (const d of defaults) {
      await this.citiesRepository
        .createQueryBuilder()
        .update(City)
        .set({
          centerLat: d.centerLat,
          centerLng: d.centerLng,
          exitGateLat: d.exitGateLat,
          exitGateLng: d.exitGateLng,
          serviceRadiusMeters: d.serviceRadiusMeters,
        })
        .where('nameEn = :n AND centerLat IS NULL', { n: d.nameEn })
        .execute();
    }
  }

  async findAll() {
    const lang = I18nContext.current()?.lang || 'en';
    const cities = await this.citiesRepository.find({ order: { id: 'ASC' } });
    
    return cities.map(city => ({
      id: city.id,
      name: lang === 'ar' ? city.nameAr : city.nameEn,
    }));
  }
}
