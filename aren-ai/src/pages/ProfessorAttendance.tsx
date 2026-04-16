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
    IonModal,
    useIonViewWillEnter,
    IonFooter
} from '@ionic/react';
import {
    menu,
    checkmarkCircle,
    closeCircle,
    timeOutline,
    checkmarkDoneOutline,
    closeOutline,
    alarmOutline,
    personCircleOutline,
    helpCircleOutline,
    createOutline
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { CalendarSelector } from '../components/CalendarSelector';
import PageTransition from '../components/PageTransition';
import { useProfessorFilters } from '../hooks/useProfessorFilters';
import { getApiUrl } from '../config/api';
import { DailyScheduleView, DailySession } from '../components/DailyScheduleView';
import '../components/StudentHeader.css';
import './ProfessorAttendance.css';

// Types
interface Student {
    id: number;
    username: string;
    email: string;
    avatar?: string;
}

type AttendanceStatus = 'present' | 'late' | 'absent' | 'unchecked';

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
    const [sessionMarkers, setSessionMarkers] = useState<Record<string, number>>({});
    const [dailySessions, setDailySessions] = useState<DailySession[]>([]);
    const [isManualDateSelection, setIsManualDateSelection] = useState(false);
    const [showScheduleView, setShowScheduleView] = useState(false);

    // Aliases State
    const [studentAliases, setStudentAliases] = useState<Record<number, { firstName: string, lastName: string }>>({});
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');

    // 1. Fetch Session History (for calendar dots)
    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const offset = new Date().getTimezoneOffset();
            const historyUrl = getApiUrl(`api/class-templates/history?grade=${selectedGrade}&sectionNumber=${selectedSection}&timezoneOffset=${offset}`);
            const res = await fetch(historyUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            const data = await res.json();
            if (data && typeof data === 'object') {
                setSessionMarkers(data);
            }
        } catch (err) {
            console.error("Error fetching session history:", err);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [selectedGrade, selectedSection]);

    useEffect(() => {
        const stored = localStorage.getItem('prof_student_aliases');
        if (stored) {
            try {
                setStudentAliases(JSON.parse(stored));
            } catch (e) {
                console.error("Error loading aliases:", e);
            }
        }
    }, []);

    // Use useIonViewWillEnter to force a refresh every time the user enters the page
    useIonViewWillEnter(() => {
        setIsManualDateSelection(false); // Reset manual selection when returning to the page
        fetchHistory(); // Sync calendar markers
        fetchState();   // Sync current session state
    });

    const handleDateSelect = (date: Date) => {
        setIsManualDateSelection(true);
        setSelectedDate(date);
        setShowScheduleView(true); // Always force open the popup on explicit click
        // fetchState will trigger via useEffect, but let's be sure
    };

    // 2. Fetch Sessions for Selected Date
    useEffect(() => {
        fetchState();
    }, [selectedDate, selectedSection, selectedGrade, selectedSubject]); // Removed isManualDateSelection from deps to control it better

    const fetchState = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('authToken');

            // --- ALWAYS FETCH STUDENTS FIRST ---
            const studentsUrl = getApiUrl(`api/students?grade=${selectedGrade}&sectionNumber=${selectedSection}`);
            const studentsRes = await fetch(studentsUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            const studentsData = await studentsRes.json();
            setStudents(studentsData.map((s: any) => ({
                id: s.id_user,
                username: `${s.name} ${s.last_name || ''}`,
                email: s.email,
                avatar: s.avatar
            })));
            
            // --- STEP 1: Check for an active session ONLY if we haven't manually picked a date ---
            let activeSessionData: any = null;
            if (!isManualDateSelection) {
                const activeRes = await fetch(getApiUrl(`api/class-templates/active`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (activeRes.ok) {
                    activeSessionData = await activeRes.json();
                    if (activeSessionData && activeSessionData.id_class) {
                        if (activeSessionData.section_grade) setSelectedGrade(activeSessionData.section_grade);
                        if (activeSessionData.section_name) setSelectedSection(activeSessionData.section_name);
                        
                        loadAttendanceForSession(activeSessionData, token, false);
                        setDailySessions([activeSessionData]);
                        // Removed early return so we also fetch previous sessions for the day
                    } else {
                        activeSessionData = null; // Ensure null if empty result
                    }
                }
            }

            // --- STEP 2: Fallback to Date Filtering ---
            const dateStr = [
                selectedDate.getFullYear(),
                String(selectedDate.getMonth() + 1).padStart(2, '0'),
                String(selectedDate.getDate()).padStart(2, '0')
            ].join('-');

            const offset = new Date().getTimezoneOffset();
            const sessionUrl = getApiUrl(`api/class-templates/by-date?date=${dateStr}&grade=${selectedGrade}&sectionNumber=${selectedSection}&timezoneOffset=${offset}`);
            const sessionRes = await fetch(sessionUrl, { headers: { 'Authorization': `Bearer ${token}` } });
            const sessionsObj = await sessionRes.json();
            
            const sessions: DailySession[] = Array.isArray(sessionsObj) ? sessionsObj : (sessionsObj && sessionsObj.id_class ? [sessionsObj] : []);
            
            setDailySessions(prev => {
                const merged = [...sessions];
                if (activeSessionData && !merged.some(s => s.id_class === activeSessionData.id_class)) {
                    merged.push(activeSessionData);
                }
                return merged;
            });

            // Logic to auto-select or pop up schedule view
            const runningSession = sessions.find(s => s.status === 'running');
            
            if (runningSession && !isManualDateSelection) {
                // Auto-load running session only if not manual pick
                loadAttendanceForSession(runningSession, token, false);
            } else if (sessions.length === 1 && !isManualDateSelection) {
                // Auto-load single session only if not manual pick
                loadAttendanceForSession(sessions[0], token, false);
            } else if (isManualDateSelection) {
                // If user manually tapped, ENSURE the view stays open for them to pick
                // even if there is only 1 or 0 (it will show "No sessions" in the view)
                setShowScheduleView(true);
            } else if (!activeSessionData) {
                // ONLY clear if we didn't find an active session in Step 1
                setActiveSession(null);
                setAttendance({});
                setShowScheduleView(false);
            }

        } catch (err) {
            console.error("Error fetching data:", err);
            // Clear on error too
            setActiveSession(null);
            setAttendance({});
        } finally {
            setLoading(false);
        }
    };

    const loadAttendanceForSession = async (session: DailySession, tokenStr?: string | null, preventHideSchedule?: boolean) => {
        const token = tokenStr || localStorage.getItem('authToken');
        setActiveSession(session);
        if (!preventHideSchedule) {
            setShowScheduleView(false);
        } else {
            // Keep schedule view strictly based on how many sessions we have currently loaded
            setShowScheduleView(dailySessions.length > 1);
        }
        try {
            const attendanceRes = await fetch(getApiUrl(`api/class-templates/attendance/${session.id_class}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const attendanceData = await attendanceRes.json();
            
            const attendanceMap: AttendanceRecord = {};
            attendanceData.forEach((record: any) => {
                let status: AttendanceStatus = 'unchecked';
                if (record.attendance === 1) status = 'present';
                else if (record.attendance === 0) status = 'absent';
                else if (record.attendance === 2) status = 'late';
                attendanceMap[record.id_user] = status;
            });
            setAttendance(attendanceMap);
        } catch (error) {
            console.error("Error loading specific attendance:", error);
        }
    };

    const syncWithBackend = async (studentId: number, status: AttendanceStatus) => {
        if (!activeSession) return;
        try {
            const token = localStorage.getItem('authToken');
            // Mapping UI status to DB status
            const dbStatus = status === 'present' ? 1 : (status === 'absent' ? 0 : (status === 'late' ? 2 : null));
            
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
        const currentStatus: AttendanceStatus = attendance[studentId] ?? 'unchecked';

        let nextStatus: AttendanceStatus;
        if (currentStatus === 'unchecked') nextStatus = 'present';
        else if (currentStatus === 'present') nextStatus = 'late';
        else if (currentStatus === 'late') nextStatus = 'absent';
        else nextStatus = 'unchecked';

        setAttendance(prev => ({ ...prev, [studentId]: nextStatus }));
        syncWithBackend(studentId, nextStatus);
    };

    const getStatus = (studentId: number): AttendanceStatus => {
        return attendance[studentId] ?? 'unchecked';
    };

    const markAll = async (status: AttendanceStatus) => {
        if (!activeSession) return;
        const dbStatus = status === 'present' ? 1 : (status === 'absent' ? 0 : (status === 'late' ? 2 : null));
        
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

    const getStudentDisplayName = (student: Student) => {
        const alias = studentAliases[student.id];
        if (alias && (alias.firstName || alias.lastName)) {
            return `${alias.firstName} ${alias.lastName}`.trim();
        }
        return student.username;
    };

    const filteredStudents = students.filter(s => {
        const query = searchText.toLowerCase();
        const displayName = getStudentDisplayName(s).toLowerCase();
        const originalName = s.username.toLowerCase();
        return displayName.includes(query) || originalName.includes(query);
    });

    const openEditModal = (e: React.MouseEvent, student: Student) => {
        e.stopPropagation();
        setEditingStudentId(student.id);
        const alias = studentAliases[student.id] || { firstName: '', lastName: '' };
        setEditFirstName(alias.firstName);
        setEditLastName(alias.lastName);
        setShowEditModal(true);
    };

    const saveAlias = () => {
        if (editingStudentId !== null) {
            const newAliases = {
                ...studentAliases,
                [editingStudentId]: { firstName: editFirstName, lastName: editLastName }
            };
            setStudentAliases(newAliases);
            localStorage.setItem('prof_student_aliases', JSON.stringify(newAliases));
        }
        setShowEditModal(false);
    };

    const getStatusIcon = (status: AttendanceStatus) => {
        switch (status) {
            case 'present': return checkmarkCircle;
            case 'late': return timeOutline;
            case 'absent': return closeCircle;
            case 'unchecked': return helpCircleOutline;
        }
    };

    const getDisplayLabel = () => {
        const subjectLabel = t(`professor.dashboard.subjects.${selectedSubject.replace(/\s+/g, '')}`) || selectedSubject;
        return `${selectedGrade} - ${selectedSection} : ${subjectLabel}`;
    };

    const getColorForPercentage = (p: number) => {
        const ratio = Math.max(0, Math.min(100, p)) / 100;
        const r = Math.round(255 + (120 - 255) * ratio);
        const g = Math.round(82 + (184 - 82) * ratio);
        const b = Math.round(82 + (176 - 82) * ratio);
        return `rgb(${r}, ${g}, ${b})`;
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
                    <div className="sh-brand-sub">{t('professor.attendance.title', 'Attendance')}</div>
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
                        <div className="pa-dropdown-label">{t('taskAssignment.gradeFilter', 'Grade')}</div>
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
                        <div className="pa-dropdown-label">{t('taskAssignment.searchSections', 'Section').replace('...', '')}</div>
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
                        <div className="pa-dropdown-label">{t('quizGenerator.selectSubject', 'Subject')}</div>
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
                    <div className="quiz-container">
                        <div className="quiz-card" style={{ marginTop: '10px' }}>
                            <div className="quiz-card-title">{t('professor.attendance.calendar_title', 'Session Calendar')}</div>
                            <div className="pa-calendar-wrapper">
                                <CalendarSelector
                                    onDateSelect={handleDateSelect}
                                    title={t('professor.attendance.title', 'Attendance')}
                                    sessionMarkers={sessionMarkers}
                                />
                            </div>
                        </div>

                        {showScheduleView && (
                            <div className="quiz-card" style={{ marginTop: '20px', position: 'relative' }}>
                                <IonIcon 
                                    icon={closeCircle} 
                                    style={{ 
                                        position: 'absolute', 
                                        top: '12px', 
                                        right: '12px', 
                                        fontSize: '28px', 
                                        color: 'color-mix(in srgb, var(--ion-color-primary) 30%, #111)', 
                                        cursor: 'pointer',
                                        zIndex: 10,
                                        opacity: 0.95
                                    }} 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowScheduleView(false);
                                    }}
                                />
                                <div className="quiz-card-title">{t('professor.attendance.timeline', 'Daily Timeline')}</div>
                                <DailyScheduleView 
                                    date={selectedDate}
                                    sessions={dailySessions}
                                    onSessionSelect={(session) => loadAttendanceForSession(session, null, false)}
                                    selectedSessionId={activeSession?.id_class}
                                />
                            </div>
                        )}

                        {!showScheduleView && (
                            <>
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
                                    <span>{students.length} {t('professor.attendance.total', 'total')}</span>
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
                                placeholder={t('professor.attendance.search', 'Search students...')}
                            />
                        </div>

                        <div className="quiz-card">
                            <div className="quiz-card-title">
                                {activeSession ? `${t('professor.attendance.student_list', 'Student List')} (${activeSession.name_session})` : t('professor.attendance.student_list', 'Student List')}
                            </div>
                            <div className="pa-students-list">
                                {!activeSession ? (
                                    <div className="pa-no-session-warning">
                                        <IonIcon icon={closeCircle} />
                                        <p>{t('professor.attendance.no_session', 'No active session found for this section.')}</p>
                                        <button 
                                            className="pa-go-btn"
                                            onClick={() => ionRouter.push('/start-class-session')}
                                        >
                                            {t('professor.attendance.go_to_launcher', 'Go to Class Launcher')}
                                        </button>
                                    </div>
                                ) : filteredStudents.length === 0 ? (
                                    <div className="pa-empty-state">{t('professor.attendance.no_students', 'No students found in this section.')}</div>
                                ) : (
                                    filteredStudents.map(student => {
                                        const status = getStatus(student.id);
                                        return (
                                            <div
                                                key={student.id}
                                                className={`pa-student-item ${status}`}
                                                onClick={() => cycleAttendance(student.id)}
                                            >
                                                <div className="pa-student-avatar" style={{ overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' }}>
                                                    {student.avatar ? (
                                                        <img src={student.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Profile" />
                                                    ) : (
                                                        <IonIcon icon={personCircleOutline} style={{ fontSize: '40px', color: '#9e9e9e' }} />
                                                    )}
                                                </div>
                                                <div className="pa-student-info">
                                                    <span className="pa-student-name">{getStudentDisplayName(student)}</span>
                                                    <span className="pa-student-email">{student.email}</span>
                                                </div>
                                                <div className="pa-item-actions">
                                                    <IonIcon 
                                                        icon={createOutline} 
                                                        className="pa-edit-alias-icon" 
                                                        onClick={(e) => openEditModal(e, student)}
                                                    />
                                                    <div className={`pa-status-icon ${status}`}>
                                                        <IonIcon icon={getStatusIcon(status)} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        </>
                        )}

                        <div className="quiz-footer-spacer"></div>
                    </div>
                </PageTransition>
            </IonContent>

            <IonFooter className="quiz-footer">
                <div className="quiz-footer-notch">
                    <button 
                        className="quiz-generate-btn"
                        onClick={() => ionRouter.push('/page/professor')}
                        style={{ background: 'var(--ion-color-secondary)' }}
                    >
                        {t('professor.attendance.finish_return_short', 'Return to Menu')}
                    </button>
                </div>
            </IonFooter>

            <IonModal
                isOpen={showEditModal}
                onDidDismiss={() => setShowEditModal(false)}
                className="quiz-name-modal"
            >
                <div className="quiz-modal-inner">
                    <h2 className="quiz-modal-title">{t('professor.attendance.edit_identifier')}</h2>

                    <div className="pa-alias-inputs">
                        <div className="quiz-input-wrapper">
                            <label className="pa-input-label">{t('professor.attendance.first_name')}</label>
                            <input
                                type="text"
                                className="quiz-modal-input-field"
                                value={editFirstName}
                                onChange={(e) => setEditFirstName(e.target.value)}
                                placeholder={t('professor.attendance.first_name')}
                            />
                        </div>
                        <div className="quiz-input-wrapper">
                            <label className="pa-input-label">{t('professor.attendance.last_name')}</label>
                            <input
                                type="text"
                                className="quiz-modal-input-field"
                                value={editLastName}
                                onChange={(e) => setEditLastName(e.target.value)}
                                placeholder={t('professor.attendance.last_name')}
                            />
                        </div>
                    </div>

                    <div className="quiz-modal-buttons">
                        <button
                            className="quiz-modal-btn cancel"
                            onClick={() => setShowEditModal(false)}
                        >
                            {t('common.cancel') || "Cancel"}
                        </button>
                        <button className="quiz-modal-btn save" onClick={saveAlias}>
                            {t('common.save') || "Save"}
                        </button>
                    </div>
                </div>
            </IonModal>
        </IonPage>
    );
};

export default ProfessorAttendance;
