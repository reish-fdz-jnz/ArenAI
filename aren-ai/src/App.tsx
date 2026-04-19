import {
  IonApp,
  IonRouterOutlet,
  IonSplitPane,
  setupIonicReact,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Redirect, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import ProfessorSidebar from "./components/ProfessorSidebar";
import StudentSidebar from "./components/StudentSidebar";
import Page from "./pages/Page";
import Chat from "./pages/Chatbot";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RegisterStudent from "./pages/RegisterStudent";
import Section_Creation from "./pages/Section_Creation";
import StudentSectionPage from "./pages/StudentScores";
import StudentDetail from "./pages/StudentDetail";
import Quiz from "./pages/Quiz";
import PersonalityQuiz from "./pages/PersonalityQuiz";
import Main_Prof from "./pages/Main_Prof";
import Main_Student from "./pages/Main_Student";
import Class_Join from "./pages/Class_Join";
import BattleMinigame from "./pages/BattleMinigame";
import BattleLobby from "./components/BattleLobby";
import SubjectDetail from "./pages/SubjectDetail";
import StudentProfile from "./pages/StudentProfile";
import CharacterDetail from "./pages/CharacterDetail";
import StudentSettings from "./pages/StudentSettings";
import Achievements from "./pages/Achievements";
import Leaderboard from "./pages/Leaderboard";
import Shop from "./pages/Shop";
import Clan from "./pages/Clan";
import Help from "./pages/Help";
import ProfessorAdmin from "./pages/ProfessorAdmin";
import ProfessorProfile from "./pages/ProfessorProfile";
import EditProfile from "./pages/EditProfile";
import ProfessorChat from "./pages/ProfessorChat";
import ProfessorSettings from "./pages/ProfessorSettings";
import AIQuizGenerator from "./pages/AIQuizGenerator";
import QuizPreview from "./pages/QuizPreview";
import TaskAssignment from "./pages/TaskAssignment";
import QuizMenu from "./pages/QuizMenu";
import AssignmentsMenu from "./pages/AssignmentsMenu";
import StudentAssignments from "./pages/StudentAssignments";
import EditAssignment from "./pages/EditAssignment";
import ProfessorAssignmentReview from "./pages/ProfessorAssignmentReview";
import CreateClassSession from "./pages/CreateClassSession";
import ClassLibrary from "./pages/ClassLibrary";
import AvatarSelection from "./pages/AvatarSelection";
import { ThemeProvider } from "./context/ThemeContext";
import { AvatarProvider } from "./context/AvatarContext";
import { ProfilePictureProvider } from "./context/ProfilePictureContext";
import { SoundProvider } from "./context/SoundContext";
import ChatMenu from "./pages/ChatMenu";
import StudentChat from "./pages/StudentChat";
import StartClassSession from "./pages/StartClassSession";
import ArenEntityPage from "./pages/ArenEntityPage";
import TopicDetail from "./pages/TopicDetail";
import { socketService } from "./services/socket";
import { chatStorage } from "./services/chatStorage";
import { App as CapApp } from "@capacitor/app";
import SessionExpiredModal from "./components/SessionExpiredModal";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "./theme/shared.css"; /* Global Shared Styles */

/* Optional CSS utils that can be commented out */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import "@ionic/react/css/palettes/dark.system.css";

/* Theme variables */
import "./theme/variables.css";

/* i18n */
import "./i18n";
import ProfessorStudents from "./pages/ProfessorStudents";
import ProfessorAttendance from "./pages/ProfessorAttendance";
import ProfessorTopicStats from "./pages/ProfessorTopicStats";
import ProfessorQuizResults from "./pages/ProfessorQuizResults";
import ProfessorStudentQuizDetail from "./pages/ProfessorStudentQuizDetail";

setupIonicReact();

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<"professor" | "student" | null>(
    null,
  );
  const [userData, setUserData] = useState<any>(null); // Add userData state
  const [isLoading, setIsLoading] = useState(true);
  const [isSessionExpired, setIsSessionExpired] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem("userRole") as
      | "professor"
      | "student"
      | null;
    const savedUserData = localStorage.getItem("userData"); // Load user data

    if (savedRole) {
      setUserRole(savedRole);
    } else {
      setUserRole(null);
    }

    if (savedUserData) {
      try {
        setUserData(JSON.parse(savedUserData));
      } catch (e) {
        console.error("Failed to parse user data", e);
        setUserData(null);
      }
    }

    setIsLoading(false);
  }, []);

  // === GLOBAL CHAT MESSAGE LISTENER ===
  // This stays active after login, always receiving messages
  useEffect(() => {
    if (!userRole) return; // Only run when logged in

    console.log("[App] Setting up global chat listener");
    socketService.connect();
    const socket = socketService.socket;

    if (socket) {
      // Remove any existing listener
      socket.off("receive_message");

      socket.on("receive_message", (data: any) => {
        const targetChatId = data.chatId || data.senderId;

        console.log(`[App Global Listener] Message received:`, {
          chatId: targetChatId,
          text: data.text.substring(0, 30),
          timestamp: data.timestamp,
        });

        // Save to chatStorage (single source of truth)
        if (targetChatId) {
          chatStorage.saveMessage(targetChatId, {
            id: Date.now() + Math.random(),
            text: data.text,
            isUser: false,
            timestamp: data.timestamp,
            senderName: data.senderName || "Friend",
          });
          console.log(
            `[App] Saved message to chatStorage for chat ${targetChatId}`,
          );
        }
      });
    }

    return () => {
      if (socketService.socket) {
        socketService.socket.off("receive_message");
        console.log("[App] Cleaned up global chat listener");
      }
    };
  }, [userRole]); // Re-run when userRole changes (login/logout)

  // === SESSION EXPIRY CHECK ===
  useEffect(() => {
    if (!userRole) return;

    const checkSession = () => {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      if (!token) {
        console.warn("[SessionCheck] No token found in localStorage.");
        return;
      }

      try {
        // More robust JWT decode to prevent premature logouts
        const parts = token.split(".");
        if (parts.length !== 3) {
          console.error("[SessionCheck] Invalid JWT format.");
          return;
        }

        const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const decodedJson = decodeURIComponent(
          atob(payloadBase64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        
        const payload = JSON.parse(decodedJson);

        if (payload.exp) {
          const currentTime = Math.floor(Date.now() / 1000);
          const timeRemaining = payload.exp - currentTime;
          
          // Add 15-minute (900s) leeway for time drift between server and client
          const timeWithLeeway = timeRemaining + 900; 

          console.log(`[SessionCheck] Token expires in ${Math.round(timeRemaining / 60)} minutes (with 15m drift buffer).`);
          
          if (timeWithLeeway < 0) {
            console.warn("[SessionCheck] Session expired (including leeway). Showing modal.");
            setIsSessionExpired(true);
          }
        }
      } catch (e) {
        console.error("[SessionCheck] Error decoding token expiry:", e);
      }
    };

    // Check immediately and then every minute
    checkSession();
    const intervalId = setInterval(checkSession, 60000);

    return () => clearInterval(intervalId);
  }, [userRole]);

  const handleSessionExpiredConfirm = () => {
    setIsSessionExpired(false);
    handleLogout();
    window.location.href = "/login";
  };

  // === DEEP LINK LISTENER FOR QR CODE JOINING ===
  useEffect(() => {
    const setupDeepLinks = async () => {
      await CapApp.addListener("appUrlOpen", (event: { url: string }) => {
        console.log("[App] Deep link received:", event.url);

        try {
          const url = new URL(event.url);
          let joinCode: string | null = null;

          if (url.protocol === "arenai:") {
            // Custom scheme: arenai://join/123
            // The host is "join" and the code is in the pathname
            const pathParts = url.pathname.split("/").filter(Boolean);
            if (url.host === "join") {
              joinCode = pathParts[0] || null;
            }
          } else {
            // HTTPS scheme: https://domain.com/join/123
            const pathParts = url.pathname.split("/").filter(Boolean);
            const joinIndex = pathParts.indexOf("join");
            if (joinIndex !== -1 && pathParts.length > joinIndex + 1) {
              joinCode = pathParts[joinIndex + 1];
            }
          }

          if (joinCode) {
            console.log("[App] Navigating to join class:", joinCode);
            // Use window.location for navigation to ensure it works even if router isn't ready
            window.location.href = `/join/${joinCode}`;
          }
        } catch (error) {
          console.error("[App] Error parsing deep link:", error);
        }
      });
    };

    setupDeepLinks();

    return () => {
      CapApp.removeAllListeners();
    };
  }, []);

  const handleLogin = (role: "professor" | "student", userData?: any) => {
    setUserRole(role);
    localStorage.setItem("userRole", role);
    if (userData) {
      setUserData(userData); // Set state
      localStorage.setItem("userData", JSON.stringify(userData));
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setUserData(null); // Clear state
    localStorage.removeItem("userData");
    localStorage.removeItem("userRole");
    // CRITICAL: Also remove the actual tokens to prevent stale session checks
    localStorage.removeItem("authToken");
    localStorage.removeItem("token");
    console.log("[App] Logged out successfully.");
  };

  const renderSidebar = () => {
    if (!userRole) return null;
    switch (userRole) {
      case "professor":
        return <ProfessorSidebar key="professor" onLogout={handleLogout} />;
      case "student":
        return <StudentSidebar key="student" onLogout={handleLogout} />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <IonApp>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <p>Loading...</p>
        </div>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <ProfilePictureProvider>
        <AvatarProvider>
          <ThemeProvider>
            <SoundProvider>
              <IonReactRouter>
                <IonSplitPane contentId="main" disabled={!userRole}>
                  {renderSidebar()}
                  <IonRouterOutlet id="main">
                    <Route path="/" exact={true}>
                      {userRole ? (
                        <Redirect
                          to={
                            userRole === "student"
                              ? "/page/student"
                              : "/page/professor"
                          }
                        />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    {/* Authentication Routes */}
                    <Route path="/login" exact={true}>
                      {userRole ? (
                        <Redirect
                          to={
                            userRole === "student"
                              ? "/page/student"
                              : "/page/professor"
                          }
                        />
                      ) : (
                        <Login onLogin={handleLogin} />
                      )}
                    </Route>

                    <Route path="/Register" exact={true}>
                      <Register />
                    </Route>
                    <Route path="/register-student" exact={true}>
                      <RegisterStudent />
                    </Route>

                    {/* Main Dashboard Routes */}
                    <Route path="/page/professor" exact={true}>
                      {userRole === "professor" ? (
                        <Main_Prof />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/page/student" exact={true}>
                      {userRole === "student" ? (
                        <Main_Student />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/quiz-menu" exact={true}>
                      {userRole === "student" ? (
                        <StudentAssignments />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/leaderboard" exact={true}>
                      {userRole === "student" ? (
                        <Leaderboard />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/leaderboard" exact={true}>
                      {userRole === "student" ? (
                        <Leaderboard />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    {/* Additional Features */}
                    <Route path="/section-creation" exact={true}>
                      {userRole === "professor" ? (
                        <Section_Creation />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/prof-students" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorStudents />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/prof-attendance" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorAttendance />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/topic-stats" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorTopicStats />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/page/task-assignment" exact={true}>
                      {userRole === "professor" ? (
                        <TaskAssignment />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/page/ai-quiz-generator" exact={true}>
                      {userRole === "professor" ? (
                        <AIQuizGenerator />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/page/quiz-preview" exact={true}>
                      {userRole === "professor" ? (
                        <QuizPreview />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/page/quiz-menu" exact={true}>
                      {userRole === "professor" ? (
                        <QuizMenu />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/page/assignments-menu" exact={true}>
                      {userRole === "professor" ? (
                        <AssignmentsMenu />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/page/assignment-results" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorQuizResults />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/prof-student-quiz-detail" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorStudentQuizDetail />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/page/edit-assignment/:id" exact={true}>
                      {userRole === "professor" ? (
                        <EditAssignment />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/page/assignment-review/:id" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorAssignmentReview />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    {/* Live Class Session Routes */}
                    <Route path="/create-class" exact={true}>
                      {userRole === "professor" ? (
                        <CreateClassSession />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/class-library" exact={true}>
                      {userRole === "professor" ? (
                        <ClassLibrary />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>
                    <Route path="/start-class-session" exact={true}>
                      {userRole === "professor" ? (
                        <StartClassSession />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/settings" exact={true}>
                      {userRole === "student" ? (
                        <StudentSettings />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/quiz" exact={true}>
                      {userRole === "student" ? (
                        <Quiz />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/personality-quiz" exact={true}>
                      {userRole === "student" ? (
                        <PersonalityQuiz />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/battleminigame" exact={true}>
                      {userRole === "student" ? (
                        <BattleMinigame></BattleMinigame>
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/battlelobby" exact={true}>
                      {userRole === "student" ? (
                        <BattleLobby></BattleLobby>
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/subject/:name" exact={true}>
                      {userRole === "student" ? (
                        <SubjectDetail />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/avatar-selection" exact={true}>
                      {userRole === "student" ? (
                        <AvatarSelection />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/profile" exact={true}>
                      {userRole === "student" ? (
                        <StudentProfile />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/character-detail" exact={true}>
                      {userRole === "student" ? (
                        <CharacterDetail />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/aren-entity" exact={true}>
                      {userRole === "student" ? (
                        <ArenEntityPage />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/page/topic/:id" exact={true}>
                      {userRole === "student" ? (
                        <TopicDetail />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/achievements" exact={true}>
                      {userRole === "student" ? (
                        <Achievements />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/chat" exact={true}>
                      {userRole ? <Chat /> : <Redirect to="/login" />}
                    </Route>

                    {/* Re-added New Chat Menu Route - Now for both Students and Professors */}
                    <Route path="/chat-menu" exact={true}>
                      {userRole === "student" || userRole === "professor" ? (
                        <ChatMenu />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/student-chat/:id" exact={true}>
                      {userRole === "student" || userRole === "professor" ? (
                        <StudentChat />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    {/* Students by section */}
                    <Route path="/student-section" exact={true}>
                      {userRole === "professor" ? (
                        <StudentSectionPage />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    {/* Student Detail Page */}
                    <Route
                      path="/teacher-student-detail/:username/:subject"
                      exact={true}
                    >
                      {userRole === "professor" ? (
                        <StudentDetail />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    {/* Professor Admin Page */}
                    <Route path="/teacher-admin" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorAdmin />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/professor-profile" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorProfile />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/edit-profile" exact={true}>
                      {userRole === "professor" ? (
                        <EditProfile />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/professor-chat" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorChat />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/professor-settings" exact={true}>
                      {userRole === "professor" ? (
                        <ProfessorSettings />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    <Route path="/help" exact={true}>
                      {userRole === "student" ? (
                        <Help />
                      ) : (
                        <Redirect to="/login" />
                      )}
                    </Route>

                    {/* Nueva ruta para unirse a clase por código o QR */}
                    <Route path="/join/:code?" exact={true}>
                      <Class_Join />
                    </Route>

                    {/* Generic folder route - must be LAST to avoid capturing specific routes */}
                    <Route path="/folder/:name" exact={true}>
                      {userRole ? <Page /> : <Redirect to="/login" />}
                    </Route>
                  </IonRouterOutlet>
                </IonSplitPane>
              </IonReactRouter>
            </SoundProvider>
          </ThemeProvider>
        </AvatarProvider>
      </ProfilePictureProvider>
      <SessionExpiredModal
        isOpen={isSessionExpired}
        onConfirm={handleSessionExpiredConfirm}
      />
    </IonApp>
  );
};

export default App;
