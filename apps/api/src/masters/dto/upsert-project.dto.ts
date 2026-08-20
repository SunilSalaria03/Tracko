import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpsertProjectDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{6})$/, {
    message: 'Color must be a hex value like #188433',
  })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
