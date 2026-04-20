import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config/env.js';
import { getUserChats } from '../repositories/chatRepository.js';
import { getRandomQuiz, getQuizQuestions } from '../repositories/quizRepository.js';
import { getUserGrade } from '../repositories/userRepository.js';
import { listStudentSections } from '../repositories/studentRepository.js';
import { listProfessorSections } from '../repositories/sectionRepository.js';

// --- Interfaces ---

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
    hasAnswered: boolean; // Track if they answered current round
}

type GameStatus = 'waiting' | 'playing' | 'round_result' | 'finished';

interface GameState {
    roomId: string;
    status: GameStatus;
    players: Record<string, Player>; // Keyed by userId
    currentQuestionIndex: number;
    roundStartTime: number;
    roundEndTime: number; // For Hard Timer
    answers: Record<string, { time: number; correct: boolean }>;
    
    // System
    roundTimeout?: NodeJS.Timeout;
    isSuddenDeath?: boolean;
    questions?: any[]; // Array of questions for this session
}

// --- State ---

const waitingQueue: { userId: string; name: string; avatar: string; socketId: string }[] = [];
// Map roomId -> GameState
const activeGames: Record<string, GameState> = {};
// Map userId -> roomId
const userGameMap: Record<string, string> = {};

const ROUND_DURATION_SEC = 15; // Soft limit for users
const HARD_TIMEOUT_SEC = 20;   // Hard limit to force resolution

