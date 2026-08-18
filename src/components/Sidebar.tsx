import React, { useState, useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  LayoutGrid,
  ListTree,
  Highlighter,
  Info,
  X,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import type { Annotation, DocumentInfo, PDFOutlineItem } from '../utils/types';

interface SidebarProps {
  isOpen: boolean;
  pdfDoc: PDFDocumentProxy | null;
  docInfo: DocumentInfo | null;
  outline: PDFOutlineItem[];
  currentPage: number;
  numPages: number;
  annotations: Annotation[];
  filterClass: string;
  customFilterStyle: React.CSSProperties;
  onClose: () => void;
  onPageSelect: (pageNumber: number) => void;
  onDeleteAnnotation: (id: string) => void;
}

type TabType = 'thumbnails' | 'outline' | 'annotations' | 'info';

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  pdfDoc,
  docInfo,
  outline,
  currentPage,
  numPages,
  annotations,
  filterClass,
  customFilterStyle,
  onClose,
  onPageSelect,
  onDeleteAnnotation,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('thumbnails');

  if (!isOpen) return null;

  return (
    <aside className="w-68 sm:w-72 h-[calc(100vh-2.75rem)] bg-[#222228] border-r border-[#343440] flex flex-col z-30 select-none shadow-xl transition-all">
      {/* Tab Header Strip */}
      <div className="p-2 border-b border-[#30303a] flex items-center justify-between bg-[#202026]">
        <div className="flex items-center gap-0.5 bg-[#1a1a20] p-0.5 rounded-md border border-[#2e2e38]">
          <button
            onClick={() => setActiveTab('thumbnails')}
            className={`p-1.5 rounded text-xs transition-all ${
              activeTab === 'thumbnails'
                ? 'bg-[#32323e] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Thumbnails"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTab('outline')}
            className={`p-1.5 rounded text-xs transition-all ${
              activeTab === 'outline'
                ? 'bg-[#32323e] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Table of Contents"
          >
            <ListTree className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTab('annotations')}
            className={`p-1.5 rounded text-xs transition-all ${
              activeTab === 'annotations'
                ? 'bg-[#32323e] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title={`Annotations (${annotations.length})`}
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`p-1.5 rounded text-xs transition-all ${
              activeTab === 'info'
                ? 'bg-[#32323e] text-zinc-100 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Document Details"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={onClose}
          className="btn-icon w-7 h-7"
          title="Close Sidebar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-2.5">
        {/* TAB 1: THUMBNAILS (Theme-Aware Inversion) */}
        {activeTab === 'thumbnails' && (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <ThumbnailItem
                key={pageNum}
                pdfDoc={pdfDoc}
                pageNumber={pageNum}
                isActive={currentPage === pageNum}
                filterClass={filterClass}
                customFilterStyle={customFilterStyle}
                onClick={() => onPageSelect(pageNum)}
              />
            ))}
          </div>
        )}

        {/* TAB 2: OUTLINE / TABLE OF CONTENTS */}
        {activeTab === 'outline' && (
          <div className="flex flex-col gap-0.5">
            {outline.length === 0 ? (
              <div className="text-[11px] text-zinc-500 text-center py-6">
                No Table of Contents found.
              </div>
            ) : (
              outline.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onPageSelect(item.pageNumber)}
                  className="flex items-center justify-between p-1.5 rounded text-left text-xs text-zinc-300 hover:text-white hover:bg-[#2a2a34] transition-all group"
                >
                  <span className="truncate pr-2">{item.title}</span>
                  <span className="font-mono text-[10px] text-zinc-500 group-hover:text-zinc-200">
                    p.{item.pageNumber}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* TAB 3: ANNOTATIONS LIST */}
        {activeTab === 'annotations' && (
          <div className="flex flex-col gap-1.5">
            {annotations.length === 0 ? (
              <div className="text-[11px] text-zinc-500 text-center py-6">
                No annotations added yet.
              </div>
            ) : (
              annotations.map((ann) => (
                <div
                  key={ann.id}
                  onClick={() => onPageSelect(ann.pageNumber)}
                  className="p-2 rounded bg-[#272730]/60 hover:bg-[#2c2c36] border border-[#343440] flex items-center justify-between gap-2 cursor-pointer transition-all group text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {ann.type === 'image' ? (
                      <ImageIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    ) : (
                      <span
                        className="w-2 h-2 rounded-full shrink-0 border border-white/20"
                        style={{ backgroundColor: (ann as { color?: string }).color || '#facc15' }}
                      />
                    )}
                    <div className="flex flex-col overflow-hidden">
                      <span className="font-medium text-zinc-200 capitalize truncate">
                        {ann.type.replace('-', ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Page {ann.pageNumber}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteAnnotation(ann.id);
                    }}
                    className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete Annotation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 4: DOCUMENT INFO */}
        {activeTab === 'info' && (
          <div className="flex flex-col gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-[#272730]/60 border border-[#343440] flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Document Details
              </span>
              <div className="flex justify-between">
                <span className="text-zinc-400">File Name:</span>
                <span className="text-zinc-200 font-medium truncate max-w-[130px]" title={docInfo?.fileName}>
                  {docInfo?.fileName || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total Pages:</span>
                <span className="text-zinc-200 font-mono">{numPages}</span>
              </div>
              {docInfo?.fileSize && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">File Size:</span>
                  <span className="text-zinc-200 font-mono">
                    {(docInfo.fileSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-[#272730]/60 border border-[#343440] flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Session Stats
              </span>
              <div className="flex justify-between">
                <span className="text-zinc-400">Annotations:</span>
                <span className="text-zinc-200 font-mono font-medium">
                  {annotations.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

// Thumbnail Renderer subcomponent with Color Inversion
const ThumbnailItem: React.FC<{
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  isActive: boolean;
  filterClass: string;
  customFilterStyle: React.CSSProperties;
  onClick: () => void;
}> = ({ pdfDoc, pageNumber, isActive, filterClass, customFilterStyle, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!pdfDoc) return;
    let isCancelled = false;

    const renderThumbnail = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.25 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;
      } catch {}
    };

    renderThumbnail();
    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNumber]);

  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-1.5 rounded-lg cursor-pointer transition-all ${
        isActive
          ? 'bg-[#30303c] border border-zinc-400 shadow-xs'
          : 'bg-[#25252e] hover:bg-[#2c2c38] border border-[#343440]'
      }`}
    >
      {/* Thumbnail Paper Container with matching Theme Background & Filter */}
      <div
        className={`w-full aspect-[1/1.4] rounded-xs overflow-hidden flex items-center justify-center transition-all duration-200 shadow-xs border border-white/10 ${filterClass}`}
        style={{
          ...customFilterStyle,
        }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full object-contain"
        />
      </div>
      <span
        className={`text-[10px] font-mono font-medium ${
          isActive ? 'text-zinc-100' : 'text-zinc-400'
        }`}
      >
        {pageNumber}
      </span>
    </div>
  );
};
