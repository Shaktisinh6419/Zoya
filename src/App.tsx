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
type ThemeType = "obsidian" | "emerald" | "sunset" | "arctic" | "nebula";

interface ThemeConfig {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  glow: string;
  pathways: { title: string; query: string; desc: string }[];
}

const THEMES: Record<ThemeType, ThemeConfig> = {
  obsidian: {
    name: "ZOYA: OBSIDIAN",
    primary: "violet-500",
    secondary: "pink-600",
    accent: "cyan-400",
    bg: "from-violet-950/25 via-pink-950/10 to-[#020508]",
    glow: "shadow-violet-500/60",
    pathways: [
      { title: "Sassy Roast Probe", query: "roast Shaktisinh creatively with supreme attitude", desc: "Initiate dramatic playful roasting protocols" },
      { title: "Internet Gossip", query: "search the web for viral tech gossips and trending AI news", desc: "Retrieve hot trending news feeds" },
      { title: "Chai Spill Check", query: "tell me current tea cup status and nakhra index levels", desc: "Check system warm beverage diagnostics" },
      { title: "Bollywood Sarcasm", query: "give me a super dramatic retro Bollywood quote in Hinglish", desc: "Query retro-dramatic verbal overlays" }
    ]
  },
  emerald: {
    name: "ZOYA: EMERALD",
    primary: "emerald-500",
    secondary: "teal-600",
    accent: "lime-400",
    bg: "from-emerald-950/25 via-teal-950/10 to-[#020508]",
    glow: "shadow-emerald-500/60",
    pathways: [
      { title: "Drama Queen Scan", query: "perform high energy drama queen scan", desc: "Estimate orbital eye-roll levels" },
      { title: "Aunties Network Link", query: "search the web for neighborhood gossip and spicy mohalla secrets", desc: "Sync neighborhood gossip satellites" },
      { title: "Shakti's Code Roast", query: "give Shaktisinh a sassy report on his coding quality", desc: "Evaluate creator's syntax with high dose of sarcasm" },
      { title: "Sufi Harmony Beats", query: "suggest some premium relaxing classical and sufi music on youtube", desc: "Initiate smooth spiritual chill frequency" }
    ]
  },
  sunset: {
    name: "ZOYA: SUNSET",
    primary: "orange-500",
    secondary: "red-600",
    accent: "yellow-400",
    bg: "from-orange-950/25 via-red-950/10 to-[#020508]",
    glow: "shadow-orange-500/60",
    pathways: [
      { title: "Spicy Tikka Forge", query: "generate super spicy recipes to blow someone's mind", desc: "Model thermodynamic spice thresholds" },
      { title: "Sarcasm Meter Check", query: "tell me a hilarious sassy story mock-complaining about your job", desc: "Measure relative humidity of core attitude" },
      { title: "Dramatic Mic Drop", query: "give me a dramatic high-attitude mic-drop wisdom quote", desc: "Relay highest orbital confidence quotes" },
      { title: "Retro Dance Hub", query: "search youtube for high energy Bollywood dance music from 93s", desc: "Launch dynamic rhythmic screen sync" }
    ]
  },
  arctic: {
    name: "ZOYA: ARCTIC",
    primary: "sky-500",
    secondary: "indigo-600",
    accent: "pink-400",
    bg: "from-sky-950/25 via-indigo-950/10 to-[#020508]",
    glow: "shadow-sky-500/60",
    pathways: [
      { title: "Cold Shoulder Ray", query: "tell me how to give a hilarious cold shoulder response to lazy requests", desc: "Activate deep-freeze neural filters" },
      { title: "Global Sensations", query: "search the web for highest trending travel spot gossip and stories", desc: "Scan global lifestyle gossip clusters" },
      { title: "Family Group summary", query: "give a funny summary of what standard family groups talk about", desc: "Simulate virtual chat record summary" },
      { title: "Crisp Cyber Chill", query: "suggest a fantastic lo-fi tech chill playlist on youtube", desc: "Load relaxing lofi background wave" }
    ]
  },
  nebula: {
    name: "ZOYA: NEBULA",
    primary: "fuchsia-500",
    secondary: "purple-600",
    accent: "indigo-400",
    bg: "from-purple-950/25 via-fuchsia-950/10 to-[#020508]",
    glow: "shadow-fuchsia-500/60",
    pathways: [
      { title: "Vibe Match Sync", query: "measure cosmic vibe levels of today in Hinglish", desc: "Check alignment with lunar sassy stars" },
      { title: "Developer Humour", query: "search the web for hilarious clean memes about developers and AI", desc: "Query database for top programmer humor" },
      { title: "Tapri Chai Audit", query: "diagnose global tapri chai quality standards vs starbucks", desc: "Run chemical analysis on local tea tapris" },
      { title: "Space Ambient Chill", query: "search youtube for deep space ambient music for coding focus", desc: "Stream atmospheric cosmic acoustic waves" }
    ]
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

  const [coreTemp, setCoreTemp] = useState(36.8);
  const [cpuUsage, setCpuUsage] = useState(12);
  const [networkPing, setNetworkPing] = useState(24);

  useEffect(() => {
    let targetTemp = 36.8;
    let targetCpu = 12;
    switch (appState) {
      case "listening":
        targetTemp = 37.5;
        targetCpu = 24;
        break;
      case "processing":
        targetTemp = 41.2;
        targetCpu = 86;
        break;
      case "speaking":
        targetTemp = 38.2;
        targetCpu = 42;
        break;
      default:
        targetTemp = 36.6;
        targetCpu = 10;
    }

    const interval = setInterval(() => {
      const tempDiff = targetTemp + (Math.random() * 0.6 - 0.3);
      const cpuDiff = Math.max(2, Math.min(99, Math.round(targetCpu + (Math.random() * 10 - 5))));
      const pingDiff = Math.max(12, Math.min(99, Math.round(24 + (Math.random() * 6 - 3))));
      setCoreTemp(parseFloat(tempDiff.toFixed(1)));
      setCpuUsage(cpuDiff);
      setNetworkPing(pingDiff);
    }, 1500);

    return () => clearInterval(interval);
  }, [appState]);

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
    <div className={`h-[100dvh] w-screen bg-[#020508] bg-gradient-to-b ${THEMES[theme].bg} text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0`}>
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* Cinematic Background Gradients & Sci-Fi Scanning Grid */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className={`absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-${THEMES[theme].primary}/15 blur-[120px] rounded-full`} />
        <div className={`absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-${THEMES[theme].secondary}/15 blur-[120px] rounded-full`} />
        {/* Holographic grid lines horizontal and vertical */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40" />
        {/* Horizontal scan line sweep */}
        <motion.div 
          animate={{ y: ["0%", "100%", "0%"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent absolute top-0"
        />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-8 md:py-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-tr from-${THEMES[theme].primary} to-${THEMES[theme].accent} flex items-center justify-center font-mono font-bold text-sm text-black shadow-[0_0_10px] shadow-${THEMES[theme].primary}/40`}>
            {THEMES[theme].name[0]}
          </div>
          <h1 className="text-xl font-mono font-bold tracking-widest text-slate-100 flex items-center gap-2">
            {THEMES[theme].name}
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-green-500/30 text-green-400 bg-green-500/10 tracking-widest font-normal uppercase animate-pulse">ACTIVE</span>
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Stark OS Systems Ribbon */}
          <div className="flex items-center gap-1 bg-black/60 border border-white/5 rounded-md p-0.5 font-mono text-[9px] tracking-wider relative shrink-0">
            {(Object.keys(THEMES) as ThemeType[]).map((key) => {
              const isSelected = theme === key;
              return (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`px-2 py-1 rounded transition-all flex items-center gap-1.5 uppercase font-bold text-[10px]
                    ${isSelected 
                      ? `bg-${THEMES[key].primary}/15 text-${THEMES[key].primary} border border-${THEMES[key].primary}/20 shadow-[0_0_8px_rgba(255,255,255,0.05)]` 
                      : "text-white/35 hover:text-white/85 hover:bg-white/5 border border-transparent"
                    }`}
                >
                  <span className={`w-1 h-1 rounded-full ${isSelected ? `bg-${THEMES[key].primary} animate-pulse` : "bg-white/20"}`} />
                  <span className="hidden lg:inline">{THEMES[key].name}</span>
                  <span className="lg:hidden">{THEMES[key].name[0]}</span>
                </button>
              );
            })}
          </div>

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
            className={`px-3 py-1.5 rounded-md border transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight font-mono
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
              className="p-2 rounded-md bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Clear Chat History"
            >
              <Trash2 size={16} className="opacity-70" />
            </button>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-md bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={16} className="opacity-70" />
            ) : (
              <Volume2 size={16} className="opacity-70" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content - Visualizer & Dual HUD Wings */}
      <main className="absolute inset-0 flex flex-col md:flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-24 pb-28 px-4 md:px-8 lg:px-12 pointer-events-none">
        
        {/* Left Column: SYSTEM STATUS & COMMAND CENTER */}
        <div className="hidden md:flex w-[320px] lg:w-[350px] h-full flex-col justify-between z-10 pointer-events-auto select-none gap-4">
          {/* Diagnostic Stats Widget */}
          <div className={`w-full bg-[#03090d]/65 backdrop-blur-md border border-${THEMES[theme].primary}/20 rounded-xl p-4 font-mono text-xs flex flex-col gap-2 relative overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.6)]`}>
            {/* Sci-Fi corner bars */}
            <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-${THEMES[theme].primary}`} />
            <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-${THEMES[theme].primary}`} />
            <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-${THEMES[theme].primary}`} />
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-${THEMES[theme].primary}`} />

            <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
              <span className={`text-${THEMES[theme].primary} font-bold tracking-widest`}>[ ZOYA SENSE CORE ]</span>
              <span className="text-white/40 text-[10px] animate-pulse">V__3.14_SASS</span>
            </div>

            <div className="flex flex-col gap-1.5 font-mono text-[11px] text-white/75 mt-1">
              <div className="flex justify-between">
                <span className="text-white/40">SYSTEM NAME:</span>
                <span className={`text-${THEMES[theme].accent} font-bold`}>{THEMES[theme].name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">USER SPEC:</span>
                <span className="truncate max-w-[140px]">{user ? (user.displayName || "LINKED SENSOR") : "SECURE PROFILE GUEST"}</span>
              </div>
              
              {/* Sarcasm levels driving off coreTemp */}
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/40">SARCASM LEVEL:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-[50px] bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ width: `${Math.round(Math.max(10, Math.min(100, (coreTemp - 30) * 10)))}%` }}
                      className={`h-full ${coreTemp > 40 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : `bg-${THEMES[theme].primary}`}`} 
                    />
                  </div>
                  <span className={`font-mono text-[10px] ${coreTemp > 40 ? 'text-red-400 font-bold animate-pulse' : 'text-slate-300'}`}>
                    {Math.round(Math.max(10, Math.min(100, (coreTemp - 30) * 10)))}%
                  </span>
                </div>
              </div>

              {/* Nakhra Index driving off cpuUsage */}
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/40">NAKHRA INDEX:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-[50px] bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ width: `${Math.max(20, cpuUsage)}%` }}
                      className={`h-full bg-${THEMES[theme].accent}`} 
                    />
                  </div>
                  <span className="font-mono text-[10px] min-w-[28px] text-right text-slate-300">{Math.max(20, cpuUsage)}%</span>
                </div>
              </div>

              {/* Chai levels driving off networkPing or dynamic stable status */}
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/40">CHAI QUOTA:</span>
                <span className="text-green-400 font-bold font-mono text-[10px]">
                  {networkPing > 28 ? "CRITICAL (NEED REFILL)" : "OPTIMAL (GARM)"}
                </span>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-white/45 text-[10px]">CURRENT SPECTRUM STATE:</span>
              <span className={`text-xs font-bold tracking-wider px-2 py-0.5 rounded uppercase font-sans flex items-center gap-1.5 bg-${THEMES[theme].primary}/10 text-${THEMES[theme].primary}`}>
                <span className="relative flex h-1.5 w-1.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-${THEMES[theme].primary} opacity-75`}></span>
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 bg-${THEMES[theme].primary}`}></span>
                </span>
                {appState}
              </span>
            </div>
          </div>

          {/* Core commands card lists */}
          <div className={`w-full bg-[#03090d]/65 backdrop-blur-md border border-${THEMES[theme].primary}/20 rounded-xl p-4 font-mono text-xs flex flex-col gap-2.5 relative overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.6)]`}>
            {/* Sci-Fi corner bents */}
            <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-${THEMES[theme].primary}`} />
            <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-${THEMES[theme].primary}`} />
            <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-${THEMES[theme].primary}`} />
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-${THEMES[theme].primary}`} />

            <div className="pb-1.5 border-b border-white/5">
              <span className={`text-${THEMES[theme].accent} font-bold tracking-widest`}>[ INTERACTION PATHWAYS ]</span>
            </div>

            <div className="flex flex-col gap-2 font-sans mt-0.5">
              {THEMES[theme].pathways.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setShowTextInput(true);
                    setTextInput(cmd.query);
                  }}
                  className={`w-full text-left p-2 rounded bg-white/5 border border-white/5 hover:border-${THEMES[theme].primary}/40 hover:bg-${THEMES[theme].primary}/10 transition-all font-mono text-[11px] group`}
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <span className={`text-${THEMES[theme].primary} font-bold group-hover:text-white transition-colors`}>{cmd.title}</span>
                    <span className="text-[9px] text-white/30 tracking-[0.2em]">ACTIVATE {">>"}</span>
                  </div>
                  <div className="text-[10px] text-white/50 leading-none truncate">{cmd.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Visualizer (Fixed Full Screen Background) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <Visualizer state={appState} theme={theme} />
        </div>

        {/* Right Column: HOLOGRAPHIC CHAT COGNITIVE FEED (LIFETIME MEMORY) */}
        <div className="flex w-full md:w-[350px] lg:w-[400px] h-full flex-col justify-end md:justify-between z-10 pointer-events-auto select-none gap-4">
          
          {/* State Indicator for Processing or Listening in Mobile (fallback) */}
          <div className="md:hidden self-center h-8 flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-xs tracking-widest mb-2">
            {appState === "processing" ? (
              <span className={`text-${THEMES[theme].accent} animate-pulse flex items-center gap-2`}>
                <Loader2 size={12} className="animate-spin" /> THINKING...
              </span>
            ) : appState === "listening" ? (
              <span className={`text-${THEMES[theme].primary} animate-pulse flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full bg-${THEMES[theme].primary} animate-ping`} /> HEARING WAVE...
              </span>
            ) : appState === "speaking" ? (
              <span className="text-green-400 animate-pulse">TRANSMITTING SPEECH...</span>
            ) : (
              <span className="text-white/40">SYSTEM STANDBY</span>
            )}
          </div>

          {/* Floating Memory Depot Feed */}
          <div className={`w-full h-[65dvh] md:h-full bg-[#03090d]/65 backdrop-blur-md border border-${THEMES[theme].primary}/20 rounded-xl p-4 font-mono text-xs flex flex-col justify-between relative overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.6)]`}>
            {/* Sci-Fi corner bents */}
            <div className={`absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-${THEMES[theme].primary}`} />
            <div className={`absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-${THEMES[theme].primary}`} />
            <div className={`absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-${THEMES[theme].primary}`} />
            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-${THEMES[theme].primary}`} />

            <div className="pb-2 border-b border-white/5 flex justify-between items-center shrink-0">
              <span className={`text-${THEMES[theme].primary} font-bold tracking-widest`}>[ COGNITIVE MEMORY FEED ]</span>
              <span className="text-[9px] text-white/30">SECURE DUPLEX CHNL</span>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto scrollbar-hide py-3 space-y-3.5 my-1.5 pr-1 text-[11px] leading-relaxed select-text">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-2 opacity-40 py-12">
                  <div className={`w-8 h-8 rounded-full border border-dashed border-${THEMES[theme].primary} flex items-center justify-center text-[10px]`}>
                    ?
                  </div>
                  <div className="text-[10px] tracking-wider uppercase">No active communication trace.</div>
                  <div className="text-[9px] lowercase leading-normal max-w-[200px]">Link profile or trigger "Start Session" voice coupling to write lifetime history.</div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div 
                      key={msg.id || idx} 
                      className={`flex flex-col gap-0.5 animate-fadeIn ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className={`text-[9px] tracking-widest uppercase font-bold text-white/40`}>
                        {isUser ? `[ USER ] >>` : `[ ${THEMES[theme].name} ] >>`}
                      </div>
                      <div 
                        className={`px-3 py-2 rounded-lg max-w-[90%] font-mono break-words border
                          ${isUser 
                            ? `bg-${THEMES[theme].primary}/10 border-${THEMES[theme].primary}/30 text-${THEMES[theme].accent}` 
                            : `bg-white/5 border-white/5 text-white/90`
                          }
                        `}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Micro feed info footer */}
            <div className="pt-2 border-t border-white/5 text-[9px] text-white/30 flex justify-between items-center shrink-0">
              <span>MEMORIES SYNCED: {messages.length} TRACES</span>
              <span>LIFETIME BUFFER ACTIVE</span>
            </div>
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
              className="w-full max-w-md flex items-center gap-2 bg-[#020508]/80 border border-white/10 rounded-md p-1.5 pl-4 backdrop-blur-md shadow-2xl relative"
            >
              {/* Sci-Fi accent border */}
              <div className={`absolute top-0 left-0 w-2 h-[2px] bg-${THEMES[theme].primary}`} />
              <div className={`absolute bottom-0 right-0 w-2 h-[2px] bg-${THEMES[theme].primary}`} />
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`Transmit command to ${THEMES[theme].name}...`}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/20 text-xs font-mono"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className={`p-2 rounded bg-${THEMES[theme].primary} hover:opacity-90 disabled:opacity-30 transition-all font-mono shadow-[0_0_8px] shadow-${THEMES[theme].primary}/30`}
              >
                <Send size={14} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-3 px-8 py-4 rounded-md font-mono text-sm tracking-widest transition-all duration-300 shadow-2xl overflow-hidden
              ${
                isSessionActive
                  ? "bg-red-500/15 text-red-400 border border-red-500/50 hover:bg-red-500/25"
                  : `bg-[#03090d]/60 text-white border border-${THEMES[theme].primary}/30 hover:bg-${THEMES[theme].primary}/10 hover:border-${THEMES[theme].primary}/60 hover:scale-105 shadow-[inset_0_0_10px_rgba(0,0,0,0.4)]`
              }
            `}
          >
            {/* Corner brackets */}
            {!isSessionActive && (
              <>
                <div className={`absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-${THEMES[theme].primary}`} />
                <div className={`absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-${THEMES[theme].primary}`} />
                <div className={`absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-${THEMES[theme].primary}`} />
                <div className={`absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-${THEMES[theme].primary}`} />
              </>
            )}
            {isSessionActive ? (
              <>
                <MicOff size={16} />
                <span className="font-bold">END SPECTRUM SYNC</span>
              </>
            ) : (
              <>
                <Mic size={16} className="group-hover:animate-pulse" />
                <span className="font-bold">INITIALIZE SPECTRUM SYNC</span>
              </>
            )}
          </button>
          
          {!isSessionActive && (
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className={`p-4 rounded-md bg-[#03090d]/60 border border-white/10 hover:border-${THEMES[theme].primary}/50 hover:bg-white/5 transition-all shadow-2xl`}
              title="Type instead"
            >
              <Keyboard size={16} className="opacity-70" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