export const initSocket = (io: Server) => {
    // Middleware: Lenient Auth (Try to get UserID, else use SocketID)
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (token) {
            try {
                const payload = jwt.verify(token, appConfig.auth.jwtSecret) as any;
                socket.data.user = { 
                    id: String(payload.sub || payload.userId), 
                    username: payload.username,
                    role: payload.role
                };
            } catch (e) {
                // Invalid token? behave as guest/socket-only? 
                // For this app, let's enforce randomness if invalid, or error.
                // Better: error to force relogin if token is bad.
                // return next(new Error("Authentication Invalid"));
                // Fallback for dev/robustness:
                socket.data.user = { id: 'guest_' + socket.id, username: 'Guest' };
            }
        } else {
             socket.data.user = { id: 'guest_' + socket.id, username: 'Guest' };
        }
        next();
    });

    io.on('connection', async (socket: Socket) => {
        const userId = socket.data.user.id;
        console.log(`[Socket] Connected: ${userId} (${socket.id})`);

        // --- END DUPLICATE CONNECTION GUARD ---

        // ===== CRITICAL: AUTO-JOIN CHAT ROOMS =====
        // This ensures users receive messages even if they haven't opened the chat yet
        // Without this, first-time app users won't get any messages
        try {
            // Only join if user has a real ID (not guest)
            if (!userId.startsWith('guest_')) {
                const userIdNum = parseInt(userId);
                const role = socket.data.user.role;

                if (!isNaN(userIdNum)) {
                    // 1. Auto-join Chat Rooms (All roles)
                    const chats = await getUserChats(userIdNum);
                    chats.forEach((chat: any) => {
                        socket.join(`chat_${chat.id}`);
                    });

                    // 2. Auto-join Section Rooms (Role dependent)
                    let sectionIds: number[] = [];
                    if (role === 'professor') {
                        sectionIds = await listProfessorSections(userIdNum);
                        console.log(`[Socket] Professor ${userId} joining ${sectionIds.length} managed sections.`);
                    } else {
                        sectionIds = await listStudentSections(userIdNum);
                    }

                    sectionIds.forEach(sectionId => {
                        const roomName = `section_${sectionId}`;
                        socket.join(roomName);
                        console.log(`[Socket] ${role} ${userId} auto-joined section room: ${roomName}`);
                    });
                    
                    console.log(`[Socket] ${userId} (${role}) initialized with ${chats.length} chats and ${sectionIds.length} sections.`);
                }
            }
        } catch (error) {
            console.error(`[Socket] Failed to auto-join chat rooms for ${userId}:`, error);
        }
        // ===== END AUTO-JOIN =====

        // --- 1. RECONNECTION CHECK ---
        const existingGameId = userGameMap[userId];
        if (existingGameId && activeGames[existingGameId]) {
            const game = activeGames[existingGameId];
            if (game.status !== 'finished') {
                handleReconnection(io, socket, game, userId);
            }
        }

        // --- 2. JOIN MATCH HANDLER (Explicit Sync Request) ---
        socket.on('join_match_session', (data: { roomId: string }) => {
            console.log(`[Socket] join_match_session: User=${userId} Room=${data.roomId}`);
            const game = activeGames[data.roomId];
            if (game) {
                console.log(`[Socket] Game found. Players: ${Object.keys(game.players).join(', ')}`);
                if (game.players[userId]) {
                     console.log(`[Socket] Player authorized. Joining room and resyncing...`);
                     socket.join(data.roomId); // FORCE JOIN ROOM
                     handleReconnection(io, socket, game, userId);
                } else {
                     console.log(`[Socket] Player NOT in game players list.`);
                     socket.emit('game_error', { code: 'NOT_FOUND', message: 'You are not in this match.' });
                }
            } else {
                console.log(`[Socket] Game NOT found for Room=${data.roomId}`);
                socket.emit('game_error', { code: 'NOT_FOUND', message: 'Match not found.' });
            }
        });

        // --- 3. HOSTED GAMES LIST ---
        
        // Host a new Game
        socket.on('create_game', async (data: { name: string; avatar: string; profilePic?: string; schoolName?: string; topicName?: string; language?: string }) => {
            const roomId = `room_${Date.now()}_${userId}`;
            
            // Use actual school name from client if provided, otherwise fallback
            const hostSchoolName = data.schoolName || "ArenAI School";
            const mockSectionId = parseInt(userId) ? (parseInt(userId) % 2 === 0 ? "10-1" : "10-2") : "10-1";
            
            // Get subject from frontend data
            const subjectName = data.topicName || 'Math';
            const language = data.language || 'es'; // Default to Spanish

            // === QUIZ SELECTION ===
            let questions: any[] = [];
            let quizName: string | null = null;
            try {
                // 1. Get User Grade
                let grade = '10'; // Default
                if (!userId.startsWith('guest_')) {
                    const dbGrade = await getUserGrade(parseInt(userId));
                    if (dbGrade) grade = dbGrade;
                }
                
                // 2. Fetch Random Quiz with language filter
                const quiz = await getRandomQuiz(subjectName, grade, language);
                
                if (quiz) {
                   questions = await getQuizQuestions(quiz.id_quiz);
                   quizName = quiz.quiz_name;
                   console.log(`\n========================================`);
                   console.log(`[BATTLE QUIZ] Starting battle with quiz from database!`);
                   console.log(`[BATTLE QUIZ] Quiz Name: "${quizName}"`);
                   console.log(`[BATTLE QUIZ] Quiz ID: ${quiz.id_quiz}`);
                   console.log(`[BATTLE QUIZ] Subject: ${subjectName}`);
                   console.log(`[BATTLE QUIZ] Grade: ${grade}`);
                   console.log(`[BATTLE QUIZ] Language: ${language}`);
                   console.log(`[BATTLE QUIZ] Questions: ${questions.length}`);
                   console.log(`========================================\n`);
                } else {
                   console.log(`[BATTLE QUIZ] No quiz found for Subject=${subjectName}, Grade=${grade}, Language=${language}. Using Frontend Fallback.`);
                }
            } catch(e) {
                console.error("[BATTLE QUIZ] Failed to fetch quiz:", e);
            }
            // ======================

            const p1: Player = {
                userId,
                socketId: socket.id,
                name: data.name,
                avatar: data.avatar,
                score: 0,
                health: 100,
                maxHealth: 100,
                winStreak: 0,
                utilizationIndex: 0,
                isDisconnected: false,
                hasAnswered: false
            };

            const game: GameState = {
                roomId,
                status: 'waiting',
                players: { [userId]: p1 },
                currentQuestionIndex: 0,
                roundStartTime: 0,
                roundEndTime: 0, 
                answers: {},
                questions, // Store questions
                // Metadata for Listing
                hostName: data.name,
                hostProfilePic: data.profilePic || 'axolotl',
                schoolName: hostSchoolName,
                sectionId: mockSectionId,
                subjectName: subjectName, // Store subject name for lobby display
                quizName: quizName // Store quiz name for reference
            } as any; 

            activeGames[roomId] = game;
            userGameMap[userId] = roomId;
            socket.join(roomId);

            console.log(`[Game] Hosted by ${data.name}: ${roomId}`);
            socket.emit('game_created', { roomId });
            
            io.emit('games_list_update', getOpenGames());
        });


        // Get List
        socket.on('get_games', () => {
            socket.emit('games_list', getOpenGames());
        });

            // Join Specific Game
            socket.on('join_game', (data: { roomId: string; name: string; avatar: string }) => {
                const game = activeGames[data.roomId];
                if (!game) {
                    socket.emit('game_error', { code: 'NOT_FOUND', message: 'Game not found' });
                    return;
                }

                // Prevent self-joining
                if (game.players[userId]) {
                    console.log(`[Socket] User ${userId} tried to join their own game ${data.roomId}`);
                    socket.emit('game_error', { code: 'ALREADY_IN_ROOM', message: 'You are already in this room' });
                    return;
                }

                if (Object.keys(game.players).length >= 2) {
                    socket.emit('game_error', { code: 'FULL', message: 'Game is full' });
                    return;
                }

                // Join Logic
                const p2: Player = {
                    userId,
                    socketId: socket.id,
                    name: data.name,
                    avatar: data.avatar,
                    score: 0,
                    health: 100,
                    maxHealth: 100,
                    winStreak: 0,
                    utilizationIndex: 0,
                    isDisconnected: false,
                    hasAnswered: false
                };

                game.players[userId] = p2;
                userGameMap[userId] = game.roomId;
                socket.join(game.roomId);

                // Notify both as "match_found" to transition UI
                io.to(game.roomId).emit('match_found', {
                    roomId: game.roomId,
                    players: game.players
                });

            // Start Game with a small delay to ensure UI transition and room joining
            setTimeout(() => {
                startRound(io, game);
            }, 800);
            
            // Update List (Remove full game)
            io.emit('games_list_update', getOpenGames());
        });

        // Cancel Game (Host abandons before match starts)
        socket.on('cancel_game', (data: { roomId: string }) => {
            const game = activeGames[data.roomId];
            if (!game) return;

            // Verify caller is the host (owner of this game)
            if (game.players[userId]) {
                console.log(`[Game] Host ${userId} cancelled game ${data.roomId}`);
                delete activeGames[data.roomId];
                delete userGameMap[userId];
                
                // Broadcast updated list
                io.emit('games_list_update', getOpenGames());
            }
        });

        // Deprecated: Queue (Keeping logic commented or removed if purely list based now)
        // socket.on('join_queue', ...);

        // --- 4. GAMEPLAY ---
        socket.on('submit_answer', (data: { roomId: string; correct: boolean }) => {
            const game = activeGames[data.roomId];
            if (!game || game.status !== 'playing') return;

            // Check if player is in game
            if (!game.players[userId]) return;

            // Check if already answered
            if (game.answers[userId]) return;

            const timeTaken = (Date.now() - game.roundStartTime) / 1000;
            game.answers[userId] = { time: timeTaken, correct: data.correct };
            game.players[userId].hasAnswered = true;

            // Notify everyone that SOMEONE answered (for UI "Waiting for opponent")
            io.to(game.roomId).emit('opponent_answered', { userId });

            // Check if all answered
            const allAnswered = Object.values(game.players).every(p => !p.isDisconnected && (game.answers[p.userId] || p.isDisconnected));
            // Note: If opponent is disconnected, we don't wait for them? 
            // Better: 'allAnswered' means all ACTIVE players answered.
            // But for FAIRNESS and SIMPLICITY in this 'Fixed Logic':
            // If 2 players exist, we wait for 2 answers OR Timeout.
            // We do NOT resolve early if one is just slow. We resolve early if BOTH answer.
            
            const totalPlayers = Object.keys(game.players).length;
            const totalAnswers = Object.keys(game.answers).length;

            if (totalAnswers === totalPlayers) {
                resolveRound(io, game);
            } else if (!game.isSuddenDeath) {
                // First Answer -> Trigger Sudden Death (10s)
                game.isSuddenDeath = true;
                if (game.roundTimeout) clearTimeout(game.roundTimeout);
                
                const suddenDeathDuration = 10;
                game.roundEndTime = Date.now() + (suddenDeathDuration * 1000);
                
                game.roundTimeout = setTimeout(() => {
                    resolveRound(io, game);
                }, suddenDeathDuration * 1000);
                
                io.to(game.roomId).emit('sudden_death_start', { endTime: game.roundEndTime });
            }
        });

        socket.on('leave_match', (data: { roomId: string }) => {
            handleForfeit(io, userId, data.roomId, 'abandoned');
        });

        socket.on('disconnect', () => {
             console.log(`[Socket] Disconnect: ${userId}`);
             // If in queue
             const qIdx = waitingQueue.findIndex(p => p.userId === userId);
             if (qIdx !== -1) waitingQueue.splice(qIdx, 1);

             // If in game
             const gameId = userGameMap[userId];
             if (gameId && activeGames[gameId]) {
                 const game = activeGames[gameId];
                 if (game.status !== 'finished') {
                     if (game.players[userId]) {
                         game.players[userId].isDisconnected = true;
                         // Notify opponent
                         io.to(gameId).emit('player_status_change', { userId, status: 'disconnected' });
                     }
                 }
             }
        });


        // --- 5. GENERIC CHAT (Student/P2P) ---
        socket.on('join_chat', (data: { chatId: string }) => {
            const { chatId } = data;
            const roomName = `chat_${chatId}`;
            socket.join(roomName);
            console.log(`[Socket] ${userId} joined chat room: ${roomName}`);
        });

        socket.on('send_message', (data: { chatId: string; text: string; senderName?: string }) => {
            const { chatId, text, senderName } = data;
            const roomName = `chat_${chatId}`;
            
            // Broadcast to room (including sender, or exclude sender? Usually include for sync)
            // But frontend adds optimistically. Let's broadcast to others.
            socket.to(roomName).emit('receive_message', {
                chatId,
                text,
                senderId: userId,
                senderName: senderName || socket.data.user.username,
                timestamp: new Date().toISOString()
            });
            console.log(`[Socket] Message in ${roomName} from ${userId}: ${text}`);
        });

        // --- 6. CLASSROOM LIVE SYNC ---
        socket.on('set_topic_focus', (data: { sectionId: number; topicId: number; topicName: string }) => {
            console.log(`[Socket] Topic focus update for Section ${data.sectionId}: ${data.topicName} (${data.topicId})`);
            io.to(`section_${data.sectionId}`).emit('topic_focus', {
                topicId: data.topicId,
                topicName: data.topicName,
                professorId: userId
            });
        });
    });
};

