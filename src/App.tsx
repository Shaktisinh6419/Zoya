import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2 } from "lucide-react";
import { getZoyaResponse, getZoyaAudio, resetZoyaSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";
import { auth, signInWithGoogle, logout, db, handleFirestoreError, OperationType } from "./services/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, orderBy, limit, getDocs, addDoc } from "firebase/firestore";

type AppState = "idle" | "listening" | "processing" | "speaking";
type ThemeType = "obsidian" | "emerald" | "sunset" | "arctic";

interface ThemeConfig {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  glow: string;
}

const THEMES: Record<ThemeType, ThemeConfig> = {
  obsidian: {
    name: "Obsidian",
    primary: "violet-500",
    secondary: "pink-500",
    accent: "cyan-400",
    bg: "from-violet-900/20 to-pink-900/20",
    glow: "shadow-violet-500/60"
  },
  emerald: {
    name: "Emerald",
    primary: "emerald-500",
    secondary: "teal-500",
    accent: "lime-400",
    bg: "from-emerald-900/20 to-teal-900/20",
    glow: "shadow-emerald-500/60"
  },
  sunset: {
    name: "Sunset",
    primary: "orange-500",
    secondary: "red-500",
    accent: "yellow-400",
    bg: "from-orange-900/20 to-red-900/20",
    glow: "shadow-orange-500/60"
  },
  arctic: {
    name: "Arctic",
    primary: "sky-500",
    secondary: "indigo-500",
    accent: "blue-300",
    bg: "from-sky-900/20 to-indigo-900/20",
    glow: "shadow-sky-500/60"
  }
};

interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("zoya_theme");
    return (saved as ThemeType) || "obsidian";
  });

  // Auth and Firestore sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (!user) {
        setMessages([]); // Clear for fresh start if logged out
        return;
      }
      
      const userPath = `users/${user.uid}`;
      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        
        // 1. Sync User Preferences
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.theme) setTheme(userData.theme as ThemeType);
        } else {
          try {
            const dataToSave: any = {
              uid: user.uid,
              email: user.email || "anonymous",
              theme: theme,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };
            if (user.displayName) dataToSave.displayName = user.displayName;

            await setDoc(userRef, dataToSave);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, userPath);
          }
        }

        // 2. Load Lifetime Memory (Recent 50 messages)
        const messagesQuery = query(
          collection(db, "users", user.uid, "messages"),
          orderBy("timestamp", "asc"),
          limit(50)
        );
        const querySnapshot = await getDocs(messagesQuery);
        const history: ChatMessage[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          history.push({
            id: doc.id,
            sender: data.sender as "user" | "zoya",
            text: data.text
          });
        });
        
        if (history.length > 0) {
          setMessages(history);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, userPath);
      }
    });

    return () => unsubscribe();
  }, []);

  // Update theme in Firestore and LocalStorage
  useEffect(() => {
    localStorage.setItem("zoya_theme", theme);
    if (user) {
      const userPath = `users/${user.uid}`;
      updateDoc(doc(db, "users", user.uid), {
        theme,
        updatedAt: serverTimestamp()
      }).catch((error) => {
        handleFirestoreError(error, OperationType.WRITE, userPath);
      });
    }
  }, [theme, user]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    const newMessage: ChatMessage = { id: Date.now().toString(), sender: "user", text: finalTranscript };
    setMessages((prev) => [...prev, newMessage]);
    
    // Save to Firestore for lifetime memory
    if (user) {
      addDoc(collection(db, "users", user.uid, "messages"), {
        sender: "user",
        text: finalTranscript,
        timestamp: serverTimestamp()
      }).catch(console.error);
    }
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for browser commands
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "zoya", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini
      responseText = await getZoyaResponse(finalTranscript, messagesRef.current);
      const zoyaMsg: ChatMessage = { id: Date.now().toString() + "-z", sender: "zoya", text: responseText };
      setMessages((prev) => [...prev, zoyaMsg]);
      
      // Save to Firestore
      if (user) {
        addDoc(collection(db, "users", user.uid, "messages"), {
          sender: "zoya",
          text: responseText,
          timestamp: serverTimestamp()
        }).catch(console.error);
      }
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetZoyaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetZoyaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          const msgId = Date.now().toString() + "-" + sender;
          setMessages((prev) => [...prev, { id: msgId, sender, text }]);
          
          // Save to Firestore
          if (user) {
            addDoc(collection(db, "users", user.uid, "messages"), {
              sender,
              text,
              timestamp: serverTimestamp()
            }).catch(console.error);
          }
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        await session.start();
      } catch (e) {
        console.error("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* Cinematic Background Gradients */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-${THEMES[theme].primary}/20 blur-[120px] rounded-full`} />
        <div className={`absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-${THEMES[theme].secondary}/20 blur-[120px] rounded-full`} />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-tr from-${THEMES[theme].primary} to-${THEMES[theme].secondary} flex items-center justify-center font-bold text-sm`}>
            Z
          </div>
          <h1 className="text-xl font-serif font-medium tracking-wide opacity-90">Zoya</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={() => {
              const themeKeys = Object.keys(THEMES) as ThemeType[];
              const currentIndex = themeKeys.indexOf(theme);
              const nextIndex = (currentIndex + 1) % themeKeys.length;
              setTheme(themeKeys[nextIndex]);
            }}
            className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2"
            title="Change Theme"
          >
            <div className={`w-2 h-2 rounded-full bg-${THEMES[theme].primary} shadow-[0_0_8px] shadow-${THEMES[theme].primary}`} />
            <span className="hidden sm:inline">{THEMES[theme].name}</span>
          </button>

          <button
            onClick={async () => {
              if (user) {
                if (confirm("Disconnect identity? Cloud memory will be paused.")) {
                  await logout();
                }
              } else {
                await signInWithGoogle();
              }
            }}
            className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-tighter
              ${user 
                ? `bg-${THEMES[theme].primary}/10 border-${THEMES[theme].primary}/30 text-${THEMES[theme].primary}` 
                : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${user ? `bg-${THEMES[theme].primary} animate-pulse shadow-[0_0_5px] shadow-${THEMES[theme].primary}` : "bg-white/30"}`} />
            {user ? "Identity Linked" : "Sync Profile"}
          </button>

          {messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear the chat history?")) {
                  setMessages([]);
                  resetZoyaSession();
                }
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Clear Chat History"
            >
              <Trash2 size={18} className="opacity-70" />
            </button>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} className="opacity-70" />
            ) : (
              <Volume2 size={18} className="opacity-70" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content - Visualizer & Chat */}
      <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-24 px-4 md:px-12 pointer-events-none">
        
        {/* Left Column: Zoya Status */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6">
            <AnimatePresence>
              {appState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`flex items-center gap-2 text-${THEMES[theme].accent}/80 text-sm md:text-base italic font-serif`}
                >
                  <Loader2 size={16} className="animate-spin" />
                  Replying...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Visualizer (Fixed Full Screen Background) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <Visualizer state={appState} theme={theme} />
        </div>

        {/* Right Column: User Status */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          <div className="h-6 flex justify-end">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`flex items-center gap-2 text-${THEMES[theme].primary}/80 text-sm md:text-base italic`}
                >
                  <div className={`w-2 h-2 rounded-full bg-${THEMES[theme].primary} animate-pulse`} />
                  Listening...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </main>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1 pl-4 backdrop-blur-md shadow-2xl"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message to Zoya..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className={`p-2 rounded-full bg-${THEMES[theme].primary} hover:opacity-90 disabled:opacity-50 transition-colors`}
              >
                <Send size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-3 px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl
              ${
                isSessionActive
                  ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                  : `bg-white/10 text-white border border-white/20 hover:bg-${THEMES[theme].primary}/20 hover:border-${THEMES[theme].primary}/40 hover:scale-105`
              }
            `}
          >
            {isSessionActive ? (
              <>
                <MicOff size={20} />
                <span>End Session</span>
              </>
            ) : (
              <>
                <Mic size={20} className="group-hover:animate-bounce" />
                <span>Start Session</span>
              </>
            )}
          </button>
          
          {!isSessionActive && (
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-2xl"
              title="Type instead"
            >
              <Keyboard size={20} className="opacity-70" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
