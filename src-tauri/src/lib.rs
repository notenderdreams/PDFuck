use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Clone)]
pub struct OpenFileResult {
    pub file_name: String,
    pub file_path: String,
    pub data: Vec<u8>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OpenImageResult {
    pub file_name: String,
    pub file_path: String,
    pub data_url: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SaveResult {
    pub success: bool,
    pub file_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ScannedPdfResult {
    pub file_name: String,
    pub file_path: String,
    pub file_size: u64,
    pub modified_timestamp: u64,
    pub directory_path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiExplanationRequest {
    pub request_id: String,
    pub prompt: String,
    pub png_data_url: String,
}

#[derive(Serialize)]
pub struct AiProviderStatus {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Serialize)]
pub struct AiExplanationResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Default)]
pub struct AiRunnerState {
    executable: Mutex<Option<PathBuf>>,
    processes: Mutex<HashMap<String, Arc<Mutex<Option<Child>>>>>,
    cancellations: Mutex<HashSet<String>>,
}

impl Drop for AiRunnerState {
    fn drop(&mut self) {
        if let Ok(processes) = self.processes.lock() {
            for process in processes.values() {
                if let Ok(mut child) = process.lock() {
                    if let Some(child) = child.as_mut() {
                        let _ = child.kill();
                    }
                }
            }
        }
    }
}

struct TempAiDirectory(PathBuf);

impl Drop for TempAiDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn ai_error(code: &str, message: impl Into<String>) -> AiExplanationResult {
    AiExplanationResult {
        ok: false,
        response: None,
        code: Some(code.to_string()),
        message: Some(message.into()),
    }
}

fn executable_candidates(manual: Option<PathBuf>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = manual {
        candidates.push(path);
    }
    if let Some(path_value) = std::env::var_os("PATH") {
        candidates
            .extend(std::env::split_paths(&path_value).map(|directory| {
                directory.join(if cfg!(windows) { "codex.exe" } else { "codex" })
            }));
    }
    if let Some(home) = dirs_home() {
        candidates.push(home.join(".local/bin/codex"));
        candidates.push(home.join(".cargo/bin/codex"));
        candidates.push(home.join(".bun/bin/codex"));
        candidates.push(home.join(".npm-global/bin/codex"));
        candidates.push(home.join(".local/share/mise/shims/codex"));
    }
    candidates.push(PathBuf::from("/opt/homebrew/bin/codex"));
    candidates.push(PathBuf::from("/usr/local/bin/codex"));
    candidates
}

fn discover_codex(manual: Option<PathBuf>) -> Option<PathBuf> {
    executable_candidates(manual)
        .into_iter()
        .find(|candidate| candidate.is_file())
}

fn check_provider(executable: &Path) -> AiProviderStatus {
    let version = Command::new(executable).arg("--version").output();
    let version = match version {
        Ok(output) if output.status.success() => {
            String::from_utf8_lossy(&output.stdout).trim().to_string()
        }
        _ => {
            return AiProviderStatus {
                status: "incompatible_cli".into(),
                provider: None,
                version: None,
                executable: None,
                message: Some("The selected Codex CLI could not run `codex --version`.".into()),
            }
        }
    };
    let help = Command::new(executable).args(["exec", "--help"]).output();
    let supports_required_options = help
        .ok()
        .filter(|output| output.status.success())
        .map(|output| {
            let help_text = String::from_utf8_lossy(&output.stdout);
            [
                "--ephemeral",
                "--ignore-user-config",
                "--ignore-rules",
                "--output-schema",
                "--output-last-message",
            ]
            .iter()
            .all(|option| help_text.contains(option))
        })
        .unwrap_or(false);
    if !supports_required_options {
        return AiProviderStatus {
            status: "incompatible_cli".into(),
            provider: None,
            version: Some(version),
            executable: Some(executable.to_string_lossy().into()),
            message: Some("This Codex CLI version does not support the secure non-interactive options PDFuck requires. Update Codex and try again.".into()),
        };
    }
    let login = Command::new(executable).args(["login", "status"]).output();
    if !matches!(login, Ok(ref output) if output.status.success()) {
        return AiProviderStatus {
            status: "unauthenticated".into(),
            provider: None,
            version: Some(version),
            executable: Some(executable.to_string_lossy().into()),
            message: Some(
                "Codex is installed but not logged in. Run `codex login` and try again.".into(),
            ),
        };
    }
    AiProviderStatus {
        status: "ready".into(),
        provider: Some("codex".into()),
        version: Some(version),
        executable: Some(executable.to_string_lossy().into()),
        message: None,
    }
}

#[tauri::command]
async fn get_ai_provider_status(state: tauri::State<'_, AiRunnerState>) -> Result<AiProviderStatus, ()> {
    let manual = state.executable.lock().ok().and_then(|value| value.clone());
    let status = match discover_codex(manual) {
        Some(executable) => check_provider(&executable),
        None => AiProviderStatus {
            status: "missing_cli".into(),
            provider: None,
            version: None,
            executable: None,
            message: Some(
                "Codex CLI was not found. Install Codex or select its executable.".into(),
            ),
        },
    };
    Ok(status)
}

#[tauri::command]
async fn set_ai_provider_executable(
    executable_path: String,
    state: tauri::State<'_, AiRunnerState>,
) -> Result<AiProviderStatus, ()> {
    let path = PathBuf::from(executable_path);
    if !path.is_absolute() || !path.is_file() {
        return Ok(AiProviderStatus {
            status: "missing_cli".into(),
            provider: None,
            version: None,
            executable: None,
            message: Some("Select an existing absolute path to the Codex executable.".into()),
        });
    }
    let status = check_provider(&path);
    if status.status == "ready" {
        if let Ok(mut manual) = state.executable.lock() {
            *manual = Some(path);
        }
    }
    Ok(status)
}

fn codex_arguments(
    crop: &Path,
    schema: &Path,
    output: &Path,
    working_directory: &Path,
) -> Vec<String> {
    vec![
        "exec".into(),
        "--ephemeral".into(),
        "--ignore-user-config".into(),
        "--ignore-rules".into(),
        "--config".into(),
        "approval_policy=\"never\"".into(),
        "--sandbox".into(),
        "read-only".into(),
        "--skip-git-repo-check".into(),
        "--cd".into(),
        working_directory.to_string_lossy().into(),
        "--image".into(),
        crop.to_string_lossy().into(),
        "--output-schema".into(),
        schema.to_string_lossy().into(),
        "--output-last-message".into(),
        output.to_string_lossy().into(),
        "--color".into(),
        "never".into(),
        "-".into(),
    ]
}

fn parse_ai_output(contents: &str) -> Result<String, ()> {
    let value: serde_json::Value = serde_json::from_str(contents).map_err(|_| ())?;
    value
        .get("explanation")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or(())
}

#[tauri::command]
async fn run_ai_explanation(
    request: AiExplanationRequest,
    state: tauri::State<'_, AiRunnerState>,
) -> Result<AiExplanationResult, ()> {
    if state
        .cancellations
        .lock()
        .map(|mut values| values.remove(&request.request_id))
        .unwrap_or(false)
    {
        return Ok(ai_error("cancelled", "Explanation cancelled."));
    }
    let manual = state.executable.lock().ok().and_then(|value| value.clone());
    let executable = match discover_codex(manual) {
        Some(value) => value,
        None => {
            return Ok(ai_error(
                "missing_cli",
                "Codex CLI was not found. Install Codex or select its executable.",
            ));
        }
    };
    let provider = check_provider(&executable);
    if provider.status != "ready" {
        return Ok(ai_error(
            &provider.status,
            provider
                .message
                .unwrap_or_else(|| "Codex is not ready.".into()),
        ));
    }

    let suffix: String = request
        .request_id
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || *character == '_' || *character == '-'
        })
        .take(80)
        .collect();
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let directory = std::env::temp_dir().join(format!(
        "pdfuck-ai-{}-{}-{}",
        std::process::id(),
        timestamp,
        suffix
    ));
    if fs::create_dir(&directory).is_err() {
        return Ok(ai_error("process_failed", "Could not create temporary AI workspace."));
    }
    let temporary = TempAiDirectory(directory);
    let crop_path = temporary.0.join("region.png");
    let schema_path = temporary.0.join("response-schema.json");
    let output_path = temporary.0.join("response.json");
    let diagnostics_path = temporary.0.join("diagnostics.txt");

    let encoded = request
        .png_data_url
        .split_once(',')
        .map(|(_, data)| data)
        .unwrap_or(&request.png_data_url);
    let crop = match base64::engine::general_purpose::STANDARD.decode(encoded) {
        Ok(value) => value,
        Err(_) => return Ok(ai_error("process_failed", "The selected region image was invalid.")),
    };
    if fs::write(&crop_path, crop).is_err() || fs::write(&schema_path, r#"{"type":"object","properties":{"explanation":{"type":"string"}},"required":["explanation"],"additionalProperties":false}"#).is_err() {
        return Ok(ai_error("process_failed", "Could not prepare the temporary AI request."));
    }
    let diagnostics = match fs::File::create(&diagnostics_path) {
        Ok(value) => value,
        Err(_) => return Ok(ai_error("process_failed", "Could not prepare Codex diagnostics.")),
    };
    let mut command = Command::new(&executable);
    command
        .args(codex_arguments(
            &crop_path,
            &schema_path,
            &output_path,
            &temporary.0,
        ))
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::from(diagnostics));
    let mut child = match command.spawn() {
        Ok(value) => value,
        Err(error) => return Ok(ai_error("process_failed", format!("Could not start Codex: {error}"))),
    };
    if child
        .stdin
        .as_mut()
        .and_then(|stdin| stdin.write_all(request.prompt.as_bytes()).ok())
        .is_none()
    {
        let _ = child.kill();
        return Ok(ai_error(
            "process_failed",
            "Could not send the explanation prompt to Codex.",
        ));
    }
    drop(child.stdin.take());

    let process = Arc::new(Mutex::new(Some(child)));
    if let Ok(mut processes) = state.processes.lock() {
        processes.insert(request.request_id.clone(), process.clone());
    }
    if state
        .cancellations
        .lock()
        .map(|mut values| values.remove(&request.request_id))
        .unwrap_or(false)
    {
        if let Ok(mut value) = process.lock() {
            if let Some(child) = value.as_mut() {
                let _ = child.kill();
            }
        }
        if let Ok(mut processes) = state.processes.lock() {
            processes.remove(&request.request_id);
        }
        return Ok(ai_error("cancelled", "Explanation cancelled."));
    }
    let started = Instant::now();
    let mut cancelled = false;
    let mut timed_out = false;
    let exit_status = loop {
        if state
            .processes
            .lock()
            .map(|processes| !processes.contains_key(&request.request_id))
            .unwrap_or(true)
        {
            cancelled = true;
        }
        if started.elapsed() >= Duration::from_secs(180) {
            timed_out = true;
            if let Ok(mut value) = process.lock() {
                if let Some(child) = value.as_mut() {
                    let _ = child.kill();
                }
            }
        }
        let polled = process.lock().ok().and_then(|mut value| {
            value
                .as_mut()
                .and_then(|child| child.try_wait().ok().flatten())
        });
        if let Some(status) = polled {
            break Some(status);
        }
        if timed_out {
            tokio::time::sleep(Duration::from_millis(30)).await;
            continue;
        }
        tokio::time::sleep(Duration::from_millis(60)).await;
    };
    if let Ok(mut processes) = state.processes.lock() {
        processes.remove(&request.request_id);
    }
    if let Ok(mut value) = process.lock() {
        if let Some(mut child) = value.take() {
            let _ = child.wait();
        }
    }
    if timed_out {
        return Ok(ai_error("timeout", "Codex did not respond within three minutes."));
    }
    if cancelled {
        return Ok(ai_error("cancelled", "Explanation cancelled."));
    }
    if !matches!(exit_status, Some(status) if status.success()) {
        let diagnostic = fs::read_to_string(&diagnostics_path).unwrap_or_default();
        let capped: String = diagnostic.chars().take(4_000).collect();
        return Ok(ai_error(
            "process_failed",
            if capped.trim().is_empty() {
                "Codex exited without producing an explanation.".into()
            } else {
                capped
            },
        ));
    }
    match fs::read_to_string(&output_path)
        .ok()
        .and_then(|contents| parse_ai_output(&contents).ok())
    {
        Some(response) => Ok(AiExplanationResult {
            ok: true,
            response: Some(response),
            code: None,
            message: None,
        }),
        None => Ok(ai_error(
            "malformed_output",
            "Codex returned an unreadable structured response. Try again.",
        )),
    }
}

