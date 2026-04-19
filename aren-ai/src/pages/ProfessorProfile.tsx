import React from 'react';
import {
    IonContent,
    IonPage,
    IonIcon,
    IonButton,
    IonAccordion,
    IonAccordionGroup,
    IonItem,
    IonLabel,
    IonToggle,
    IonSelect,
    IonSelectOption,
    useIonRouter,
    IonAvatar
} from '@ionic/react';
import {
    person,
    moonOutline,
    notificationsOutline,
    helpCircleOutline,
    logOutOutline,
    colorPaletteOutline,
    pencilOutline
} from 'ionicons/icons';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';
import './ProfessorProfile.css';
import StudentHeader from '../components/StudentHeader';
import PageTransition from '../components/PageTransition';

const ProfessorProfile: React.FC = () => {
    const { theme, setTheme, availableThemes } = useTheme();
    const { t } = useTranslation();
    const router = useIonRouter();

    const handleLogout = () => {
        // Clear local storage and redirect
        localStorage.removeItem("userRole");
        localStorage.removeItem("userData");
        localStorage.removeItem("authToken");
        // Force reload or redirect to login
        window.location.href = '/login';
    };

    // Get dynamic user data
    const userDataStr = localStorage.getItem("userData");
    const userData = userDataStr ? JSON.parse(userDataStr) : null;
    const userName = userData ? `${userData.name} ${userData.last_name || ""}` : "Professor";
    const userEmail = userData ? userData.email : "professor@arenai.edu";

    return (
        <IonPage className="profile-page-premium">
            <StudentHeader pageTitle="professor.profile.title" showNotch={false} showBackButton={true} onBack={() => router.push('/page/professor')} />
            <IonContent fullscreen className="profile-content-premium">
                <PageTransition>
                    {/* HERO SECTION - Centered & Clean */}
                    <div className="profile-hero-card">
                        <div className="profile-bg-pattern"></div>

                        <div className="avatar-section-centered">
                            <div className="avatar-halo"></div>
                            <div className="avatar-frame-premium large">
                                {/* Use generic person icon or actual image if available */}
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    background: 'var(--ion-color-light)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '64px',
                                    color: 'var(--ion-color-medium)'
                                }}>
                                    <IonIcon icon={person} />
                                </div>
                                <div className="edit-icon-badge">
                                    <IonIcon icon={pencilOutline} />
                                </div>
                            </div>
                        </div>

                        <div className="player-identity-centered">
                            <h1>
                                {userName}
                            </h1>
                            <div className="identity-subtitle">
                                {t('professor.profile.role')}
                            </div>
                            <div className="identity-subtitle" style={{ fontSize: '12px', opacity: 0.7 }}>
                                {userEmail}
                            </div>
                        </div>
                    </div>

                    <div className="profile-content-container">

                        {/* APPEARANCE SETTINGS */}
                        <div className="section-header-modern">
                            <h3>
                                <IonIcon icon={colorPaletteOutline} />
                                {t('professor.profile.appearance')}
                            </h3>
                        </div>

                        <IonAccordionGroup className="floating-accordions">
                            <IonAccordion value="theme" className="modern-accordion">
                                <IonItem slot="header" lines="none" className="accordion-header-modern">
                                    <IonLabel>{t('professor.profile.theme')}</IonLabel>
                                </IonItem>
                                <div slot="content" className="accordion-content-modern" style={{ padding: '0 20px 20px 20px' }}>
                                    <IonSelect
                                        value={theme}
                                        interface="popover"
                                        onIonChange={e => setTheme(e.detail.value)}
                                        className="theme-select-full"
                                        style={{ width: '100%' }}
                                    >
                                        {availableThemes.map(th => (
                                            <IonSelectOption key={th} value={th}>
                                                {th === 'original-alter' ? 'Original (ALTER)' : th.charAt(0).toUpperCase() + th.slice(1)}
                                            </IonSelectOption>
                                        ))}
                                    </IonSelect>
                                </div>
                            </IonAccordion>
                        </IonAccordionGroup>

                        {/* NOTIFICATIONS SETTINGS */}
                        <div className="section-header-modern">
                            <h3>
                                <IonIcon icon={notificationsOutline} />
                                {t('professor.profile.notifications')}
                            </h3>
                        </div>

                        <div className="modern-accordion" style={{ padding: '0' }}>
                            <IonItem lines="full" className="accordion-header-modern">
                                <IonLabel>{t('professor.profile.classAlerts')}</IonLabel>
                                <IonToggle slot="end" checked={true} color="primary" />
                            </IonItem>
                            <IonItem lines="none" className="accordion-header-modern">
                                <IonIcon icon={moonOutline} slot="start" size="small" style={{ marginRight: '8px' }} />
                                <IonLabel>{t('professor.profile.dnd')}</IonLabel>
                                <IonToggle slot="end" checked={false} color="primary" />
                            </IonItem>
                        </div>


                        {/* SUPPORT & LOGOUT */}
                        <div className="section-header-modern">
                            <h3>
                                <IonIcon icon={helpCircleOutline} />
                                {t('professor.profile.support')}
                            </h3>
                        </div>

                        <div className="modern-accordion" onClick={() => { }}>
                            <IonItem button detail={true} lines="none" className="accordion-header-modern">
                                <IonLabel>{t('professor.profile.helpCenter')}</IonLabel>
                            </IonItem>
                        </div>

                        <div style={{ marginTop: '30px', marginBottom: '30px' }}>
                            <IonButton expand="block" color="danger" className="logout-btn-premium" onClick={handleLogout}>
                                <IonIcon slot="start" icon={logOutOutline} />
                                {t('professor.profile.logout')}
                            </IonButton>
                        </div>

                    </div>
                </PageTransition>
            </IonContent>
        </IonPage>
    );
};

export default ProfessorProfile;
