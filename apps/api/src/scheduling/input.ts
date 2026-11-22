import { z } from 'zod';

export const bookingInput = z.object({
  title: z.string().trim().min(3).max(120),
  courseId: z.string().optional(),
  teacherProfileId: z.string().min(1),
  mode: z.enum(['ONLINE','ONSITE','HYBRID']),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  capacity: z.number().int().min(1).max(500).default(1),
  location: z.string().trim().max(300).optional(),
  meetingUrl: z.url().max(2048).optional(),
}).superRefine((input,ctx)=>{
  if(Date.parse(input.startsAt)>=Date.parse(input.endsAt)) ctx.addIssue({code:'custom',path:['endsAt'],message:'End must follow start'});
  if(input.mode!=='ONLINE' && (!input.location || input.location.length<5)) ctx.addIssue({code:'custom',path:['location'],message:'Location required for onsite and hybrid sessions'});
  if(input.mode!=='ONSITE' && !input.meetingUrl) ctx.addIssue({code:'custom',path:['meetingUrl'],message:'Provide a meeting link until Google/Zoom OAuth integrations are connected'});
  if(input.meetingUrl && !/^https:\/\//.test(input.meetingUrl)) ctx.addIssue({code:'custom',path:['meetingUrl'],message:'HTTPS meeting link required'});
});
