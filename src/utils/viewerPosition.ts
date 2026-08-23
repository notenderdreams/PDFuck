export const shouldRestoreViewerPosition = (
  hasDocument: boolean,
  isNewDocument: boolean,
  isNewViewMode: boolean
) => hasDocument && (isNewDocument || isNewViewMode);
