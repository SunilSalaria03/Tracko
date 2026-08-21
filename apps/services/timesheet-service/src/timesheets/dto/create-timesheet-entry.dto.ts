import { Type } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTimesheetEntryDto {
  @IsUUID()
  projectId!: string;

  @IsUUID()
  taskId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'entryDate must be YYYY-MM-DD',
  })
  entryDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(24)
  hours!: number;

  @IsString()
  @MinLength(1, { message: 'Notes are required' })
  @MaxLength(1000)
  description!: string;
}
