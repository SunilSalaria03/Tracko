import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_PATTERN,
  normalizeEmailTransform,
} from './email.constraints';

export class SignUpDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @Transform(normalizeEmailTransform)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(EMAIL_MAX_LENGTH, {
    message: `Email must be at most ${EMAIL_MAX_LENGTH} characters`,
  })
  @Matches(EMAIL_PATTERN, {
    message: 'Enter a valid email address',
  })
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'Password must include uppercase, lowercase, number, and special character',
  })
  password!: string;
}
