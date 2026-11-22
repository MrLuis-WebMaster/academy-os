import { z } from 'zod';

export const meetingProviders = ['MEET', 'ZOOM', 'CUSTOM'] as const;
export const sessionModes = ['ONLINE', 'ONSITE', 'HYBRID'] as const;

export const sessionInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  subjectId: z.string().trim().min(1),
  teacherId: z.string().trim().min(1),
  mode: z.enum(sessionModes),
  provider: z.enum(meetingProviders).nullable().optional(),
  meetingUrl: z.url().nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  capacity: z.number().int().min(1).max(500),
}).superRefine((session, ctx) => {
  if (Date.parse(session.startsAt) >= Date.parse(session.endsAt)) {
    ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' });
  }
  if (session.mode !== 'ONLINE' && (!session.location || session.location.length < 5)) {
    ctx.addIssue({ code: 'custom', path: ['location'], message: 'Location is required for onsite/hybrid classes' });
  }
  if (session.mode !== 'ONSITE' && !session.provider && !session.meetingUrl) {
    ctx.addIssue({ code: 'custom', path: ['provider'], message: 'Meeting provider or link required' });
  }
  if (session.mode !== 'ONSITE' && session.provider === 'CUSTOM' && !session.meetingUrl) {
    ctx.addIssue({ code: 'custom', path: ['meetingUrl'], message: 'Custom meetings need an URL' });
  }
});

export type SessionInput = z.infer<typeof sessionInputSchema>;

export function validateSession(input: unknown) {
  const result = sessionInputSchema.safeParse(input);
  return result.success
    ? { valid: true as const, data: result.data }
    : { valid: false as const, issues: result.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) };
}