#[tauri::command]
fn cancel_ai_explanation(request_id: String, state: tauri::State<'_, AiRunnerState>) -> bool {
    let process = state
        .processes
        .lock()
        .ok()
        .and_then(|mut processes| processes.remove(&request_id));
    if let Some(process) = process {
        if let Ok(mut value) = process.lock() {
            if let Some(child) = value.as_mut() {
                return child.kill().is_ok();
            }
        }
    }
    if let Ok(mut cancellations) = state.cancellations.lock() {
        cancellations.insert(request_id);
    }
    true
}

#[tauri::command]
fn open_pdf_dialog() -> Option<OpenFileResult> {
    let file = rfd::FileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .set_title("Open PDF Document")
        .pick_file()?;

    let data = fs::read(&file).ok()?;
    let file_name = file
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "document.pdf".to_string());
    let file_path = file.to_string_lossy().to_string();

    Some(OpenFileResult {
        file_name,
        file_path,
        data,
    })
}

#[tauri::command]
fn open_image_dialog() -> Option<OpenImageResult> {
    let file = rfd::FileDialog::new()
        .add_filter(
            "Images",
            &["png", "jpg", "jpeg", "webp", "svg", "gif", "bmp"],
        )
        .set_title("Select Image to Attach")
        .pick_file()?;

    let bytes = fs::read(&file).ok()?;
    let ext = file
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| "png".to_string());

    let mime_type = match ext.as_str() {
        "svg" => "image/svg+xml",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/png",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:{};base64,{}", mime_type, b64);

    let file_name = file
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "image.png".to_string());
    let file_path = file.to_string_lossy().to_string();

    Some(OpenImageResult {
        file_name,
        file_path,
        data_url,
    })
}

