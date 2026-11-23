import {prisma} from '../../../lib/prisma.js';
import type {AnalyticsPeriod} from '../domain/analytics-period.js';
import type {AnalyticsRepository} from '../application/analytics-ports.js';
import {AnalyticsAccessDenied} from '../application/analytics-use-cases.js';

/** All measures are derived from persisted real events. No inferred students or revenue. */
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  async overview(workspaceId:string,actorId:string,start:Date,end:Date,period:AnalyticsPeriod){
    const membership=await prisma.workspaceMember.findFirst({
      where:{workspaceId,userId:actorId,role:{in:['OWNER','ADMIN']}},select:{id:true},
    });
    if(!membership)throw new AnalyticsAccessDenied();
    const dateWindow={gte:start,lt:end};
    const [
      students,teachers,courses,
      scheduled,completed,cancelled,bookedSeats,attendanceRecorded,
      practices,evidences,activeGoals,receipts,voided,
    ]=await Promise.all([
      prisma.workspaceMember.count({where:{workspaceId,role:'STUDENT'}}),
      prisma.teacherProfile.count({where:{workspaceId}}),
      prisma.course.count({where:{workspaceId}}),
      prisma.classSession.count({where:{workspaceId,status:'CONFIRMED',startsAt:dateWindow}}),
      prisma.classSession.count({where:{workspaceId,status:'COMPLETED',startsAt:dateWindow}}),
      prisma.classSession.count({where:{workspaceId,status:'CANCELLED',startsAt:dateWindow}}),
      prisma.classBooking.count({
        where:{workspaceId,status:'BOOKED',session:{workspaceId,startsAt:dateWindow}},
      }),
      prisma.classBooking.count({
        where:{workspaceId,attendance:{not:null},session:{workspaceId,startsAt:dateWindow}},
      }),
      prisma.activityAttempt.aggregate({
        where:{
          createdAt:dateWindow,
          activity:{reflection:{session:{workspaceId}}},
        },
        _count:{_all:true},_avg:{score:true},
      }),
      prisma.skillEvidence.count({where:{workspaceId,createdAt:dateWindow}}),
      prisma.learningGoal.count({where:{workspaceId,status:'ACTIVE'}}),
      prisma.paymentReceipt.aggregate({
        where:{workspaceId,voidedAt:null,receivedAt:dateWindow},
        _sum:{amountCOP:true},
      }),
      prisma.paymentReceipt.count({where:{workspaceId,voidedAt:dateWindow}}),
    ]);
    return {
      period,from:start,through:end,
      people:{students,teachers,courses},
      classes:{scheduled,completed,cancelled,bookedSeats,attendanceRecorded},
      learning:{
        practiceAttempts:practices._count._all,
        averagePracticeScore:practices._avg.score===null?null:Math.round(practices._avg.score),
        assessedCompetencies:evidences,activeGoals,
      },
      finances:{
        manualCollectedCOP:receipts._sum.amountCOP??0,
        voidedReceipts:voided,
      },
      notes:[
        'Indicadores calculados con datos reales registrados en esta academia y período.',
        'Cobros manuales: no representan pagos procesados ni ingresos bancarios conciliados.',
        'Resultados de prácticas: promedios por intento, no dominio certificado ni evaluaciones diagnósticas.',
        'Asistencia: se cuentan reservas con asistencia registrada, no estudiantes únicos.',
      ],
    };
  }
}
