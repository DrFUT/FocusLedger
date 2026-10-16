import { useCallback } from "react";
import type { UpdateSnapshot } from "../../shared/types/update";
import { useUpdateDialog } from "../providers/UpdateDialogProvider";

interface TitleBarUpdateEntry {
  showUpdateEntry: boolean;
  onOpenUpdateDialog: () => void;
}

interface SettingsUpdateEntry {
  updateSnapshot: UpdateSnapshot;
  updateChecking: boolean;
  updateInstalling: boolean;
  updateDialogOpen: boolean;
  onCheckForUpdates: () => Promise<void>;
  onOpenUpdateDialog: () => void;
  onOpenUpdateReleasePage: () => Promise<void>;
  onOpenUpdateDownload: () => Promise<void>;
}

export function useAppShellUpdateEntry() {
  const {
    snapshot,
    isChecking,
    isInstalling,
    dialogOpen,
    openUpdateDialog,
    checkForUpdates,
    openReleasePage,
    openAssetDownload,
  } = useUpdateDialog();

  const handleCheckForUpdates = useCallback(async () => {
    await checkForUpdates(false);
  }, [checkForUpdates]);

  const titleBarUpdateEntry: TitleBarUpdateEntry = {
    // FocusLedger stays offline even when a stale upstream snapshot is available.
    showUpdateEntry: false,
    onOpenUpdateDialog: openUpdateDialog,
  };

  const settingsUpdateEntry: SettingsUpdateEntry = {
    updateSnapshot: snapshot,
    updateChecking: isChecking,
    updateInstalling: isInstalling,
    updateDialogOpen: dialogOpen,
    onCheckForUpdates: handleCheckForUpdates,
    onOpenUpdateDialog: openUpdateDialog,
    onOpenUpdateReleasePage: openReleasePage,
    onOpenUpdateDownload: openAssetDownload,
  };

  return {
    titleBarUpdateEntry,
    settingsUpdateEntry,
  };
}
