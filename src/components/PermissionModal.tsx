import React from 'react';
import { motion } from 'motion/react';
import { MicOff } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function PermissionModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#020508]/90 border border-red-500/30 rounded-lg p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden font-mono"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
        
        {/* Sci-Fi accent corners */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-red-500" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-red-500" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-red-500" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-red-500" />

        <div className="w-16 h-16 rounded bg-red-500/20 flex items-center justify-center mb-6 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
          <MicOff size={32} className="text-red-400" />
        </div>
        
        <h2 className="text-lg font-bold tracking-widest text-white mb-3">[ MICROPHONE BLOCKED ]</h2>
        <p className="text-white/60 text-[11px] mb-6 leading-relaxed uppercase">
          Neural channel registration failed. The Stark Assistant cannot hear your vocal command wave until microphone permission is granted.
        </p>
        
        <div className="bg-white/5 border border-white/5 rounded p-4 text-left w-full mb-6">
          <p className="text-[11px] text-white/85 font-bold mb-2 uppercase tracking-wide">Registration guidelines:</p>
          <ol className="text-[10px] text-white/50 list-decimal pl-4 space-y-1.5 leading-normal">
            <li>Click the <strong className="text-red-400">lock icon (🔒)</strong> or <strong className="text-red-400">tune icon (⚙️)</strong> next to the browser URL bar.</li>
            <li>Enable direct <strong className="text-red-400">Microphone Access</strong> to <strong className="text-white">Allow</strong>.</li>
            <li>Re-verify by reloading the user system profile.</li>
          </ol>
        </div>
        
        <div className="flex flex-col w-full gap-2 font-sans">
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white font-mono text-xs tracking-widest font-bold rounded transition-colors shadow-[0_0_10px_rgba(239,68,68,0.4)]"
          >
            RE-LOAD SENSOR CHANNEL
          </button>
          <button 
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all font-mono text-[10px] tracking-wider rounded border border-white/5"
          >
            ABORT REGISTER
          </button>
        </div>
      </motion.div>
    </div>
  );
}
