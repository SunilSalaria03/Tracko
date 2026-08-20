import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_PATTERN,
  normalizeEmailTransform,
} from './email.constraints';

export class VerifyResetCodeDto {
  @Transform(normalizeEmailTransform)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(EMAIL_MAX_LENGTH, {
    message: `Email must be at most ${EMAIL_MAX_LENGTH} characters`,
  })
  @Matches(EMAIL_PATTERN, {
    message: 'Enter a valid email address',
  })
  email!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  code!: string;
}
