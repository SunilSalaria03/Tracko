import { Injectable } from '@nestjs/common';
import { PublicUser } from './user.types';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findById(id: string): Promise<PublicUser | null> {
    return this.usersRepository.findById(id);
  }
}
