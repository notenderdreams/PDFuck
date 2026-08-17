import React, { useState, useEffect, useRef } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  LayoutGrid,
  ListTree,
  Highlighter,
  Info,
  X,
  Trash2,
  ExternalLink,
  FileText,
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
  onClose,
  onPageSelect,
  onDeleteAnnotation,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('thumbnails');

  if (!isOpen) return null;

  return (
    <aside className="w-72 sm:w-80 h-[calc(100vh-3.5rem)] bg-[#0e0e12]/95 border-r border-white/[0.08] backdrop-blur-2xl flex flex-col z-30 select-none shadow-2xl transition-all">
      {/* Sidebar Header & Tab Switcher */}
      <div className="p-3 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => setActiveTab('thumbnails')}
            className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'thumbnails'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Page Thumbnails"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('outline')}
            className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'outline'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Table of Contents"
          >
            <ListTree className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('annotations')}
            className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'annotations'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title={`Annotations (${annotations.length})`}
          >
            <Highlighter className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'info'
                ? 'bg-white/20 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            title="Document Details"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
          title="Close Sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* TAB 1: THUMBNAILS */}
        {activeTab === 'thumbnails' && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <ThumbnailItem
                key={pageNum}
                pdfDoc={pdfDoc}
                pageNumber={pageNum}
                isActive={currentPage === pageNum}
                onClick={() => onPageSelect(pageNum)}
              />
            ))}
          </div>
        )}

        {/* TAB 2: OUTLINE / TABLE OF CONTENTS */}
        {activeTab === 'outline' && (
          <div className="flex flex-col gap-1">
            {outline.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-8">
                No Table of Contents available in this document.
              </div>
            ) : (
              outline.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => onPageSelect(item.pageNumber)}
                  className="flex items-center justify-between p-2 rounded-xl text-left text-xs text-zinc-300 hover:text-white hover:bg-white/5 transition-all group"
                >
                  <span className="truncate pr-2">{item.title}</span>
                  <span className="font-mono text-[10px] text-zinc-500 group-hover:text-blue-400">
                    p.{item.pageNumber}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* TAB 3: ANNOTATIONS LIST */}
        {activeTab === 'annotations' && (
          <div className="flex flex-col gap-2">
            {annotations.length === 0 ? (
              <div className="text-xs text-zinc-500 text-center py-8">
                No annotations added yet. Use the highlighter, pen, or attach image tools!
              </div>
            ) : (
              annotations.map((ann) => (
                <div
                  key={ann.id}
                  onClick={() => onPageSelect(ann.pageNumber)}
                  className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] flex items-center justify-between gap-2 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {ann.type === 'image' ? (
                      <ImageIcon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    ) : (
                      <span
                        className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/30"
                        style={{ backgroundColor: (ann as { color?: string }).color || '#ffe600' }}
                      />
                    )}
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-medium text-zinc-200 capitalize truncate">
                        {ann.type.replace('-', ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
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
          <div className="flex flex-col gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                File Details
              </span>
              <div className="flex justify-between">
                <span className="text-zinc-400">File Name:</span>
                <span className="text-zinc-200 font-medium truncate max-w-[140px]" title={docInfo?.fileName}>
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
              {docInfo?.title && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Title:</span>
                  <span className="text-zinc-200 truncate max-w-[140px]" title={docInfo.title}>
                    {docInfo.title}
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Session Stats
              </span>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total Highlights & Notes:</span>
                <span className="text-blue-400 font-mono font-semibold">
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

// Thumbnail Renderer subcomponent
const ThumbnailItem: React.FC<{
  pdfDoc: PDFDocumentProxy | null;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ pdfDoc, pageNumber, isActive, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!pdfDoc) return;
    let isCancelled = false;

    const renderThumbnail = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale: 0.22 });
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
      className={`flex flex-col items-center gap-1.5 p-1.5 rounded-xl cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-blue-600/20 ring-2 ring-blue-500 shadow-md'
          : 'bg-white/[0.03] hover:bg-white/[0.08] ring-1 ring-white/[0.06]'
      }`}
    >
      <div className="w-full aspect-[1/1.4] bg-white rounded overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="block w-full h-full object-contain" />
      </div>
      <span
        className={`text-[10px] font-mono font-medium ${
          isActive ? 'text-blue-300' : 'text-zinc-400'
        }`}
      >
        {pageNumber}
      </span>
    </div>
  );
};
