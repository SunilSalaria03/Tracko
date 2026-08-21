import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { PublicUser } from '../users/user.types';
import {
  ApplyLeaveDto,
  ListLeaveQueryDto,
  ReviewLeaveDto,
} from './dto/leave.dto';
import { LeaveService } from './leave.service';

@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('balance')
  getBalance(@CurrentUser() user: PublicUser) {
    return this.leaveService.getMyBalance(user);
  }

  @Get('requests/me')
  listMine(@CurrentUser() user: PublicUser) {
    return this.leaveService.listMyRequests(user);
  }

  @Get('requests')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  listAll(
    @CurrentUser() user: PublicUser,
    @Query() query: ListLeaveQueryDto,
  ) {
    return this.leaveService.listAllRequests(user, query.status);
  }

  @Post('requests')
  apply(@CurrentUser() user: PublicUser, @Body() dto: ApplyLeaveDto) {
    return this.leaveService.apply(user, dto);
  }

  @Patch('requests/:id/review')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  review(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewLeaveDto,
  ) {
    return this.leaveService.review(user, id, dto);
  }

  @Delete('requests/:id')
  deleteMine(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaveService.deleteMyRequest(user, id);
  }
}
