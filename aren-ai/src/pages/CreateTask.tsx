import React, { useState, useEffect } from 'react';
import {
    IonContent,
    IonHeader,
    IonPage,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonButton,
    IonSegment,
    IonSegmentButton,
    IonIcon,
    IonRange,
    IonChip,
    IonGrid,
    IonRow,
    IonCol,
    useIonToast,
    useIonViewWillEnter
} from '@ionic/react';
import {
    schoolOutline,
    documentTextOutline,
    clipboardOutline,
    addCircleOutline,
    createOutline,
    chevronDownOutline,
    chevronUpOutline,
    bookOutline,
    checkmarkOutline
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { getApiUrl } from '../config/api';
import './CreateTask.css';
import { socketService } from '../services/socket';

// Mock Topics Data
const TOPICS_BY_SUBJECT: { [key: string]: string[] } = {
    'Mathematics': ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Trigonometry', 'Probability', 'LinearEq', 'Functions'],
    'Science': ['Biology', 'Chemistry', 'Physics', 'EarthSci', 'Astronomy', 'EnvSci'],
    'History': ['History', 'Geography', 'Civics', 'Economics', 'Culture', 'Govt'],
    'Literature': ['Vocab', 'Grammar', 'Reading', 'Writing', 'Speaking', 'Listening'],
    'Computer Science': ['Algorithms', 'DataStructures', 'WebDev', 'Databases', 'AI', 'Networking'],
    'Art': ['Painting', 'Sculpture', 'ArtHistory', 'ColorTheory', 'DigitalArt']
};

const SUBJECT_IDS: Record<string, number> = {
    'Mathematics': 1,
    'Science': 2,
    'History': 3,
    'Literature': 4,
    'Computer Science': 5,
    'Art': 6
};

const CreateTask: React.FC = () => {
    const { t } = useTranslation();
    const [recipientType, setRecipientType] = useState<'class' | 'student'>('class');
    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
    const [taskType, setTaskType] = useState<'quiz' | 'requirement'>('quiz');
    const [present] = useIonToast();

    // Quiz State
    const [subject, setSubject] = useState('');
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [isTopicsExpanded, setIsTopicsExpanded] = useState(false);
    const [questionCount, setQuestionCount] = useState(5);
    const [customPrompt, setCustomPrompt] = useState('');
    const [selectedQuizId, setSelectedQuizId] = useState<string>('');

    // Requirement State
    const [note, setNote] = useState('');

    // Data loaded from API
    const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
    const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
    const [savedQuizzes, setSavedQuizzes] = useState<{ id: string; name: string }[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    const subjects = Object.keys(TOPICS_BY_SUBJECT);

    const fetchData = async () => {
        try {
            setLoadingData(true);
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            };

            const userStr = localStorage.getItem('user') || localStorage.getItem('userData');
            const user = userStr ? JSON.parse(userStr) : null;
            const professorId = user?.id;

            if (professorId) {
                // Fetch classes
                const classesResponse = await fetch(getApiUrl(`api/classes?professorId=${professorId}`), { headers });
                if (classesResponse.ok) {
                    const classesData = await classesResponse.json();
                    setClasses(classesData.map((c: any) => ({ id: String(c.id_class), name: c.name_class })));
                }

                // Fetch quizzes
                const quizzesResponse = await fetch(getApiUrl(`api/quizzes/professor/${professorId}`), { headers });
                if (quizzesResponse.ok) {
                    const quizzesData = await quizzesResponse.json();
                    const list = quizzesData.quizzes || [];
                    setSavedQuizzes(list.map((q: any) => ({ id: String(q.id_quiz), name: q.name || q.quiz_name })));
                }
            }

            // Fetch students
            const sectionId = user?.sectionId || user?.id_section;
            if (sectionId) {
                const studentsResponse = await fetch(getApiUrl(`api/sections/${sectionId}/students`), { headers });
                if (studentsResponse.ok) {
                    const studentsData = await studentsResponse.json();
                    setStudents(studentsData.map((s: any) => ({
                        id: String(s.id),
                        name: `${s.name}${s.lastName ? ' ' + s.lastName : ''}`
                    })));
                }
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoadingData(false);
        }
    };

    useIonViewWillEnter(() => {
        fetchData();
    });

    // Socket Listener for real-time quiz updates
    useEffect(() => {
        const socket = socketService.socket;
        if (!socket) return;

        const handleQuizCreated = (data: any) => {
            console.log("[CreateTask] New quiz detected via socket, refreshing list...", data);
            fetchData();
        };

        socket.on('quiz_created', handleQuizCreated);
        return () => {
            socket.off('quiz_created', handleQuizCreated);
        };
    }, []);

    const handleCreateTask = async () => {
        if (selectedRecipients.length === 0) {
            present({ message: t('professor.createTask.alerts.selectRecipient'), duration: 2000, color: 'danger' });
            return;
        }

        if (taskType === 'quiz' && (!subject || selectedTopics.length === 0) && !selectedQuizId) {
            present({ message: t('professor.createTask.alerts.fillSubjectTopic'), duration: 2000, color: 'danger' });
            return;
        }

        if (taskType === 'requirement' && !note) {
            present({ message: t('professor.createTask.alerts.addNote'), duration: 2000, color: 'danger' });
            return;
        }

        try {
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            const userStr = localStorage.getItem('user') || localStorage.getItem('userData');
            const user = userStr ? JSON.parse(userStr) : null;
            const professorId = user?.id;

            const payloadBase = {
                title: selectedQuizId 
                    ? (savedQuizzes.find(q => q.id === selectedQuizId)?.name || 'Nueva Tarea')
                    : (taskType === 'quiz' ? `${subject}: ${selectedTopics.join(', ')}` : 'Nueva Tarea'),
                description: taskType === 'quiz' ? customPrompt : note,
                professorId: Number(professorId),
                subjectId: SUBJECT_IDS[subject] || 1,
                dueTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                quizId: selectedQuizId ? Number(selectedQuizId) : null,
            };

            for (const recipientId of selectedRecipients) {
                const payload = {
                    ...payloadBase,
                    sectionId: recipientType === 'class' ? Number(recipientId) : (user?.sectionId || 1),
                };

                await fetch(getApiUrl('api/assignments'), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });
            }

            present({ message: t('professor.createTask.alerts.success') || "¡Tarea creada y notificada!", duration: 2000, color: 'success' });

            // Reset
            setSelectedRecipients([]);
            setSubject('');
            setSelectedTopics([]);
            setNote('');
            setSelectedQuizId('');
        } catch (error) {
            console.error("Error creating task:", error);
            present({ message: "Error al crear la tarea", duration: 2000, color: 'danger' });
        }
    };

    const toggleTopic = (topicKey: string) => {
        setSelectedTopics(prev => prev.includes(topicKey) ? prev.filter(t => t !== topicKey) : [...prev, topicKey]);
    };

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/page/professor" />
                    </IonButtons>
                    <IonTitle>{t('professor.createTask.title')}</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent className="create-task-content">
                <div className="create-task-container">
                    {/* Recipients */}
                    <section className="form-section">
                        <h2 className="section-title"><IonIcon icon={schoolOutline} /> {t('professor.createTask.assignTo')}</h2>
                        <div className="recipient-toggle">
                            <IonSegment value={recipientType} onIonChange={e => setRecipientType(e.detail.value as any)}>
                                <IonSegmentButton value="class"><IonLabel>{t('professor.createTask.classes')}</IonLabel></IonSegmentButton>
                                <IonSegmentButton value="student"><IonLabel>{t('professor.createTask.students')}</IonLabel></IonSegmentButton>
                            </IonSegment>
                        </div>

                        <IonItem className="custom-select-item" lines="none">
                            <IonLabel position="stacked">{recipientType === 'class' ? t('professor.createTask.selectClasses') : t('professor.createTask.selectStudents')}</IonLabel>
                            <IonSelect multiple={true} value={selectedRecipients} onIonChange={e => setSelectedRecipients(e.detail.value)}>
                                {recipientType === 'class'
                                    ? classes.map(c => <IonSelectOption key={c.id} value={c.id}>{c.name}</IonSelectOption>)
                                    : students.map(s => <IonSelectOption key={s.id} value={s.id}>{s.name}</IonSelectOption>)
                                }
                            </IonSelect>
                        </IonItem>
                        <div className="selected-chips">
                            {selectedRecipients.map(id => {
                                const item = recipientType === 'class' ? classes.find(c => c.id === id) : students.find(s => s.id === id);
                                return item ? <IonChip key={id}>{item.name}</IonChip> : null;
                            })}
                        </div>
                    </section>

                    {/* Quiz Selection */}
                    {taskType === 'quiz' && (
                        <section className="form-section">
                            <h2 className="section-title"><IonIcon icon={bookOutline} /> {t('professor.createTask.selectQuiz', 'Seleccionar Quiz')}</h2>
                            <IonItem className="custom-select-item" lines="none">
                                <IonLabel position="stacked">{t('professor.createTask.savedQuizzes', 'Mis Quizzes Guardados')}</IonLabel>
                                <IonSelect value={selectedQuizId} onIonChange={e => setSelectedQuizId(e.detail.value)} placeholder="Elige un quiz de tu biblioteca">
                                    <IonSelectOption value="">{t('professor.createTask.newQuiz', '-- Generar Nuevo Quiz --')}</IonSelectOption>
                                    {savedQuizzes.map(q => <IonSelectOption key={q.id} value={q.id}>{q.name}</IonSelectOption>)}
                                </IonSelect>
                            </IonItem>
                            {selectedQuizId && (
                                <div className="quiz-selection-info fade-in-fast" style={{marginTop: '10px'}}>
                                    <IonChip color="success">
                                        <IonIcon icon={checkmarkOutline} />
                                        <IonLabel>{savedQuizzes.find(q => q.id === selectedQuizId)?.name}</IonLabel>
                                    </IonChip>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Task Type */}
                    <section className="form-section">
                        <h2 className="section-title"><IonIcon icon={createOutline} /> {t('professor.createTask.taskType')}</h2>
                        <div className="task-type-cards">
                            <div className={`type-card ${taskType === 'quiz' ? 'selected' : ''}`} onClick={() => setTaskType('quiz')}>
                                <div className="card-icon"><IonIcon icon={clipboardOutline} /></div>
                                <h3>{t('professor.createTask.quiz')}</h3>
                                <p>{t('professor.createTask.quizDesc')}</p>
                            </div>
                            <div className={`type-card ${taskType === 'requirement' ? 'selected' : ''}`} onClick={() => setTaskType('requirement')}>
                                <div className="card-icon"><IonIcon icon={documentTextOutline} /></div>
                                <h3>{t('professor.createTask.requirement')}</h3>
                                <p>{t('professor.createTask.requirementDesc')}</p>
                            </div>
                        </div>
                    </section>

                    {/* Form */}
                    <section className="form-section input-area">
                        {taskType === 'quiz' ? (
                            <div className="quiz-form fade-in">
                                {!selectedQuizId && (
                                    <>
                                        <h3 className="subsection-title">{t('professor.createTask.quizDetails')}</h3>
                                        <IonGrid className="no-padding-start">
                                            <IonRow>
                                                <IonCol size="12">
                                                    <IonItem className="custom-input-item" lines="none">
                                                        <IonLabel position="stacked">{t('professor.createTask.subject')}</IonLabel>
                                                        <IonSelect value={subject} onIonChange={e => {setSubject(e.detail.value); setSelectedTopics([]); setIsTopicsExpanded(true);}}>
                                                            {subjects.map(s => <IonSelectOption key={s} value={s}>{s}</IonSelectOption>)}
                                                        </IonSelect>
                                                    </IonItem>
                                                </IonCol>
                                                {subject && TOPICS_BY_SUBJECT[subject] && (
                                                    <IonCol size="12">
                                                        <div className="topics-expandable-container">
                                                            <div className="topics-header" onClick={() => setIsTopicsExpanded(!isTopicsExpanded)}>
                                                                <div className="topics-label"><IonIcon icon={bookOutline} className="topic-icon" /><span>{t('professor.createTask.selectTopics')} ({selectedTopics.length})</span></div>
                                                                <IonIcon icon={isTopicsExpanded ? chevronUpOutline : chevronDownOutline} />
                                                            </div>
                                                            {isTopicsExpanded && (
                                                                <div className="topics-list fade-in-fast">
                                                                    {TOPICS_BY_SUBJECT[subject].map(topicKey => (
                                                                        <div key={topicKey} className={`topic-checkbox-item ${selectedTopics.includes(topicKey) ? 'selected' : ''}`} onClick={() => toggleTopic(topicKey)}>
                                                                            <div className={`checkbox-circle ${selectedTopics.includes(topicKey) ? 'checked' : ''}`}>{selectedTopics.includes(topicKey) && <div className="inner-dot"></div>}</div>
                                                                            <span className="topic-name">{t(`professor.dashboard.topics.${topicKey}`, topicKey)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </IonCol>
                                                )}
                                            </IonRow>
                                        </IonGrid>
                                        <div className="range-container">
                                            <IonLabel>{t('professor.createTask.questionCount')}: {questionCount}</IonLabel>
                                            <IonRange min={1} max={20} pin={true} value={questionCount} onIonChange={e => setQuestionCount(e.detail.value as number)} color="secondary" />
                                        </div>
                                    </>
                                )}
                                <IonItem className="custom-input-item" lines="none">
                                    <IonLabel position="stacked">{t('professor.createTask.customPrompt')}</IonLabel>
                                    <IonTextarea rows={3} value={customPrompt} onIonChange={e => setCustomPrompt(e.detail.value!)} placeholder={t('professor.createTask.customPromptPlaceholder')} />
                                </IonItem>
                            </div>
                        ) : (
                            <div className="requirement-form fade-in">
                                <h3 className="subsection-title">{t('professor.createTask.requirementDetails')}</h3>
                                <IonItem className="custom-input-item" lines="none">
                                    <IonLabel position="stacked">{t('professor.createTask.description')}</IonLabel>
                                    <IonTextarea rows={6} value={note} onIonChange={e => setNote(e.detail.value!)} placeholder={t('professor.createTask.descriptionPlaceholder')} />
                                </IonItem>
                            </div>
                        )}
                    </section>

                    <div className="action-button-container">
                        <IonButton expand="block" className="create-button" onClick={handleCreateTask}>
                            <IonIcon slot="start" icon={addCircleOutline} />
                            {t('professor.createTask.createBtn')}
                        </IonButton>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default CreateTask;
