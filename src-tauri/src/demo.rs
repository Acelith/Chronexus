//! M32: optional synthetic demo campaign and the first-start tour flag.
//!
//! The demo is an ordinary campaign whose id is recorded in `app_metadata`, so no schema
//! change is needed and older backups stay valid. The interface supplies the visible text in
//! the user's language; the structure (pages, sessions, links, clues, character) is fixed
//! here. It is created only on request, cannot be shared or used for training, and
//! [`remove`] deletes every row and managed image of that campaign in one transaction.
use crate::{
    clues, graph,
    journal::{self, identifier, storage, AppResult, Campaign},
    knowledge, player,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, path::Path};

const DEMO_KEY: &str = "demo_campaign_id";
const TOUR_KEY: &str = "first_start_tour_seen";

/// Visible demo text in the interface language. `{0}`/`{1}` mark page mentions.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DemoText {
    pub campaign: String,
    pub town: String,
    pub town_text: String,
    pub innkeeper: String,
    pub innkeeper_text: String,
    pub baron: String,
    pub baron_text: String,
    pub tower: String,
    pub tower_text: String,
    pub session1: String,
    /// `{0}` town, `{1}` innkeeper.
    pub session1_arrival: String,
    /// `{0}` innkeeper, `{1}` baron: the claim the rumour points to.
    pub session1_claim: String,
    pub session2: String,
    /// `{0}` tower.
    pub session2_path: String,
    /// `{0}` baron.
    pub session2_seal: String,
    pub lives_in: String,
    pub rules: String,
    pub rules_evidence: String,
    pub linked_to: String,
    pub linked_evidence: String,
    pub rumour: String,
    pub rumour_details: String,
    pub question: String,
    pub question_details: String,
    pub character: String,
    pub ancestry: String,
    pub vocation: String,
    pub character_notes: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstStart {
    pub demo_campaign_id: Option<String>,
    pub tour_seen: bool,
}

fn metadata(c: &Connection, key: &str) -> AppResult<Option<String>> {
    c.query_row("SELECT value FROM app_metadata WHERE key=?1", [key], |r| {
        r.get(0)
    })
    .optional()
    .map_err(storage)
}

/// The demo campaign's id, when one exists.
pub fn campaign_id(c: &Connection) -> AppResult<Option<String>> {
    let Some(id) = metadata(c, DEMO_KEY)? else {
        return Ok(None);
    };
    let exists: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM campaigns WHERE id=?1)",
            [&id],
            |r| r.get(0),
        )
        .map_err(storage)?;
    Ok(exists.then_some(id))
}

pub fn is_demo(c: &Connection, campaign: &str) -> AppResult<bool> {
    Ok(campaign_id(c)?.as_deref() == Some(campaign))
}

/// Refuses work that would mix the demo with real data or leave files behind.
pub fn refuse(c: &Connection, campaign: &str) -> AppResult<()> {
    if is_demo(c, campaign)? {
        return Err(
            "The demo campaign cannot be shared or used for training. Create your own campaign for that."
                .into(),
        );
    }
    Ok(())
}

pub fn first_start(c: &Connection) -> AppResult<FirstStart> {
    Ok(FirstStart {
        demo_campaign_id: campaign_id(c)?,
        tour_seen: metadata(c, TOUR_KEY)?.is_some(),
    })
}

pub fn set_tour_seen(c: &Connection, seen: bool) -> AppResult<FirstStart> {
    if seen {
        c.execute(
            "INSERT INTO app_metadata(key,value) VALUES (?1,'1') ON CONFLICT(key) DO NOTHING",
            [TOUR_KEY],
        )
    } else {
        c.execute("DELETE FROM app_metadata WHERE key=?1", [TOUR_KEY])
    }
    .map_err(storage)?;
    first_start(c)
}

