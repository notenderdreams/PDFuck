pub type CommandResult<T> = std::result::Result<T, String>;

pub fn command_error(error: anyhow::Error) -> String {
    format!("{error:#}")
}