#[tauri::command]
fn save_pdf_dialog(data: Vec<u8>, default_name: Option<String>) -> SaveResult {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("PDF Document", &["pdf"])
        .set_title("Save PDF Document");

    let file_name = default_name.unwrap_or_else(|| "annotated_document.pdf".to_string());
    dialog = dialog.set_file_name(&file_name);

    if let Some(path) = dialog.save_file() {
        if fs::write(&path, &data).is_ok() {
            return SaveResult {
                success: true,
                file_path: Some(path.to_string_lossy().to_string()),
            };
        }
    }

    SaveResult {
        success: false,
        file_path: None,
    }
}

#[tauri::command]
fn write_pdf_file(file_path: String, data: Vec<u8>) -> SaveResult {
    let path = PathBuf::from(&file_path);
    let is_pdf = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"));

    if !is_pdf || !path.is_file() || fs::write(&path, &data).is_err() {
        return SaveResult {
            success: false,
            file_path: None,
        };
    }

    SaveResult {
        success: true,
        file_path: Some(file_path),
    }
}

#[tauri::command]
fn save_json_dialog(json_string: String, default_name: Option<String>) -> SaveResult {
    let mut dialog = rfd::FileDialog::new()
        .add_filter("JSON File", &["json"])
        .set_title("Save Annotations Session");

    let file_name = default_name.unwrap_or_else(|| "annotations.json".to_string());
    dialog = dialog.set_file_name(&file_name);

    if let Some(path) = dialog.save_file() {
        if fs::write(&path, json_string.as_bytes()).is_ok() {
            return SaveResult {
                success: true,
                file_path: Some(path.to_string_lossy().to_string()),
            };
        }
    }

    SaveResult {
        success: false,
        file_path: None,
    }
}

