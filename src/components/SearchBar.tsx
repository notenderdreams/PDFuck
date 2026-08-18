import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X, Loader2 } from 'lucide-react';
import type { SearchMatch } from '../utils/types';

interface SearchBarProps {
  isOpen: boolean;
  isSearching: boolean;
  searchResults: SearchMatch[];
  currentMatchIndex: number;
  onSearch: (query: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  isOpen,
  isSearching,
  searchResults,
  currentMatchIndex,
  onSearch,
  onNext,
  onPrev,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        onPrev();
      } else {
        onNext();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed top-13 right-4 z-40 flex items-center gap-1.5 p-1 rounded-lg bg-[#24242b] border border-[#383846] shadow-2xl animate-slide-down text-xs">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1c1c22] rounded border border-[#343440]">
        <Search className="w-3.5 h-3.5 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Find in document..."
          className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-40 font-sans"
        />
        {isSearching && <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />}
      </div>

      {searchResults.length > 0 ? (
        <span className="text-[11px] font-mono text-zinc-300 px-1">
          {currentMatchIndex + 1}/{searchResults.length}
        </span>
      ) : query ? (
        <span className="text-[11px] text-zinc-500 px-1">0 results</span>
      ) : null}

      <div className="flex items-center gap-0.5">
        <button
          onClick={onPrev}
          disabled={searchResults.length === 0}
          className="btn-icon w-6 h-6 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onNext}
          disabled={searchResults.length === 0}
          className="btn-icon w-6 h-6 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Next match (Enter)"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          className="btn-icon w-6 h-6 ml-0.5"
          title="Close search (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
