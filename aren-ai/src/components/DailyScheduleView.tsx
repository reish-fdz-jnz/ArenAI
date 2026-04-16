import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './DailyScheduleView.css';

export interface DailySession {
    id_class: number;
    name_session: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
    name_template?: string;
    topics?: any[];
}

interface DailyScheduleViewProps {
    date: Date;
    sessions: DailySession[];
    onSessionSelect: (session: DailySession) => void;
    selectedSessionId?: number;
}

export const DailyScheduleView: React.FC<DailyScheduleViewProps> = ({ 
    date, 
    sessions, 
    onSessionSelect,
    selectedSessionId 
}) => {
    const { t, i18n } = useTranslation();

    // Generate hours 00:00 to 23:00 to cover all possible timezones and sessions
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const timeToMinutes = (timeValue: string | null, defaultHour: number) => {
        if (!timeValue) return defaultHour * 60;
        
        // Handle "YYYY-MM-DDTHH:mm:ss" or Date objects
        const d = new Date(timeValue);
        if (!isNaN(d.getTime())) {
            return (d.getHours() * 60) + d.getMinutes();
        }

        // Fallback for raw "HH:mm:ss" or "HH:mm" time strings
        const parts = timeValue.split(':');
        if (parts.length >= 2) {
            return (Number(parts[0]) * 60) + Number(parts[1]);
        }

        return defaultHour * 60;
    };

    const formatTime = (timeValue: string | null, defaultTime: string) => {
        if (!timeValue) return defaultTime;
        const d = new Date(timeValue);
        if (!isNaN(d.getTime())) {
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        }
        return timeValue.substring(0, 5); // Fallback for raw time string "10:00:00"
    };

    const scheduleStartMinutes = 0 * 60;
    const scheduleEndMinutes = 24 * 60;
    const totalMinutes = scheduleEndMinutes - scheduleStartMinutes;

    const formattedDate = date.toLocaleDateString(i18n.language, { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });

    const now = new Date();
    const isToday = [
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    ].join('') === [
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    ].join('');

    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    const showCurrentTimeLine = isToday && currentMinutes >= scheduleStartMinutes && currentMinutes <= scheduleEndMinutes;
    const currentTopPercentage = ((currentMinutes - scheduleStartMinutes) / totalMinutes) * 100;

    return (
        <div className="daily-schedule-container">
            <div className="ds-header">{formattedDate}</div>
            
            <div className="ds-timeline-wrapper">
                {/* Time Axis */}
                <div className="ds-time-axis">
                    {hours.map(hour => (
                        <div key={hour} className="ds-hour-marker">
                            <span>{hour.toString().padStart(2, '0')}:00</span>
                        </div>
                    ))}
                </div>

                {/* Grid and Blocks Area */}
                <div className="ds-grid">
                    {/* Horizontal Grid lines */}
                    {hours.map(hour => (
                        <div key={hour} className="ds-grid-line"></div>
                    ))}

                    {/* Current Time Line */}
                    {showCurrentTimeLine && (
                        <div 
                            className="ds-current-time-line" 
                            style={{ top: `${currentTopPercentage}%` }}
                        >
                            <div className="ds-current-time-indicator">{now.getHours().toString().padStart(2, '0')}:{now.getMinutes().toString().padStart(2, '0')}</div>
                        </div>
                    )}

                    {/* Session Blocks */}
                    {sessions.map((session, index) => {
                        const startMin = timeToMinutes(session.start_time, 10);
                        const endMin = session.end_time ? timeToMinutes(session.end_time, 18) : startMin + 60; // Default 1 hour if no end_time
                        
                        let top = ((startMin - scheduleStartMinutes) / totalMinutes) * 100;
                        let height = ((endMin - startMin) / totalMinutes) * 100;

                        // Clamp to grid
                        if (top < 0) {
                            height += top;
                            top = 0;
                        }
                        if (top + height > 100) {
                            height = 100 - top;
                        }

                        if (height <= 0 || top >= 100) return null; // Outside display area

                        const isSelected = selectedSessionId === session.id_class;

                        return (
                            <div 
                                key={session.id_class}
                                className={`ds-session-block ${isSelected ? 'selected' : ''} ${session.status}`}
                                style={{ top: `${top}%`, height: `${height}%` }}
                                onClick={() => onSessionSelect(session)}
                            >
                                {session.status === 'running' && <div className="ds-running-badge">LIVE</div>}
                                <div className="ds-session-content">
                                    <h4 className="ds-session-title">{session.name_session || session.name_template || `${t('calendar.classProp', 'Class').split(' ')[0]} ${index + 1}`}</h4>
                                    <span className="ds-session-time">
                                        {formatTime(session.start_time, "10:00")} - {formatTime(session.end_time, "11:00")}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
