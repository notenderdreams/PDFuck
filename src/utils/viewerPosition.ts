export const shouldRestoreViewerPosition = (
  hasDocument: boolean,
  isNewDocument: boolean,
  isNewViewMode: boolean
) => hasDocument && (isNewDocument || isNewViewMode);

type RestoreScheduler = (restore: () => void) => void;

const scheduleViewerPositionRestore: RestoreScheduler = (restore) => {
  queueMicrotask(restore);
  requestAnimationFrame(() => {
    restore();
    requestAnimationFrame(restore);
  });
};

export const keepViewerPositionAfter = (
  element: HTMLElement,
  action: () => void,
  schedule: RestoreScheduler = scheduleViewerPositionRestore
) => {
  const viewer = element.closest<HTMLElement>('.pdf-viewer-viewport');
  if (!viewer) {
    action();
    return;
  }

  const scrollLeft = viewer.scrollLeft;
  const scrollTop = viewer.scrollTop;
  const restore = () => {
    viewer.scrollLeft = scrollLeft;
    viewer.scrollTop = scrollTop;
  };

  action();
  restore();
  schedule(restore);
};

export const focusWithoutMovingViewer = (element: HTMLElement) => {
  keepViewerPositionAfter(element, () => element.focus({ preventScroll: true }));
};
