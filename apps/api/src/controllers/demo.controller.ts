import { Body, Controller, Get, Post } from '@nestjs/common';
import { validateSession } from '../domain/sessions.js';
import { Public } from '../auth/public.js';

@Public()
@Controller()
export class DemoController {
  @Get('health')
  health() {
    return { ok: true, product: 'AcademyOS', mode: 'demo', version: '0.1.0' };
  }

  @Get('capabilities')
  capabilities() {
    return {
      mode: 'demo',
      workspaces: ['SOLO', 'ACADEMY'],
      subjectsPerTeacher: 'multiple',
      sessionModes: ['ONLINE', 'ONSITE', 'HYBRID'],
      videoProvidersPlanned: ['GOOGLE_MEET', 'ZOOM'],
      storageProvidersPlanned: ['GOOGLE_DRIVE', 'ONEDRIVE', 'DROPBOX'],
      modules: ['CORE', 'CLASS_ALIVE', 'PASSPORT', 'PROFE_STUDIO', 'PROFE_SOS'],
    };
  }

  @Post('sessions/validate')
  validate(@Body() payload: unknown) {
    return validateSession(payload);
  }
}
