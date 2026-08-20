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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { PublicUser } from '../users/user.types';
import { CreateTimesheetEntryDto } from './dto/create-timesheet-entry.dto';
import { ListTimesheetEntriesDto } from './dto/list-timesheet-entries.dto';
import { UpdateTimesheetEntryDto } from './dto/update-timesheet-entry.dto';
import { TimesheetsService } from './timesheets.service';
import type { TimesheetEntry } from './timesheets.types';

@Controller('timesheet')
@UseGuards(JwtAuthGuard)
export class TimesheetsController {
  constructor(private readonly timesheetsService: TimesheetsService) {}

  @Get('options')
  getOptions(): Promise<{
    projects: Array<{
      id: string;
      name: string;
      color: string;
      tasks: Array<{ id: string; name: string }>;
    }>;
  }> {
    return this.timesheetsService.getOptions();
  }

  @Get('entries')
  listEntries(
    @CurrentUser() user: PublicUser,
    @Query() query: ListTimesheetEntriesDto,
  ): Promise<TimesheetEntry[]> {
    return this.timesheetsService.listEntries(user, query);
  }

  @Get('entries/:id')
  getEntry(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TimesheetEntry> {
    return this.timesheetsService.getEntry(user, id);
  }

  @Post('entries')
  createEntry(
    @CurrentUser() user: PublicUser,
    @Body() dto: CreateTimesheetEntryDto,
  ): Promise<TimesheetEntry> {
    return this.timesheetsService.createEntry(user, dto);
  }

  @Patch('entries/:id')
  updateEntry(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimesheetEntryDto,
  ): Promise<TimesheetEntry> {
    return this.timesheetsService.updateEntry(user, id, dto);
  }

  @Delete('entries/:id')
  deleteEntry(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    return this.timesheetsService.deleteEntry(user, id);
  }
}
