import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { PublicUser } from '../users/user.types';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.paymentsService.listMine(user);
  }

  @Get('session/:sessionId')
  bySession(
    @CurrentUser() user: PublicUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.paymentsService.getBySession(sessionId, user);
  }

  @Get(':id')
  one(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return this.paymentsService.getMine(id, user);
  }

  @Post('checkout')
  checkout(@CurrentUser() user: PublicUser) {
    return this.paymentsService.createCheckout(user);
  }
}
