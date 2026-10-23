use crate::{
    db, graph, images,
    journal::{self, require_campaign, storage, AppResult},
    knowledge, player,
    search::inline_text,
};
use rusqlite::Connection;
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{io::Write, path::Path};
use zip::{write::SimpleFileOptions, ZipWriter};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportReceipt {
    pub path: String,
    pub files: usize,
    pub pages: usize,
    pub sessions: usize,
    pub images: usize,
}
fn md_text(content: &Value) -> String {
    let Some(items) = content.as_array() else {
        return String::new();
    };
    let mut out = String::new();
    for item in items {
        match item["type"].as_str() {
            Some("pageMention") => {
                let id = item["props"]["pageId"].as_str().unwrap_or("");
                let label = item["props"]["label"]
                    .as_str()
                    .unwrap_or("")
                    .replace(']', "\\]");
                out.push_str(&format!("[{label}](../pages/{id}.md)"));
            }
            Some("link") => {
                let label = inline_text(&item["content"]);
                let href = item["href"].as_str().unwrap_or("");
                if href.starts_with("https://") || href.starts_with("http://") {
                    out.push_str(&format!(
                        "[{}]({})",
                        label.replace(']', "\\]"),
                        href.replace(')', "%29")
                    ));
                } else {
                    out.push_str(&label);
                }
            }
            Some("text") => {
                let mut text = item["text"].as_str().unwrap_or("").to_string();
                if item["styles"]["bold"] == true {
                    text = format!("**{text}**");
                }
                if item["styles"]["italic"] == true {
                    text = format!("*{text}*");
                }
                out.push_str(&text);
            }
            _ => {}
        }
    }
    out
}
fn markdown(doc: &Value) -> String {
    fn blocks(value: &Value, depth: usize, out: &mut String) {
        if let Some(items) = value.as_array() {
            for b in items {
                let prefix = match b["type"].as_str() {
                    Some("heading") => {
                        "#".repeat(b["props"]["level"].as_u64().unwrap_or(2).clamp(1, 6) as usize)
                            + " "
                    }
                    Some("bulletListItem") => "- ".into(),
                    Some("numberedListItem") => "1. ".into(),
                    Some("checkListItem") => {
                        if b["props"]["checked"] == true {
                            "- [x] ".into()
                        } else {
                            "- [ ] ".into()
                        }
                    }
                    Some("quote") => "> ".into(),
                    _ => String::new(),
                };
                out.push_str(&format!(
                    "{}{}{}\n\n",
                    "  ".repeat(depth),
                    prefix,
                    md_text(&b["content"])
                ));
                blocks(&b["children"], depth + 1, out);
            }
        }
    }
    let mut out = String::new();
    blocks(&doc["blocks"], 0, &mut out);
    out
}
pub fn write_export(
    c: &Connection,
    root: &Path,
    campaign_id: &str,
    destination: &Path,
) -> AppResult<ExportReceipt> {
    require_campaign(c, campaign_id)?;
    let snapshot = c.unchecked_transaction().map_err(storage)?;
    let c = &snapshot;
    if !destination.is_absolute() || destination.extension().and_then(|s| s.to_str()) != Some("zip")
    {
        return Err("Scegli un nuovo file con estensione .zip.".into());
    }
    let campaign = journal::list_campaigns(c)?
        .into_iter()
        .find(|a| a.id == campaign_id)
        .ok_or("Campagna non trovata.")?;
    let sessions = journal::list_sessions(c, campaign_id)?;
    let pages = knowledge::list_pages(c, campaign_id)?;
    let character = player::get_character(c, campaign_id)?;
    let assets = if let Some(pc) = &character {
        player::list_assets(c, campaign_id, &pc.id)?
    } else {
        vec![]
    };
    let pictures = images::all(c, campaign_id)?;
    let mut q = c
        .prepare("SELECT id FROM relationships WHERE campaign_id=?1 ORDER BY id")
        .map_err(storage)?;
    let ids = q
        .query_map([campaign_id], |r| r.get::<_, String>(0))
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    drop(q);
    let relationships = ids
        .into_iter()
        .map(|id| graph::get_relationship(c, campaign_id, &id))
        .collect::<AppResult<Vec<_>>>()?;
    let data = json!({"formatVersion":1,"schemaVersion":db::LATEST_SCHEMA,"campaign":campaign,"sessions":sessions,"pages":pages,"character":character,"assets":assets,"images":pictures,"relationships":relationships});
    let mut files: Vec<(String, Vec<u8>)> = vec![(
        "campaign.json".into(),
        serde_json::to_vec_pretty(&data).map_err(|_| "Esportazione JSON non riuscita.")?,
    )];
    let mut index=format!("# {}\n\nEsportazione Chronexus. Le immagini collegate sono incluse; il ripristino completo usa il backup .nodex.\n\n## Pagine\n\n",campaign.name);
    for page in &pages {
        let mut text = format!(
            "# {}\n\nTipo: {}\n\nAlias: {}\n\n{}",
            page.title,
            page.kind,
            page.aliases.join(", "),
            markdown(&page.document)
        );
        append_images(&mut text, &pictures, Some(&page.id), None, None);
        files.push((format!("pages/{}.md", page.id), text.into_bytes()));
        index.push_str(&format!(
            "- [{}](pages/{}.md)\n",
            page.title.replace(']', "\\]"),
            page.id
        ));
    }
    index.push_str("\n## Sessioni\n\n");
    for session in &sessions {
        files.push((
            format!("sessions/{}.md", session.id),
            format!(
                "# Sessione {} — {}\n\n{}",
                session.sequence,
                session.title,
                markdown(&session.document)
            )
            .into_bytes(),
        ));
        index.push_str(&format!(
            "- [{}: {}](sessions/{}.md)\n",
            session.sequence,
            session.title.replace(']', "\\]"),
            session.id
        ));
    }
    if let Some(pc) = &character {
        let mut text = format!(
            "# {}\n\n```json\n{}\n```\n",
            pc.data.name,
            serde_json::to_string_pretty(&pc.data).map_err(|_| "Scheda illeggibile.")?
        );
        append_images(&mut text, &pictures, None, Some(&pc.id), None);
        files.push(("character/sheet.md".into(), text.into_bytes()));
        index.push_str("\n[Scheda del personaggio](character/sheet.md)\n");
    }
    for asset in &assets {
        let mut text = format!(
            "# {}\n\n```json\n{}\n```\n",
            data["assets"]
                .as_array()
                .and_then(|a| a.iter().find(|a| a["id"] == asset.id))
                .and_then(|a| a["input"]["details"]["name"].as_str())
                .unwrap_or("Voce"),
            serde_json::to_string_pretty(asset).map_err(|_| "Voce illeggibile.")?
        );
        append_images(&mut text, &pictures, None, None, Some(&asset.id));
        files.push((format!("assets/{}.md", asset.id), text.into_bytes()));
    }
    files.push(("README.md".into(), index.into_bytes()));
    if assets.iter().any(|asset| match &asset.input.details {
        player::AssetDetails::Spell { fields } | player::AssetDetails::Ability { fields } => {
            fields.catalog_source.is_some()
        }
        _ => false,
    }) {
        files.push(("LICENSE-SRD.txt".into(),b"This work includes material taken from the System Reference Document 5.1 (\"SRD 5.1\") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.\n\nImported spell entries can include personal modifications; catalogSource identifies their original entry. Data provider: D&D 5e API (5e-bits).\n".to_vec()));
    }
    for image in &pictures {
        files.push((
            format!("attachments/{}/{}", campaign_id, image.filename),
            images::bytes(root, image)?,
        ));
    }
    if files.iter().map(|(_, b)| b.len()).sum::<usize>() > 512 * 1024 * 1024 {
        return Err("Esportazione troppo grande (massimo 512 MiB).".into());
    }
    let manifest = json!({"formatVersion":1,"kind":"chronexus-readable-export","files":files.iter().map(|(path,bytes)|json!({"path":path,"size":bytes.len(),"sha256":format!("{:x}",Sha256::digest(bytes))})).collect::<Vec<_>>()});
    files.push((
        "manifest.json".into(),
        serde_json::to_vec_pretty(&manifest).map_err(|_| "Manifest non leggibile.")?,
    ));
    snapshot.commit().map_err(storage)?;
    let parent = destination.parent().ok_or("Destinazione mancante.")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|_| "Destinazione non accessibile: verifica cartella e permessi.")?;
    {
        let mut zip = ZipWriter::new(temp.as_file_mut());
        for (path, bytes) in &files {
            zip.start_file(
                path,
                SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated),
            )
            .map_err(|_| "Creazione ZIP fallita.")?;
            zip.write_all(bytes)
                .map_err(|_| "Scrittura ZIP fallita: verifica lo spazio disponibile.")?;
        }
        zip.finish().map_err(|_| "Chiusura ZIP fallita.")?;
    }
    temp.as_file()
        .sync_all()
        .map_err(|_| "Impossibile sincronizzare l'esportazione.")?;
    temp.persist_noclobber(destination)
        .map_err(|_| "Il file esiste già o non è scrivibile. Scegli un nome nuovo.")?;
    Ok(ExportReceipt {
        path: destination.display().to_string(),
        files: files.len(),
        pages: pages.len(),
        sessions: sessions.len(),
        images: pictures.len(),
    })
}
fn append_images(
    text: &mut String,
    images: &[images::Attachment],
    page: Option<&str>,
    character: Option<&str>,
    asset: Option<&str>,
) {
    for i in images {
        if (page.is_some() && i.page_id.as_deref() == page)
            || (character.is_some() && i.character_id.as_deref() == character)
            || (asset.is_some() && i.asset_id.as_deref() == asset)
        {
            text.push_str(&format!(
                "\n![{}](../attachments/{}/{})\n",
                i.caption.replace(']', "\\]"),
                i.campaign_id,
                i.filename
            ));
        }
    }
}