fn plain(text: &str, limit: usize) -> AppResult<String> {
    let text = text.trim();
    if text.is_empty() || text.chars().count() > limit || text.contains(['\u{0}', '\r']) {
        return Err("Demo text is missing or too long. Nothing was created.".into());
    }
    Ok(text.to_string())
}

/// One paragraph whose `{n}` markers become mentions of `pages[n]` (id, label).
/// Every marker must appear exactly once, so a translation cannot drop a link.
fn paragraph(id: &str, template: &str, pages: &[(&str, &str)]) -> AppResult<Value> {
    let template = plain(template, 600)?;
    // Arabic interface text wraps parameters in isolation marks; drop stray ones.
    let template = template.replace(['\u{2068}', '\u{2069}'], "");
    let mut content = vec![];
    let mut rest = template.as_str();
    let mut seen = vec![false; pages.len()];
    while let Some(start) = rest.find('{') {
        let end = rest[start..]
            .find('}')
            .map(|e| start + e)
            .ok_or("Demo text is missing or too long. Nothing was created.")?;
        let index: usize = rest[start + 1..end]
            .parse()
            .map_err(|_| "Demo text is missing or too long. Nothing was created.")?;
        let (page, label) = pages
            .get(index)
            .ok_or("Demo text is missing or too long. Nothing was created.")?;
        if seen[index] {
            return Err("Demo text is missing or too long. Nothing was created.".into());
        }
        seen[index] = true;
        if start > 0 {
            content.push(json!({"type":"text","text":&rest[..start],"styles":{}}));
        }
        content.push(json!({"type":"pageMention","props":{"pageId":page,"label":label}}));
        rest = &rest[end + 1..];
    }
    if !rest.is_empty() {
        content.push(json!({"type":"text","text":rest,"styles":{}}));
    }
    if seen.contains(&false) {
        return Err("Demo text is missing or too long. Nothing was created.".into());
    }
    Ok(json!({"id":id,"type":"paragraph","props":{},"content":content,"children":[]}))
}

fn note(text: &str) -> AppResult<Value> {
    Ok(json!({"version":1,"blocks":[
        {"id":"demo-1","type":"paragraph","props":{},"content":[{"type":"text","text":plain(text,600)?,"styles":{}}],"children":[]}
    ]}))
}

/// Creates the demo campaign. Only one may exist. On any failure the partial campaign is
/// removed again, so a refused creation leaves nothing behind.
pub fn create(c: &Connection, root: &Path, text: &DemoText) -> AppResult<Campaign> {
    if campaign_id(c)?.is_some() {
        return Err("The demo campaign already exists. Open it or remove it first.".into());
    }
    let campaign = journal::create_campaign(c, &plain(&text.campaign, 200)?)?;
    c.execute(
        "INSERT INTO app_metadata(key,value) VALUES (?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        params![DEMO_KEY, campaign.id],
    )
    .map_err(storage)?;
    match populate(c, &campaign.id, text) {
        Ok(()) => Ok(Campaign {
            demo: true,
            ..campaign
        }),
        Err(error) => {
            remove(c, root, &campaign.id)?;
            Err(error)
        }
    }
}

