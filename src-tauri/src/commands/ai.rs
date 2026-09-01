use anyhow::{Context, Result};
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

use super::error::CommandResult;
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

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredAiProvider {
    pub id: String,
    pub name: String,
    pub executable: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
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
    pub available_providers: Vec<DiscoveredAiProvider>,
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
    preferred_provider_id: Mutex<Option<String>>,
    custom_executable: Mutex<Option<PathBuf>>,
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

fn standard_candidate_paths(bin_names: &[&str]) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path_value) = std::env::var_os("PATH") {
        for directory in std::env::split_paths(&path_value) {
            for name in bin_names {
                let file_name = if cfg!(windows) {
                    format!("{}.exe", name)
                } else {
                    (*name).to_string()
                };
                candidates.push(directory.join(file_name));
            }
        }
    }
    if let Some(home) = home_directory() {
        for name in bin_names {
            let file_name = if cfg!(windows) {
                format!("{}.exe", name)
            } else {
                (*name).to_string()
            };
            candidates.push(home.join(".local/bin").join(&file_name));
            candidates.push(home.join(".cargo/bin").join(&file_name));
            candidates.push(home.join(".bun/bin").join(&file_name));
            candidates.push(home.join(".npm-global/bin").join(&file_name));
            candidates.push(home.join(".local/share/mise/shims").join(&file_name));
        }
    }
    for name in bin_names {
        candidates.push(PathBuf::from(format!("/opt/homebrew/bin/{}", name)));
        candidates.push(PathBuf::from(format!("/usr/local/bin/{}", name)));
    }
    candidates
}

fn discover_antigravity(manual: Option<PathBuf>) -> Option<PathBuf> {
    if let Some(path) = manual.filter(|p| p.is_file()) {
        return Some(path);
    }
    standard_candidate_paths(&["agy", "antigravity"])
        .into_iter()
        .find(|candidate| candidate.is_file())
}

fn discover_codex(manual: Option<PathBuf>) -> Option<PathBuf> {
    if let Some(path) = manual.filter(|p| p.is_file()) {
        return Some(path);
    }
    standard_candidate_paths(&["codex"])
        .into_iter()
        .find(|candidate| candidate.is_file())
}

fn check_antigravity_executable(executable: &Path) -> DiscoveredAiProvider {
    let version = match Command::new(executable).arg("--version").output() {
        Ok(output) if output.status.success() => {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        }
        _ => None,
    };

    let (status, message) = if version.is_some() {
        ("ready".to_string(), None)
    } else {
        (
            "incompatible_cli".to_string(),
            Some("The selected Antigravity CLI could not run `agy --version`.".to_string()),
        )
    };

    DiscoveredAiProvider {
        id: "antigravity".to_string(),
        name: "Antigravity CLI (agy)".to_string(),
        executable: executable.to_string_lossy().into_owned(),
        version,
        status,
        message,
    }
}

fn check_codex_executable(executable: &Path) -> DiscoveredAiProvider {
    let version = match Command::new(executable).arg("--version").output() {
        Ok(output) if output.status.success() => {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        }
        _ => None,
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
        return DiscoveredAiProvider {
            id: "codex".to_string(),
            name: "Codex CLI".to_string(),
            executable: executable.to_string_lossy().into_owned(),
            version,
            status: "incompatible_cli".to_string(),
            message: Some(
                "This Codex CLI version does not support required non-interactive options."
                    .to_string(),
            ),
        };
    }

    if !matches!(Command::new(executable).args(["login", "status"]).output(), Ok(output) if output.status.success())
    {
        return DiscoveredAiProvider {
            id: "codex".to_string(),
            name: "Codex CLI".to_string(),
            executable: executable.to_string_lossy().into_owned(),
            version,
            status: "unauthenticated".to_string(),
            message: Some(
                "Codex is installed but not logged in. Run `codex login` and try again."
                    .to_string(),
            ),
        };
    }

    DiscoveredAiProvider {
        id: "codex".to_string(),
        name: "Codex CLI".to_string(),
        executable: executable.to_string_lossy().into_owned(),
        version,
        status: "ready".to_string(),
        message: None,
    }
}

fn check_custom_executable(executable: &Path) -> DiscoveredAiProvider {
    let file_name = executable
        .file_name()
        .map(|f| f.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if file_name.contains("agy") || file_name.contains("antigravity") {
        let mut provider = check_antigravity_executable(executable);
        provider.id = "custom".to_string();
        provider.name = format!("Custom ({})", executable.display());
        return provider;
    }
    if file_name.contains("codex") {
        let mut provider = check_codex_executable(executable);
        provider.id = "custom".to_string();
        provider.name = format!("Custom ({})", executable.display());
        return provider;
    }

    let version = Command::new(executable)
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| {
            let text = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        });

    DiscoveredAiProvider {
        id: "custom".to_string(),
        name: format!("Custom ({})", executable.display()),
        executable: executable.to_string_lossy().into_owned(),
        version,
        status: "ready".to_string(),
        message: None,
    }
}

