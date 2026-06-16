import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, Shield, Compass, Cpu, Zap } from "lucide-react";
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
type ThemeType = "obsidian" | "emerald" | "sunset" | "arctic" | "nebula" | "stark";

interface ThemeConfig {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  glow: string;
  themePrimaryHex: string;
  themeSecondaryHex: string;
  themeAccentHex: string;
  bgGrad: string;
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
    themePrimaryHex: "#8b5cf6",
    themeSecondaryHex: "#db2777",
    themeAccentHex: "#22d3ee",
    bgGrad: "radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.15) 0%, rgba(219, 39, 119, 0.05) 60%, #020508 100%)",
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
    themePrimaryHex: "#10b981",
    themeSecondaryHex: "#14b8a6",
    themeAccentHex: "#84cc16",
    bgGrad: "radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.15) 0%, rgba(20, 184, 166, 0.05) 60%, #020508 100%)",
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
    themePrimaryHex: "#f97316",
    themeSecondaryHex: "#dc2626",
    themeAccentHex: "#eab308",
    bgGrad: "radial-gradient(circle at 50% 50%, rgba(249, 115, 22, 0.15) 0%, rgba(220, 38, 38, 0.05) 60%, #020508 100%)",
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
    themePrimaryHex: "#0ea5e9",
    themeSecondaryHex: "#4f46e5",
    themeAccentHex: "#f472b6",
    bgGrad: "radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.15) 0%, rgba(79, 70, 229, 0.05) 60%, #020508 100%)",
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
    themePrimaryHex: "#d946ef",
    themeSecondaryHex: "#9333ea",
    themeAccentHex: "#818cf8",
    bgGrad: "radial-gradient(circle at 50% 50%, rgba(217, 70, 239, 0.15) 0%, rgba(147, 51, 234, 0.05) 60%, #020508 100%)",
    pathways: [
      { title: "Vibe Match Sync", query: "measure cosmic vibe levels of today in Hinglish", desc: "Check alignment with lunar sassy stars" },
      { title: "Developer Humour", query: "search the web for hilarious clean memes about developers and AI", desc: "Query database for top programmer humor" },
      { title: "Tapri Chai Audit", query: "diagnose global tapri chai quality standards vs starbucks", desc: "Run chemical analysis on local tea tapris" },
      { title: "Space Ambient Chill", query: "search youtube for deep space ambient music for coding focus", desc: "Stream atmospheric cosmic acoustic waves" }
    ]
  },
  stark: {
    name: "STARK: J.A.R.V.I.S.",
    primary: "cyan-500",
    secondary: "blue-600",
    accent: "orange-500",
    bg: "from-blue-950/25 via-cyan-950/10 to-[#010408]",
    glow: "shadow-cyan-400/60",
    themePrimaryHex: "#06b6d4",
    themeSecondaryHex: "#2563eb",
    themeAccentHex: "#f97316",
    bgGrad: "radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.16) 0%, rgba(37, 99, 235, 0.04) 65%, #010408 100%)",
    pathways: [
      { title: "Reactor Diagnostics", query: "activate Stark auxiliary reactor diagnostics and display energy output levels", desc: "Query main propulsion modules and RT core status" },
      { title: "Sensory Matrix Scan", query: "scan nearby airspace and local systems for anomalous readings", desc: "Engage primary orbital warning nodes" },
      { title: "Biological Roast", query: "give Shaktisinh a premium witty J.A.R.V.I.S. style roast with supreme dry humor", desc: "Initiate advanced dry-sarcastic commentary output" },
      { title: "AC/DC Rock Overload", query: "recommend legendary heavy classic rock songs suitable for an armored flight", desc: "Select high-amplitude mechanical audio tracks" }
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

function playHudBeep(type: 'click' | 'warning' | 'success' | 'hologram' | 'sweep' = 'click') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'warning') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.setValueAtTime(220, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'hologram') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'sweep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1800, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    // AudioContext blocked or not supported yet, ignore gracefully
  }
}

function SegmentedGauge({ value, color, maxBlocks = 8 }: { value: number; color: string; maxBlocks?: number }) {
  const filledBlocks = Math.round((Math.max(0, Math.min(100, value)) / 100) * maxBlocks);
  return (
    <div className="flex gap-[3px] items-center">
      {Array.from({ length: maxBlocks }).map((_, i) => {
        const isFilled = i < filledBlocks;
        return (
          <div
            key={i}
            className="w-[5px] h-2.5 rounded-[1px] transition-all duration-300"
            style={{
              backgroundColor: isFilled ? color : "rgba(255, 255, 255, 0.05)",
              boxShadow: isFilled ? `0 0 5px ${color}88` : "none"
            }}
          />
        );
      })}
    </div>
  );
}

