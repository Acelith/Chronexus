use crate::{
    graph::block_exists,
    journal::{identifier, require_campaign, storage, title, AppResult},
    knowledge,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use uuid::Uuid;

const LIMIT: i64 = 1_000_000;
fn text(value: &str, max: usize) -> AppResult<()> {
    if value.chars().count() > max || value.contains('\0') {
        return Err(format!(
            "Testo non valido: massimo {max} caratteri, senza caratteri nulli."
        ));
    }
    Ok(())
}
fn bounded(value: i64, min: i64, max: i64, label: &str) -> AppResult<()> {
    if !(min..=max).contains(&value) {
        return Err(format!(
            "{label}: inserisci un numero intero da {min} a {max}."
        ));
    }
    Ok(())
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Stat {
    pub id: String,
    pub label: String,
    pub value: String,
    pub group: String,
    #[serde(default)]
    pub modifier: String,
    #[serde(default)]
    pub training: Training,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Training {
    #[default]
    None,
    Proficient,
    Expert,
}

pub const SHEET_FIELDS: &[&str] = &[
    "playerName",
    "background",
    "alignment",
    "nextLevelXp",
    "armorClass",
    "initiative",
    "proficiencyBonus",
    "armor",
    "hitDiceTotal",
    "hitDiceUsed",
    "resistances",
    "vision",
    "speed",
    "specialMovement",
    "passivePerception",
    "passiveInvestigation",
    "createdOn",
    "birth",
    "deity",
    "age",
    "gender",
    "height",
    "weight",
    "size",
    "appearance",
    "personality",
    "ideals",
    "bonds",
    "flaws",
    "allies",
    "enemies",
    "proficiencies",
    "languages",
    "ancestryTraits",
    "classFeatures",
    "feats",
    "platinum",
    "gold",
    "electrum",
    "silver",
    "copper",
    "gems",
    "valuables",
    "mount",
    "encumbrance",
    "castingClass",
    "castingAbility",
    "spellSaveDc",
    "spellAttackBonus",
    "spellCount",
];
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SheetDetails {
    #[serde(default)]
    pub fields: BTreeMap<String, String>,
    #[serde(default)]
    pub inspiration: bool,
    #[serde(default)]
    pub death_successes: i64,
    #[serde(default)]
    pub death_failures: i64,
    #[serde(default)]
    pub attacks: Vec<Attack>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Attack {
    pub id: String,
    pub name: String,
    pub bonus: String,
    pub damage: String,
    pub range: String,
    pub weight: String,
    pub ammunition: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Resource {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub current: i64,
    pub maximum: i64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CharacterInput {
    #[serde(default)]
    pub sheet: SheetDetails,
    pub name: String,
    pub system_id: String,
    pub ancestry: String,
    pub vocation: String,
    pub level: Option<i64>,
    pub experience: Option<i64>,
    pub hp_current: i64,
    pub hp_maximum: i64,
    pub hp_temporary: i64,
    pub stats: Vec<Stat>,
    pub resources: Vec<Resource>,
    pub conditions: String,
    pub notes: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Character {
    pub id: String,
    pub campaign_id: String,
    pub data: CharacterInput,
    pub revision: i64,
}
fn validate_character(input: &CharacterInput) -> AppResult<()> {
    title(&input.name)?;
    title(&input.system_id)?;
    text(&input.system_id, 80)?;
    text(&input.ancestry, 200)?;
    text(&input.vocation, 200)?;
    text(&input.conditions, 2000)?;
    text(&input.notes, 16000)?;
    let sheet = &input.sheet;
    for (key, value) in &sheet.fields {
        if !SHEET_FIELDS.contains(&key.as_str()) {
            return Err("Campo della scheda sconosciuto.".into());
        }
        text(value, 4000)?;
    }
    bounded(sheet.death_successes, 0, 3, "Successi contro morte")?;
    bounded(sheet.death_failures, 0, 3, "Fallimenti contro morte")?;
    if sheet.attacks.len() > 30 {
        return Err("Massimo 30 armi o attacchi.".into());
    }
    for (number, label) in [(input.level, "Livello"), (input.experience, "Esperienza")] {
        if let Some(n) = number {
            bounded(n, 0, LIMIT, label)?;
        }
    }
    bounded(input.hp_maximum, 0, LIMIT, "Punti vita massimi")?;
    bounded(input.hp_current, 0, input.hp_maximum, "Punti vita attuali")?;
    bounded(input.hp_temporary, 0, LIMIT, "Punti vita temporanei")?;
    if input.stats.len() > 100 || input.resources.len() > 50 {
        return Err("Massimo 100 statistiche e 50 risorse per personaggio.".into());
    }
    let mut ids = HashSet::new();
    for attack in &sheet.attacks {
        identifier(&attack.id)?;
        title(&attack.name)?;
        if !ids.insert(&attack.id) {
            return Err("Attacco duplicato.".into());
        }
        for value in [
            &attack.bonus,
            &attack.damage,
            &attack.range,
            &attack.weight,
            &attack.ammunition,
        ] {
            text(value, 200)?;
        }
    }
    for stat in &input.stats {
        identifier(&stat.id)?;
        title(&stat.label)?;
        text(&stat.value, 200)?;
        text(&stat.modifier, 200)?;
        if !ids.insert(&stat.id)
            || !["ability", "skill", "save", "defense", "movement", "other"]
                .contains(&stat.group.as_str())
        {
            return Err("Statistica duplicata o categoria non valida.".into());
        }
    }
    for resource in &input.resources {
        identifier(&resource.id)?;
        title(&resource.label)?;
        if !ids.insert(&resource.id) || !["resource", "slot"].contains(&resource.kind.as_str()) {
            return Err("Risorsa duplicata o tipo non valido.".into());
        }
        bounded(resource.maximum, 0, LIMIT, "Risorsa massima")?;
        bounded(resource.current, 0, resource.maximum, "Risorsa attuale")?;
    }
    Ok(())
}
fn character_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Character> {
    Ok(Character {
        id: row.get(0)?,
        campaign_id: row.get(1)?,
        data: decode(row, 2)?,
        revision: row.get(3)?,
    })
}
fn decode<T: serde::de::DeserializeOwned>(
    row: &rusqlite::Row<'_>,
    index: usize,
) -> rusqlite::Result<T> {
    let raw: String = row.get(index)?;
    serde_json::from_str(&raw).map_err(|e| {
        rusqlite::Error::FromSqlConversionFailure(index, rusqlite::types::Type::Text, Box::new(e))
    })
}
pub fn get_character(c: &Connection, campaign: &str) -> AppResult<Option<Character>> {
    require_campaign(c, campaign)?;
    c.query_row(
        "SELECT id,campaign_id,data,revision FROM characters WHERE campaign_id=?1",
        [campaign],
        character_row,
    )
    .optional()
    .map_err(storage)
}
fn require_character(c: &Connection, campaign: &str, id: &str) -> AppResult<Character> {
    identifier(id)?;
    get_character(c, campaign)?
        .filter(|item| item.id == id)
        .ok_or("Personaggio non trovato in questa campagna.".into())
}
pub fn save_character(
    c: &Connection,
    campaign: &str,
    id: Option<&str>,
    revision: Option<i64>,
    input: CharacterInput,
) -> AppResult<Character> {
    require_campaign(c, campaign)?;
    validate_character(&input)?;
    let data = serde_json::to_string(&input).map_err(|_| "Scheda non leggibile.")?;
    let chosen = id
        .map(String::from)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    identifier(&chosen)?;
    if id.is_some() {
        let revision = revision.ok_or("Revisione mancante. Riapri la scheda.")?;
        let changed=c.execute("UPDATE characters SET data=?1,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE campaign_id=?2 AND id=?3 AND revision=?4",params![data,campaign,chosen,revision]).map_err(storage)?;
        if changed != 1 {
            return Err("Scheda modificata altrove. Riaprila prima di salvare; le modifiche restano nel modulo.".into());
        }
    } else {
        if get_character(c, campaign)?.is_some() {
            return Err("Questa campagna ha già un personaggio. Apri la sua scheda.".into());
        }
        c.execute(
            "INSERT INTO characters(id,campaign_id,data) VALUES (?1,?2,?3)",
            params![chosen, campaign, data],
        )
        .map_err(storage)?;
    }
    require_character(c, campaign, &chosen)
}
pub fn change_counter(
    c: &Connection,
    campaign: &str,
    id: &str,
    revision: i64,
    target: &str,
    delta: i64,
) -> AppResult<Character> {
    bounded(delta, -LIMIT, LIMIT, "Variazione")?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    let mut character = require_character(&tx, campaign, id)?;
    if character.revision != revision {
        return Err("Contatore modificato altrove. Riapri la scheda.".into());
    }
    let value = match target {
        "hp" => &mut character.data.hp_current,
        "temporaryHp" => &mut character.data.hp_temporary,
        resource => {
            &mut character
                .data
                .resources
                .iter_mut()
                .find(|r| r.id == resource)
                .ok_or("Risorsa non trovata. Riapri la scheda.")?
                .current
        }
    };
    *value = value
        .checked_add(delta)
        .ok_or("Variazione troppo grande.")?;
    let saved = save_character(&tx, campaign, Some(id), Some(revision), character.data)?;
    tx.commit().map_err(storage)?;
    Ok(saved)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum AssetDetails {
    Item {
        #[serde(default)]
        location: String,
        name: String,
        quantity: i64,
        category: String,
        description: String,
        weight: Option<f64>,
        value: String,
        equipped: bool,
        consumable: bool,
        notes: String,
    },
    Spell {
        #[serde(flatten)]
        fields: AbilityFields,
    },
    Ability {
        #[serde(flatten)]
        fields: AbilityFields,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AbilityFields {
    #[serde(default)]
    pub catalog_source: Option<crate::catalog::CatalogSource>,
    #[serde(default)]
    pub ritual: bool,
    #[serde(default)]
    pub concentration: bool,
    pub name: String,
    pub system_id: String,
    pub rank: String,
    pub school: String,
    pub casting_time: String,
    pub duration: String,
    pub range: String,
    pub components: String,
    pub known: bool,
    pub prepared: bool,
    pub description: String,
    pub notes: String,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssetLinks {
    pub page_id: Option<String>,
    pub source_session_id: Option<String>,
    pub source_block_id: Option<String>,
    pub npc_id: Option<String>,
    pub place_id: Option<String>,
    pub quest_id: Option<String>,
    pub provenance_notes: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AssetInput {
    pub details: AssetDetails,
    pub links: AssetLinks,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub campaign_id: String,
    pub character_id: String,
    pub input: AssetInput,
    pub revision: i64,
    pub source_available: bool,
}
fn validate_details(details: &AssetDetails) -> AppResult<()> {
    match details {
        AssetDetails::Item {
            location,
            name,
            quantity,
            category,
            description,
            weight,
            value,
            notes,
            ..
        } => {
            title(name)?;
            bounded(*quantity, 0, LIMIT, "Quantità")?;
            text(category, 100)?;
            text(description, 16000)?;
            text(value, 200)?;
            text(notes, 16000)?;
            text(location, 200)?;
            if weight.is_some_and(|w| !w.is_finite() || !(0.0..=1_000_000.0).contains(&w)) {
                return Err(
                    "Peso: inserisci un valore da 0 a 1000000, nella tua unità di misura.".into(),
                );
            }
        }
        AssetDetails::Spell { fields } | AssetDetails::Ability { fields } => {
            title(&fields.name)?;
            title(&fields.system_id)?;
            text(&fields.system_id, 80)?;
            for value in [
                &fields.rank,
                &fields.school,
                &fields.casting_time,
                &fields.duration,
                &fields.range,
                &fields.components,
            ] {
                text(value, 200)?;
            }
            text(&fields.description, 16000)?;
            text(&fields.notes, 16000)?;
            if let Some(source) = &fields.catalog_source {
                source.validate()?;
            }
        }
    }
    Ok(())
}
fn source_available(c: &Connection, campaign: &str, links: &AssetLinks) -> AppResult<bool> {
    let Some(session) = &links.source_session_id else {
        return Ok(links.source_block_id.is_none());
    };
    identifier(session)?;
    let raw: Option<String> = c
        .query_row(
            "SELECT document FROM sessions WHERE campaign_id=?1 AND id=?2",
            params![campaign, session],
            |r| r.get(0),
        )
        .optional()
        .map_err(storage)?;
    let Some(raw) = raw else {
        return Err("Sessione fonte non trovata in questa campagna.".into());
    };
    let document: serde_json::Value =
        serde_json::from_str(&raw).map_err(|_| "Documento fonte non leggibile.")?;
    Ok(links
        .source_block_id
        .as_ref()
        .is_none_or(|id| block_exists(&document, id)))
}
fn validate_links(c: &Connection, campaign: &str, links: &AssetLinks) -> AppResult<()> {
    text(&links.provenance_notes, 4000)?;
    if let Some(block) = &links.source_block_id {
        text(block, 128)?;
        if block.is_empty() || links.source_session_id.is_none() {
            return Err("Seleziona una sessione prima del blocco fonte.".into());
        }
    }
    for id in [
        &links.page_id,
        &links.npc_id,
        &links.place_id,
        &links.quest_id,
    ]
    .into_iter()
    .flatten()
    {
        knowledge::get_page(c, campaign, id)?;
    }
    source_available(c, campaign, links)?;
    Ok(())
}
fn asset_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Asset> {
    Ok(Asset {
        id: row.get(0)?,
        campaign_id: row.get(1)?,
        character_id: row.get(2)?,
        input: AssetInput {
            details: decode(row, 3)?,
            links: AssetLinks {
                page_id: row.get(4)?,
                source_session_id: row.get(5)?,
                source_block_id: row.get(6)?,
                npc_id: row.get(7)?,
                place_id: row.get(8)?,
                quest_id: row.get(9)?,
                provenance_notes: row.get(10)?,
            },
        },
        revision: row.get(11)?,
        source_available: true,
    })
}
const ASSET_SELECT:&str="SELECT id,campaign_id,character_id,details,page_id,source_session_id,source_block_id,npc_id,place_id,quest_id,provenance_notes,revision FROM player_assets";
pub fn list_assets(c: &Connection, campaign: &str, character: &str) -> AppResult<Vec<Asset>> {
    require_character(c, campaign, character)?;
    let mut statement=c.prepare(&format!("{ASSET_SELECT} WHERE campaign_id=?1 AND character_id=?2 ORDER BY json_extract(details,'$.name') COLLATE NOCASE,id")).map_err(storage)?;
    let mut assets = statement
        .query_map(params![campaign, character], asset_row)
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    for asset in &mut assets {
        asset.source_available = source_available(c, campaign, &asset.input.links)?;
    }
    Ok(assets)
}
fn get_asset(c: &Connection, campaign: &str, character: &str, id: &str) -> AppResult<Asset> {
    require_character(c, campaign, character)?;
    identifier(id)?;
    let mut asset = c
        .query_row(
            &format!("{ASSET_SELECT} WHERE campaign_id=?1 AND character_id=?2 AND id=?3"),
            params![campaign, character, id],
            asset_row,
        )
        .optional()
        .map_err(storage)?
        .ok_or("Voce non trovata per questo personaggio.")?;
    asset.source_available = source_available(c, campaign, &asset.input.links)?;
    Ok(asset)
}
pub fn save_asset(
    c: &Connection,
    campaign: &str,
    character: &str,
    id: Option<&str>,
    revision: Option<i64>,
    input: AssetInput,
) -> AppResult<Asset> {
    let tx = c.unchecked_transaction().map_err(storage)?;
    require_character(&tx, campaign, character)?;
    validate_details(&input.details)?;
    validate_links(&tx, campaign, &input.links)?;
    let previous = id
        .map(|id| get_asset(&tx, campaign, character, id))
        .transpose()?;
    let empty = AssetLinks::default();
    let old = previous.as_ref().map(|a| &a.input.links).unwrap_or(&empty);
    for (new, old, kind) in [
        (&input.links.npc_id, &old.npc_id, "npc"),
        (&input.links.place_id, &old.place_id, "place"),
        (&input.links.quest_id, &old.quest_id, "quest"),
    ] {
        if let Some(id) = new {
            if new != old && knowledge::get_page(&tx, campaign, id)?.kind != kind {
                return Err(
                    "La pagina collegata non ha il tipo richiesto (PNG, luogo o missione).".into(),
                );
            }
        }
    }
    // A removed source block remains attributable. Unchanged historical links
    // must not prevent quantity updates or editing an existing description.
    if !source_available(&tx, campaign, &input.links)?
        && previous.as_ref().is_none_or(|a| {
            a.input.links.source_session_id != input.links.source_session_id
                || a.input.links.source_block_id != input.links.source_block_id
        })
    {
        return Err(
            "Blocco fonte non trovato. Seleziona un blocco attuale o rimuovi il riferimento."
                .into(),
        );
    }
    if let Some(old) = &previous {
        if std::mem::discriminant(&old.input.details) != std::mem::discriminant(&input.details) {
            return Err("Il tipo della voce non può essere cambiato. Crea una nuova voce.".into());
        }
    }
    let chosen = id
        .map(String::from)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    identifier(&chosen)?;
    let details = serde_json::to_string(&input.details).map_err(|_| "Voce non leggibile.")?;
    let links = &input.links;
    let changed = if id.is_some() {
        tx.execute("UPDATE player_assets SET details=?1,page_id=?2,source_session_id=?3,source_block_id=?4,npc_id=?5,place_id=?6,quest_id=?7,provenance_notes=?8,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE campaign_id=?9 AND character_id=?10 AND id=?11 AND revision=?12",params![details,links.page_id,links.source_session_id,links.source_block_id,links.npc_id,links.place_id,links.quest_id,links.provenance_notes,campaign,character,chosen,revision.ok_or("Revisione mancante. Riapri la voce.")?]).map_err(storage)?
    } else {
        tx.execute("INSERT INTO player_assets(id,campaign_id,character_id,details,page_id,source_session_id,source_block_id,npc_id,place_id,quest_id,provenance_notes) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",params![chosen,campaign,character,details,links.page_id,links.source_session_id,links.source_block_id,links.npc_id,links.place_id,links.quest_id,links.provenance_notes]).map_err(storage)?
    };
    if changed != 1 {
        return Err(
            "Voce modificata altrove. Riaprila prima di salvare; il modulo resta aperto.".into(),
        );
    }
    let saved = get_asset(&tx, campaign, character, &chosen)?;
    tx.commit().map_err(storage)?;
    Ok(saved)
}
pub fn delete_asset(
    c: &Connection,
    campaign: &str,
    character: &str,
    id: &str,
    revision: i64,
) -> AppResult<()> {
    require_character(c, campaign, character)?;
    identifier(id)?;
    let changed=c.execute("DELETE FROM player_assets WHERE campaign_id=?1 AND character_id=?2 AND id=?3 AND revision=?4",params![campaign,character,id,revision]).map_err(storage)?;
    if changed != 1 {
        return Err("Voce modificata altrove o non trovata. Riaprila prima di eliminarla.".into());
    }
    Ok(())
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    for campaign in crate::journal::list_campaigns(c)? {
        if let Some(character) = get_character(c, &campaign.id)? {
            identifier(&character.id)?;
            validate_character(&character.data)?;
            for asset in list_assets(c, &campaign.id, &character.id)? {
                identifier(&asset.id)?;
                validate_details(&asset.input.details)?;
                validate_links(c, &campaign.id, &asset.input.links)?;
            }
        }
    }
    Ok(())
}
