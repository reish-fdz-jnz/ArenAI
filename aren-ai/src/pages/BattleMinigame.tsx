import React, { useState, useEffect, useRef } from "react";
import {
  IonContent,
  IonPage,
  IonIcon,
  IonButton,
  IonGrid,
  IonRow,
  IonCol,
  useIonViewWillLeave,
  useIonViewWillEnter,
} from "@ionic/react";
import { arrowForward, close } from "ionicons/icons";
import { useTranslation } from "react-i18next";
import { useLocation, useHistory } from "react-router-dom";
import { socketService } from "../services/socket";
import StudentSidebar from "../components/StudentSidebar";
import StudentHeader from "../components/StudentHeader";
import BattleResultModal from "../components/BattleResultModal";
import "./BattleMinigame.css";
import "./BattleResultsStats.css";
import { BattleQuestions } from "../data/questions";
import { battleStatsService } from "../services/battleStats";
import { progressionService } from "../services/progressionService";

// --- Interfaces (Must match Backend) ---

interface Player {
  userId: string;
  socketId: string;
  name: string;
  avatar: string;
  score: number;
  health: number;
  maxHealth: number;
  winStreak: number;
  utilizationIndex: number;
  isDisconnected: boolean;
  hasAnswered: boolean;
}

type GameStatus = "waiting" | "playing" | "round_result" | "finished";

interface GameSnapshot {
  roomId: string; // Unique
  status: GameStatus;
  players: Record<string, Player>;
  currentQuestionIndex: number;
  roundEndTime: number;
  isSuddenDeath?: boolean; // New flag for visual timer
  questions?: any[];
}

// --- Component ---

