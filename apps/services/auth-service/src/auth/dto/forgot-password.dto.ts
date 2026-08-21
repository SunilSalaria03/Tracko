import { Transform } from 'class-transformer';
import { IsEmail, Matches, MaxLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_PATTERN,
  normalizeEmailTransform,
} from './email.constraints';

export class ForgotPasswordDto {
  @Transform(normalizeEmailTransform)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(EMAIL_MAX_LENGTH, {
    message: `Email must be at most ${EMAIL_MAX_LENGTH} characters`,
  })
  @Matches(EMAIL_PATTERN, {
    message: 'Enter a valid email address',
  })
  email!: string;
}