const createMatch = (io: Server) => {
    const p1 = waitingQueue.shift()!;
    const p2 = waitingQueue.shift()!;
    const roomId = `room_${Date.now()}`;

    const game: GameState = {
        roomId,
        status: 'waiting',
        players: {
            [p1.userId]: { ...p1, score: 0, health: 100, maxHealth: 100, winStreak: 0, utilizationIndex: 0, isDisconnected: false, hasAnswered: false },
            [p2.userId]: { ...p2, score: 0, health: 100, maxHealth: 100, winStreak: 0, utilizationIndex: 0, isDisconnected: false, hasAnswered: false }
        },
        currentQuestionIndex: 0,
        roundStartTime: 0,
        roundEndTime: 0,
        answers: {}
    };

    activeGames[roomId] = game;
    userGameMap[p1.userId] = roomId;
    userGameMap[p2.userId] = roomId;

    const s1 = io.sockets.sockets.get(p1.socketId);
    const s2 = io.sockets.sockets.get(p2.socketId);
    s1?.join(roomId);
    s2?.join(roomId);

    // Notify Match Found (Lobby -> Game Transition)
    if (s1) {
        s1.emit('match_found', {
            roomId,
            opponent: { name: p2.name, avatar: p2.avatar }
        });
    }
    if (s2) {
        s2.emit('match_found', {
            roomId,
            opponent: { name: p1.name, avatar: p1.avatar }
        });
    }

    // Start Round 1
    startRound(io, game);
};

