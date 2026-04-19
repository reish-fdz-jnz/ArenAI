import React, { useState } from 'react';
import {
  IonPage,
  IonContent,
  IonCard,
  IonCardContent,
  IonText,
  IonHeader,
  IonToolbar,
  IonIcon,
  IonSelect,
  IonSelectOption,
  useIonRouter,
  IonBackButton,
  IonButtons
} from '@ionic/react';
import { trophyOutline, chevronBack } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import './StudentScores.css';

const StudentSectionPage: React.FC = () => {
  const { t } = useTranslation();
  const router = useIonRouter();

  type StudentScore = { username: string; score: number };
  type SubjectData = { [subject: string]: { [section: string]: StudentScore[] } };

  // Data organized by subject -> section -> students
  const subjectData: SubjectData = {
    Math: {
      '1': [
        { username: 'Yereth Soto', score: 82 },
        { username: 'Leonardo Escobar', score: 45 },
        { username: 'Barack Obama', score: 88 },
        { username: 'Alice Johnson', score: 92 },
        { username: 'Bob Martin', score: 78 },
        { username: 'Charlie Davis', score: 85 },
        { username: 'Sofia Mendez', score: 74 },
        { username: 'Michael Jordan', score: 96 },
        { username: 'Luis Fernandez', score: 67 },
      ],
      '2': [
        { username: 'Diana Wilson', score: 88 },
        { username: 'Edward Brown', score: 73 },
        { username: 'Fiona Garcia', score: 95 },
        { username: 'Camila Rojas', score: 79 },
        { username: 'Jose Martinez', score: 84 },
        { username: 'Natalie Portman', score: 91 },
        { username: 'Kevin Diaz', score: 65 },
        { username: 'Andrea Gomez', score: 77 },
        { username: 'Daniel Smith', score: 69 },
      ],
    },
    Science: {
      '1': [{ username: 'Yereth Soto', score: 88 }, { username: 'Leonardo Escobar', score: 52 }],
      '2': [{ username: 'Diana Wilson', score: 91 }]
    },
    'Social Studies': {
      '1': [{ username: 'Yereth Soto', score: 79 }],
      '2': [{ username: 'Diana Wilson', score: 85 }]
    },
    Spanish: {
      '1': [{ username: 'Yereth Soto', score: 94 }],
      '2': [{ username: 'Diana Wilson', score: 80 }]
    }
  };

  const [selectedSection, setSelectedSection] = useState('1');
  const [selectedGrade, setSelectedGrade] = useState('7');
  const [selectedSubject, setSelectedSubject] = useState('Math');

  const currentStudents = subjectData[selectedSubject] && subjectData[selectedSubject][selectedSection]
    ? subjectData[selectedSubject][selectedSection]
    : subjectData['Math'] && subjectData['Math']['1']
      ? subjectData['Math']['1']
      : [];

  const handleStudentClick = (username: string) => {
    const encodedUsername = encodeURIComponent(username);
    const encodedSubject = encodeURIComponent(selectedSubject);
    router.push(`/teacher-student-detail/${encodedUsername}/${encodedSubject}`);
  };

  const getScoreClass = (score: number) => {
    if (score >= 85) return 'score-high';
    if (score >= 70) return 'score-medium';
    return 'score-low';
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const averageScore = currentStudents.length > 0
    ? Math.round(currentStudents.reduce((sum, s) => sum + s.score, 0) / currentStudents.length)
    : 0;

  const sortedStudents = [...currentStudents].sort((a, b) => b.score - a.score);
  const top3 = sortedStudents.slice(0, 3);
  const others = sortedStudents.slice(3);

  return (
    <IonPage className="pst-page global-background-pattern">
      <IonHeader className="ion-no-border">
        <IonToolbar className="header-toolbar">
          <IonButtons slot="start">
            <IonBackButton
              defaultHref="/page/professor"
              text=""
              icon={chevronBack}
              style={{ color: 'var(--ion-color-primary)', fontSize: '24px' }}
            />
          </IonButtons>
          <div className="pst-header-brand">
            <span className="pst-brand-name">ArenAI</span>
            <span className="pst-brand-sub">ANALYTICS</span>
          </div>
        </IonToolbar>

        {/* Notched section for Title */}
        <div className="pst-notch-container">
          <div className="pst-notch">
            <div className="pst-title-pill">
              {t('professor.studentScores.title')}
            </div>
          </div>
        </div>
      </IonHeader>

      <IonContent fullscreen className="student-scores-content">
        <div className="dashboard-container">
          {/* Top Row: Class Average & Filters */}
          <div className="dashboard-top-row">
            <div className="avg-circle-container">
              <div className="avg-circle">
                <span className="avg-val">{averageScore}%</span>
                <span className="avg-lbl">{t('professor.studentScores.averageScore')}</span>
              </div>
              <svg className="avg-svg" viewBox="0 0 100 100">
                <circle className="avg-track" cx="50" cy="50" r="45" />
                <circle 
                  className="avg-fill" 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  style={{ strokeDashoffset: 283 - (283 * averageScore) / 100 }}
                />
              </svg>
            </div>

            <div className="header-controls">
              <div className="filter-pill">
                <span className="pill-label">{t('professor.studentScores.grade')}</span>
                <IonSelect
                  value={selectedGrade}
                  onIonChange={e => setSelectedGrade(e.detail.value)}
                  interface="popover"
                  toggleIcon=""
                >
                  <IonSelectOption value="7">7th</IonSelectOption>
                  <IonSelectOption value="8">8th</IonSelectOption>
                  <IonSelectOption value="9">9th</IonSelectOption>
                  <IonSelectOption value="10">10th</IonSelectOption>
                  <IonSelectOption value="11">11th</IonSelectOption>
                </IonSelect>
              </div>

              <div className="filter-pill">
                <span className="pill-label">{t('professor.studentScores.section')}</span>
                <IonSelect
                  value={selectedSection}
                  onIonChange={e => setSelectedSection(e.detail.value)}
                  interface="popover"
                  toggleIcon=""
                >
                  <IonSelectOption value="1">S-1</IonSelectOption>
                  <IonSelectOption value="2">S-2</IonSelectOption>
                  <IonSelectOption value="3">S-3</IonSelectOption>
                </IonSelect>
              </div>
            </div>
          </div>

          {/* Leaderboard Podium */}
          <div className="podium-container">
            {top3[1] && (
              <div className="podium-spot silver" onClick={() => handleStudentClick(top3[1].username)}>
                <div className="podium-avatar">{getInitials(top3[1].username)}</div>
                <div className="podium-rank">2</div>
                <div className="podium-name">{top3[1].username}</div>
                <div className="podium-score">{top3[1].score}%</div>
              </div>
            )}
            {top3[0] && (
              <div className="podium-spot gold" onClick={() => handleStudentClick(top3[0].username)}>
                <div className="podium-crown">👑</div>
                <div className="podium-avatar">{getInitials(top3[0].username)}</div>
                <div className="podium-rank">1</div>
                <div className="podium-name">{top3[0].username}</div>
                <div className="podium-score">{top3[0].score}%</div>
              </div>
            )}
            {top3[2] && (
              <div className="podium-spot bronze" onClick={() => handleStudentClick(top3[2].username)}>
                <div className="podium-avatar">{getInitials(top3[2].username)}</div>
                <div className="podium-rank">3</div>
                <div className="podium-name">{top3[2].username}</div>
                <div className="podium-score">{top3[2].score}%</div>
              </div>
            )}
          </div>

          {/* Remaining Students List */}
          <div className="others-list">
            <h3 className="list-title">Ranking de Clase</h3>
            {sortedStudents.slice(3).map((student, index) => (
              <div 
                key={index} 
                className={`ranking-row ${getScoreClass(student.score)}`}
                onClick={() => handleStudentClick(student.username)}
              >
                <span className="row-rank">{index + 4}</span>
                <div className="row-avatar">{getInitials(student.username)}</div>
                <span className="row-name">{student.username}</span>
                <span className="row-score">{student.score}%</span>
              </div>
            ))}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default StudentSectionPage;
