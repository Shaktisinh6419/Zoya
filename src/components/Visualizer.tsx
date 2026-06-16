import { motion } from "motion/react";

type VisualizerState = "idle" | "listening" | "processing" | "speaking";
type ThemeType = "obsidian" | "emerald" | "sunset" | "arctic" | "nebula" | "stark";

interface VisualizerProps {
  state: VisualizerState;
  theme: ThemeType;
}

export default function Visualizer({ state, theme }: VisualizerProps) {
  // Helper to get animation duration depending on state
  const getSpeed = (base: number) => {
    switch (state) {
      case "listening": return base * 0.4;
      case "processing": return base * 0.2;
      case "speaking": return base * 0.6;
      default: return base;
    }
  };

  const getThemeColors = () => {
    const colors: Record<ThemeType, { 
      primary: string; 
      secondary: string; 
      accent: string; 
      glow: string;
      colorHex: string;
    }> = {
      obsidian: {
        primary: "rgba(139, 92, 246, 1)", // Violet (ZOYA: Obsidian)
        secondary: "rgba(219, 39, 119, 1)", // Pink
        accent: "rgba(34, 211, 238, 1)", // Cyan
        glow: "rgba(139, 92, 246, 0.4)",
        colorHex: "#8b5cf6"
      },
      emerald: {
        primary: "rgba(16, 185, 129, 1)", // Emerald (ZOYA: Emerald)
        secondary: "rgba(20, 184, 166, 1)", // Teal
        accent: "rgba(132, 204, 22, 1)", // Lime
        glow: "rgba(16, 185, 129, 0.4)",
        colorHex: "#10b981"
      },
      sunset: {
        primary: "rgba(249, 115, 22, 1)", // Orange (ZOYA: Sunset)
        secondary: "rgba(220, 38, 38, 1)", // Red
        accent: "rgba(234, 179, 8, 1)", // Yellow
        glow: "rgba(249, 115, 22, 0.4)",
        colorHex: "#f97316"
      },
      arctic: {
        primary: "rgba(14, 165, 233, 1)", // Sky (ZOYA: Arctic)
        secondary: "rgba(79, 70, 229, 1)", // Indigo
        accent: "rgba(244, 114, 182, 1)", // Pink
        glow: "rgba(14, 165, 233, 0.4)",
        colorHex: "#0ea5e9"
      },
      nebula: {
        primary: "rgba(217, 70, 239, 1)", // Fuchsia (ZOYA: Nebula)
        secondary: "rgba(147, 51, 234, 1)", // Purple
        accent: "rgba(129, 140, 248, 1)", // Indigo
        glow: "rgba(217, 70, 239, 0.4)",
        colorHex: "#d946ef"
      },
      stark: {
        primary: "rgba(6, 182, 212, 1)", // Cyan (STARK HUD)
        secondary: "rgba(37, 99, 235, 1)", // Blue
        accent: "rgba(249, 115, 22, 1)", // Orange
        glow: "rgba(6, 182, 212, 0.45)",
        colorHex: "#06b6d4"
      }
    };
    return colors[theme];
  };

  const tc = getThemeColors();

  return (
    <div className="relative w-72 h-72 md:w-[420px] md:h-[420px] flex items-center justify-center pointer-events-none select-none">
      {/* Background Holographic Radar Lines */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] opacity-40 rounded-full" />
      
      {/* Laser HUD Scanning sweep */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: getSpeed(10), repeat: Infinity, ease: "linear" }}
        className="absolute inset-2 md:inset-6 rounded-full border border-transparent origin-center opacity-20"
        style={{
          background: `conic-gradient(from 0deg, ${tc.primary} 0deg, transparent 90deg, transparent 360deg)`
        }}
      />

      {/* Outer Compass Tick Rings */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: getSpeed(40), repeat: Infinity, ease: "linear" }}
        className="absolute w-full h-full rounded-full border border-dashed opacity-25"
        style={{ borderColor: tc.primary, strokeWidth: "1px" }}
      />
      
      {/* Outer Concentric Tech Target HUD */}
      <svg className="absolute w-[105%] h-[105%] opacity-15" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="48" fill="none" stroke={tc.primary} strokeWidth="0.25" strokeDasharray="3 1" />
        <circle cx="50" cy="50" r="46" fill="none" stroke={tc.primary} strokeWidth="0.1" />
        <line x1="50" y1="0" x2="50" y2="100" stroke={tc.primary} strokeWidth="0.15" strokeDasharray="2 2" />
        <line x1="0" y1="50" x2="100" y2="50" stroke={tc.primary} strokeWidth="0.15" strokeDasharray="2 2" />
      </svg>

      {/* Dual Rotating Gear Dials */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: getSpeed(14), repeat: Infinity, ease: "linear" }}
        className="absolute w-[82%] h-[82%] rounded-full border-4 border-double opacity-20 flex items-center justify-center"
        style={{ borderColor: tc.secondary }}
      />

      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: getSpeed(24), repeat: Infinity, ease: "linear" }}
        className="absolute w-[76%] h-[76%] rounded-full border opacity-30"
        style={{ borderColor: tc.primary, borderStyle: "dotted", borderWidth: "2px" }}
      />

      {/* Orbiting Satellite Nodes */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: getSpeed(8), repeat: Infinity, ease: "linear" }}
        className="absolute w-[68%] h-[68%] flex items-center justify-center"
      >
        <div className="absolute top-0 w-3 h-3 rounded-full blur-[2px]" style={{ backgroundColor: tc.accent, boxShadow: `0 0 10px ${tc.accent}` }} />
        <div className="absolute bottom-0 w-2 h-2 rounded-full blur-[1px]" style={{ backgroundColor: tc.primary, boxShadow: `0 0 8px ${tc.primary}` }} />
      </motion.div>

      {/* Inner Active Scanning Ring */}
      <motion.div
        animate={state === "listening" 
          ? { scale: [1, 1.08, 1], opacity: [0.3, 0.7, 0.3] } 
          : { scale: 1, opacity: 0.25 }
        }
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[58%] h-[58%] rounded-full border-2 border-dashed opacity-40"
        style={{ borderColor: tc.accent }}
      />

      {/* Cognitive Processing Ring */}
      <motion.div
        animate={state === "processing"
          ? { rotate: [0, 360], scale: [0.95, 1.05, 0.95] }
          : { rotate: -180 }
        }
        transition={state === "processing"
          ? { duration: 2, repeat: Infinity, ease: "linear" }
          : { duration: 15, repeat: Infinity, ease: "easeInOut" }
        }
        className="absolute w-[46%] h-[46%] rounded-full border-2 border-dashed opacity-50"
        style={{ borderColor: tc.primary, strokeDasharray: "20 5 5 5" }}
      />

      {/* Center Core Glass Bubble */}
      <motion.div
        animate={
          state === "speaking"
            ? { scale: [1, 1.03, 0.98, 1.02, 1], boxShadow: [`0 0 25px ${tc.glow}`, `0 0 45px ${tc.primary}`, `0 0 25px ${tc.glow}`] }
            : state === "listening"
            ? { scale: [1, 1.05, 1], boxShadow: [`0 0 15px ${tc.glow}`, `0 0 35px ${tc.accent}`, `0 0 15px ${tc.glow}`] }
            : { scale: 1, boxShadow: `0 0 20px ${tc.glow}` }
        }
        transition={{ duration: state === "speaking" ? 0.6 : 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[34%] h-[34%] rounded-full bg-[#03090d]/80 border-2 backdrop-blur-md flex flex-col items-center justify-center z-10"
        style={{ 
          borderColor: tc.primary,
          boxShadow: `inset 0 0 20px ${tc.glow}`
        }}
      >
        {/* Futuristic Grid inside Core */}
        <div className="absolute inset-1 rounded-full bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:6px_6px] pointer-events-none opacity-50" />

        {/* Dynamic Voice Line / Orb inside Center */}
        <div className="absolute inset-0 flex items-center justify-center">
          {state === "speaking" ? (
            /* Sci-Fi Voice Bars */
            <div className="flex items-center gap-1.5 h-10">
              {[1, 2, 3, 4, 5].map((idx) => (
                <motion.div
                  key={idx}
                  animate={{ height: ["12px", "32px", "12px"] }}
                  transition={{ 
                    duration: 0.4 + idx * 0.1, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: idx * 0.05
                  }}
                  className="w-1 rounded-full"
                  style={{ backgroundColor: tc.accent }}
                />
              ))}
            </div>
          ) : state === "listening" ? (
            /* Radar Sonar Ring expanding outwards */
            <div className="relative w-full h-full flex items-center justify-center">
              <motion.div
                animate={{ scale: [0.2, 1.8], opacity: [1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                className="absolute w-12 h-12 rounded-full border-2"
                style={{ borderColor: tc.accent }}
              />
              <motion.div
                animate={{ scale: [0.2, 1.8], opacity: [0.8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                className="absolute w-12 h-12 rounded-full border"
                style={{ borderColor: tc.primary }}
              />
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tc.accent }} />
            </div>
          ) : state === "processing" ? (
            /* Cyber spinning ring inside core */
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 rounded-full border-2 border-transparent border-t-current"
              style={{ color: tc.accent }}
            />
          ) : (
            /* Idle floating core */
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.92, 1.05, 0.92] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-5 h-5 rounded-full blur-[1px]"
              style={{ 
                backgroundColor: tc.primary,
                boxShadow: `0 0 15px ${tc.primary}`
              }}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
