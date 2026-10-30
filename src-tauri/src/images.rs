use crate::journal::{identifier, require_campaign, storage, title, AppResult};
use base64::{engine::general_purpose::STANDARD, Engine};
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Cursor, Read, Write},
    path::{Path, PathBuf},
};
use uuid::Uuid;
const MAX_BYTES: usize = 20 * 1024 * 1024;
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ImageTarget {
    pub kind: String,
    pub id: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub page_id: Option<String>,
    pub character_id: Option<String>,
    pub asset_id: Option<String>,
    pub id: String,
    pub campaign_id: String,
    pub caption: String,
    pub role: String,
    pub filename: String,
    pub width: u32,
    pub height: u32,
    pub size: u64,
    pub sha256: String,
    pub created_at: String,
}
fn owner(c: &Connection, campaign: &str, target: &ImageTarget) -> AppResult<()> {
    require_campaign(c, campaign)?;
    identifier(&target.id)?;
    let table = match target.kind.as_str() {
        "page" => "pages",
        "character" => "characters",
        "asset" => "player_assets",
        _ => return Err("Invalid image destination.".into()),
    };
    let found: bool = c
        .query_row(
            &format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE campaign_id=?1 AND id=?2)"),
            params![campaign, target.id],
            |r| r.get(0),
        )
        .map_err(storage)?;
    if !found {
        return Err("The entry does not belong to the selected campaign.".into());
    }
    Ok(())
}
fn decode(bytes: &[u8]) -> AppResult<(DynamicImage, ImageFormat)> {
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Err("Image too large or empty: up to 20 MiB.".into());
    }
    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| "Unreadable image format.")?;
    let format = reader.format().ok_or("Choose a PNG, JPEG or WebP image.")?;
    if ![ImageFormat::Png, ImageFormat::Jpeg, ImageFormat::WebP].contains(&format) {
        return Err("PNG, JPEG and WebP are supported; SVG and GIF are not imported.".into());
    }
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(8192);
    limits.max_image_height = Some(8192);
    limits.max_alloc = Some(160 * 1024 * 1024);
    reader.limits(limits);
    let mut decoder = reader
        .into_decoder()
        .map_err(|_| "Damaged or too large image.")?;
    let (w, h) = decoder.dimensions();
    if u64::from(w) * u64::from(h) > 32_000_000 {
        return Err("Up to 32 million pixels per image.".into());
    }
    let orientation = decoder
        .orientation()
        .unwrap_or(image::metadata::Orientation::NoTransforms);
    let mut image = DynamicImage::from_decoder(decoder)
        .map_err(|_| "Damaged image or too much memory needed.")?;
    image.apply_orientation(orientation);
    Ok((image, format))
}
fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Attachment> {
    Ok(Attachment {
        page_id: r.get(10)?,
        character_id: r.get(11)?,
        asset_id: r.get(12)?,
        id: r.get(0)?,
        campaign_id: r.get(1)?,
        caption: r.get(2)?,
        role: r.get(3)?,
        filename: r.get(4)?,
        width: r.get(5)?,
        height: r.get(6)?,
        size: r.get::<_, i64>(7)? as u64,
        sha256: r.get(8)?,
        created_at: r.get(9)?,
    })
}
const COLUMNS: &str = "id,campaign_id,caption,role,filename,width,height,size,sha256,created_at,page_id,character_id,asset_id";
fn column(target: &ImageTarget) -> AppResult<&'static str> {
    match target.kind.as_str() {
        "page" => Ok("page_id"),
        "character" => Ok("character_id"),
        "asset" => Ok("asset_id"),
        _ => Err("Invalid image destination.".into()),
    }
}
pub fn list(c: &Connection, campaign: &str, target: &ImageTarget) -> AppResult<Vec<Attachment>> {
    owner(c, campaign, target)?;
    let field = column(target)?;
    let mut q=c.prepare(&format!("SELECT {COLUMNS} FROM image_attachments WHERE campaign_id=?1 AND {field}=?2 ORDER BY created_at,id")).map_err(storage)?;
    let rows = q
        .query_map(params![campaign, target.id], row)
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage);
    rows
}
pub fn all(c: &Connection, campaign: &str) -> AppResult<Vec<Attachment>> {
    require_campaign(c, campaign)?;
    let mut q = c
        .prepare(&format!(
            "SELECT {COLUMNS} FROM image_attachments WHERE campaign_id=?1 ORDER BY created_at,id"
        ))
        .map_err(storage)?;
    let rows = q
        .query_map([campaign], row)
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage);
    rows
}
pub(crate) fn get(c: &Connection, campaign: &str, id: &str) -> AppResult<Attachment> {
    identifier(id)?;
    require_campaign(c, campaign)?;
    c.query_row(
        &format!("SELECT {COLUMNS} FROM image_attachments WHERE campaign_id=?1 AND id=?2"),
        params![campaign, id],
        row,
    )
    .map_err(|_| "Image not found in the campaign.".into())
}
fn directory(root: &Path, campaign: &str) -> AppResult<PathBuf> {
    identifier(campaign)?;
    let canonical = fs::canonicalize(root).map_err(|_| "Archive folder not accessible.")?;
    let mut parent = canonical;
    for component in ["attachments", campaign] {
        let path = parent.join(component);
        if !path.exists() {
            fs::create_dir(&path)
                .map_err(|_| "Cannot create the images folder: check space and permissions.")?;
        }
        let metadata = fs::symlink_metadata(&path).map_err(|_| "Image folder not accessible.")?;
        if metadata.file_type().is_symlink()
            || !metadata.is_dir()
            || fs::canonicalize(&path).map_err(|_| "Images path not readable.")? != path
        {
            return Err("The images folder contains a forbidden external link.".into());
        }
        parent = path;
    }
    Ok(parent)
}
pub fn add(
    c: &Connection,
    root: &Path,
    campaign: &str,
    target: &ImageTarget,
    caption: &str,
    role: &str,
    bytes: Vec<u8>,
) -> AppResult<Attachment> {
    owner(c, campaign, target)?;
    let caption = title(caption)?;
    if !["portrait", "map", "image", "reference"].contains(&role) {
        return Err("Invalid image type.".into());
    }
    if list(c, campaign, target)?.len() >= 100 {
        return Err("Up to 100 images per entry.".into());
    }
    let (image, format) = decode(&bytes)?;
    let extension = if format == ImageFormat::Jpeg {
        "jpg"
    } else if format == ImageFormat::WebP {
        "webp"
    } else {
        "png"
    };
    let id = Uuid::new_v4().to_string();
    let filename = format!("{id}.{extension}");
    let parent = directory(root, campaign)?;
    let mut temporary =
        tempfile::NamedTempFile::new_in(root).map_err(|_| "Cannot copy the image.")?;
    temporary
        .write_all(&bytes)
        .and_then(|_| temporary.as_file().sync_all())
        .map_err(|_| "Image copy failed: check space and permissions.")?;
    let path = parent.join(&filename);
    temporary
        .persist_noclobber(&path)
        .map_err(|_| "Cannot save the image copy.")?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    let field = column(target)?;
    let result=tx.execute(&format!("INSERT INTO image_attachments(id,campaign_id,{field},caption,role,filename,width,height,size,sha256) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"),params![id,campaign,target.id,caption,role,filename,image.width(),image.height(),bytes.len() as i64,format!("{:x}",Sha256::digest(&bytes))]).map_err(storage).and_then(|_|tx.commit().map_err(storage));
    if let Err(error) = result {
        let _ = fs::remove_file(path);
        return Err(error);
    }
    get(c, campaign, &id)
}
pub fn bytes(root: &Path, attachment: &Attachment) -> AppResult<Vec<u8>> {
    let ext = attachment.filename.rsplit('.').next().unwrap_or("");
    if !["png", "jpg", "webp"].contains(&ext)
        || attachment.filename != format!("{}.{}", attachment.id, ext)
    {
        return Err("Invalid image name.".into());
    }
    let path = directory(root, &attachment.campaign_id)?.join(&attachment.filename);
    let metadata = fs::symlink_metadata(&path)
        .map_err(|_| "Image file missing. Recover it from the backup.")?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > MAX_BYTES as u64
    {
        return Err("Invalid image file.".into());
    }
    let mut data = vec![];
    fs::File::open(&path)
        .and_then(|file| file.take(MAX_BYTES as u64 + 1).read_to_end(&mut data))
        .map_err(|_| "Image not readable.")?;
    if data.len() as u64 != attachment.size
        || format!("{:x}", Sha256::digest(&data)) != attachment.sha256
    {
        return Err("Image changed or damaged. Recover the original copy from the backup.".into());
    }
    Ok(data)
}
pub fn read(
    c: &Connection,
    root: &Path,
    campaign: &str,
    id: &str,
    thumbnail: bool,
) -> AppResult<String> {
    let attachment = get(c, campaign, id)?;
    let data = bytes(root, &attachment)?;
    let (data, mime) = if thumbnail {
        let (image, _) = decode(&data)?;
        let mut out = Cursor::new(Vec::new());
        image
            .thumbnail(480, 320)
            .write_to(&mut out, ImageFormat::Png)
            .map_err(|_| "Preview not available.")?;
        (out.into_inner(), "image/png")
    } else {
        let ext = attachment.filename.rsplit('.').next().unwrap();
        (
            data,
            if ext == "jpg" {
                "image/jpeg"
            } else if ext == "webp" {
                "image/webp"
            } else {
                "image/png"
            },
        )
    };
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(data)))
}
pub fn detach(c: &Connection, campaign: &str, id: &str) -> AppResult<()> {
    get(c, campaign, id)?;
    let pinned: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM map_pins WHERE campaign_id=?1 AND image_id=?2)",
            params![campaign, id],
            |r| r.get(0),
        )
        .map_err(storage)?;
    if pinned {
        return Err("This map has pins. Delete its pins or move them to another map first.".into());
    }
    c.execute(
        "DELETE FROM image_attachments WHERE campaign_id=?1 AND id=?2",
        params![campaign, id],
    )
    .map_err(storage)?;
    Ok(())
}
pub fn detach_asset(c: &Connection, campaign: &str, id: &str) -> AppResult<()> {
    let exists: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='image_attachments')",
            [],
            |r| r.get(0),
        )
        .map_err(storage)?;
    if exists {
        c.execute(
            "DELETE FROM image_attachments WHERE campaign_id=?1 AND asset_id=?2",
            params![campaign, id],
        )
        .map_err(storage)?;
    }
    Ok(())
}
pub fn validate_files(c: &Connection, root: &Path) -> AppResult<()> {
    for campaign in crate::journal::list_campaigns(c)? {
        for image in all(c, &campaign.id)? {
            identifier(&image.id)?;
            title(&image.caption)?;
            let data = bytes(root, &image)?;
            let (decoded, _) = decode(&data)?;
            if decoded.width() != image.width || decoded.height() != image.height {
                return Err("Inconsistent image dimensions in the backup.".into());
            }
        }
    }
    Ok(())
}
