import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  INVALID_RESET_CODE_MESSAGE,
} from './auth.constants';
import { SignUpDto } from './dto/signup.dto';
import { GoogleAuthClient } from './google-auth.client';
import { PublicUser } from '../users/user.types';

type CreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  authProvider: 'LOCAL' | 'GOOGLE';
  role: 'ADMIN' | 'EMPLOYEE';
};

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: {
    findById: jest.Mock;
    findByEmail: jest.Mock;
    findByGoogleId: jest.Mock;
    createUser: jest.Mock;
    linkGoogleId: jest.Mock;
    setPassword: jest.Mock;
    updatePassword: jest.Mock;
    invalidateResetChallenges: jest.Mock;
    createResetChallenge: jest.Mock;
    findActiveResetChallenge: jest.Mock;
    markChallengeVerified: jest.Mock;
    findVerifiedChallengeByTokenHash: jest.Mock;
    consumeChallenge: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };
  let googleAuthClient: { verifyAccessToken: jest.Mock };

  const signUpDto: SignUpDto = {
    firstName: 'Mukesh',
    lastName: 'Salaria',
    email: 'mukesh@example.com',
    password: 'Password123!',
  };

  beforeEach(async () => {
    authRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByGoogleId: jest.fn(),
      createUser: jest.fn(),
      linkGoogleId: jest.fn(),
      setPassword: jest.fn(),
      updatePassword: jest.fn(),
      invalidateResetChallenges: jest.fn(),
      createResetChallenge: jest.fn(),
      findActiveResetChallenge: jest.fn(),
      markChallengeVerified: jest.fn(),
      findVerifiedChallengeByTokenHash: jest.fn(),
      consumeChallenge: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
    };
    googleAuthClient = {
      verifyAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: authRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: GoogleAuthClient, useValue: googleAuthClient },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('15m'),
            get: jest.fn().mockReturnValue('development'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('hashes the password and never stores plaintext', async () => {
    authRepository.findByEmail.mockResolvedValue(null);
    authRepository.createUser.mockImplementation(
      async (input: CreateUserInput): Promise<PublicUser> => {
        expect(input.passwordHash).not.toBe(signUpDto.password);
        expect(
          await bcrypt.compare(signUpDto.password, input.passwordHash ?? ''),
        ).toBe(true);

        return {
          id: 'user-1',
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          role: 'EMPLOYEE',
          hasPassword: true,
          hasGoogle: false,
        };
      },
    );

    const user = await service.signUp(signUpDto);

    expect(user).toMatchObject({
      firstName: 'Mukesh',
      email: 'mukesh@example.com',
      role: 'EMPLOYEE',
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email', async () => {
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      firstName: 'Mukesh',
      lastName: 'Salaria',
      email: signUpDto.email,
      role: 'EMPLOYEE',
      hasPassword: true,
      hasGoogle: false,
      passwordHash: 'hash',
      googleId: null,
      authProvider: 'LOCAL',
    });

    await expect(service.signUp(signUpDto)).rejects.toMatchObject({
      message: EMAIL_ALREADY_REGISTERED_MESSAGE,
    });
    expect(authRepository.createUser).not.toHaveBeenCalled();
  });

  it('signs in with valid credentials and returns a JWT', async () => {
    const passwordHash = await bcrypt.hash(signUpDto.password, 12);
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      firstName: 'Mukesh',
      lastName: 'Salaria',
      email: signUpDto.email,
      role: 'EMPLOYEE',
      hasPassword: true,
      hasGoogle: false,
      passwordHash,
      googleId: null,
      authProvider: 'LOCAL',
    });

    const result = await service.signIn({
      email: signUpDto.email,
      password: signUpDto.password,
    });

    expect(result.token).toBe('signed-token');
    expect(result.user).toEqual({
      id: 'user-1',
      firstName: 'Mukesh',
      lastName: 'Salaria',
      email: signUpDto.email,
      role: 'EMPLOYEE',
      hasPassword: true,
      hasGoogle: false,
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: signUpDto.email,
      role: 'EMPLOYEE',
    });
  });

  it('rejects invalid credentials', async () => {
    authRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.signIn({
        email: signUpDto.email,
        password: signUpDto.password,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an incorrect password', async () => {
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      firstName: 'Mukesh',
      lastName: 'Salaria',
      email: signUpDto.email,
      role: 'EMPLOYEE',
      hasPassword: true,
      hasGoogle: false,
      passwordHash: await bcrypt.hash('OtherPassword123!', 12),
      googleId: null,
      authProvider: 'LOCAL',
    });

    await expect(
      service.signIn({
        email: signUpDto.email,
        password: signUpDto.password,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates a user from a verified Google account', async () => {
    googleAuthClient.verifyAccessToken.mockResolvedValue({
      googleId: 'google-1',
      email: 'nitesh@gmail.com',
      firstName: 'Nitesh',
      lastName: 'Vishwakarma',
    });
    authRepository.findByGoogleId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'user-google',
        firstName: 'Nitesh',
        lastName: 'Vishwakarma',
        email: 'nitesh@gmail.com',
        role: 'EMPLOYEE',
        hasPassword: false,
        hasGoogle: true,
        passwordHash: null,
        googleId: 'google-1',
        authProvider: 'GOOGLE',
      });
    authRepository.findByEmail.mockResolvedValue(null);
    authRepository.createUser.mockResolvedValue({
      id: 'user-google',
      firstName: 'Nitesh',
      lastName: 'Vishwakarma',
      email: 'nitesh@gmail.com',
      role: 'EMPLOYEE',
      hasPassword: false,
      hasGoogle: true,
    });

    const result = await service.signInWithGoogle('google-id-token');

    expect(authRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'nitesh@gmail.com',
        passwordHash: null,
        googleId: 'google-1',
        authProvider: 'GOOGLE',
      }),
    );
    expect(result.token).toBe('signed-token');
    expect(result.user.email).toBe('nitesh@gmail.com');
  });

  it('signs in an existing Google user without creating a duplicate', async () => {
    googleAuthClient.verifyAccessToken.mockResolvedValue({
      googleId: 'google-1',
      email: 'nitesh@gmail.com',
      firstName: 'Nitesh',
      lastName: 'Vishwakarma',
    });
    authRepository.findByGoogleId.mockResolvedValue({
      id: 'user-google',
      firstName: 'Nitesh',
      lastName: 'Vishwakarma',
      email: 'nitesh@gmail.com',
      role: 'EMPLOYEE',
      hasPassword: false,
      hasGoogle: true,
      passwordHash: null,
      googleId: 'google-1',
      authProvider: 'GOOGLE',
    });

    const result = await service.signInWithGoogle('google-id-token');

    expect(authRepository.createUser).not.toHaveBeenCalled();
    expect(result.user.id).toBe('user-google');
    expect(result.googleLinked).toBe(false);
  });

  it('creates a dummy Google user in development', async () => {
    authRepository.findByGoogleId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'dummy-user',
        firstName: 'Dummy',
        lastName: 'Google',
        email: 'dummy.google@tracko.local',
        role: 'EMPLOYEE',
        hasPassword: false,
        hasGoogle: true,
        passwordHash: null,
        googleId: 'dummy-google-local',
        authProvider: 'GOOGLE',
      });
    authRepository.findByEmail.mockResolvedValue(null);
    authRepository.createUser.mockResolvedValue({
      id: 'dummy-user',
      firstName: 'Dummy',
      lastName: 'Google',
      email: 'dummy.google@tracko.local',
      role: 'EMPLOYEE',
      hasPassword: false,
      hasGoogle: true,
    });

    const result = await service.signInWithDummyGoogle();

    expect(result.user.email).toBe('dummy.google@tracko.local');
    expect(authRepository.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        googleId: 'dummy-google-local',
        authProvider: 'GOOGLE',
        passwordHash: null,
      }),
    );
  });

  it('rejects password sign-in for a Google-only account without revealing the provider', async () => {
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-google',
      firstName: 'Nitesh',
      lastName: 'Vishwakarma',
      email: 'nitesh@gmail.com',
      role: 'EMPLOYEE',
      hasPassword: false,
      hasGoogle: true,
      passwordHash: null,
      googleId: 'google-1',
      authProvider: 'GOOGLE',
    });

    await expect(
      service.signIn({
        email: 'nitesh@gmail.com',
        password: 'Password123!',
      }),
    ).rejects.toMatchObject({
      message: INVALID_CREDENTIALS_MESSAGE,
    });
  });

  it('links Google to an existing password account with the same verified email', async () => {
    googleAuthClient.verifyAccessToken.mockResolvedValue({
      googleId: 'google-1',
      email: signUpDto.email,
      firstName: 'Mukesh',
      lastName: 'Salaria',
    });
    authRepository.findByGoogleId.mockResolvedValue(null);
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      firstName: 'Mukesh',
      lastName: 'Salaria',
      email: signUpDto.email,
      role: 'EMPLOYEE',
      hasPassword: true,
      hasGoogle: false,
      passwordHash: 'hash',
      googleId: null,
      authProvider: 'LOCAL',
    });
    authRepository.findById.mockResolvedValue({
      id: 'user-1',
      firstName: 'Mukesh',
      lastName: 'Salaria',
      email: signUpDto.email,
      role: 'EMPLOYEE',
      hasPassword: true,
      hasGoogle: true,
      passwordHash: 'hash',
      googleId: 'google-1',
      authProvider: 'LOCAL',
    });

    const result = await service.signInWithGoogle('google-id-token');

    expect(authRepository.createUser).not.toHaveBeenCalled();
    expect(authRepository.linkGoogleId).toHaveBeenCalledWith(
      'user-1',
      'google-1',
    );
    expect(result.user).toMatchObject({
      id: 'user-1',
      hasPassword: true,
      hasGoogle: true,
    });
    expect(result.googleLinked).toBe(true);
  });

  it('lets a Google-only user set a password', async () => {
    authRepository.findById.mockResolvedValue({
      id: 'user-google',
      firstName: 'Nitesh',
      lastName: 'Vishwakarma',
      email: 'nitesh@gmail.com',
      role: 'EMPLOYEE',
      hasPassword: false,
      hasGoogle: true,
      passwordHash: null,
      googleId: 'google-1',
      authProvider: 'GOOGLE',
    });
    authRepository.setPassword.mockImplementation(
      async (_userId: string, passwordHash: string) => ({
        id: 'user-google',
        firstName: 'Nitesh',
        lastName: 'Vishwakarma',
        email: 'nitesh@gmail.com',
        role: 'EMPLOYEE',
        hasPassword: true,
        hasGoogle: true,
        passwordHash,
        googleId: 'google-1',
        authProvider: 'GOOGLE',
      }),
    );

    const user = await service.setPassword('user-google', {
      password: 'Password123!',
    });

    expect(user).toMatchObject({
      id: 'user-google',
      hasPassword: true,
      hasGoogle: true,
    });
    expect(user).not.toHaveProperty('passwordHash');
    expect(authRepository.setPassword).toHaveBeenCalledWith(
      'user-google',
      expect.any(String),
    );
    const [, hash] = authRepository.setPassword.mock.calls[0] as [
      string,
      string,
    ];
    expect(await bcrypt.compare('Password123!', hash)).toBe(true);
  });

  it('rejects setting a password when one already exists', async () => {
    authRepository.findById.mockResolvedValue({
      id: 'user-1',
      firstName: 'Mukesh',
      lastName: 'Salaria',
      email: signUpDto.email,
      role: 'EMPLOYEE',
      hasPassword: true,
      hasGoogle: false,
      passwordHash: 'hash',
      googleId: null,
      authProvider: 'LOCAL',
    });

    await expect(
      service.setPassword('user-1', { password: 'Password123!' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(authRepository.setPassword).not.toHaveBeenCalled();
  });

  it('does not create a reset challenge for an unknown email', async () => {
    authRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.requestPasswordReset({ email: 'missing@example.com' }),
    ).resolves.toEqual({ ok: true });
    expect(authRepository.createResetChallenge).not.toHaveBeenCalled();
  });

  it('creates a reset code for an existing Google-only account', async () => {
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-google',
      firstName: 'Nitesh',
      lastName: 'Vishwakarma',
      email: 'nitesh@gmail.com',
      role: 'EMPLOYEE',
      hasPassword: false,
      hasGoogle: true,
      passwordHash: null,
      googleId: 'google-1',
      authProvider: 'GOOGLE',
    });

    const result = await service.requestPasswordReset({
      email: 'nitesh@gmail.com',
    });

    expect(result.ok).toBe(true);
    expect(result.devCode).toMatch(/^\d{6}$/);
    expect(authRepository.createResetChallenge).toHaveBeenCalled();
  });

  it('rejects an invalid reset code without revealing the account', async () => {
    authRepository.findActiveResetChallenge.mockResolvedValue(null);

    await expect(
      service.verifyResetCode({
        email: 'nitesh@gmail.com',
        code: '123456',
      }),
    ).rejects.toMatchObject({
      message: INVALID_RESET_CODE_MESSAGE,
    });
  });

  it('sets a password after a verified reset code', async () => {
    const codeHash = await bcrypt.hash('123456', 12);
    authRepository.findActiveResetChallenge.mockResolvedValue({
      id: 'challenge-1',
      email: 'nitesh@gmail.com',
      codeHash,
      resetTokenHash: null,
      expiresAt: new Date(Date.now() + 60_000),
      verifiedAt: null,
      consumedAt: null,
    });

    const { resetToken } = await service.verifyResetCode({
      email: 'nitesh@gmail.com',
      code: '123456',
    });

    expect(resetToken).toHaveLength(64);
    expect(authRepository.markChallengeVerified).toHaveBeenCalledWith(
      'challenge-1',
      expect.any(String),
    );

    authRepository.findVerifiedChallengeByTokenHash.mockResolvedValue({
      id: 'challenge-1',
      email: 'nitesh@gmail.com',
      codeHash,
      resetTokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 60_000),
      verifiedAt: new Date(),
      consumedAt: null,
    });
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-google',
      firstName: 'Nitesh',
      lastName: 'Vishwakarma',
      email: 'nitesh@gmail.com',
      role: 'EMPLOYEE',
      hasPassword: false,
      hasGoogle: true,
      passwordHash: null,
      googleId: 'google-1',
      authProvider: 'GOOGLE',
    });

    await expect(
      service.resetPassword({
        resetToken,
        password: 'Password123!',
      }),
    ).resolves.toEqual({ ok: true });

    expect(authRepository.updatePassword).toHaveBeenCalledWith(
      'user-google',
      expect.any(String),
    );
    expect(authRepository.consumeChallenge).toHaveBeenCalledWith('challenge-1');
  });
});
