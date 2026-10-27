//! Shareable projections of data that is not a plain Codex item: selected sections of the
//! character sheet and managed images (M25.4). Both can only be **shared**: the server has no
//! kind that would let another computer rebuild a full sheet or re-attach an image to its
//! owner, so a private replica would be a copy nobody could use. They are never part of
//! "keep a private copy of everything".
//!
//! A section carries only non-empty fields the user can see on the sheet, as plain strings,
//! under a stable key; nothing is computed or inferred. An image carries its caption and is
//! uploaded once as an original (byte for byte, PNG/JPEG/WebP within the server's limits).
use crate::{images, journal::AppResult, player};
use rusqlite::Connection;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

/// What the server accepts for one uploaded image.
pub const MAX_SHARED_IMAGE_BYTES: u64 = 8 * 1024 * 1024;
pub const MAX_SHARED_IMAGE_SIDE: u32 = 8192;
pub const MAX_SHARED_IMAGE_PIXELS: u64 = 16_000_000;

type Fields = &'static [(&'static str, &'static str)];
const IDENTITY: Fields = &[
    ("playerName", "Player name"),
    ("background", "Background"),
    ("alignment", "Alignment"),
    ("nextLevelXp", "Experience to next level"),
    ("createdOn", "Character creation date"),
    ("birth", "Date and place of birth"),
    ("deity", "Deity and domain"),
    ("age", "Age"),
    ("gender", "Gender"),
    ("height", "Height"),
    ("weight", "Body weight"),
    ("size", "Size"),
    ("appearance", "Appearance and mannerisms"),
    ("personality", "Personality traits"),
    ("ideals", "Ideals"),
    ("bonds", "Bonds"),
    ("flaws", "Flaws"),
    ("allies", "Companions and allies"),
    ("enemies", "Enemies"),
    ("proficiencies", "Weapon, armor and tool proficiencies"),
    ("languages", "Languages"),
    ("ancestryTraits", "Origin traits"),
    ("classFeatures", "Class features"),
    ("feats", "Feats"),
];
const COMBAT: Fields = &[
    ("armorClass", "Armor class"),
    ("initiative", "Initiative"),
    ("proficiencyBonus", "Proficiency bonus"),
    ("armor", "Armor, shield and protection"),
    ("hitDiceTotal", "Total hit dice"),
    ("hitDiceUsed", "Hit dice used"),
    ("resistances", "Advantages, resistances and immunities"),
    ("vision", "Vision"),
    ("speed", "Speed and travel"),
    ("specialMovement", "Special movement"),
    ("passivePerception", "Passive Perception"),
    ("passiveInvestigation", "Passive Investigation"),
];
const EQUIPMENT: Fields = &[
    ("platinum", "Platinum pieces"),
    ("gold", "Gold pieces"),
    ("electrum", "Electrum pieces"),
    ("silver", "Silver pieces"),
    ("copper", "Copper pieces"),
    ("gems", "Gems and jewelry"),
    ("valuables", "Valuables lent, deposited or received"),
    ("mount", "Mount"),
    ("encumbrance", "Load and encumbrance"),
];
const SPELLCASTING: Fields = &[
    ("castingClass", "Spellcasting class"),
    ("castingAbility", "Spellcasting ability"),
    ("spellSaveDc", "Spell save DC"),
    ("spellAttackBonus", "Spell attack bonus"),
    ("spellCount", "Number of spells prepared or known"),
];
/// Section keys the server understands, with their interface titles (English source).
pub const SECTIONS: [(&str, &str); 4] = [
    ("identity", "Identity and background"),
    ("combat", "Combat and senses"),
    ("equipment", "Money, valuables and load"),
    ("spellcasting", "Magic"),
];

