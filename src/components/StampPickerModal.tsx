import React from 'react';
import { X, Upload, Stamp, CheckCircle, AlertTriangle, ShieldCheck, FileCheck } from 'lucide-react';

interface StampPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStamp: (dataUrl: string, name: string) => void;
  onAttachCustomImage: () => void;
}

function generateStampSvgDataUrl(text: string, colorHex: string, subtext: string = ''): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120">
    <rect x="5" y="5" width="290" height="110" rx="10" fill="none" stroke="${colorHex}" stroke-width="6" stroke-dasharray="8 4" opacity="0.9"/>
    <rect x="12" y="12" width="276" height="96" rx="6" fill="${colorHex}" fill-opacity="0.08" stroke="${colorHex}" stroke-width="2"/>
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
    color: '#00e599',
    icon: CheckCircle,
  },
  {
    id: 'confidential',
    name: 'CONFIDENTIAL',
    subtext: 'DO NOT DISTRIBUTE',
    color: '#ff3366',
    icon: AlertTriangle,
  },
  {
    id: 'reviewed',
    name: 'REVIEWED',
    subtext: 'QC INSPECTION PASSED',
    color: '#00d4ff',
    icon: ShieldCheck,
  },
  {
    id: 'draft',
    name: 'DRAFT',
    subtext: 'WORK IN PROGRESS',
    color: '#ff9f1c',
    icon: FileCheck,
  },
  {
    id: 'urgent',
    name: 'URGENT',
    subtext: 'PRIORITY ACTION',
    color: '#ff2d75',
    icon: AlertTriangle,
  },
  {
    id: 'final',
    name: 'FINAL COPY',
    subtext: 'OFFICIAL RECORD',
    color: '#a855f7',
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in text-xs">
      <div className="w-full max-w-md bg-[#25252c] border border-[#383846] rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <Stamp className="w-4 h-4 text-[#00e599]" />
              <span>Attach Stamp or Image</span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Select an official seal or browse an image from disk
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#32323c] transition-all"
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
          className="p-3 rounded-lg border border-dashed border-[#0080f0]/50 bg-[#0080f0]/10 hover:bg-[#0080f0]/20 text-[#38bdf8] flex items-center justify-center gap-2 transition-all group font-medium"
        >
          <Upload className="w-4 h-4 group-hover:scale-105 transition-transform" />
          <span>Browse Custom Image / Signature File</span>
        </button>

        {/* Preset Stamps Grid */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Preset Office & Review Badges
          </span>

          <div className="grid grid-cols-3 gap-2">
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
                  className="p-2.5 rounded-lg border border-[#343440] bg-[#1e1e24] hover:bg-[#282832] hover:border-[#424252] flex flex-col items-center justify-center gap-1.5 transition-all active:scale-98 group"
                >
                  <Icon className="w-4 h-4" style={{ color: stamp.color }} />
                  <span
                    className="text-[11px] font-bold tracking-wider font-mono"
                    style={{ color: stamp.color }}
                  >
                    {stamp.name}
                  </span>
                  <span className="text-[8.5px] text-zinc-500 text-center leading-tight">
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
