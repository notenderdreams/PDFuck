use anyhow::{Context, Result};
use base64::Engine;

#[tauri::command]
#[specta::specta]
pub fn copy_image_to_clipboard(png_data_url: String) -> bool {
    copy_image(&png_data_url)
        .map_err(|error| log::error!("{error:#}"))
        .is_ok()
}

fn copy_image(png_data_url: &str) -> Result<()> {
    let encoded = png_data_url
        .split_once(',')
        .map(|(_, data)| data)
        .unwrap_or(png_data_url);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .context("clipboard image was not valid base64")?;
    let image = image::load_from_memory(&bytes)
        .context("clipboard image could not be decoded")?
        .to_rgba8();
    let (width, height) = image.dimensions();
    let image_data = arboard::ImageData {
        width: width as usize,
        height: height as usize,
        bytes: image.into_raw().into(),
    };

    let mut clipboard = arboard::Clipboard::new().context("failed to access the clipboard")?;
    clipboard
        .set_image(image_data)
        .context("failed to copy the image to the clipboard")?;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn copy_text_to_clipboard(text: String) -> bool {
    copy_text(text)
        .map_err(|error| log::error!("{error:#}"))
        .is_ok()
}

fn copy_text(text: String) -> Result<()> {
    let mut clipboard = arboard::Clipboard::new().context("failed to access the clipboard")?;
    clipboard
        .set_text(text)
        .context("failed to copy text to the clipboard")?;
    Ok(())
}