const BattleMinigame: React.FC = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation<{
    roomId: string;
    opponent: Record<string, unknown>;
    myAvatar: string;
  }>();
  const roomId = location.state?.roomId;

  // Questions State (Dynamic or Fallback)
  const [questions, setQuestions] = useState<any[]>(BattleQuestions);

  // --- State ---
  const [status, setStatus] = useState<GameStatus>("waiting");
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [questionIndex, setQuestionIndex] = useState(0);

  // Visual Timer State
  const [isSuddenDeath, setIsSuddenDeath] = useState(false);
  const [visualTimeLeft, setVisualTimeLeft] = useState(0);

  // Derived Local State
  const [myId, setMyId] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showQuestionPopup, setShowQuestionPopup] = useState(false); // Restore Popup

  // UI/Animation State
  const [showResults, setShowResults] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [battleStats, setBattleStats] = useState({ winRate: 0, streak: 0 });
  const [xpGained, setXpGained] = useState(0);

  // Animation Triggers
  const [playerAttackAnim, setPlayerAttackAnim] = useState(false);
  const [opponentAttackAnim, setOpponentAttackAnim] = useState(false);
  const [playerDamageAnim, setPlayerDamageAnim] = useState(false);
  const [opponentDamageAnim, setOpponentDamageAnim] = useState(false);
  const [damageAmount, setDamageAmount] = useState(0);
  const [showCritical, setShowCritical] = useState(false);
  // Restored Features State
  const [progress, setProgress] = useState(0);
  const [playerHitAnim, setPlayerHitAnim] = useState(false);
  const [opponentHitAnim, setOpponentHitAnim] = useState(false);
  const [showDamageAnimation, setShowDamageAnimation] = useState(false);
  const [damageTarget, setDamageTarget] = useState<"player" | "opponent">(
    "opponent",
  );

  // Scrolling Text
  const scrollingTextRef = useRef<HTMLDivElement>(null);
  const [scrollingTextPos, setScrollingTextPos] = useState(0);
  const animRef = useRef<number | null>(null);

  // Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const hitSoundRef = useRef<HTMLAudioElement | null>(null);
  const criticalSoundRef = useRef<HTMLAudioElement | null>(null);

  // --- Refs for Stale Closure Fix ---
  const playersRef = useRef(players);
  const myIdRef = useRef(myId);

  useEffect(() => {
    playersRef.current = players;
    myIdRef.current = myId;
  }, [players, myId]);

  // --- Computed ---
  const me = myId ? players[myId] : null;
  const opponentId = Object.keys(players).find((id) => id !== myId);
  const opponent = opponentId ? players[opponentId] : null;

  const currentQuestion =
    questions.length > 0
      ? questions[questionIndex % questions.length]
      : BattleQuestions[0]; // Fallback safety

  // --- Audio Functions ---
  const playHitSound = () => {
    if (hitSoundRef.current) {
      hitSoundRef.current.currentTime = 0;
      hitSoundRef.current
        .play()
        .catch((e) => console.warn("Hit sound failed", e));
    }
  };

  const playCriticalSound = () => {
    if (criticalSoundRef.current) {
      criticalSoundRef.current.currentTime = 0;
      criticalSoundRef.current
        .play()
        .catch((e) => console.warn("Crit sound failed", e));
    }
  };

  // --- Audio Lifecycle ---
  useEffect(() => {
    // BGM
    const bgm = new Audio("/assets/battlesong.mp3");
    bgm.loop = true;
    bgm.volume = 0;
    bgmRef.current = bgm;

    // SFX
    const hit = new Audio("/assets/hit-sound.mp3");
    hit.volume = 0.6;
    hitSoundRef.current = hit;

    const critical = new Audio("/assets/critical-hit-sound.mp3");
    critical.volume = 0.7;
    criticalSoundRef.current = critical;

    // Fade In
    const fadeIn = setInterval(() => {
      if (bgm.volume < 0.3) bgm.volume += 0.05;
      else clearInterval(fadeIn);
    }, 500);

    // Initial Play
    bgm.play().catch((e) => console.warn("Audio autoplay blocked", e));

    return () => {
      clearInterval(fadeIn);
      bgm.pause();
      bgmRef.current = null;
      hitSoundRef.current = null;
      criticalSoundRef.current = null;
    };
  }, []);

  useIonViewWillLeave(() => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current.currentTime = 0;
    }
  });

  useIonViewWillEnter(() => {
    if (bgmRef.current && bgmRef.current.paused) {
      bgmRef.current.play().catch((e) => console.warn("Resume BGM failed:", e));
    }
  });

  // --- Scrolling Text Animation ---
  useEffect(() => {
    const animate = () => {
      setScrollingTextPos((prev) => {
        const width = scrollingTextRef.current?.clientWidth || 0;
        const parentWidth =
          scrollingTextRef.current?.parentElement?.clientWidth || 0;
        if (width > parentWidth) {
          const next = prev - 0.5;
          return next < -width ? parentWidth : next;
        }
        return 0;
      });
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current!);
  }, [currentQuestion]);

  // --- Restore Popup Progress Logic ---
  useEffect(() => {
    if (showQuestionPopup && selectedAnswer === null) {
      const duration = 8000;
      const interval = 50;
      const increment = 100 / (duration / interval);

      setProgress(0); // Reset start

      const progressTimer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressTimer);
            return 100;
          }
          return prev + increment;
        });
      }, interval);

      const timer = setTimeout(() => {
        setShowQuestionPopup(false);
        clearInterval(progressTimer);
      }, duration);

      return () => {
        clearTimeout(timer);
        clearInterval(progressTimer);
      };
    } else {
      setProgress(0);
    }
  }, [currentQuestion, showQuestionPopup, selectedAnswer]);

  // --- Socket Logic ---
  useEffect(() => {
    if (!roomId) {
      history.replace("/page/student");
      return;
    }

    socketService.connect();
    const socket = socketService.socket;

    if (socket) {
      // 1. Initial Sync Request
      socket.emit("join_match_session", { roomId });

      // 2. Listeners
      socket.on("sync_state", (state: GameSnapshot) => {
        console.log("[Sync] Received Snapshot:", state);

        // Deduce ID logic (Same as before)
        const myP = Object.values(state.players).find(
          (p) => p.socketId === socket.id,
        );
        if (myP) setMyId(myP.userId);
        else {
          const localUser = JSON.parse(
            localStorage.getItem("userData") || "{}",
          );
          const matchName = Object.values(state.players).find(
            (p) => p.name === localUser.name,
          );
          if (matchName) setMyId(matchName.userId);
        }

        // Apply State
        setStatus(state.status);
        setPlayers(state.players);
        setQuestionIndex(state.currentQuestionIndex);

        // Update questions if provided (and we don't have them yet or should overwrite)
        if (state.questions && state.questions.length > 0) {
          setQuestions(state.questions);
        }

        // Sudden Death Sync
        setIsSuddenDeath(!!state.isSuddenDeath);
        if (state.isSuddenDeath && state.status === "playing") {
          startCountdown(state.roundEndTime);
        } else {
          setVisualTimeLeft(0);
        }

        // Show Popup on new Round
        if (state.status === "playing") {
          // Simplification: Always show popup if not answered.
        }
      });

      socket.on("round_ready", () => {
        setSelectedAnswer(null); // Explicit reset
        setShowQuestionPopup(true);
        setIsSuddenDeath(false);
        // Hide popup after time
        setTimeout(() => setShowQuestionPopup(false), 5000);
      });

      socket.on("round_result", (data: Record<string, any>) => {
        console.log("Round Result:", data);
        setStatus("round_result");
        setDamageAmount(data.damage);

        // Critical
        if (data.isCritical) {
          setShowCritical(true);
          playCriticalSound();
          setTimeout(() => setShowCritical(false), 2500);
        }

        // Calculate Winner for Animation
        // Calculate Winner for Animation (ROBUST LOOKUP)
        const currentPlayers = playersRef.current;
        const currentSocketId = socket.id;

        // Find MY UserID by looking for my SocketID in the players list
        // This is the most robust way because it bypasses string prefixes/formats.
        const myRealId = Object.keys(currentPlayers).find(
          (uid) => currentPlayers[uid].socketId === currentSocketId,
        );

        console.log(
          `[Animation Debug] Winner=${data.winnerId}, Me=${myRealId}, Sock=${currentSocketId}`,
        );

        const isMe = data.winnerId === myRealId;

        // Animation Sequence (matching Old Code)
        // Animation Sequence (matching Old Code)
        if (isMe) {
          setPlayerAttackAnim(true);
          setDamageTarget("opponent");
          setTimeout(() => playHitSound(), 300);
          setTimeout(() => {
            setShowDamageAnimation(true);
            setOpponentHitAnim(true); // Distinct Hit State

            // ROBUST HEALTH UPDATE: Use server authoritative data
            setPlayers((prev) => {
              // Target is the Opponent (Not Me)
              // We use myRealId to be consistent with the Derived Identity check above
              const oppId = Object.keys(prev).find((id) => id !== myRealId);

              // Fallback or safety check
              if (!oppId) return prev;

              // Use the Final Health sent by server for this ID
              const finalHealth = data.healths
                ? data.healths[oppId]
                : prev[oppId].health - data.damage;

              return {
                ...prev,
                [oppId]: {
                  ...prev[oppId],
                  health: Math.max(0, finalHealth),
                },
              };
            });
          }, 600);
        } else if (data.winnerId !== "draw") {
          setOpponentAttackAnim(true);
          setDamageTarget("player");
          setTimeout(() => playHitSound(), 300);
          setTimeout(() => {
            setShowDamageAnimation(true);
            setPlayerHitAnim(true); // Distinct Hit State

            // ROBUST HEALTH UPDATE: Use server authoritative data
            setPlayers((prev) => {
              // Target is ME (myRealId)
              if (!myRealId) return prev; // Should not happen if logic holds

              const finalHealth = data.healths
                ? data.healths[myRealId]
                : prev[myRealId]?.health - data.damage;

              return {
                ...prev,
                [myRealId]: {
                  ...prev[myRealId],
                  health: Math.max(0, finalHealth),
                },
              };
            });
          }, 600);
        }

        setTimeout(() => {
          setPlayerAttackAnim(false);
          setOpponentAttackAnim(false);
          setPlayerHitAnim(false);
          setOpponentHitAnim(false);
          setShowDamageAnimation(false);
        }, 2500);
      });

      socket.on("game_over", (data: { winnerId: string }) => {
        console.log("[Game Over] Winner:", data.winnerId);

        // Determine if we won
        const myRealId = Object.keys(playersRef.current).find(
          (uid) => playersRef.current[uid].socketId === socket.id,
        );

        // Record result and get updated stats
        let xpGained = 0;
        if (data.winnerId === myRealId) {
          const stats = battleStatsService.recordWin();
          setBattleStats({
            winRate: battleStatsService.getWinRate(),
            streak: stats.streak,
          });
          xpGained = 100;
        } else if (data.winnerId && data.winnerId !== "draw") {
          const stats = battleStatsService.recordLoss();
          setBattleStats({
            winRate: battleStatsService.getWinRate(),
            streak: stats.streak,
          });
          xpGained = 25;
        } else {
          // Draw - just get current stats
          const stats = battleStatsService.getStats();
          setBattleStats({
            winRate: battleStatsService.getWinRate(),
            streak: stats.streak,
          });
          xpGained = 50;
        }

        // Award XP
        const { leveledUp, stats: progStats } =
          progressionService.addXp(xpGained);
        console.log(
          `[Battle] XP Awarded: +${xpGained}. Leveled Up: ${leveledUp}. New Level: ${progStats.level}`,
        );

        setXpGained(xpGained);
        setWinnerId(data.winnerId);
        setShowResults(true);
        setStatus("finished");
      });

      socket.on("opponent_answered", (data: { userId: string }) => {
        setPlayers((prev) => ({
          ...prev,
          [data.userId]: { ...prev[data.userId], hasAnswered: true },
        }));
      });

      // SUDDEN DEATH START
      socket.on("sudden_death_start", (data: { endTime: number }) => {
        setIsSuddenDeath(true);
        startCountdown(data.endTime);
      });

      socket.on(
        "player_status_change",
        (data: { userId: string; status: string }) => {
          setPlayers((prev) => ({
            ...prev,
            [data.userId]: {
              ...prev[data.userId],
              isDisconnected: data.status === "disconnected",
            },
          }));
        },
      );
    }

      const unregisterResync = socketService.onResync(() => {
        console.log("[BattleMinigame] Socket recovered, re-syncing battle state...");
        socket?.emit("join_match_session", { roomId });
      });

      return () => {
        unregisterResync();
        if (timerRef.current) clearInterval(timerRef.current);
        socket?.off("sync_state");
        socket?.off("round_result");
        socket?.off("game_over");
        socket?.off("sudden_death_start");
      };
  }, [roomId]);

  const startCountdown = (endTime: number) => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Initial Set (Fix Jump to 0%)
    const initialLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    setVisualTimeLeft(initialLeft);

    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setVisualTimeLeft(left);
      if (left <= 0 && timerRef.current) clearInterval(timerRef.current);
    }, 1000);
  };

  const handleAnswer = (idx: number) => {
    if (status !== "playing" || selectedAnswer !== null) return;
    setSelectedAnswer(idx);
    setShowQuestionPopup(false); // Dismiss popup if open
    const isCorrect = idx === currentQuestion.correctAnswer;
    socketService.socket?.emit("submit_answer", { roomId, correct: isCorrect });
  };

  const getHealthColor = (h: number, max: number) => {
    if (h <= 0) return "#f44336";
    const p = h / max;
    return p > 0.6 ? "#4caf50" : p > 0.3 ? "#ff9800" : "#f44336";
  };

  if (!me || !opponent) {
    return (
      <IonPage>
        <div className="disconnect-overlay">
          <div className="disconnect-spinner"></div>
          <div className="disconnect-message">Connecting...</div>
        </div>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <StudentHeader
        pageTitle="battle.title"
        showBackButton={true}
        onBack={() => {
          socketService.socket?.emit("leave_match", { roomId });
          history.replace("/page/student");
        }}
      />

      <IonContent fullscreen={false} className="battle-content">
        <div className="battle-container">
          {/* Disconnect / Waiting Overlay */}
          {(opponent.isDisconnected || status === "waiting") && (
            <div className="disconnect-overlay">
              <div className="disconnect-spinner"></div>
              <div className="disconnect-message">
                {opponent.isDisconnected
                  ? "Opponent Disconnected..."
                  : "Waiting for Next Round..."}
              </div>
            </div>
          )}

          {/* Opponent Section */}
          <div className="battle-section enemy-section">
            <div className="character-container">
              <div className="health-bar enemy-health">
                <div className="character-name-row">
                  <span className="character-name">{opponent.name}</span>
                </div>
                <div className="health-bar-container">
                  <div
                    className="health-bar-fill"
                    style={{
                      width: `${(opponent.health / opponent.maxHealth) * 100}%`,
                      backgroundColor: getHealthColor(
                        opponent.health,
                        opponent.maxHealth,
                      ),
                    }}
                  ></div>
                </div>
                <div className="hp-row">
                  <span className="hp-text">
                    {opponent.health}/{opponent.maxHealth}
                  </span>
                </div>
              </div>
              <div className="avatar-wrapper">
                <img
                  src={`/assets/${opponent.avatar.toLowerCase()}-front.png`}
                  className={`avatar-image ${opponentAttackAnim ? "enemy-attack-animation" : ""
                    } ${opponentHitAnim ? "damage-animation" : ""}`}
                  onError={(e) =>
                    (e.currentTarget.src = "/assets/capybara-front.png")
                  }
                />
              </div>
            </div>
          </div>

          {/* Player Section */}
          <div className="battle-section player-section">
            <div className="character-container">
              <div className="avatar-wrapper">
                <img
                  src={`/assets/${me.avatar.toLowerCase()}-back.png`}
                  className={`avatar-image ${playerAttackAnim ? "player-attack-animation" : ""
                    } ${playerHitAnim ? "damage-animation" : ""}`}
                  onError={(e) =>
                    (e.currentTarget.src = "/assets/capybara-back.png")
                  }
                />
              </div>
              <div className="health-bar player-health">
                <div className="character-name-row">
                  <span className="character-name">{me.name}</span>
                </div>
                <div className="health-bar-container">
                  <div
                    className="health-bar-fill"
                    style={{
                      width: `${(me.health / me.maxHealth) * 100}%`,
                      backgroundColor: getHealthColor(me.health, me.maxHealth),
                    }}
                  ></div>
                </div>
                <div className="hp-row">
                  <span className="hp-text">
                    {me.health}/{me.maxHealth}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Questions */}
          {/* Sudden Death / Timer Bar (Moved here) */}
          {/* Timer Bar (Always Visible, Slim, Green -> Red) */}
          <div
            className="timer-bar-container"
            style={{
              visibility: "visible", // Always visible per user request
              height: "0.25rem", // Slimmer
              background: "rgba(0,0,0,0.1)", // Transparent/Subtle track
              width: "80%",
              margin: "0 auto",
              marginTop: "0.5rem",
              marginBottom: "0.5rem",
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            <div
              className="timer-bar-fill"
              style={{
                height: "100%",
                // If not sudden death, it stays full green (infinite time).
                // If sudden death (visualTimeLeft < 100), it depletes.
                // User said "it should be green... only the color it is".
                // If we want it to stay green until sudden death, we use logic:
                background: !isSuddenDeath
                  ? "#4caf50"
                  : visualTimeLeft > 5
                    ? "#4caf50"
                    : visualTimeLeft > 2
                      ? "#ff9800"
                      : "#f44336",

                // If not sudden death, width is 100%. If sudden death, calculated.
                width: !isSuddenDeath
                  ? "100%"
                  : `${(visualTimeLeft / 10) * 100}%`,

                transition: "width 1s linear, background-color 0.3s ease",
              }}
            ></div>
          </div>

          {/* Separator was here, removing global separator to rely on specific placement above.  */}
          {/* Actually user said "two separator bars", checking if another exists. */}
          {/* We have one in line 380, and one in 465. We should keep the one dividing player from questions. */}
          {/* But we moved the Timer Bar ABOVE the separator. */}
          {/* But we moved the Timer Bar ABOVE the separator. */}
          <div className="section-separator"></div>

          {/* Critical Hit Overlay */}
          {showCritical && (
            <div className="critical-text-overlay">CRITICAL!</div>
          )}

          {/* Questions (Always rendered, disconnected if not playing) */}
          <div
            className="options-section"
            style={{
              opacity: status === "playing" ? 1 : 0.5,
              pointerEvents: status === "playing" ? "auto" : "none",
            }}
          >
            <IonGrid>
              <IonRow>
                {currentQuestion.options.map((opt: string, i: number) => (
                  <IonCol size="12" key={i}>
                    <IonButton
                      expand="block"
                      className={`option-button ${selectedAnswer === i
                        ? i === currentQuestion.correctAnswer
                          ? "correct"
                          : "incorrect"
                        : ""
                        }`}
                      onClick={() => handleAnswer(i)}
                      disabled={selectedAnswer !== null}
                    >
                      {opt}
                    </IonButton>
                  </IonCol>
                ))}
              </IonRow>
            </IonGrid>
          </div>

          {/* Question Popup Logic */}
          {showQuestionPopup && (
            <div className="question-popup-overlay">
              <div className="question-popup">
                <div className="question-header">
                  <IonButton
                    fill="clear"
                    className="close-button"
                    onClick={() => setShowQuestionPopup(false)}
                  >
                    <IonIcon icon={close} />
                  </IonButton>
                </div>
                <div className="question-content">
                  <div className="question-text">
                    {currentQuestion.question}
                  </div>
                </div>
                <div className="progress-container">
                  <div
                    className="progress-bar"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Bar (Scrolling) */}
          <div
            className="bottom-question-bar"
            onClick={() => setShowQuestionPopup(true)}
          >
            <div className="bottom-bar-content">
              <div className="scrolling-text-container">
                <div
                  className="scrolling-text"
                  ref={scrollingTextRef}
                  style={{ transform: `translateX(${scrollingTextPos}px)` }}
                >
                  {currentQuestion.question}
                </div>
              </div>
            </div>
          </div>

          {showDamageAnimation && (
            <div className={`damage-popup ${damageTarget}`}>
              -{damageAmount}
            </div>
          )}
        </div>

        <BattleResultModal
          isOpen={showResults}
          winnerId={winnerId}
          myId={myId}
          players={players}
          battleStats={battleStats}
          xpGained={xpGained}
        />
      </IonContent>
    </IonPage>
  );
};

export default BattleMinigame;
