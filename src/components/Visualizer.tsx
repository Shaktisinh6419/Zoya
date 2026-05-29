import { motion } from "motion/react";

type VisualizerState = "idle" | "listening" | "processing" | "speaking";
type ThemeType = "obsidian" | "emerald" | "sunset" | "arctic";

interface VisualizerProps {
  state: VisualizerState;
  theme: ThemeType;
}

export default function Visualizer({ state, theme }: VisualizerProps) {
  const getRingAnimation = (index: number, reverse: boolean = false) => {
    const baseSpeed = state === "listening" ? 3 : state === "processing" ? 1.5 : state === "speaking" ? 2 : 15;
    return {
      rotate: reverse ? [-360, 0] : [0, 360],
      transition: { duration: baseSpeed + index * 2, repeat: Infinity, ease: "linear" }
    };
  };

  const getPulseAnimation = () => {
    if (state === "speaking") {
      return {
        scale: [1, 1.05, 0.98, 1.02, 1],
        opacity: [0.8, 1, 0.8, 1, 0.8],
        transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "listening") {
      return {
        scale: [1, 1.02, 1],
        opacity: [0.7, 1, 0.7],
        transition: { duration: 1, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "processing") {
      return {
        scale: [0.98, 1.02, 0.98],
        opacity: [0.6, 0.9, 0.6],
        transition: { duration: 0.8, repeat: Infinity, ease: "linear" }
      };
    }
    return {
      scale: [1, 1.01, 1],
      opacity: [0.4, 0.6, 0.4],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
    };
  };

  // Color selection based on theme and state
  const getThemeColors = () => {
    const colors: Record<ThemeType, { listening: string; processing: string; speaking: string; idle: string }> = {
      obsidian: {
        listening: "rgba(139, 92, 246, 1)", // violet
        processing: "rgba(56, 189, 248, 1)", // sky
        speaking: "rgba(236, 72, 153, 1)", // pink
        idle: "rgba(6, 182, 212, 0.8)" // cyan
      },
      emerald: {
        listening: "rgba(16, 185, 129, 1)", // emerald
        processing: "rgba(20, 184, 166, 1)", // teal
        speaking: "rgba(132, 204, 22, 1)", // lime
        idle: "rgba(45, 212, 191, 0.8)" // teal
      },
      sunset: {
        listening: "rgba(249, 115, 22, 1)", // orange
        processing: "rgba(239, 68, 68, 1)", // red
        speaking: "rgba(234, 179, 8, 1)", // yellow
        idle: "rgba(251, 146, 60, 0.8)" // light orange
      },
      arctic: {
        listening: "rgba(14, 165, 233, 1)", // sky
        processing: "rgba(99, 102, 241, 1)", // indigo
        speaking: "rgba(125, 211, 252, 1)", // light blue
        idle: "rgba(186, 230, 253, 0.8)" // ice
      }
    };

    const palette = colors[theme];
    const color = palette[state] || palette.idle;
    
    // Generate glow and border colors (simplified for Tailwind compatibility)
    let glowClass = "shadow-cyan-500/40";
    let borderClass = "border-cyan-500/50";
    
    if (theme === "obsidian") {
      glowClass = state === "listening" ? "shadow-violet-500/60" : state === "processing" ? "shadow-sky-400/80" : state === "speaking" ? "shadow-pink-500/80" : "shadow-cyan-500/40";
      borderClass = state === "listening" ? "border-violet-400" : state === "processing" ? "border-sky-400" : state === "speaking" ? "border-pink-400" : "border-cyan-500/50";
    } else if (theme === "emerald") {
      glowClass = state === "listening" ? "shadow-emerald-500/60" : state === "processing" ? "shadow-teal-400/80" : state === "speaking" ? "shadow-lime-500/80" : "shadow-emerald-500/40";
      borderClass = state === "listening" ? "border-emerald-400" : state === "processing" ? "border-teal-400" : state === "speaking" ? "border-lime-400" : "border-emerald-500/50";
    } else if (theme === "sunset") {
      glowClass = state === "listening" ? "shadow-orange-500/60" : state === "processing" ? "shadow-red-400/80" : state === "speaking" ? "shadow-yellow-500/80" : "shadow-orange-500/40";
      borderClass = state === "listening" ? "border-orange-400" : state === "processing" ? "border-red-400" : state === "speaking" ? "border-yellow-400" : "border-orange-500/50";
    } else if (theme === "arctic") {
      glowClass = state === "listening" ? "shadow-sky-500/60" : state === "processing" ? "shadow-indigo-400/80" : state === "speaking" ? "shadow-sky-300/80" : "shadow-sky-400/40";
      borderClass = state === "listening" ? "border-sky-400" : state === "processing" ? "border-indigo-400" : state === "speaking" ? "border-sky-200" : "border-sky-500/50";
    }

    return { color, glow: glowClass, border: borderClass };
  };

  const themeColors = getThemeColors();

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
      {/* Ambient Glow */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[60%] h-[60%] rounded-full blur-[80px] ${themeColors.glow}`}
        style={{ backgroundColor: themeColors.color, opacity: 0.15 }}
      />

      {/* Ring 1: Massive Outer Dashed */}
      <motion.div
        animate={getRingAnimation(4, false)}
        className={`absolute w-[100%] h-[100%] rounded-full border-[1px] border-dashed ${themeColors.border} opacity-20`}
      />

      {/* Ring 2: Segmented Thick Ring */}
      <motion.div
        animate={getRingAnimation(3, true)}
        className={`absolute w-[85%] h-[85%] rounded-full border-[2px] border-dotted ${themeColors.border} opacity-30`}
      />

      {/* Ring 3: Scanner Ring (Solid with gaps) */}
      <motion.div
        animate={getRingAnimation(2, false)}
        className={`absolute w-[70%] h-[70%] rounded-full border-[1px] ${themeColors.border} border-t-transparent border-b-transparent opacity-40`}
      />

      {/* Ring 4: Inner Dashed */}
      <motion.div
        animate={getRingAnimation(1, true)}
        className={`absolute w-[55%] h-[55%] rounded-full border-[2px] border-dashed ${themeColors.border} opacity-50`}
      />
      
      {/* Ring 5: Core HUD Ring */}
      <motion.div
        animate={getRingAnimation(0, false)}
        className={`absolute w-[40%] h-[40%] rounded-full border-[4px] border-dotted ${themeColors.border} opacity-70`}
      />

      {/* Core Circle */}
      <motion.div
        animate={getPulseAnimation()}
        className={`absolute w-[25%] h-[25%] rounded-full border-[1px] ${themeColors.border} bg-black/40 backdrop-blur-md flex items-center justify-center shadow-[inset_0_0_30px_rgba(0,0,0,0.5)]`}
        style={{ boxShadow: `0 0 40px ${themeColors.color}, inset 0 0 30px ${themeColors.color}` }}
      >
        {/* Center Text */}
        <div 
          className="font-bold tracking-[0.3em] text-xl md:text-3xl lg:text-4xl text-white"
          style={{ textShadow: `0 0 15px ${themeColors.color}, 0 0 30px ${themeColors.color}` }}
        >
          ZOYA
        </div>
      </motion.div>
    </div>
  );
}