/// A stable UUID for a (character, section) pair, so the same section is the same server item
/// on every computer without any extra bookkeeping.
pub fn section_id(character: &str, section: &str) -> String {
    let digest = Sha256::digest(format!("chronexus-sheet-section:{character}:{section}"));
    let mut bytes = [0u8; 16];
    bytes.copy_from_slice(&digest[..16]);
    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    uuid::Uuid::from_bytes(bytes).to_string()
}
fn fields_of(section: &str, input: &player::CharacterInput) -> Vec<(&'static str, String, String)> {
    let mut out: Vec<(&'static str, String, String)> = vec![];
    let mut put = |key: &'static str, label: &str, value: String| {
        let value = value.trim().to_string();
        if !value.is_empty() {
            out.push((key, label.to_string(), value));
        }
    };
    match section {
        "identity" => {
            put("name", "Character name", input.name.clone());
            put("ancestry", "Ancestry", input.ancestry.clone());
            put("vocation", "Class or calling", input.vocation.clone());
            put(
                "level",
                "Level",
                input.level.map(|n| n.to_string()).unwrap_or_default(),
            );
            put(
                "experience",
                "Experience",
                input.experience.map(|n| n.to_string()).unwrap_or_default(),
            );
        }
        "combat" if input.hp_maximum > 0 => {
            put("hpCurrent", "Hit points", input.hp_current.to_string());
            put(
                "hpMaximum",
                "Maximum hit points",
                input.hp_maximum.to_string(),
            );
            put(
                "hpTemporary",
                "Temporary hit points",
                if input.hp_temporary > 0 {
                    input.hp_temporary.to_string()
                } else {
                    String::new()
                },
            );
        }
        _ => {}
    }
    let table: Fields = match section {
        "identity" => IDENTITY,
        "combat" => COMBAT,
        "equipment" => EQUIPMENT,
        _ => SPELLCASTING,
    };
    for (key, label) in table {
        if let Some(value) = input.sheet.fields.get(*key) {
            put(key, label, value.clone());
        }
    }
    out
}
/// The sections that have anything to say, as `(item id, section key, title)`.
pub fn sections(c: &Connection, campaign: &str) -> AppResult<Vec<(String, &'static str, String)>> {
    let Some(character) = player::get_character(c, campaign)? else {
        return Ok(vec![]);
    };
    Ok(SECTIONS
        .iter()
        .filter(|(key, _)| !fields_of(key, &character.data).is_empty())
        .map(|(key, title)| {
            (
                section_id(&character.id, key),
                *key,
                format!("Character sheet · {title}"),
            )
        })
        .collect())
}
/// The wire payload of a section, or None when the section is empty or no longer exists.
pub fn section_payload(c: &Connection, campaign: &str, id: &str) -> AppResult<Option<Value>> {
    let Some(character) = player::get_character(c, campaign)? else {
        return Ok(None);
    };
    for (key, title) in SECTIONS {
        if section_id(&character.id, key) != id {
            continue;
        }
        let fields = fields_of(key, &character.data);
        if fields.is_empty() {
            return Ok(None);
        }
        return Ok(Some(json!({
            "characterId": character.id,
            "name": format!("{} · {title}", character.data.name.chars().take(150).collect::<String>()),
            "section": key,
            "fields": fields.iter().map(|(k, label, value)| json!({
                "key": k,
                "label": label,
                "value": value.chars().take(4000).collect::<String>(),
            })).collect::<Vec<_>>(),
        })));
    }
    Ok(None)
}

/// The local form of an image item, used to detect changes. The server payload is built at
/// send time, after the original has been uploaded.
pub fn image_payload(c: &Connection, campaign: &str, id: &str) -> AppResult<Option<Value>> {
    let Some(image) = images::all(c, campaign)?.into_iter().find(|i| i.id == id) else {
        return Ok(None);
    };
    let mime = match image.filename.rsplit('.').next() {
        Some("jpg") => "image/jpeg",
        Some("webp") => "image/webp",
        _ => "image/png",
    };
    Ok(Some(json!({
        "caption": image.caption,
        "sha256": image.sha256,
        "mime": mime,
        "size": image.size,
        "width": image.width,
        "height": image.height,
    })))
}
/// Whether the server would refuse this image, so the user is told instead of retried forever.
pub fn image_too_large(local: &Value) -> bool {
    let number = |key: &str| local[key].as_u64().unwrap_or(0);
    number("size") > MAX_SHARED_IMAGE_BYTES
        || number("width") > u64::from(MAX_SHARED_IMAGE_SIDE)
        || number("height") > u64::from(MAX_SHARED_IMAGE_SIDE)
        || number("width") * number("height") > MAX_SHARED_IMAGE_PIXELS
}
pub fn image_items(c: &Connection, campaign: &str) -> AppResult<Vec<(String, String)>> {
    Ok(images::all(c, campaign)?
        .into_iter()
        .map(|image| (image.id, image.caption))
        .collect())
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn section_ids_are_stable_valid_uuids_that_differ_per_section_and_character() {
        let a = section_id("2f0e4c4a-0000-4000-8000-000000000001", "combat");
        assert_eq!(
            a,
            section_id("2f0e4c4a-0000-4000-8000-000000000001", "combat")
        );
        assert_ne!(
            a,
            section_id("2f0e4c4a-0000-4000-8000-000000000001", "identity")
        );
        assert_ne!(
            a,
            section_id("2f0e4c4a-0000-4000-8000-000000000002", "combat")
        );
        assert!(uuid::Uuid::parse_str(&a).is_ok_and(|id| id.to_string() == a));
    }
    #[test]
    fn oversized_images_are_recognized_before_any_upload() {
        let ok = json!({"size": 1000, "width": 800, "height": 600});
        assert!(!image_too_large(&ok));
        for bad in [
            json!({"size": 9 * 1024 * 1024, "width": 10, "height": 10}),
            json!({"size": 10, "width": 9000, "height": 10}),
            json!({"size": 10, "width": 5000, "height": 4000}),
        ] {
            assert!(image_too_large(&bad), "{bad}");
        }
    }
}