fn populate(c: &Connection, campaign: &str, t: &DemoText) -> AppResult<()> {
    let page = |name: &str, kind: &str, body: &str| -> AppResult<String> {
        let created = knowledge::create_page(c, campaign, &plain(name, 200)?, kind, "active", &[])?;
        knowledge::save_page_document(c, campaign, &created.id, created.revision, note(body)?)?;
        Ok(created.id)
    };
    let town = page(&t.town, "place", &t.town_text)?;
    let innkeeper = page(&t.innkeeper, "npc", &t.innkeeper_text)?;
    let baron = page(&t.baron, "npc", &t.baron_text)?;
    let tower = page(&t.tower, "place", &t.tower_text)?;
    let (town_l, inn_l, baron_l, tower_l) = (
        plain(&t.town, 200)?,
        plain(&t.innkeeper, 200)?,
        plain(&t.baron, 200)?,
        plain(&t.tower, 200)?,
    );

    let first = journal::create_session(c, campaign, 1, &plain(&t.session1, 200)?, None)?;
    let doc = json!({"version":1,"blocks":[
        paragraph("arrival", &t.session1_arrival, &[(&town, &town_l), (&innkeeper, &inn_l)])?,
        paragraph("claim", &t.session1_claim, &[(&innkeeper, &inn_l), (&baron, &baron_l)])?,
    ]});
    journal::save_document(c, campaign, &first.id, first.revision, doc)?;
    let second = journal::create_session(c, campaign, 2, &plain(&t.session2, 200)?, None)?;
    let doc = json!({"version":1,"blocks":[
        paragraph("path", &t.session2_path, &[(&tower, &tower_l)])?,
        paragraph("seal", &t.session2_seal, &[(&baron, &baron_l)])?,
    ]});
    journal::save_document(c, campaign, &second.id, second.revision, doc)?;

    let relate = |from: &str,
                  to: &str,
                  label: &str,
                  certainty: &str,
                  source: Option<(&str, &str)>,
                  evidence: &str|
     -> AppResult<()> {
        graph::save_relationship(
            c,
            campaign,
            None,
            None,
            graph::RelationshipInput {
                from_page_id: from.into(),
                to_page_id: to.into(),
                label: plain(label, 80)?,
                certainty: certainty.into(),
                source_kind: source.map(|_| "session".into()),
                source_id: source.map(|(session, _)| session.into()),
                source_block_id: source.map(|(_, block)| block.into()),
                evidence: if evidence.is_empty() {
                    String::new()
                } else {
                    plain(evidence, 600)?
                },
                notes: String::new(),
            },
        )?;
        Ok(())
    };
    relate(
        &innkeeper,
        &town,
        &t.lives_in,
        "confirmed",
        Some((&first.id, "arrival")),
        "",
    )?;
    relate(
        &baron,
        &town,
        &t.rules,
        "confirmed",
        None,
        &t.rules_evidence,
    )?;
    relate(
        &baron,
        &tower,
        &t.linked_to,
        "suspected",
        Some((&second.id, "seal")),
        &t.linked_evidence,
    )?;

    let clue =
        |kind: &str, title: &str, details: &str, session: &str, block: &str, pages: Vec<String>| {
            clues::save(
                c,
                campaign,
                None,
                None,
                clues::Input {
                    kind: kind.into(),
                    title: plain(title, 200)?,
                    details: plain(details, 600)?,
                    certainty: "unknown".into(),
                    status: "open".into(),
                    sources: vec![clues::Source {
                        kind: "session".into(),
                        id: session.into(),
                        block_id: Some(block.into()),
                    }],
                    page_ids: pages,
                    resolution_session_id: None,
                },
            )
            .map(|_| ())
        };
    clue(
        "rumour",
        &t.rumour,
        &t.rumour_details,
        &first.id,
        "claim",
        vec![innkeeper.clone(), baron.clone()],
    )?;
    clue(
        "question",
        &t.question,
        &t.question_details,
        &second.id,
        "path",
        vec![tower.clone()],
    )?;

    let input: player::CharacterInput = serde_json::from_value(json!({
        "name": plain(&t.character, 200)?,
        "systemId": "generic",
        "ancestry": plain(&t.ancestry, 200)?,
        "vocation": plain(&t.vocation, 200)?,
        "level": 3, "experience": null,
        "hpCurrent": 21, "hpMaximum": 24, "hpTemporary": 0,
        "stats": [], "resources": [], "conditions": "",
        "notes": plain(&t.character_notes, 600)?,
    }))
    .map_err(|_| "Demo text is missing or too long. Nothing was created.")?;
    player::save_character(c, campaign, None, None, input)?;
    Ok(())
}

