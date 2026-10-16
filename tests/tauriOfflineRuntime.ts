import assert from "node:assert/strict";

export async function verifyOfflineRuntime(evaluate: (expression: string) => Promise<unknown>) {
  const config = { url: "http://127.0.0.1:1/dav", username: "fixture", remoteDir: "/FocusLedger" };
  const operations = [
    ["cmd_test_webdav_backup_target", { config, password: "fixture-only" }],
    ["cmd_upload_webdav_backup", { config, fileName: "fixture.zip" }],
    ["cmd_list_webdav_backups", { config }],
    ["cmd_download_webdav_backup", { config, id: "fixture" }],
    ["cmd_check_for_updates", { silent: false }],
    ["cmd_download_update", {}],
    ["cmd_install_update", {}],
  ] as const;
  for (const [command, payload] of operations) {
    const error = await evaluate(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(payload)}).then(() => null, error => String(error))`);
    assert.match(String(error), /Remote services are disabled in FocusLedger/, command);
  }
  console.log("PASS real IPC rejects WebDAV and updater operations under the fixed offline policy");
}
