use anyhow::{anyhow, Context, Result};
use base64::Engine;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use super::error::{command_error, CommandResult};
use super::platform::home_directory;

const EXPLANATION_TIMEOUT: Duration = Duration::from_secs(180);
const RESPONSE_SCHEMA: &str = r#"{"type":"object","properties":{"explanation":{"type":"string"}},"required":["explanation"],"additionalProperties":false}"#;

#[derive(Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AiExplanationRequest {
    pub request_id: String,
    pub prompt: String,
    pub png_data_url: String,
}

#[derive(Serialize, Type)]
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

#[derive(Serialize, Type)]
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
    processes: Mutex<HashMap<String, SharedChild>>,
    cancellations: Mutex<HashSet<String>>,
}

type SharedChild = Arc<Mutex<Option<Child>>>;

impl Drop for AiRunnerState {
    fn drop(&mut self) {
        if let Ok(processes) = self.processes.lock() {
            for process in processes.values() {
                kill_process(process);
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

fn missing_provider(message: impl Into<String>) -> AiProviderStatus {
    AiProviderStatus {
        status: "missing_cli".into(),
        provider: None,
        version: None,
        executable: None,
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
    if let Some(home) = home_directory() {
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
    let version = match Command::new(executable).arg("--version").output() {
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
            };
        }
    };

    let supports_required_options = Command::new(executable)
        .args(["exec", "--help"])
        .output()
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

    if !matches!(Command::new(executable).args(["login", "status"]).output(), Ok(output) if output.status.success())
    {
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
#[specta::specta]
pub async fn get_ai_provider_status(
    state: tauri::State<'_, AiRunnerState>,
) -> CommandResult<AiProviderStatus> {
    let manual = state
        .executable
        .lock()
        .map_err(|_| anyhow!("AI executable state lock was poisoned"))
        .map_err(command_error)?
        .clone();
    Ok(discover_codex(manual)
        .map(|executable| check_provider(&executable))
        .unwrap_or_else(|| {
            missing_provider("Codex CLI was not found. Install Codex or select its executable.")
        }))
}

#[tauri::command]
#[specta::specta]
pub async fn set_ai_provider_executable(
    executable_path: String,
    state: tauri::State<'_, AiRunnerState>,
) -> CommandResult<AiProviderStatus> {
    let path = PathBuf::from(executable_path);
    if !path.is_absolute() || !path.is_file() {
        return Ok(missing_provider(
            "Select an existing absolute path to the Codex executable.",
        ));
    }

    let status = check_provider(&path);
    if status.status == "ready" {
        let mut manual = state
            .executable
            .lock()
            .map_err(|_| anyhow!("AI executable state lock was poisoned"))
            .map_err(command_error)?;
        *manual = Some(path);
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

fn parse_ai_output(contents: &str) -> Result<String> {
    let value: serde_json::Value =
        serde_json::from_str(contents).context("Codex response was not valid JSON")?;
    value
        .get("explanation")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .ok_or_else(|| anyhow!("Codex response did not contain a non-empty explanation"))
}

fn create_workspace(request_id: &str) -> Result<TempAiDirectory> {
    let suffix: String = request_id
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
    fs::create_dir(&directory)
        .with_context(|| format!("failed to create AI workspace {}", directory.display()))?;
    Ok(TempAiDirectory(directory))
}

fn process_failure(error: anyhow::Error, message: impl Into<String>) -> AiExplanationResult {
    log::error!("{error:#}");
    ai_error("process_failed", message)
}

fn kill_process(process: &SharedChild) {
    if let Ok(mut child) = process.lock() {
        if let Some(child) = child.as_mut() {
            let _ = child.kill();
        }
    }
}

fn request_was_cancelled(state: &AiRunnerState, request_id: &str) -> bool {
    state
        .cancellations
        .lock()
        .map(|mut values| values.remove(request_id))
        .unwrap_or(false)
}

#[tauri::command]
#[specta::specta]
pub async fn run_ai_explanation(
    request: AiExplanationRequest,
    state: tauri::State<'_, AiRunnerState>,
) -> CommandResult<AiExplanationResult> {
    Ok(run_ai_explanation_inner(request, &state).await)
}

async fn run_ai_explanation_inner(
    request: AiExplanationRequest,
    state: &AiRunnerState,
) -> AiExplanationResult {
    if request_was_cancelled(state, &request.request_id) {
        return ai_error("cancelled", "Explanation cancelled.");
    }

    let manual = state.executable.lock().ok().and_then(|value| value.clone());
    let Some(executable) = discover_codex(manual) else {
        return ai_error(
            "missing_cli",
            "Codex CLI was not found. Install Codex or select its executable.",
        );
    };
    let provider = check_provider(&executable);
    if provider.status != "ready" {
        return ai_error(
            &provider.status,
            provider
                .message
                .unwrap_or_else(|| "Codex is not ready.".into()),
        );
    }

    let temporary = match create_workspace(&request.request_id) {
        Ok(value) => value,
        Err(error) => {
            return process_failure(error, "Could not create temporary AI workspace.");
        }
    };
    let crop_path = temporary.0.join("region.png");
    let schema_path = temporary.0.join("response-schema.json");
    let output_path = temporary.0.join("response.json");
    let diagnostics_path = temporary.0.join("diagnostics.txt");

    let encoded = request
        .png_data_url
        .split_once(',')
        .map(|(_, data)| data)
        .unwrap_or(&request.png_data_url);
    let crop = match base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .context("selected region image was not valid base64")
    {
        Ok(value) => value,
        Err(error) => return process_failure(error, "The selected region image was invalid."),
    };
    if let Err(error) = fs::write(&crop_path, crop)
        .with_context(|| format!("failed to write region image to {}", crop_path.display()))
        .and_then(|_| {
            fs::write(&schema_path, RESPONSE_SCHEMA).with_context(|| {
                format!(
                    "failed to write response schema to {}",
                    schema_path.display()
                )
            })
        })
    {
        return process_failure(error, "Could not prepare the temporary AI request.");
    }
    let diagnostics = match fs::File::create(&diagnostics_path)
        .with_context(|| format!("failed to create {}", diagnostics_path.display()))
    {
        Ok(value) => value,
        Err(error) => return process_failure(error, "Could not prepare Codex diagnostics."),
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
    let mut child = match command
        .spawn()
        .with_context(|| format!("failed to start Codex at {}", executable.display()))
    {
        Ok(value) => value,
        Err(error) => return process_failure(error, "Could not start Codex."),
    };
    let prompt_result = child
        .stdin
        .as_mut()
        .context("Codex stdin was not available")
        .and_then(|stdin| {
            stdin
                .write_all(request.prompt.as_bytes())
                .context("failed to write the prompt to Codex")
        });
    if let Err(error) = prompt_result {
        let _ = child.kill();
        return process_failure(error, "Could not send the explanation prompt to Codex.");
    }
    drop(child.stdin.take());

    let process = Arc::new(Mutex::new(Some(child)));
    if let Ok(mut processes) = state.processes.lock() {
        processes.insert(request.request_id.clone(), process.clone());
    }
    if request_was_cancelled(state, &request.request_id) {
        kill_process(&process);
        if let Ok(mut processes) = state.processes.lock() {
            processes.remove(&request.request_id);
        }
        return ai_error("cancelled", "Explanation cancelled.");
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
        if started.elapsed() >= EXPLANATION_TIMEOUT {
            timed_out = true;
            kill_process(&process);
        }
        let polled = process.lock().ok().and_then(|mut value| {
            value
                .as_mut()
                .and_then(|child| child.try_wait().ok().flatten())
        });
        if let Some(status) = polled {
            break status;
        }
        tokio::time::sleep(Duration::from_millis(if timed_out { 30 } else { 60 })).await;
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
        return ai_error("timeout", "Codex did not respond within three minutes.");
    }
    if cancelled {
        return ai_error("cancelled", "Explanation cancelled.");
    }
    if !exit_status.success() {
        let diagnostic = fs::read_to_string(&diagnostics_path).unwrap_or_default();
        let capped: String = diagnostic.chars().take(4_000).collect();
        return ai_error(
            "process_failed",
            if capped.trim().is_empty() {
                "Codex exited without producing an explanation.".into()
            } else {
                capped
            },
        );
    }

    match fs::read_to_string(&output_path)
        .with_context(|| {
            format!(
                "failed to read Codex response from {}",
                output_path.display()
            )
        })
        .and_then(|contents| parse_ai_output(&contents))
    {
        Ok(response) => AiExplanationResult {
            ok: true,
            response: Some(response),
            code: None,
            message: None,
        },
        Err(error) => {
            log::error!("{error:#}");
            ai_error(
                "malformed_output",
                "Codex returned an unreadable structured response. Try again.",
            )
        }
    }
}

#[tauri::command]
#[specta::specta]
pub fn cancel_ai_explanation(request_id: String, state: tauri::State<'_, AiRunnerState>) -> bool {
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

#[cfg(test)]
mod tests {
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
            parse_ai_output(r#"{"explanation":"Clear answer"}"#).unwrap(),
            "Clear answer"
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
