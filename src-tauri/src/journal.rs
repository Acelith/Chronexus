use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use uuid::Uuid;

pub type AppResult<T> = Result<T, String>;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Campaign {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub campaign_id: String,
    pub sequence: i64,
    pub title: String,
    pub played_on: Option<String>,
    pub document: Value,
    pub revision: i64,
    pub updated_at: String,
}

pub(crate) fn storage(error: rusqlite::Error) -> String {
    match error {
        rusqlite::Error::SqliteFailure(ref e, _) if e.code == rusqlite::ErrorCode::ConstraintViolation =>
            "Operazione non valida: verifica che il numero di sessione sia unico nella campagna.".into(),
        _ => "Impossibile accedere all'archivio. Verifica spazio e permessi, poi riprova. Gli appunti restano nell'editor.".into(),
    }
}

pub(crate) fn title(value: &str) -> AppResult<&str> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 200 || value.contains('\0') {
        return Err("Inserisci un nome o titolo da 1 a 200 caratteri.".into());
    }
    Ok(value)
}

pub(crate) fn identifier(id: &str) -> AppResult<()> {
    Uuid::parse_str(id)
        .map(|_| ())
        .map_err(|_| "Identificatore non valido. Riapri la campagna.".into())
}

pub(crate) fn require_campaign(connection: &Connection, id: &str) -> AppResult<()> {
    identifier(id)?;
    let found: bool = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM campaigns WHERE id=?1)",
            [id],
            |r| r.get(0),
        )
        .map_err(storage)?;
    if !found {
        return Err("Campagna non trovata. Ricarica l'archivio.".into());
    }
    Ok(())
}

pub fn list_campaigns(connection: &Connection) -> AppResult<Vec<Campaign>> {
    let mut statement = connection
        .prepare("SELECT id,name FROM campaigns ORDER BY created_at,id")
        .map_err(storage)?;
    let rows = statement
        .query_map([], |row| {
            Ok(Campaign {
                id: row.get(0)?,
                name: row.get(1)?,
            })
        })
        .map_err(storage)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage);
    rows
}

pub fn create_campaign(connection: &Connection, name: &str) -> AppResult<Campaign> {
    let campaign = Campaign {
        id: Uuid::new_v4().to_string(),
        name: title(name)?.to_string(),
    };
    connection
        .execute(
            "INSERT INTO campaigns(id,name) VALUES (?1,?2)",
            params![campaign.id, campaign.name],
        )
        .map_err(storage)?;
    Ok(campaign)
}

pub fn rename_campaign(connection: &Connection, id: &str, name: &str) -> AppResult<Campaign> {
    require_campaign(connection, id)?;
    let name = title(name)?.to_string();
    connection.execute("UPDATE campaigns SET name=?1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?2", params![name,id]).map_err(storage)?;
    Ok(Campaign {
        id: id.into(),
        name,
    })
}

