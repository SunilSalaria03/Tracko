import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTimesheetEntryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'entryDate must be YYYY-MM-DD',
  })
  entryDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Notes are required' })
  @MaxLength(1000)
  description?: string;
}
