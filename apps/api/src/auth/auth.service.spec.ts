import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
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
    findByEmail: jest.Mock;
    findByGoogleId: jest.Mock;
    createUser: jest.Mock;
    linkGoogleId: jest.Mock;
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
      findByEmail: jest.fn(),
      findByGoogleId: jest.fn(),
      createUser: jest.fn(),
      linkGoogleId: jest.fn(),
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
      passwordHash: 'hash',
      googleId: null,
      authProvider: 'LOCAL',
    });

    await expect(service.signUp(signUpDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
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
      passwordHash: null,
      googleId: 'google-1',
      authProvider: 'GOOGLE',
    });

    const result = await service.signInWithGoogle('google-id-token');

    expect(authRepository.createUser).not.toHaveBeenCalled();
    expect(result.user.id).toBe('user-google');
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
});
