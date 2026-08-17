import React from 'react';
import { X, Upload, Stamp, CheckCircle, AlertTriangle, ShieldCheck, FileCheck } from 'lucide-react';

interface StampPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStamp: (dataUrl: string, name: string) => void;
  onAttachCustomImage: () => void;
}

// Generate stylized SVG stamp DataURLs dynamically
function generateStampSvgDataUrl(text: string, colorHex: string, subtext: string = ''): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120">
    <rect x="5" y="5" width="290" height="110" rx="14" fill="none" stroke="${colorHex}" stroke-width="6" stroke-dasharray="8 4" opacity="0.9"/>
    <rect x="12" y="12" width="276" height="96" rx="8" fill="${colorHex}" fill-opacity="0.08" stroke="${colorHex}" stroke-width="2"/>
    <text x="150" y="${subtext ? 62 : 68}" font-family="Impact, Arial Black, sans-serif" font-size="34" font-weight="bold" fill="${colorHex}" text-anchor="middle" letter-spacing="3">${text}</text>
    ${subtext ? `<text x="150" y="88" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="${colorHex}" text-anchor="middle" letter-spacing="1.5">${subtext}</text>` : ''}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PRESET_STAMPS = [
  {
    id: 'approved',
    name: 'APPROVED',
    subtext: 'VERIFIED & PASSED',
    color: '#10b981',
    icon: CheckCircle,
  },
  {
    id: 'confidential',
    name: 'CONFIDENTIAL',
    subtext: 'DO NOT DISTRIBUTE',
    color: '#ef4444',
    icon: AlertTriangle,
  },
  {
    id: 'reviewed',
    name: 'REVIEWED',
    subtext: 'QC INSPECTION PASSED',
    color: '#06b6d4',
    icon: ShieldCheck,
  },
  {
    id: 'draft',
    name: 'DRAFT',
    subtext: 'WORK IN PROGRESS',
    color: '#f59e0b',
    icon: FileCheck,
  },
  {
    id: 'urgent',
    name: 'URGENT',
    subtext: 'PRIORITY ACTION REQUIRED',
    color: '#ec4899',
    icon: AlertTriangle,
  },
  {
    id: 'final',
    name: 'FINAL COPY',
    subtext: 'OFFICIAL RECORD',
    color: '#8b5cf6',
    icon: Stamp,
  },
];

export const StampPickerModal: React.FC<StampPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectStamp,
  onAttachCustomImage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-lg double-bezel bg-[#121216]/95 border border-white/15 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Stamp className="w-4 h-4 text-emerald-400" />
              <span>Attach Stamp or Custom Image</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Stamp will be placed on the current page. You can drag and resize it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Custom Image Upload Banner */}
        <button
          onClick={() => {
            onClose();
            onAttachCustomImage();
          }}
          className="p-4 rounded-2xl border border-dashed border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 flex items-center justify-center gap-2.5 transition-all group"
        >
          <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-semibold">Browse Custom Image / Signature File</span>
        </button>

        {/* Preset Stamps Grid */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Preset Office & Review Stamps
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {PRESET_STAMPS.map((stamp) => {
              const Icon = stamp.icon;
              return (
                <button
                  key={stamp.id}
                  onClick={() => {
                    const dataUrl = generateStampSvgDataUrl(
                      stamp.name,
                      stamp.color,
                      stamp.subtext
                    );
                    onSelectStamp(dataUrl, stamp.name);
                    onClose();
                  }}
                  className="p-3 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 group"
                >
                  <Icon className="w-5 h-5" style={{ color: stamp.color }} />
                  <span
                    className="text-xs font-bold tracking-wider font-mono"
                    style={{ color: stamp.color }}
                  >
                    {stamp.name}
                  </span>
                  <span className="text-[9px] text-zinc-500 text-center">
                    {stamp.subtext}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