const hudActions = [
  { icon: Shield, query: "engage Mark 85 tactical defensive shield diagnostics and report protective integrity", label: "DEFENSE_SYS", beep: "success" as const },
  { icon: Zap, query: "activate Stark auxiliary Arc Reactor diagnostics and report core output status", label: "REACTOR_CAP", beep: "sweep" as const },
  { icon: Compass, query: "scan nearby airspace and local networks for anomalous system signatures", label: "AIR_SCAN", beep: "hologram" as const },
  { icon: Cpu, query: "initialize core J.A.R.V.I.S. personality diagnostics and measure relative dry-wit humor index", label: "NEURAL_CPU", beep: "click" as const },
];

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [user, setUser] = useState<User | null>(null);
  const [theme, setTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("zoya_theme");
    return (saved as ThemeType) || "stark";
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

  const currentThemeConfig = THEMES[theme];

  return (
    <div 
      className="h-[100dvh] w-screen text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0 transition-all duration-700"
      style={{ background: currentThemeConfig.bgGrad }}
    >
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* Cinematic Background Gradients & Sci-Fi Scanning Grid */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div 
          className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] blur-[130px] rounded-full transition-all duration-700 opacity-60" 
          style={{ backgroundColor: `${currentThemeConfig.themePrimaryHex}22` }}
        />
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] blur-[130px] rounded-full transition-all duration-700 opacity-60" 
          style={{ backgroundColor: `${currentThemeConfig.themeSecondaryHex}1a` }}
        />
        
        {/* Holographic grid lines horizontal and vertical */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none opacity-50" />
        
        {/* Horizontal laser scan line sweep */}
        <motion.div 
          animate={{ y: ["0%", "100%", "0%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="w-full h-[1px] absolute left-0 top-0 opacity-40"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${currentThemeConfig.themePrimaryHex}55 50%, transparent 100%)`
          }}
        />

      </div>
 
       {/* Header */}
       <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-8 md:py-5 border-b border-white/5 bg-[#010408]/30 backdrop-blur-md">
         <div className="flex items-center gap-3">
           {/* Reactor Logo Node */}
           <div 
             className="relative w-10 h-10 rounded-full flex items-center justify-center border font-mono font-bold text-sm select-none transition-all duration-500 animate-fadeIn"
             style={{
               borderColor: `${currentThemeConfig.themePrimaryHex}88`,
               backgroundColor: `${currentThemeConfig.themePrimaryHex}11`,
               boxShadow: `0 0 16px ${currentThemeConfig.themePrimaryHex}55`
             }}
           >
             {/* Spinning decorative ring */}
             <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
               className="absolute inset-[-4px] rounded-full border border-dashed opacity-75"
               style={{ borderColor: currentThemeConfig.themePrimaryHex }}
             />
             {theme === "stark" ? (
               /* Miniature Arc Reactor Core Visual symbol */
               <div className="relative w-6 h-6 rounded-full border border-cyan-400/50 flex items-center justify-center bg-cyan-950/40">
                 <div className="w-2 rounded-full h-2 bg-cyan-300" style={{ boxShadow: '0 0 10px #22d3ee' }} />
                 {Array.from({ length: 6 }).map((_, i) => (
                   <div 
                     key={i} 
                     className="absolute w-[1px] h-6 bg-cyan-400/30"
                     style={{ transform: `rotate(${i * 30}deg)` }}
                   />
                 ))}
               </div>
             ) : (
               <span style={{ color: currentThemeConfig.themeAccentHex }} className="text-xs tracking-wider">
                 {theme[0].toUpperCase()}
               </span>
             )}
           </div>
 
           {theme === "stark" ? (
             <div className="flex flex-col select-none animate-fadeIn">
               <h1 className="text-sm md:text-base font-mono font-extrabold tracking-[0.2em] text-cyan-400 flex items-center gap-1.5 leading-none">
                 STARK INDUSTRIES
                 <span 
                   className="text-[7px] px-1 py-0.5 rounded border tracking-widest font-bold uppercase bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                 >
                   MARK LXXXV // J.A.R.V.I.S.
                 </span>
               </h1>
               <span className="text-[8px] text-white/40 font-mono tracking-widest mt-1 uppercase">TACTICAL NEURAL VOICE COUPLING</span>
             </div>
           ) : (
             <div className="flex flex-col select-none">
               <h1 className="text-base font-mono font-bold tracking-widest text-slate-100 flex items-center gap-2">
                 {currentThemeConfig.name}
                 <span 
                   className="text-[8px] px-1.5 py-0.5 rounded border tracking-widest font-normal uppercase animate-pulse"
                   style={{ 
                     borderColor: "rgba(16, 185, 129, 0.3)", 
                     color: "#10b981",
                     backgroundColor: "rgba(16, 185, 129, 0.1)"
                   }}
                 >
                   ONLINE
                 </span>
               </h1>
               <span className="text-[9px] text-white/30 font-mono tracking-wider">SASS-INFUSED ASSISTANT</span>
             </div>
           )}
         </div>

        <div className="flex items-center gap-3">
          {/* Cyber Theme Systems Ribbon */}
          <div className="flex items-center gap-1 bg-black/60 border border-white/10 rounded-lg p-0.5 font-mono text-[9px] tracking-wider relative shrink-0">
            {(Object.keys(THEMES) as ThemeType[]).map((key) => {
              const isSelected = theme === key;
              const tConf = THEMES[key];
              return (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`px-2 py-1 rounded transition-all flex items-center gap-1 uppercase font-bold text-[9px] cursor-pointer
                    ${isSelected 
                      ? "border" 
                      : "text-white/30 hover:text-white/80 hover:bg-white/5 border border-transparent"
                    }`}
                  style={isSelected ? {
                    backgroundColor: `${tConf.themePrimaryHex}15`,
                    borderColor: `${tConf.themePrimaryHex}33`,
                    color: tConf.themePrimaryHex,
                    boxShadow: `0 0 10px ${tConf.themePrimaryHex}15`
                  } : {}}
                >
                  <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: tConf.themePrimaryHex }} />
                  <span className="hidden lg:inline">{tConf.name.split(': ')[1] || tConf.name}</span>
                  <span className="lg:hidden">{tConf.name.split(': ')[1]?.[0] || tConf.name[0]}</span>
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
            className="px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight font-mono cursor-pointer"
            style={user ? {
              backgroundColor: `${currentThemeConfig.themePrimaryHex}11`,
              borderColor: `${currentThemeConfig.themePrimaryHex}33`,
              color: currentThemeConfig.themePrimaryHex
            } : {
              backgroundColor: "rgba(255,255,255,0.03)",
              borderColor: "rgba(255,255,255,0.08)",
              color: "rgba(148, 163, 184, 0.7)"
            }}
          >
            <div 
              className="w-1.5 h-1.5 rounded-full" 
              style={{ 
                backgroundColor: user ? currentThemeConfig.themePrimaryHex : "rgba(255,255,255,0.3)",
                boxShadow: user ? `0 0 5px ${currentThemeConfig.themePrimaryHex}` : "none"
              }} 
            />
            {user ? "PROFILE ACTIVE" : "SYNC PROFILE"}
          </button>

          {messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear the chat history?")) {
                  setMessages([]);
                  resetZoyaSession();
                }
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-red-500/15 hover:text-red-400 transition-colors border border-white/10 cursor-pointer"
              title="Clear Memory Trace"
            >
              <Trash2 size={15} className="opacity-70" />
            </button>
          )}

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
            title={isMuted ? "Unmute Synthesis" : "Mute Synthesis"}
          >
            {isMuted ? (
              <VolumeX size={15} className="opacity-70" />
            ) : (
              <Volume2 size={15} className="opacity-70" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content - Visualizer & Dual HUD Wings */}
      <main className="absolute inset-0 flex flex-col md:flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-24 pb-28 px-4 md:px-8 lg:px-12 pointer-events-none">
        
        {/* Left Column: SYSTEM STATUS & COMMAND CENTER */}
        <div className="hidden md:flex w-[310px] lg:w-[340px] h-full flex-col justify-between z-10 pointer-events-auto select-none gap-4">
          
          {/* Dynamic Lunar/Calendar Date Ring Module */}
          <div className="w-full bg-[#02060b]/70 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex items-center justify-between font-mono relative overflow-hidden">
            {/* Corner tech accents */}
            <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />

            <div className="flex items-center gap-3 select-none">
              {/* Concentric Rotating Calendar Dial */}
              <div className="relative w-16 h-16 rounded-full flex items-center justify-center border font-mono font-bold select-none" style={{ borderColor: `${currentThemeConfig.themePrimaryHex}33`, background: `radial-gradient(circle, ${currentThemeConfig.themePrimaryHex}05 0%, transparent 80%)` }}>
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border border-dashed text-[5px] text-white/30"
                  style={{ borderColor: `${currentThemeConfig.themePrimaryHex}44` }}
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-4px] rounded-full border border-dotted"
                  style={{ borderColor: `${currentThemeConfig.themeAccentHex}22` }}
                />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] tracking-widest text-white/40 uppercase font-sans">
                    {new Date().toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                  </span>
                  <span className="text-xl font-bold leading-none" style={{ color: currentThemeConfig.themePrimaryHex }}>
                    {new Date().toLocaleDateString('en-US', { day: '2-digit' })}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-widest leading-none select-none" style={{ color: currentThemeConfig.themeAccentHex }}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}
                </span>
                <span className="text-[9px] text-white/30 mt-0.5 select-none font-mono">STARK_CALENDAR_NODE_A1</span>
                <div className="flex gap-1 mt-1">
                  <span className="text-[8px] text-white/30 font-bold px-1 py-[1.2px] rounded bg-white/5">SYS: OK</span>
                  <span className="text-[8px] font-bold px-1 py-[1.2px] rounded text-cyan-400 bg-cyan-500/10">STABLE</span>
                </div>
              </div>
            </div>

            {/* Disk / Storage specifications shown in Stark HUD Reference image */}
            <div className="flex flex-col text-right text-[9px] text-white/40 gap-0.5 max-w-[125px]">
              <div className="flex justify-between gap-2">
                <span>DISK_CAP:</span>
                <span className="font-bold text-white/85">450 G</span>
              </div>
              <div className="flex justify-between gap-2">
                <span>FREE_VOL:</span>
                <span className="font-bold text-cyan-400">209 G</span>
              </div>
              <div className="w-20 h-[3px] bg-white/5 rounded-full overflow-hidden self-end mt-0.5">
                <div className="h-full bg-cyan-400" style={{ width: '46%' }}></div>
              </div>
            </div>
          </div>

          {/* Diagnostic Stats Widget */}
          <div 
            className="w-full bg-[#02060b]/75 backdrop-blur-xl border rounded-xl p-4 font-mono text-xs flex flex-col gap-3 relative overflow-hidden transition-all duration-700"
            style={{ 
              borderColor: `${currentThemeConfig.themePrimaryHex}25`,
              boxShadow: `inset 0 0 15px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5)`
            }}
          >
            {/* Tech bracket accents */}
            <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />

            <div className="flex justify-between items-center pb-2 border-b border-white/5 select-none">
              <span className="font-bold tracking-widest text-[11px]" style={{ color: currentThemeConfig.themePrimaryHex }}>
                [ SYSTEM DIAGNOSTICS ]
              </span>
              <span className="text-white/30 text-[9px] uppercase tracking-widest leading-none">SYS_V3.14_SASS</span>
            </div>

            <div className="flex flex-col gap-2 font-mono text-[11px] text-white/80">
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase">ACTIVE CORES:</span>
                <span className="font-bold text-white/95">{currentThemeConfig.name.split(': ')[1] || "OBSIDIAN"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase">OPERATOR:</span>
                <span className="truncate max-w-[130px] font-bold text-white/90" style={{ color: currentThemeConfig.themeAccentHex }}>
                  {user ? (user.displayName || "LINKED SENSOR") : "GUEST PROFILE"}
                </span>
              </div>
              
              {/* Sarcasm levels driving off coreTemp */}
              <div className="flex justify-between items-center mt-1">
                <span className="text-white/40 uppercase">SARCASM RATIO:</span>
                <div className="flex items-center gap-2">
                  <SegmentedGauge 
                    value={Math.round(Math.max(10, Math.min(100, (coreTemp - 30) * 10)))} 
                    color={coreTemp > 40 ? "#ef4444" : currentThemeConfig.themePrimaryHex} 
                  />
                  <span 
                    className="font-mono text-[10px] min-w-[28px] text-right"
                    style={{ color: coreTemp > 40 ? "#f87171" : "#cbd5e1" }}
                  >
                    {Math.round(Math.max(10, Math.min(100, (coreTemp - 30) * 10)))}%
                  </span>
                </div>
              </div>

              {/* Nakhra Index driving off cpuUsage */}
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase">NAKHRA INDEX:</span>
                <div className="flex items-center gap-2">
                  <SegmentedGauge 
                    value={Math.max(20, cpuUsage)} 
                    color={currentThemeConfig.themeAccentHex} 
                  />
                  <span className="font-mono text-[10px] min-w-[28px] text-right text-slate-300">
                    {Math.max(20, cpuUsage)}%
                  </span>
                </div>
              </div>

              {/* Chai levels driving off networkPing or dynamic stable status */}
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase">CHAI SUPPLY:</span>
                <span className="font-bold font-mono text-[10px] uppercase text-right" style={{ color: networkPing > 28 ? "#fb7185" : "#34d399" }}>
                  {networkPing > 28 ? "Refill Critical" : "85% - optimal (garm)"}
                </span>
              </div>
            </div>
            
            <div className="mt-1 pt-2 border-t border-white/5 flex items-center justify-between select-none">
              <span className="text-white/30 text-[9px] uppercase tracking-wider">COGNITIVE SPECTRUM:</span>
              <span 
                className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded uppercase font-sans flex items-center gap-1.5"
                style={{ 
                  backgroundColor: `${currentThemeConfig.themePrimaryHex}15`, 
                  color: currentThemeConfig.themePrimaryHex
                }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: currentThemeConfig.themePrimaryHex }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: currentThemeConfig.themePrimaryHex }} />
                </span>
                {appState}
              </span>
            </div>
          </div>

          {/* Interaction Pathways Section */}
          <div 
            className="w-full bg-[#02060b]/75 backdrop-blur-xl border rounded-xl p-4 font-mono text-xs flex flex-col gap-2.5 relative overflow-hidden transition-all duration-700"
            style={{ 
              borderColor: `${currentThemeConfig.themePrimaryHex}25`,
              boxShadow: `inset 0 0 15px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5)`
            }}
          >
            {/* Corner brackes */}
            <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />

            <div className="pb-1.5 border-b border-white/5 select-none">
              <span className="font-bold tracking-widest text-[11px]" style={{ color: currentThemeConfig.themeAccentHex }}>
                [ TACTICAL INVITATIONS ]
              </span>
            </div>

            <div className="flex flex-col gap-2 font-sans mt-1">
              {currentThemeConfig.pathways.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setShowTextInput(true);
                    setTextInput(cmd.query);
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-white/[0.02] border transition-all font-mono text-[11px] group cursor-pointer hover:scale-[1.02]"
                  style={{
                    borderColor: "rgba(255,255,255,0.03)",
                    borderLeft: `3px solid ${currentThemeConfig.themePrimaryHex}`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${currentThemeConfig.themePrimaryHex}44`;
                    e.currentTarget.style.backgroundColor = `${currentThemeConfig.themePrimaryHex}11`;
                    e.currentTarget.style.boxShadow = `0 0 8px ${currentThemeConfig.themePrimaryHex}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold group-hover:text-white transition-colors" style={{ color: currentThemeConfig.themePrimaryHex }}>
                      {cmd.title}
                    </span>
                    <span className="text-[8px] text-white/30 tracking-[0.2em] font-bold group-hover:text-white/60">DEPLOY {">>"}</span>
                  </div>
                  <div className="text-[10px] text-white/40 leading-tight truncate group-hover:text-white/60 transition-colors">
                    {cmd.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Visualizer (Positioned perfectly behind text windows) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <Visualizer state={appState} theme={theme} />
        </div>

        {/* Right Column: HOLOGRAPHIC COGNITIVE MEMORY FEED */}
        <div className="flex w-full md:w-[350px] lg:w-[400px] h-full flex-col justify-end md:justify-between z-10 pointer-events-auto select-none gap-4">
          
          {/* Mobile Status Indicator Overlay */}
          <div className="md:hidden self-center h-8 flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-[#020509]/85 border border-white/10 text-[10px] tracking-widest font-mono mb-2 backdrop-blur-md select-none">
            {appState === "processing" ? (
              <span className="animate-pulse flex items-center gap-1.5" style={{ color: currentThemeConfig.themeAccentHex }}>
                <Loader2 size={11} className="animate-spin" /> SOLVING EQUATIONS...
              </span>
            ) : appState === "listening" ? (
              <span className="animate-pulse flex items-center gap-1.5" style={{ color: currentThemeConfig.themePrimaryHex }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: currentThemeConfig.themePrimaryHex }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: currentThemeConfig.themePrimaryHex }} />
                </span> 
                COUPLED MIC SIGNAL ACTIVE...
              </span>
            ) : appState === "speaking" ? (
              <span className="text-green-400 animate-pulse flex items-center gap-1.5">
                <Volume2 size={12} className="animate-bounce" /> VOICING RESPONSE...
              </span>
            ) : (
              <span className="text-white/30 uppercase tracking-[0.2em]">STANDBY MODULE ACTIVE</span>
            )}
          </div>

          {/* Stark HUD System Load Panel */}
          <div 
            className="hidden md:flex w-full bg-[#02060b]/75 backdrop-blur-xl border rounded-xl p-3.5 font-mono text-xs flex flex-col gap-2 relative overflow-hidden transition-all duration-700 select-none"
            style={{ 
              borderColor: `${currentThemeConfig.themePrimaryHex}25`,
              boxShadow: `inset 0 0 15px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5)`
            }}
          >
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />

            <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
              <span className="font-bold tracking-widest text-[11px]" style={{ color: currentThemeConfig.themePrimaryHex }}>
                [ SYSTEM DIAGNOSTICS & STATUS ]
              </span>
              <span className="font-bold text-[9px]" style={{ color: currentThemeConfig.themeAccentHex }}>STARK_V8.5_SYS</span>
            </div>

            <div className="flex flex-col gap-2 text-[10px]">
              {/* CPU Usage progress bar */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-white/50 text-[9px] uppercase tracking-wider">
                  <span>ARMOR CORE CPU:</span>
                  <span className="font-bold text-white/95">{cpuUsage}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                  <div className="h-full transition-all duration-500" style={{ width: `${cpuUsage}%`, backgroundColor: currentThemeConfig.themePrimaryHex }} />
                </div>
              </div>

              {/* RAM Usage progress bar */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-white/50 text-[9px] uppercase tracking-wider">
                  <span>SYSTEM MEMORY RES:</span>
                  <span className="font-bold text-white/95">34% [12.2 GB / 64 GB]</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: '34%' }} />
                </div>
              </div>

              {/* SWAP Buffer progress bar */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between text-white/50 text-[9px] uppercase tracking-wider">
                  <span>REACTOR HEAT DISCHARGE:</span>
                  <span className="font-bold text-white/95" style={{ color: coreTemp > 40 ? '#ef4444' : '#10b981' }}>{cpuUsage > 50 ? '82% - HIGH' : '39% - STABLE'}</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                  <div className="h-full transition-all duration-500" style={{ width: cpuUsage > 50 ? '82%' : '39%', backgroundColor: cpuUsage > 50 ? '#ef4444' : '#10b981' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Floating Memory Depot Feed */}
          <div 
            className="w-full h-[65dvh] md:h-full bg-[#02060b]/75 backdrop-blur-xl border rounded-xl p-4 font-mono text-xs flex flex-col justify-between relative overflow-hidden transition-all duration-700"
            style={{ 
              borderColor: `${currentThemeConfig.themePrimaryHex}25`,
              boxShadow: `inset 0 0 15px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5)`
            }}
          >
            {/* Tech brackets */}
            <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2" style={{ borderColor: currentThemeConfig.themePrimaryHex }} />

            <div className="pb-2 border-b border-white/5 flex justify-between items-center shrink-0 select-none">
              <span className="font-bold tracking-widest text-[11px]" style={{ color: currentThemeConfig.themePrimaryHex }}>
                [ COGNITIVE TRANSMISSIONS ]
              </span>
              <span className="text-[9px] text-white/30 tracking-widest uppercase">REC_FEED_A7</span>
            </div>

            {/* Chat List */}
            <div className="flex-1 overflow-y-auto scrollbar-hide py-3 space-y-4 my-1 pr-1 text-[11px] leading-relaxed select-text">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-3 opacity-30 py-12 select-none">
                  <div 
                    className="w-12 h-12 rounded-full border border-dashed flex items-center justify-center text-xs"
                    style={{ borderColor: currentThemeConfig.themePrimaryHex }}
                  >
                    💡
                  </div>
                  <div className="text-[11px] tracking-widest uppercase font-bold" style={{ color: currentThemeConfig.themePrimaryHex }}>
                    Grid Sync Required
                  </div>
                  <div className="text-[10px] lowercase leading-relaxed max-w-[210px] text-white/70">
                    Couple the biological mic transceiver below or feed a text package to populate cybernetic log banks.
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div 
                      key={msg.id || idx} 
                      className={`flex flex-col gap-1 w-full animate-fadeIn ${isUser ? "items-end" : "items-start"}`}
                    >
                      <div className="text-[8.5px] tracking-widest uppercase font-bold text-white/30 select-none">
                        {isUser ? `[ BIOLOGICAL GUEST // OUT ] ==` : `[ ${currentThemeConfig.name} // IN ] ==`}
                      </div>
                      <div 
                        className="px-3.5 py-2.5 rounded-xl max-w-[88%] font-mono break-words border text-[11px] leading-relaxed transition-all duration-300"
                        style={isUser ? {
                          backgroundColor: `${currentThemeConfig.themePrimaryHex}11`,
                          borderColor: `${currentThemeConfig.themePrimaryHex}33`,
                          color: currentThemeConfig.themeAccentHex,
                          boxShadow: `0 2px 8px ${currentThemeConfig.themePrimaryHex}10`
                        } : {
                          backgroundColor: "rgba(255, 255, 255, 0.03)",
                          borderColor: "rgba(255, 255, 255, 0.05)",
                          color: "rgba(241, 245, 249, 0.95)"
                        }}
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
            <div className="pt-2 border-t border-white/5 text-[9px] text-white/30 flex justify-between items-center shrink-0 select-none">
              <span>SYNC_STREAMS: {messages.length} NODES</span>
              <span className="uppercase tracking-widest text-[#34d399] animate-pulse">LIFETIME MATRIX ACTIVE</span>
            </div>
          </div>
        </div>

      </main>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        
        {/* Sleek Text console input */}
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              onSubmit={handleTextSubmit}
              className="w-[90%] max-w-md flex items-center gap-2 bg-[#020509]/90 border border-white/10 rounded-xl p-2 pl-4 backdrop-blur-xl shadow-2xl relative"
            >
              <div className="absolute top-0 left-4 w-4 h-[1px]" style={{ backgroundColor: currentThemeConfig.themePrimaryHex }} />
              <div className="absolute bottom-0 right-4 w-4 h-[1px]" style={{ backgroundColor: currentThemeConfig.themePrimaryHex }} />
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`Deploy command sequence to ${theme.toUpperCase()}...`}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/20 text-xs font-mono"
                autoFocus
                style={{ caretColor: currentThemeConfig.themeAccentHex }}
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="p-2 rounded-lg transition-all font-mono shadow-md cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: currentThemeConfig.themePrimaryHex,
                  color: "#000000"
                }}
              >
                <Send size={12} className="stroke-[2.5]" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Central Core Triggers & Stark Taskbar Row */}
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-7 my-2">
          {/* Stark Action Deck - Left Side */}
          <div className="hidden md:flex items-center gap-3">
            {[hudActions[0], hudActions[1]].map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  playHudBeep(action.beep);
                  setShowTextInput(true);
                  setTextInput(action.query);
                }}
                className="w-11 h-11 rounded-full border flex flex-col items-center justify-center bg-[#010408]/80 text-white/50 cursor-pointer hover:scale-105 transition-all duration-300"
                style={{
                  borderColor: `${currentThemeConfig.themePrimaryHex}22`,
                  boxShadow: `0 0 10px ${currentThemeConfig.themePrimaryHex}05`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${currentThemeConfig.themePrimaryHex}bb`;
                  e.currentTarget.style.color = currentThemeConfig.themePrimaryHex;
                  e.currentTarget.style.boxShadow = `0 0 15px ${currentThemeConfig.themePrimaryHex}33`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${currentThemeConfig.themePrimaryHex}22`;
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                title={action.query}
              >
                <action.icon size={15} />
                <span className="text-[6px] tracking-tighter mt-0.5 opacity-60 font-mono">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Central Coupled Core Unit */}
          <div className="flex items-center gap-5">
            {/* Reactor Button Core */}
            <button
              type="button"
              onClick={() => {
                playHudBeep(isSessionActive ? 'warning' : 'sweep');
                toggleListening();
              }}
              className="group relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 transform active:scale-95 cursor-pointer z-10"
              style={{
                backgroundColor: isSessionActive ? "rgba(239, 68, 68, 0.1)" : `${currentThemeConfig.themePrimaryHex}11`
              }}
            >
              {/* Pulsing Concentric Ripple Rings */}
              <motion.div
                animate={{ scale: isSessionActive ? [1, 1.6, 1] : [1, 1.15, 1], opacity: isSessionActive ? [0.4, 0, 0.4] : [0.2, 0.4, 0.2] }}
                transition={{ duration: isSessionActive ? 1.4 : 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full border"
                style={{ borderColor: isSessionActive ? "rgba(239, 68, 68, 0.4)" : currentThemeConfig.themePrimaryHex }}
              />
              {isSessionActive && (
                <motion.div
                  animate={{ scale: [1, 2.1], opacity: [0.3, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full border-2"
                  style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}
                />
              )}

              {/* Rotating Gear Outline */}
              <motion.div
                animate={{ rotate: isSessionActive ? 360 : -360 }}
                transition={{ duration: isSessionActive ? 2.5 : 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-2 rounded-full border border-dashed opacity-55"
                style={{ borderColor: isSessionActive ? "rgba(239, 68, 68, 0.5)" : currentThemeConfig.themeAccentHex }}
              />

              {/* Solid Active Inner CORE */}
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg"
                style={{
                  backgroundColor: isSessionActive ? "#ef4444" : currentThemeConfig.themePrimaryHex,
                  boxShadow: isSessionActive 
                    ? "0 0 25px rgba(239, 68, 68, 0.6)" 
                    : `0 0 20px ${currentThemeConfig.themePrimaryHex}55`
                }}
              >
                {isSessionActive ? (
                  <MicOff size={22} className="text-black stroke-[2.5]" />
                ) : (
                  <Mic size={22} className="text-black stroke-[2.5] group-hover:scale-110 transition-transform" />
                )}
              </div>
              
              {/* Ambient hover tag */}
              <div className="absolute bottom-[-22px] text-[8.5px] font-mono tracking-widest text-white/50 group-hover:text-white transition-colors uppercase select-none">
                {isSessionActive ? "TERM_SYNC" : "COUPLE_CORE"}
              </div>
            </button>
            
            {!isSessionActive && (
              <button
                type="button"
                onClick={() => {
                  playHudBeep('click');
                  setShowTextInput(!showTextInput);
                }}
                className="p-3.5 rounded-full bg-[#020509]/60 border border-white/10 hover:border-white/20 transition-all shadow-xl cursor-pointer hover:scale-105"
                title="Compile Command Input"
                style={{
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${currentThemeConfig.themePrimaryHex}55`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.1)";
                }}
              >
                <Keyboard size={15} className="opacity-70 text-slate-300" />
              </button>
            )}
          </div>

          {/* Stark Action Deck - Right Side */}
          <div className="hidden md:flex items-center gap-3">
            {[hudActions[2], hudActions[3]].map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  playHudBeep(action.beep);
                  setShowTextInput(true);
                  setTextInput(action.query);
                }}
                className="w-11 h-11 rounded-full border flex flex-col items-center justify-center bg-[#010408]/80 text-white/50 cursor-pointer hover:scale-105 transition-all duration-300"
                style={{
                  borderColor: `${currentThemeConfig.themePrimaryHex}22`,
                  boxShadow: `0 0 10px ${currentThemeConfig.themePrimaryHex}05`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${currentThemeConfig.themePrimaryHex}bb`;
                  e.currentTarget.style.color = currentThemeConfig.themePrimaryHex;
                  e.currentTarget.style.boxShadow = `0 0 15px ${currentThemeConfig.themePrimaryHex}33`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = `${currentThemeConfig.themePrimaryHex}22`;
                  e.currentTarget.style.color = "rgba(255,255,255,0.5)";
                  e.currentTarget.style.boxShadow = "none";
                }}
                title={action.query}
              >
                <action.icon size={15} />
                <span className="text-[6px] tracking-tighter mt-0.5 opacity-60 font-mono">{action.label}</span>
              </button>
            ))}
          </div>

          {/* Portable Mobile row of actions */}
          <div className="flex md:hidden items-center gap-2 mt-4 select-none">
            {hudActions.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  playHudBeep(action.beep);
                  setShowTextInput(true);
                  setTextInput(action.query);
                }}
                className="w-9 h-9 rounded-full border flex items-center justify-center bg-[#010408]/80 text-white/60 active:scale-95"
                style={{ borderColor: `${currentThemeConfig.themePrimaryHex}33` }}
                title={action.query}
              >
                <action.icon size={13} />
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