fn scan_all_providers(custom: Option<PathBuf>) -> Vec<DiscoveredAiProvider> {
    let mut list = Vec::new();

    if let Some(custom_path) = custom {
        if custom_path.is_file() {
            list.push(check_custom_executable(&custom_path));
        }
    }

    if let Some(agy_path) = discover_antigravity(None) {
        list.push(check_antigravity_executable(&agy_path));
    }

    if let Some(codex_path) = discover_codex(None) {
        list.push(check_codex_executable(&codex_path));
    }

    list
}

pub fn resolve_active_provider(state: &AiRunnerState) -> AiProviderStatus {
    let custom = state.custom_executable.lock().ok().and_then(|c| c.clone());
    let preferred = state
        .preferred_provider_id
        .lock()
        .ok()
        .and_then(|p| p.clone());
    let available = scan_all_providers(custom);

    if available.is_empty() {
        return AiProviderStatus {
            status: "missing_cli".to_string(),
            provider: None,
            version: None,
            executable: None,
            message: Some(
                "No supported AI CLI was found. Please install Antigravity CLI (agy) or Codex."
                    .to_string(),
            ),
            available_providers: Vec::new(),
        };
    }

    let selected = if let Some(pref_id) = preferred {
        available
            .iter()
            .find(|p| p.id == pref_id)
            .cloned()
            .or_else(|| available.iter().find(|p| p.status == "ready").cloned())
            .unwrap_or_else(|| available[0].clone())
    } else {
        available
            .iter()
            .find(|p| p.status == "ready")
            .cloned()
            .unwrap_or_else(|| available[0].clone())
    };

    AiProviderStatus {
        status: selected.status.clone(),
        provider: Some(selected.id.clone()),
        version: selected.version.clone(),
        executable: Some(selected.executable.clone()),
        message: selected.message.clone(),
        available_providers: available,
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_ai_provider_status(
    state: tauri::State<'_, AiRunnerState>,
) -> CommandResult<AiProviderStatus> {
    Ok(resolve_active_provider(&state))
}

#[tauri::command]
#[specta::specta]
pub async fn set_ai_provider_preference(
    provider_id: String,
    executable_path: Option<String>,
    state: tauri::State<'_, AiRunnerState>,
) -> CommandResult<AiProviderStatus> {
    if let Ok(mut pref) = state.preferred_provider_id.lock() {
        *pref = Some(provider_id.clone());
    }
    if let Some(path_str) = executable_path {
        let p = PathBuf::from(path_str);
        if p.is_file() {
            if let Ok(mut custom) = state.custom_executable.lock() {
                *custom = Some(p);
            }
        }
    }
    Ok(resolve_active_provider(&state))
}

#[tauri::command]
#[specta::specta]
pub async fn set_ai_provider_executable(
    executable_path: String,
    state: tauri::State<'_, AiRunnerState>,
) -> CommandResult<AiProviderStatus> {
    let path = PathBuf::from(&executable_path);
    if !path.is_absolute() || !path.is_file() {
        return Ok(AiProviderStatus {
            status: "missing_cli".to_string(),
            provider: None,
            version: None,
            executable: None,
            message: Some("Select an existing absolute path to an AI executable.".to_string()),
            available_providers: scan_all_providers(None),
        });
    }

    if let Ok(mut custom) = state.custom_executable.lock() {
        *custom = Some(path);
    }
    if let Ok(mut pref) = state.preferred_provider_id.lock() {
        *pref = Some("custom".to_string());
    }

    Ok(resolve_active_provider(&state))
}

pub fn antigravity_arguments(prompt: &str) -> Vec<String> {
    vec![
        "--output-format".into(),
        "json".into(),
        "--disable-slash-commands".into(),
        "--sandbox".into(),
        format!("-p={}", prompt),
    ]
}

pub fn codex_arguments(
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

pub fn parse_ai_output(contents: &str) -> Result<String> {
    let trimmed = contents.trim();
    if trimmed.is_empty() {
        anyhow::bail!("AI CLI produced empty output");
    }

    let value: serde_json::Value =
        serde_json::from_str(trimmed).context("AI CLI response was not valid JSON")?;

    // Check if it's an Antigravity CLI payload
    if let Some(status) = value.get("status").and_then(|s| s.as_str()) {
        if status != "SUCCESS" {
            let err = value
                .get("error")
                .and_then(|e| e.as_str())
                .unwrap_or("Antigravity CLI returned an error status");
            anyhow::bail!("{err}");
        }
        if let Some(structured) = value
            .get("structured_output")
            .and_then(|s| s.get("explanation"))
            .and_then(|e| e.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            return Ok(structured.to_string());
        }
        if let Some(response) = value
            .get("response")
            .and_then(|r| r.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
        {
            return Ok(response.to_string());
        }
    }

    // Check if it's a Codex schema payload {"explanation": "..."}
    if let Some(explanation) = value
        .get("explanation")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(explanation.to_string());
    }

    // Generic fallback for any {"response": "..."} JSON
    if let Some(response) = value
        .get("response")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(response.to_string());
    }

    anyhow::bail!("AI response did not contain a non-empty explanation")
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
        "cinnabar-ai-{}-{}-{}",
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

    let active = resolve_active_provider(state);
    if active.status != "ready" {
        return ai_error(
            &active.status,
            active
                .message
                .unwrap_or_else(|| "The selected AI CLI is not ready.".to_string()),
        );
    }
    let Some(executable_str) = active.executable else {
        return ai_error(
            "missing_cli",
            "No AI executable is available. Please select one in Settings.",
        );
    };
    let executable = PathBuf::from(&executable_str);
    let provider_id = active.provider.unwrap_or_else(|| "antigravity".to_string());

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
        Err(error) => return process_failure(error, "Could not prepare AI diagnostics."),
    };

    let mut command = Command::new(&executable);
    let is_antigravity = provider_id == "antigravity"
        || executable_str.to_lowercase().contains("agy")
        || executable_str.to_lowercase().contains("antigravity");

    let child = if is_antigravity {
        let out_file = match fs::File::create(&output_path)
            .with_context(|| format!("failed to create {}", output_path.display()))
        {
            Ok(value) => value,
            Err(error) => return process_failure(error, "Could not prepare output file."),
        };

        command
            .args(antigravity_arguments(&request.prompt))
            .current_dir(&temporary.0)
            .stdout(Stdio::from(out_file))
            .stderr(Stdio::from(diagnostics));

        match command
            .spawn()
            .with_context(|| format!("failed to start Antigravity at {}", executable.display()))
        {
            Ok(value) => value,
            Err(error) => return process_failure(error, "Could not start Antigravity CLI."),
        }
    } else {
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

        let mut spawned = match command
            .spawn()
            .with_context(|| format!("failed to start Codex at {}", executable.display()))
        {
            Ok(value) => value,
            Err(error) => return process_failure(error, "Could not start Codex CLI."),
        };

        let prompt_result = spawned
            .stdin
            .as_mut()
            .context("Codex stdin was not available")
            .and_then(|stdin| {
                stdin
                    .write_all(request.prompt.as_bytes())
                    .context("failed to write the prompt to Codex")
            });
        if let Err(error) = prompt_result {
            let _ = spawned.kill();
            return process_failure(error, "Could not send the explanation prompt to Codex.");
        }
        drop(spawned.stdin.take());
        spawned
    };

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
        return ai_error("timeout", "AI CLI did not respond within three minutes.");
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
                "AI CLI exited without producing an explanation.".into()
            } else {
                capped
            },
        );
    }

    match fs::read_to_string(&output_path)
        .with_context(|| format!("failed to read AI response from {}", output_path.display()))
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
                "AI CLI returned an unreadable response. Try again.",
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
    fn antigravity_arguments_construction() {
        let args = antigravity_arguments("Explain this equation");
        assert_eq!(args[0], "--output-format");
        assert_eq!(args[1], "json");
        assert!(args.iter().any(|a| a == "--sandbox"));
        assert!(args.iter().any(|a| a == "--disable-slash-commands"));
        assert_eq!(args.last().unwrap(), "-p=Explain this equation");
    }

    #[test]
    fn parses_antigravity_and_codex_output() {
        // Antigravity standard response
        assert_eq!(
            parse_ai_output(r#"{"status":"SUCCESS","response":"Clear explanation"}"#).unwrap(),
            "Clear explanation"
        );
        // Antigravity structured response
        assert_eq!(
            parse_ai_output(r#"{"status":"SUCCESS","response":"Fallback","structured_output":{"explanation":"Structured answer"}}"#).unwrap(),
            "Structured answer"
        );
        // Codex schema output
        assert_eq!(
            parse_ai_output(r#"{"explanation":"Clear answer"}"#).unwrap(),
            "Clear answer"
        );
        // Antigravity error
        assert!(parse_ai_output(r#"{"status":"ERROR","error":"Token limit"}"#).is_err());
        assert!(parse_ai_output("").is_err());
    }

    #[test]
    fn temporary_directory_guard_removes_files() {
        let path =
            std::env::temp_dir().join(format!("cinnabar-ai-cleanup-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir(&path).unwrap();
        fs::write(path.join("region.png"), b"temporary").unwrap();
        drop(TempAiDirectory(path.clone()));
        assert!(!path.exists());
    }
}
