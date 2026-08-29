import React, { useEffect, useRef } from 'react';
import { Copy, FileText, Image, Trash2 } from 'lucide-react';
import { SparkleIcon } from './icons/SparkleIcon';

interface PageContextMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  onDeletePage: () => void;
  onCopyPageText: () => void;
  onCopyPageImage: () => void;
  onAskAi: () => void;
  onCopySelectedText?: () => void;
  hasSelectedText?: boolean;
}

export const PageContextMenu: React.FC<PageContextMenuProps> = ({
  position,
  onClose,
  onDeletePage,
  onCopyPageText,
  onCopyPageImage,
  onAskAi,
  onCopySelectedText,
  hasSelectedText = false,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const close = () => onClose();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const run = (action: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClose();
    action();
  };

  const itemClass =
    'page-context-menu__item';

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Page actions"
      className="page-context-menu"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        className={itemClass}
        disabled={!hasSelectedText}
        onClick={hasSelectedText && onCopySelectedText ? run(onCopySelectedText) : undefined}
      >
        <span className="page-context-menu__icon" aria-hidden="true">
          <Copy />
        </span>
        <span>Copy text</span>
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onCopyPageText)}>
        <span className="page-context-menu__icon" aria-hidden="true">
          <FileText />
        </span>
        <span>Copy page text</span>
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onCopyPageImage)}>
        <span className="page-context-menu__icon" aria-hidden="true">
          <Image />
        </span>
        <span>Copy page as image</span>
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onAskAi)}>
        <span className="page-context-menu__icon" aria-hidden="true">
          <SparkleIcon />
        </span>
        <span>Ask AI about this page</span>
      </button>
      <div className="page-context-menu__separator" role="separator" />
      <button
        type="button"
        role="menuitem"
        className={`${itemClass} page-context-menu__item--destructive`}
        onClick={run(onDeletePage)}
      >
        <span className="page-context-menu__icon" aria-hidden="true">
          <Trash2 />
        </span>
        <span>Delete page</span>
      </button>
    </div>
  );
};