/// Tables that hold rows of one campaign, children before parents.
const CAMPAIGN_TABLES: [&str; 26] = [
    "map_routes",
    "map_pins",
    "timeline_entries",
    "world_calendars",
    "sync_conflicts",
    "sync_outbox",
    "sync_remote_items",
    "sync_shares",
    "sync_links",
    "clue_sources",
    "clue_pages",
    "clues",
    "mentions",
    "relationships",
    "party_members",
    "image_attachments",
    "player_assets",
    "characters",
    "import_sources",
    "search_documents",
    "dice_rolls",
    "assistant_turns",
    "campaign_ai_settings",
    "campaign_ai_training",
    "sessions",
    "pages",
];

/// Deletes the demo campaign completely: every row, its managed images folder and the
/// marker. Refuses any other campaign. Image files go after the rows commit; a failure there
/// is reported but the campaign is already gone from the archive.
pub fn remove(c: &Connection, root: &Path, campaign: &str) -> AppResult<()> {
    identifier(campaign)?;
    if metadata(c, DEMO_KEY)?.as_deref() != Some(campaign) {
        return Err("Only the demo campaign can be removed this way.".into());
    }
    let tx = c.unchecked_transaction().map_err(storage)?;
    tx.execute(
        "DELETE FROM page_aliases WHERE page_id IN (SELECT id FROM pages WHERE campaign_id=?1)",
        [campaign],
    )
    .map_err(storage)?;
    for table in CAMPAIGN_TABLES {
        let exists: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                [table],
                |r| r.get(0),
            )
            .map_err(storage)?;
        if exists {
            tx.execute(
                &format!("DELETE FROM {table} WHERE campaign_id=?1"),
                [campaign],
            )
            .map_err(storage)?;
        }
    }
    tx.execute("DELETE FROM campaigns WHERE id=?1", [campaign])
        .map_err(storage)?;
    tx.execute("DELETE FROM app_metadata WHERE key=?1", [DEMO_KEY])
        .map_err(storage)?;
    tx.commit().map_err(storage)?;
    let folder = root.join("attachments").join(campaign);
    match fs::symlink_metadata(&folder) {
        Ok(meta) if meta.is_dir() && !meta.file_type().is_symlink() => fs::remove_dir_all(&folder)
            .map_err(|_| {
                "The demo campaign was removed, but its images folder could not be deleted. Check permissions."
                    .to_string()
            }),
        _ => Ok(()),
    }
}

#[cfg(test)]
pub(crate) fn sample() -> DemoText {
    let s = |v: &str| v.to_string();
    DemoText {
        campaign: s("Demo — The Salt Tower"),
        town: s("Harrowgate"),
        town_text: s("A fishing town on the river Vey."),
        innkeeper: s("Mira"),
        innkeeper_text: s("Innkeeper of the Drowned Lantern."),
        baron: s("Baron Aldric"),
        baron_text: s("Lord of Harrowgate."),
        tower: s("The Salt Tower"),
        tower_text: s("A ruined watchtower on the cliffs."),
        session1: s("Arrival in Harrowgate"),
        session1_arrival: s("We reached {0} at dusk and took rooms at the inn run by {1}."),
        session1_claim: s("{0} told us that {1} poisoned the town well."),
        session2: s("The road to the Salt Tower"),
        session2_path: s("We followed the cliff path north to {0}."),
        session2_seal: s("A broken seal on the door bore the crest of {0}."),
        lives_in: s("lives in"),
        rules: s("rules"),
        rules_evidence: s("Common knowledge in town."),
        linked_to: s("linked to"),
        linked_evidence: s("His crest on a broken seal."),
        rumour: s("Mira claims the Baron poisoned the well"),
        rumour_details: s("Only her word so far."),
        question: s("Who was inside the Salt Tower?"),
        question_details: s("Fresh boot prints led inside."),
        character: s("Ilsa Marrow"),
        ancestry: s("Human"),
        vocation: s("Ranger"),
        character_notes: s("Demo character. Edit anything."),
    }
}