#[tauri::command]
fn read_file_from_path(file_path: String) -> Option<OpenFileResult> {
    let path = Path::new(&file_path);
    let data = fs::read(path).ok()?;
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "document.pdf".to_string());

    Some(OpenFileResult {
        file_name,
        file_path,
        data,
    })
}

#[tauri::command]
fn select_directory_dialog() -> Option<String> {
    let folder = rfd::FileDialog::new()
        .set_title("Select Directory to Add to PDF Library")
        .pick_folder()?;
    Some(folder.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_directory_pdfs(directory_path: String) -> Vec<ScannedPdfResult> {
    let mut results = Vec::new();
    let root = Path::new(&directory_path);
    if !root.exists() || !root.is_dir() {
        return results;
    }

    fn scan_dir(dir: &Path, base_dir: &str, results: &mut Vec<ScannedPdfResult>, depth: usize) {
        if depth > 4 {
            return;
        }
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext.to_string_lossy().to_lowercase() == "pdf" {
                            let file_name = path
                                .file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_else(|| "document.pdf".to_string());
                            let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            let modified_timestamp = entry
                                .metadata()
                                .and_then(|m| m.modified())
                                .ok()
                                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                                .map(|d| d.as_millis() as u64)
                                .unwrap_or(0);

                            results.push(ScannedPdfResult {
                                file_name,
                                file_path: path.to_string_lossy().to_string(),
                                file_size,
                                modified_timestamp,
                                directory_path: base_dir.to_string(),
                            });
                        }
                    }
                } else if path.is_dir() {
                    let dir_name = path
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    if !dir_name.starts_with('.')
                        && dir_name != "node_modules"
                        && dir_name != "target"
                    {
                        scan_dir(&path, base_dir, results, depth + 1);
                    }
                }
            }
        }
    }

    scan_dir(root, &directory_path, &mut results, 0);
    results
}

