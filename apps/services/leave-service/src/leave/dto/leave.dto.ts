import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { DaySession, LeaveType } from '../leave.types';

export class ApplyLeaveDto {
  @IsIn(['SICK', 'CASUAL', 'UNPAID'])
  leaveType!: LeaveType;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be YYYY-MM-DD',
  })
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be YYYY-MM-DD',
  })
  endDate!: string;

  @IsIn(['FULL', 'FIRST_HALF', 'SECOND_HALF'])
  startSession!: DaySession;

  @IsIn(['FULL', 'FIRST_HALF', 'SECOND_HALF'])
  endSession!: DaySession;

  @IsString()
  @MinLength(1, { message: 'Reason is required' })
  @MaxLength(1000)
  reason!: string;
}

export class ReviewLeaveDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @ValidateIf((dto: ReviewLeaveDto) => dto.status === 'REJECTED')
  @IsString()
  @MinLength(1, { message: 'Rejection reason is required' })
  @MaxLength(500)
  reviewNote?: string;

  @ValidateIf((dto: ReviewLeaveDto) => dto.status === 'APPROVED')
  @IsOptional()
  @IsString()
  @MaxLength(500)
  approveNote?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(365)
  approvedDays?: number;

  @ValidateIf(
    (dto: ReviewLeaveDto) =>
      dto.status === 'APPROVED' && dto.approvedDays !== undefined,
  )
  @IsOptional()
  @IsString()
  @MaxLength(500)
  daysEditReason?: string;
}

export class ListLeaveQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsUUID()
  userId?: string;
}