const startRound = (io: Server, game: GameState) => {
    if (game.status === 'finished') return;

    game.status = 'playing';
    game.roundStartTime = Date.now();
    game.roundEndTime = Date.now() + (HARD_TIMEOUT_SEC * 1000);
    game.answers = {};
    
    // Reset Round Flags
    Object.values(game.players).forEach(p => p.hasAnswered = false);

    // Clear any previous timer
    if (game.roundTimeout) clearTimeout(game.roundTimeout);

    // Set HARD TIMEOUT (safety fallback)
    // User requested "never happen unless one student answers". 
    // We set effectively INFINITE time (e.g. 24 hours) until first answer.
    const MAX_WAIT_TIME = 86400; 
    game.roundEndTime = Date.now() + (MAX_WAIT_TIME * 1000);
    game.isSuddenDeath = false;

    // We do NOT set a resolving timeout here anymore, or we set it for 24h.
    game.roundTimeout = setTimeout(() => {
        console.log(`[Game ${game.roomId}] Hard Timeout Triggered (24h limit)`);
        resolveRound(io, game); 
    }, MAX_WAIT_TIME * 1000);

    // Emit 'round_ready' to signal client to reset UI state
    io.to(game.roomId).emit('round_ready');
    
    // Full Sync Emit
    emitGameState(io, game);
};

