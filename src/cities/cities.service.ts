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