#[tauri::command]
fn get_default_directories() -> Vec<String> {
    let mut dirs = Vec::new();
    if let Some(home) = dirs_home() {
        let docs = home.join("Documents");
        if docs.exists() && docs.is_dir() {
            dirs.push(docs.to_string_lossy().to_string());
        }
        let downloads = home.join("Downloads");
        if downloads.exists() && downloads.is_dir() {
            dirs.push(downloads.to_string_lossy().to_string());
        }
    }
    dirs
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

#[tauri::command]
fn copy_image_to_clipboard(png_data_url: String) -> bool {
    let b64 = if let Some(idx) = png_data_url.find(',') {
        &png_data_url[idx + 1..]
    } else {
        &png_data_url
    };

    let bytes = match base64::engine::general_purpose::STANDARD.decode(b64) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let img = match image::load_from_memory(&bytes) {
        Ok(i) => i.to_rgba8(),
        Err(_) => return false,
    };

    let (width, height) = img.dimensions();
    let img_data = arboard::ImageData {
        width: width as usize,
        height: height as usize,
        bytes: img.into_raw().into(),
    };

    let mut clipboard = match arboard::Clipboard::new() {
        Ok(c) => c,
        Err(_) => return false,
    };

    clipboard.set_image(img_data).is_ok()
}

#[tauri::command]
fn copy_text_to_clipboard(text: String) -> bool {
    let mut clipboard = match arboard::Clipboard::new() {
        Ok(c) => c,
        Err(_) => return false,
    };
    clipboard.set_text(text).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AiRunnerState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_pdf_dialog,
            open_image_dialog,
            save_pdf_dialog,
            write_pdf_file,
            save_json_dialog,
            read_file_from_path,
            select_directory_dialog,
            scan_directory_pdfs,
            get_default_directories,
            copy_image_to_clipboard,
            copy_text_to_clipboard,
            get_ai_provider_status,
            set_ai_provider_executable,
            run_ai_explanation,
            cancel_ai_explanation,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod ai_tests {
    use super::*;

    #[test]
    fn command_construction_keeps_prompt_out_of_arguments() {
        let args = codex_arguments(
            Path::new("crop.png"),
            Path::new("schema.json"),
            Path::new("output.json"),
            Path::new("work"),
        );
        assert!(!args.join(" ").contains("malicious prompt"));
        assert_eq!(args.last().map(String::as_str), Some("-"));
        assert!(args
            .windows(2)
            .any(|pair| pair == ["--sandbox", "read-only"]));
        assert!(args.iter().any(|argument| argument == "--ignore-rules"));
    }

    #[test]
    fn parses_only_expected_structured_output() {
        assert_eq!(
            parse_ai_output(r#"{"explanation":"Clear answer"}"#),
            Ok("Clear answer".into())
        );
        assert!(parse_ai_output("Clear answer").is_err());
        assert!(parse_ai_output(r#"{"other":"answer"}"#).is_err());
    }

    #[test]
    fn manual_executable_has_discovery_precedence() {
        let manual = PathBuf::from("/definitely/manual/codex");
        assert_eq!(
            executable_candidates(Some(manual.clone())).first(),
            Some(&manual)
        );
    }

    #[test]
    fn temporary_directory_guard_removes_files() {
        let path =
            std::env::temp_dir().join(format!("pdfuck-ai-cleanup-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir(&path).unwrap();
        fs::write(path.join("region.png"), b"temporary").unwrap();
        drop(TempAiDirectory(path.clone()));
        assert!(!path.exists());
    }
}

#[cfg(test)]
mod pdf_file_persistence_tests {
    use super::*;

    #[test]
    fn page_changes_are_written_to_the_source_file() {
        let path = std::env::temp_dir().join(format!(
            "pdfuck-page-persistence-test-{}-{}.pdf",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::write(&path, b"original pdf bytes").unwrap();

        let result = write_pdf_file(
            path.to_string_lossy().into_owned(),
            b"pdf bytes after page deletion".to_vec(),
        );

        assert!(result.success);
        assert_eq!(fs::read(&path).unwrap(), b"pdf bytes after page deletion");
        let _ = fs::remove_file(path);
    }
}