const resolveRound = (io: Server, game: GameState) => {
    if (game.status !== 'playing') return; // Prevent double resolution

    game.status = 'round_result';
    if (game.roundTimeout) clearTimeout(game.roundTimeout);

    // Logic
    const pIds = Object.keys(game.players);
    const p1Id = pIds[0];
    const p2Id = pIds[1];

    const a1 = game.answers[p1Id];
    const a2 = game.answers[p2Id];

    // Default: 9999s, incorrect
    const a1Res = a1 || { time: 9999, correct: false };
    const a2Res = a2 || { time: 9999, correct: false };

    let damageDealt = 0;
    let roundWinnerId: string | null = null;
    const damages = { [p1Id]: 0, [p2Id]: 0 };
    const messages = { [p1Id]: '', [p2Id]: '' };
    let isCritical = false;

    if (a1Res.correct && a2Res.correct) {
        roundWinnerId = a1Res.time < a2Res.time ? p1Id : p2Id;
        damageDealt = Math.floor(Math.random() * 4) + 5;
        const loser = roundWinnerId === p1Id ? p2Id : p1Id;
        damages[loser] = damageDealt;
        messages[roundWinnerId] = '¡Más rápido!';
        messages[loser] = '¡Lento!';
    } else if (a1Res.correct) {
        roundWinnerId = p1Id;
        damageDealt = Math.floor(Math.random() * 6) + 25;
        damages[p2Id] = damageDealt;
        messages[p1Id] = 'CRITICAL HIT';
        messages[p2Id] = 'Wrong';
        isCritical = true;
    } else if (a2Res.correct) {
        roundWinnerId = p2Id;
        damageDealt = Math.floor(Math.random() * 6) + 25;
        damages[p1Id] = damageDealt;
        messages[p2Id] = 'CRITICAL HIT';
        messages[p1Id] = 'Wrong';
        isCritical = true;
    } else {
        // Both Wrong or Timeout
        messages[p1Id] = 'Fallaste';
        messages[p2Id] = 'Fallaste';
        roundWinnerId = 'draw';
    }

    // Apply Damage
    game.players[p1Id].health = Math.max(0, game.players[p1Id].health - damages[p1Id]);
    game.players[p2Id].health = Math.max(0, game.players[p2Id].health - damages[p2Id]);

    // Check Game Over
    let winnerId: string | null = null;
    if (game.players[p1Id].health <= 0) winnerId = p2Id;
    else if (game.players[p2Id].health <= 0) winnerId = p1Id;

    // Emit Result
    io.to(game.roomId).emit('round_result', {
        winnerId: roundWinnerId,
        damage: damageDealt,
        damages,
        healths: { [p1Id]: game.players[p1Id].health, [p2Id]: game.players[p2Id].health },
        messages,
        isCritical
    });

    if (winnerId) {
        game.status = 'finished';
        io.to(game.roomId).emit('game_over', { winnerId });
        // Cleanup
        setTimeout(() => {
            delete activeGames[game.roomId];
            delete userGameMap[p1Id];
            delete userGameMap[p2Id];
        }, 5000);
    } else {
        // Next Round
        setTimeout(() => {
            game.currentQuestionIndex++;
            startRound(io, game);
        }, 3000); 
    }
};

