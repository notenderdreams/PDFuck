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
    <rect x="5" y="5" width="290" height="110" rx="6" fill="none" stroke="${colorHex}" stroke-width="4" stroke-dasharray="6 3" opacity="0.9"/>
    <rect x="10" y="10" width="280" height="100" rx="4" fill="${colorHex}" fill-opacity="0.06" stroke="${colorHex}" stroke-width="1.5"/>
    <text x="150" y="${subtext ? 62 : 68}" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" font-size="28" font-weight="bold" fill="${colorHex}" text-anchor="middle" letter-spacing="2">${text}</text>
    ${subtext ? `<text x="150" y="86" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" fill="${colorHex}" text-anchor="middle" letter-spacing="1">${subtext}</text>` : ''}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PRESET_STAMPS = [
  {
    id: 'approved',
    name: 'APPROVED',
    subtext: 'VERIFIED & PASSED',
    color: '#4ade80',
    icon: CheckCircle,
  },
  {
    id: 'confidential',
    name: 'CONFIDENTIAL',
    subtext: 'DO NOT DISTRIBUTE',
    color: '#f87171',
    icon: AlertTriangle,
  },
  {
    id: 'reviewed',
    name: 'REVIEWED',
    subtext: 'QC INSPECTION PASSED',
    color: '#38bdf8',
    icon: ShieldCheck,
  },
  {
    id: 'draft',
    name: 'DRAFT',
    subtext: 'WORK IN PROGRESS',
    color: '#fbbf24',
    icon: FileCheck,
  },
  {
    id: 'urgent',
    name: 'URGENT',
    subtext: 'PRIORITY ACTION',
    color: '#fb7185',
    icon: AlertTriangle,
  },
  {
    id: 'final',
    name: 'FINAL COPY',
    subtext: 'OFFICIAL RECORD',
    color: '#c084fc',
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
      <div className="w-full max-w-md bg-[#24242b] border border-[#383846] rounded-xl p-5 shadow-2xl flex flex-col gap-4 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-1.5">
              <Stamp className="w-4 h-4 text-zinc-400" />
              <span>Attach Stamp or Image</span>
            </h3>
            <p className="text-[11px] text-zinc-400">
              Attach a badge or custom signature image
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-icon w-7 h-7"
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
          className="p-3 rounded-lg border border-dashed border-zinc-600 bg-[#1e1e24] hover:bg-[#2a2a34] text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition-all font-medium"
        >
          <Upload className="w-4 h-4 text-zinc-400" />
          <span>Browse Custom Image / Signature File</span>
        </button>

        {/* Preset Stamps Grid */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Preset Stamps & Badges
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
                  className="p-2.5 rounded-lg border border-[#363644] bg-[#1e1e24] hover:bg-[#2a2a34] hover:border-[#444456] flex flex-col items-center justify-center gap-1.5 transition-all active:scale-98 group"
                >
                  <Icon className="w-4 h-4" style={{ color: stamp.color }} />
                  <span
                    className="text-[10.5px] font-bold tracking-wider font-mono"
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