fn session_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Session> {
    let document: String = row.get(5)?;
    let document = serde_json::from_str(&document).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(5, rusqlite::types::Type::Text, Box::new(error))
    })?;
    Ok(Session {
        id: row.get(0)?,
        campaign_id: row.get(1)?,
        sequence: row.get(2)?,
        title: row.get(3)?,
        played_on: row.get(4)?,
        document,
        revision: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

pub fn list_sessions(connection: &Connection, campaign_id: &str) -> AppResult<Vec<Session>> {
    require_campaign(connection, campaign_id)?;
    let mut statement = connection.prepare("SELECT id,campaign_id,sequence,title,played_on,document,revision,updated_at FROM sessions WHERE campaign_id=?1 ORDER BY sequence,id").map_err(storage)?;
    let rows = statement
        .query_map([campaign_id], session_row)
        .map_err(storage)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage);
    rows
}

pub fn create_session(
    connection: &Connection,
    campaign_id: &str,
    sequence: i64,
    name: &str,
    played_on: Option<String>,
) -> AppResult<Session> {
    require_campaign(connection, campaign_id)?;
    let name = title(name)?;
    if !(1..=999999).contains(&sequence) {
        return Err("Il numero di sessione deve essere compreso tra 1 e 999999.".into());
    }
    if let Some(date) = &played_on {
        if date.len() != 10 || chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err() {
            return Err("Inserisci una data valida nel formato anno-mese-giorno.".into());
        }
    }
    let id = Uuid::new_v4().to_string();
    let document = empty_document();
    let tx = connection.unchecked_transaction().map_err(storage)?;
    tx.execute("INSERT INTO sessions(id,campaign_id,sequence,title,played_on,document) VALUES (?1,?2,?3,?4,?5,?6)",params![id,campaign_id,sequence,name,played_on,document.to_string()]).map_err(storage)?;
    crate::search::session(&tx, campaign_id, &id)?;
    tx.commit().map_err(storage)?;
    get_session(connection, campaign_id, &id)
}

pub fn get_session(connection: &Connection, campaign_id: &str, id: &str) -> AppResult<Session> {
    identifier(campaign_id)?;
    identifier(id)?;
    connection.query_row("SELECT id,campaign_id,sequence,title,played_on,document,revision,updated_at FROM sessions WHERE campaign_id=?1 AND id=?2", params![campaign_id,id],session_row)
        .optional().map_err(storage)?.ok_or_else(|| "Sessione non trovata in questa campagna.".into())
}

// Validate the supported editor subset before replacing canonical user content.
pub(crate) fn empty_document() -> Value {
    json!({"version":1,"blocks":[{"id":Uuid::new_v4().to_string(),"type":"paragraph","props":{},"content":[],"children":[]}]})
}

pub fn validate_document(document: &Value) -> AppResult<()> {
    if document.to_string().len() > 2_000_000 {
        return Err("Appunti troppo grandi (massimo 2 MB per sessione).".into());
    }
    let invalid =
        || "Formato degli appunti non valido o non supportato. Nessun dato sostituito.".to_string();
    if document.get("version").and_then(Value::as_u64) != Some(1) {
        return Err(invalid());
    }
    if document
        .get("importedFrom")
        .is_some_and(|v| v.as_str() != Some("logseq"))
    {
        return Err(invalid());
    }
    let blocks = document
        .get("blocks")
        .and_then(Value::as_array)
        .ok_or_else(invalid)?;
    if blocks.is_empty() {
        return Err(invalid());
    }
    fn visit(blocks: &[Value], depth: usize, ids: &mut HashSet<String>) -> Result<(), ()> {
        if depth > 12 {
            return Err(());
        }
        for block in blocks {
            let id = block.get("id").and_then(Value::as_str).ok_or(())?;
            if id.is_empty() || id.len() > 128 || !ids.insert(id.into()) || ids.len() > 10000 {
                return Err(());
            }
            let kind = block.get("type").and_then(Value::as_str).ok_or(())?;
            if ![
                "paragraph",
                "heading",
                "bulletListItem",
                "numberedListItem",
                "checkListItem",
                "quote",
            ]
            .contains(&kind)
            {
                return Err(());
            }
            if !block.get("props").is_some_and(Value::is_object) {
                return Err(());
            }
            for inline in block.get("content").and_then(Value::as_array).ok_or(())? {
                match inline.get("type").and_then(Value::as_str) {
                    Some("text")
                        if inline.get("text").is_some_and(Value::is_string)
                            && inline.get("styles").is_some_and(Value::is_object) => {}
                    Some("link") if inline.get("href").is_some_and(Value::is_string) => {
                        for text in inline.get("content").and_then(Value::as_array).ok_or(())? {
                            if text.get("type").and_then(Value::as_str) != Some("text")
                                || !text.get("text").is_some_and(Value::is_string)
                                || !text.get("styles").is_some_and(Value::is_object)
                            {
                                return Err(());
                            }
                        }
                    }
                    Some("pageMention") => {
                        let props = inline.get("props").ok_or(())?;
                        let id = props.get("pageId").and_then(Value::as_str).ok_or(())?;
                        let label = props.get("label").and_then(Value::as_str).ok_or(())?;
                        if Uuid::parse_str(id).is_err() || title(label).is_err() {
                            return Err(());
                        }
                    }
                    _ => return Err(()),
                }
            }
            visit(
                block.get("children").and_then(Value::as_array).ok_or(())?,
                depth + 1,
                ids,
            )?;
        }
        Ok(())
    }
    visit(blocks, 0, &mut HashSet::new()).map_err(|_| invalid())
}

pub fn save_document(
    connection: &Connection,
    campaign_id: &str,
    id: &str,
    revision: i64,
    document: Value,
) -> AppResult<Session> {
    identifier(campaign_id)?;
    identifier(id)?;
    validate_document(&document)?;
    let transaction = connection.unchecked_transaction().map_err(storage)?;
    let affected = transaction.execute("UPDATE sessions SET document=?1,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?2 AND campaign_id=?3 AND revision=?4",params![document.to_string(),id,campaign_id,revision]).map_err(storage)?;
    if affected != 1 {
        return Err("Salvataggio fermato: la sessione è stata modificata altrove o non appartiene alla campagna. Copia gli appunti prima di riaprire la sessione.".into());
    }
    crate::knowledge::index_document(&transaction, campaign_id, Some(id), None, &document)?;
    crate::search::session(&transaction, campaign_id, id)?;
    transaction.commit().map_err(storage)?;
    get_session(connection, campaign_id, id)
}