const handleReconnection = (io: Server, socket: Socket, game: GameState, userId: string) => {
    // Update socket ref
    const p = game.players[userId];
    if (p) {
        p.socketId = socket.id;
        p.isDisconnected = false;
        socket.join(game.roomId);
        
        console.log(`[Reconnect] ${userId} rejoining ${game.roomId}`);
        
        // Notify others
        io.to(game.roomId).emit('player_status_change', { userId, status: 'connected' });
        
        // Send Full State
        emitGameState(io, game, socket);
    }
};

const handleForfeit = (io: Server, loserId: string, roomId: string, reason: string) => {
    const game = activeGames[roomId];
    if (!game || game.status === 'finished') return;
    
    game.status = 'finished';
    if (game.roundTimeout) clearTimeout(game.roundTimeout);
    
    // Determine winner
    const winnerId = Object.keys(game.players).find(pid => pid !== loserId);
    
    io.to(roomId).emit('game_over', { winnerId, reason });
    
    // Cleanup
    setTimeout(() => {
         delete activeGames[roomId];
         Object.keys(game.players).forEach(uid => delete userGameMap[uid]);
    }, 1000);
};

// --- HELPER: Emit Full Snapshot ---
const emitGameState = (io: Server, game: GameState, targetSocket?: Socket) => {
    const payload = {
        roomId: game.roomId,
        status: game.status,
        currentQuestionIndex: game.currentQuestionIndex,
        roundEndTime: game.roundEndTime,
        isSuddenDeath: game.isSuddenDeath,
        players: game.players,
        questions: game.questions || [] // Send questions
    };
    
    if (targetSocket) {
        targetSocket.emit('sync_state', payload);
    } else {
        io.to(game.roomId).emit('sync_state', payload);
    }
};

// --- HELPER: Get Open Games List ---
const getOpenGames = () => {
    return Object.values(activeGames)
        .filter(g => g.status === 'waiting')
        .map(g => ({
            roomId: g.roomId,
            hostName: (g as any).hostName,
            hostAvatar: Object.values(g.players)[0]?.avatar,
            hostProfilePic: (g as any).hostProfilePic || 'axolotl',
            schoolName: (g as any).schoolName || 'ArenAI School',
            sectionId: (g as any).sectionId,
            subjectName: (g as any).subjectName || 'Math' // Include subject name for lobby display
        }));
};

