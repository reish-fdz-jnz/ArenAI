import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    IonPage,
    IonContent,
    IonIcon,
    IonHeader,
    IonToolbar,
    IonMenuButton,
    IonSearchbar,
    useIonRouter,
} from '@ionic/react';
import {
    menu,
    checkmarkCircle,
    closeCircle,
    timeOutline,
    checkmarkDoneOutline,
    closeOutline,
    alarmOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { CalendarSelector } from '../components/CalendarSelector';
import PageTransition from '../components/PageTransition';
import { useProfessorFilters } from '../hooks/useProfessorFilters';
import { getApiUrl } from '../config/api';
import '../components/StudentHeader.css';
import './ProfessorAttendance.css';

// Types
interface Student {
    id: number;
    username: string;
    email: string;
    avatar?: string;
}

type AttendanceStatus = 'present' | 'late' | 'absent';

interface AttendanceRecord {
    [studentId: number]: AttendanceStatus;
}

const GRADES = ['7', '8', '9', '10', '11', '12'];
const SECTIONS = ['1', '2', '3', '4'];
const SUBJECTS = ['Math', 'Science', 'Social Studies', 'Spanish'];

const ProfessorAttendance: React.FC = () => {
    const { t } = useTranslation();
    const ionRouter = useIonRouter();
    const { 
        selectedGrade, setSelectedGrade, 
        selectedSection, setSelectedSection, 
        selectedSubject, setSelectedSubject 
    } = useProfessorFilters();

    const [showDropdown, setShowDropdown] = useState(false);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [attendance, setAttendance] = useState<AttendanceRecord>({});
    const [activeSession, setActiveSession] = useState<any>(null);
    const [searchText, setSearchText] = useState('');
    const [loading, setLoading] = useState(true);

    // 1. Fetch Active Session
    useEffect(() => {
        const fetchState = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('authToken');
                // Use labels for lookup on backend if IDs aren't established yet
                const url = getApiUrl(`api/students?grade=${selectedGrade}&sectionNumber=${selectedSection}`);

                // Check active session - hardening with grade and sectionNumber lookup
                const sessionUrl = getApiUrl(`api/class-templates/active?grade=${selectedGrade}&sectionNumber=${selectedSection}`);
                const sessionRes = await fetch(sessionUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const session = await sessionRes.json();
                setActiveSession(session);

                if (session) {
                    // Fetch Students for this section using the improved route
                    const studentsRes = await fetch(url, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const studentsData = await studentsRes.json();
                    setStudents(studentsData.map((s: any) => ({
                        id: s.id_user,
                        username: `${s.name} ${s.last_name || ''}`,
                        email: s.email
                    })));

                    // Fetch Attendance for this specific class session
                    const attendanceRes = await fetch(getApiUrl(`api/class-templates/attendance/${session.id_class}`), {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const attendanceData = await attendanceRes.json();
                    
                    const attendanceMap: AttendanceRecord = {};
                    attendanceData.forEach((record: any) => {
                        // DB 1 = Present, 0 = Absent, 2 = Late (mapping)
                        let status: AttendanceStatus = 'present';
                        if (record.attendance === 0) status = 'absent';
                        else if (record.attendance === 2) status = 'late';
                        attendanceMap[record.id_user] = status;
                    });
                    setAttendance(attendanceMap);
                } else {
                    setStudents([]);
                    setAttendance({});
                }
            } catch (err) {
                console.error("Error fetching attendance data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchState();
    }, [selectedSection, selectedGrade, selectedSubject]);

    const syncWithBackend = async (studentId: number, status: AttendanceStatus) => {
        if (!activeSession) return;
        try {
            const token = localStorage.getItem('authToken');
            // Mapping UI status to DB status
            const dbStatus = status === 'present' ? 1 : (status === 'absent' ? 0 : 2);
            
            await fetch(getApiUrl(`api/class-templates/attendance/${activeSession.id_class}`), {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    students: [{ userId: studentId, attendance: dbStatus }]
                })
            });
        } catch (err) {
            console.error("Error syncing attendance:", err);
        }
    };

    const cycleAttendance = (studentId: number) => {
        if (!activeSession) return;
        const currentStatus: AttendanceStatus = attendance[studentId] ?? 'absent';

        let nextStatus: AttendanceStatus;
        if (currentStatus === 'absent') nextStatus = 'present';
        else if (currentStatus === 'present') nextStatus = 'late';
        else nextStatus = 'absent';

        setAttendance(prev => ({ ...prev, [studentId]: nextStatus }));
        syncWithBackend(studentId, nextStatus);
    };

    const getStatus = (studentId: number): AttendanceStatus => {
        return attendance[studentId] ?? 'absent';
    };

    const markAll = async (status: AttendanceStatus) => {
        if (!activeSession) return;
        const dbStatus = status === 'present' ? 1 : (status === 'absent' ? 0 : 2);
        
        const newAttendance = { ...attendance };
        const syncData = students.map(s => {
            newAttendance[s.id] = status;
            return { userId: s.id, attendance: dbStatus };
        });

        setAttendance(newAttendance);

        try {
            const token = localStorage.getItem('authToken');
            await fetch(getApiUrl(`api/class-templates/attendance/${activeSession.id_class}`), {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ students: syncData })
            });
        } catch (err) {
            console.error("Error syncing bulk attendance:", err);
        }
    };

    const getInitials = (name: string) => {
        const parts = name.split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.substring(0, 2).toUpperCase();
    };

    const getPresentCount = () => {
        return Object.values(attendance).filter(s => s === 'present').length;
    };

    const getLateCount = () => {
        return Object.values(attendance).filter(s => s === 'late').length;
    };

    const filteredStudents = students.filter(s =>
        s.username.toLowerCase().includes(searchText.toLowerCase())
    );

    const getStatusIcon = (status: AttendanceStatus) => {
        switch (status) {
            case 'present': return checkmarkCircle;
            case 'late': return timeOutline;
            case 'absent': return closeCircle;
        }
    };

    const getDisplayLabel = () => {
        const subjectLabel = t(`professor.dashboard.subjects.${selectedSubject.replace(/\s+/g, '')}`) || selectedSubject;
        return `${selectedGrade} - ${selectedSection} : ${subjectLabel}`;
    };

    return (
        <IonPage className="pa-page">
            <IonHeader className="student-header-container">
                <IonToolbar className="student-toolbar">
                    <div className="sh-content">
                        <div className="sh-menu-btn-container">
                            <IonMenuButton className="sh-menu-btn">
                                <IonIcon icon={menu} />
                            </IonMenuButton>
                        </div>
                    </div>
                </IonToolbar>

                <div className="sh-brand-container-absolute">
                    <div className="sh-brand-name">ArenAI</div>
                    <div className="sh-brand-sub">Attendance</div>
                </div>

                <div className="sh-notch-container">
                    <div className="sh-notch">
                        <div
                            className="sh-subject-display interactive"
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowDropdown(!showDropdown);
                            }}
                            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                        >
                            <span className="sh-subject-text pa-compact-text">
                                {getDisplayLabel()}
                            </span>
                        </div>
                    </div>
                </div>
            </IonHeader>

            {showDropdown && createPortal(
                <div className="pa-class-dropdown" onClick={(e) => e.stopPropagation()}>
                    <div className="pa-dropdown-section">
                        <div className="pa-dropdown-label">Grade</div>
                        <div className="pa-dropdown-options-row">
                            {GRADES.map(g => (
                                <div
                                    key={g}
                                    className={`pa-dropdown-chip ${selectedGrade.toString() === g ? 'selected' : ''}`}
                                    onClick={() => setSelectedGrade(parseInt(g, 10))}
                                >
                                    {g}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="pa-dropdown-section">
                        <div className="pa-dropdown-label">Section</div>
                        <div className="pa-dropdown-options-row">
                            {SECTIONS.map(s => (
                                <div
                                    key={s}
                                    className={`pa-dropdown-chip ${selectedSection === s ? 'selected' : ''}`}
                                    onClick={() => setSelectedSection(s)}
                                >
                                    {s}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="pa-dropdown-section">
                        <div className="pa-dropdown-label">Subject</div>
                        <div className="pa-dropdown-options-col">
                            {SUBJECTS.map(subj => (
                                <div
                                    key={subj}
                                    className={`pa-dropdown-option ${selectedSubject === subj ? 'selected' : ''}`}
                                    onClick={() => {
                                        setSelectedSubject(subj);
                                        setShowDropdown(false);
                                    }}
                                >
                                    {t(`professor.dashboard.subjects.${subj.replace(/\s+/g, '')}`) || subj}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <IonContent
                className="pa-content"
                fullscreen
                onClick={() => showDropdown && setShowDropdown(false)}
            >
                <PageTransition variant="fade">
                    <div className="pa-container">
                        <div className="pa-calendar-card">
                            <CalendarSelector
                                onDateSelect={(date) => setSelectedDate(date)}
                                title="Attendance"
                            />
                        </div>

                        <div className="pa-stats-bar">
                            <div className="pa-stats-counts">
                                <div className="pa-count-badge present">
                                    <IonIcon icon={checkmarkCircle} />
                                    <span>{getPresentCount()}</span>
                                </div>
                                <div className="pa-count-badge late">
                                    <IonIcon icon={timeOutline} />
                                    <span>{getLateCount()}</span>
                                </div>
                                <div className="pa-count-badge total">
                                    <span>{students.length} total</span>
                                </div>
                            </div>
                            <div className="pa-quick-actions">
                                <button className="pa-action-btn present" onClick={() => markAll('present')}>
                                    <IonIcon icon={checkmarkDoneOutline} />
                                </button>
                                <button className="pa-action-btn late" onClick={() => markAll('late')}>
                                    <IonIcon icon={alarmOutline} />
                                </button>
                                <button className="pa-action-btn absent" onClick={() => markAll('absent')}>
                                    <IonIcon icon={closeOutline} />
                                </button>
                            </div>
                        </div>

                        <div className="pa-search-container">
                            <IonSearchbar
                                className="pa-searchbar"
                                value={searchText}
                                onIonInput={(e) => setSearchText(e.detail.value || '')}
                                placeholder="Search students..."
                            />
                        </div>

                        <div className="pa-card">
                            <div className="pa-card-title">
                                {activeSession ? `Student List (${activeSession.name_session})` : 'Student List'}
                            </div>
                            <div className="pa-students-list">
                                {!activeSession ? (
                                    <div className="pa-no-session-warning">
                                        <IonIcon icon={closeCircle} />
                                        <p>No active session found for this section.</p>
                                        <button 
                                            className="pa-go-btn"
                                            onClick={() => ionRouter.push('/start-class-session')}
                                        >
                                            Go to Class Launcher
                                        </button>
                                    </div>
                                ) : filteredStudents.length === 0 ? (
                                    <div className="pa-empty-state">No students found in this section.</div>
                                ) : (
                                    filteredStudents.map(student => {
                                        const status = getStatus(student.id);
                                        return (
                                            <div
                                                key={student.id}
                                                className={`pa-student-item ${status}`}
                                                onClick={() => cycleAttendance(student.id)}
                                            >
                                                <div className="pa-student-avatar">
                                                    {getInitials(student.username)}
                                                </div>
                                                <div className="pa-student-info">
                                                    <span className="pa-student-name">{student.username}</span>
                                                    <span className="pa-student-email">{student.email}</span>
                                                </div>
                                                <div className={`pa-status-icon ${status}`}>
                                                    <IonIcon icon={getStatusIcon(status)} />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="pa-footer-spacer"></div>
                    </div>
                </PageTransition>
            </IonContent>
        </IonPage>
    );
};

export default ProfessorAttendance;
