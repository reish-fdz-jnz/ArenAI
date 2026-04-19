import type { Request, Response } from 'express';
import { 
  listClassesForStudent, 
  getStudentClassTopics, 
  upsertStudentAttendance 
} from '../repositories/classRepository.js';
import { listTopicsByTemplate } from '../repositories/classTemplateRepository.js';
import { db } from '../db/pool.js';
import { computeUtcRangeForLocalDay } from '../utils/dateUtils.js';

export async function getActiveSessionForStudent(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    // Find any running class in any of the student's sections
    const classes = await listClassesForStudent(userId, { status: 'running' });
    
    if (!classes || classes.length === 0) {
      return res.status(200).json({ data: null });
    }

    const activeSession = classes[0]; // Take the first running session

    // Auto-join the student (mark attendance = 1)
    await upsertStudentAttendance(activeSession.id_class, userId, 1);
    
    // The previous listClassesForStudent call might not have the updated attendance
    activeSession.attendance = 1;

    // Get topics for the session template to show what the class is about
    if (activeSession.id_class_template) {
      const templateTopics = await listTopicsByTemplate(activeSession.id_class_template);
      
      // Get student's individual score per topic in this class
      const studentTopicScores = await getStudentClassTopics(activeSession.id_class, userId);
      const scoreMap = new Map(studentTopicScores.map((t: any) => [t.id_topic, t]));

      activeSession.topics = templateTopics.map(t => {
        const scores = scoreMap.get(t.id_topic);
        return {
          id_topic: t.id_topic,
          name_topic: t.name,
          score: (scores && scores.score !== undefined) ? scores.score : null,
          ai_summary: scores?.ai_summary ?? null
        };
      });
    } else {
      activeSession.topics = [];
    }

    res.status(200).json({ data: activeSession });
  } catch (err: any) {
    console.error('Error in getActiveSessionForStudent:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

export async function getSessionsByDateForStudent(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { date, timezoneOffset } = req.query;
    if (!date || !timezoneOffset) {
      return res.status(400).json({ message: 'date and timezoneOffset required' });
    }

    const offsetMinutes = parseInt(timezoneOffset as string, 10);
    const dateStr = date as string;

    const { startUtc, endUtc } = computeUtcRangeForLocalDay(dateStr, offsetMinutes);

    const matchMatches = await listClassesForStudent(userId, {
      startDate: startUtc.replace('T', ' ').substring(0, 19),
      endDate: endUtc.replace('T', ' ').substring(0, 19)
    });

    res.status(200).json(matchMatches);
  } catch (err: any) {
    console.error('Error in getSessionsByDateForStudent:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

export async function getSessionHistoryForStudent(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { timezoneOffset } = req.query;
    if (!timezoneOffset) {
      return res.status(400).json({ message: 'timezoneOffset required' });
    }
    
    const offsetMinutes = parseInt(timezoneOffset as string, 10);

    const result = await db.query<any>(
      `SELECT
          DATE(DATE_ADD(c.start_time, INTERVAL -? MINUTE)) as local_date,
          COUNT(*) as session_count
       FROM class c
       INNER JOIN user_section us ON us.id_section = c.id_section
       WHERE us.id_user = ?
       GROUP BY local_date`,
      [offsetMinutes, userId]
    );

    const history: Record<string, number> = {};
    for (const row of result.rows) {
      const dbDateStr = String(row.local_date); 
      let parsedDateText = dbDateStr;
      
      const potentialMatch = dbDateStr.match(/(\w+\s\w+\s\d+\s\d{4})/);
      if (potentialMatch) {
         const d = new Date(dbDateStr);
         if (!isNaN(d.getTime())) {
             const yyyy = d.getFullYear();
             const mm = String(d.getMonth() + 1).padStart(2, '0');
             const dd = String(d.getDate()).padStart(2, '0');
             parsedDateText = `${yyyy}-${mm}-${dd}`;
         }
      } else {
         const d = new Date(dbDateStr);
         if (!isNaN(d.getTime())) {
             const yyyy = d.getFullYear();
             const mm = String(d.getMonth() + 1).padStart(2, '0');
             const dd = String(d.getDate()).padStart(2, '0');
             parsedDateText = `${yyyy}-${mm}-${dd}`;
         }
      }
      history[parsedDateText] = Number(row.session_count);
    }

    res.status(200).json(history);
  } catch (err: any) {
    console.error('Error in getSessionHistoryForStudent:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

export async function getStudentSessionDetail(req: Request, res: Response) {
  try {
    // Left unimplemented for now if the by_date covers it. I'll implement just in case.
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const classId = parseInt(req.params.classId, 10);

    // Make sure they have access
    const classes = await listClassesForStudent(userId);
    const session = classes.find((c: any) => c.id_class === classId);
    
    if (!session) {
      return res.status(404).json({ message: 'Class not found' });
    }

    if (session.id_class_template) {
      const templateTopics = await listTopicsByTemplate(session.id_class_template);
      const studentTopicScores = await getStudentClassTopics(classId, userId);
      const scoreMap = new Map(studentTopicScores.map((t: any) => [t.id_topic, t]));

      session.topics = templateTopics.map(t => {
        const scores = scoreMap.get(t.id_topic);
        return {
          id_topic: t.id_topic,
          name_topic: t.name,
          score: (scores && scores.score !== undefined) ? scores.score : null,
          ai_summary: scores?.ai_summary ?? null
        };
      });
    } else {
      session.topics = [];
    }
    
    res.status(200).json({ data: session });

  } catch (err: any) {
    console.error('Error in getStudentSessionDetail:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
