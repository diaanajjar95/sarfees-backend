import { ApiProperty } from '@nestjs/swagger';

export class FaqItemDto {
  @ApiProperty({ example: 'trip-book' })
  id: string;

  @ApiProperty({
    example: 'Trips',
    description: 'Localized category label for grouping in the UI.',
  })
  category: string;

  @ApiProperty({ example: 'How do I book an intercity trip?' })
  question: string;

  @ApiProperty({
    example:
      'From the home screen, tap Book a Trip. Pick your departure and arrival cities…',
  })
  answer: string;
}
