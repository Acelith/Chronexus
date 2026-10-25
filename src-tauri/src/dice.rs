use crate::journal::{self, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

pub const SIDES: [i64; 7] = [4, 6, 8, 10, 12, 20, 100];
pub const MAX_PER_TYPE: i64 = 50;
pub const MAX_DICE: i64 = 100;
const PAGE_SIZE: usize = 30;
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Selection {
    pub sides: i64,
    pub quantity: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Group {
    pub sides: i64,
    pub quantity: i64,
    pub values: Vec<i64>,
    pub subtotal: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Roll {
    pub id: String,
    pub campaign_id: String,
    pub created_at: String,
    pub groups: Vec<Group>,
    pub total: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Cursor {
    pub created_at: String,
    pub id: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct History {
    pub rolls: Vec<Roll>,
    pub next_cursor: Option<Cursor>,
}
fn invalid() -> String {
    "Invalid or inconsistent dice history. No data replaced.".into()
}
fn composition(input: &[Selection]) -> AppResult<Vec<Selection>> {
    if input.len() > SIDES.len() {
        return Err("Choose each die type only once.".into());
    }
    let mut selections = input.to_vec();
    selections.sort_by_key(|g| g.sides);
    if selections.windows(2).any(|w| w[0].sides == w[1].sides) {
        return Err("Choose each die type only once.".into());
    }
    if selections
        .iter()
        .any(|g| !SIDES.contains(&g.sides) || !(0..=MAX_PER_TYPE).contains(&g.quantity))
    {
        return Err(
            "Use d4, d6, d8, d10, d12, d20 or d100 and whole quantities from 0 to 50.".into(),
        );
    }
    selections.retain(|g| g.quantity > 0);
    let count: i64 = selections.iter().map(|g| g.quantity).sum();
    if !(1..=MAX_DICE).contains(&count) {
        return Err("Select from 1 to 100 dice in total (up to 50 per type).".into());
    }
    Ok(selections)
}
fn validate(roll: &Roll) -> AppResult<()> {
    journal::identifier(&roll.id)?;
    journal::identifier(&roll.campaign_id)?;
    chrono::DateTime::parse_from_rfc3339(&roll.created_at).map_err(|_| invalid())?;
    let selections: Vec<_> = roll
        .groups
        .iter()
        .map(|g| Selection {
            sides: g.sides,
            quantity: g.quantity,
        })
        .collect();
    if composition(&selections)? != selections {
        return Err(invalid());
    }
    for g in &roll.groups {
        if g.values.len() != g.quantity as usize
            || g.values.iter().any(|v| !(1..=g.sides).contains(v))
            || g.values.iter().sum::<i64>() != g.subtotal
        {
            return Err(invalid());
        }
    }
    if roll.total != roll.groups.iter().map(|g| g.subtotal).sum::<i64>() {
        return Err(invalid());
    }
    Ok(())
}
fn decode(id: String, campaign: String, date: String, payload: String) -> AppResult<Roll> {
    let roll: Roll = serde_json::from_str(&payload).map_err(|_| invalid())?;
    if roll.id != id || roll.campaign_id != campaign || roll.created_at != date {
        return Err(invalid());
    }
    validate(&roll)?;
    Ok(roll)
}
fn find(c: &Connection, id: &str) -> AppResult<Option<Roll>> {
    let row = c
        .query_row(
            "SELECT id,campaign_id,created_at,payload FROM dice_rolls WHERE id=?1",
            [id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            },
        )
        .optional()
        .map_err(journal::storage)?;
    row.map(|(id, campaign, date, payload)| decode(id, campaign, date, payload))
        .transpose()
}
/// Rejection sampling avoids modulo bias; words come from the operating system CSPRNG.
fn sample(sides: i64, next: &mut impl FnMut() -> AppResult<u32>) -> AppResult<i64> {
    let sides = sides as u32;
    let limit = u32::MAX - u32::MAX % sides;
    loop {
        let word = next()?;
        if word < limit {
            return Ok(i64::from(word % sides) + 1);
        }
    }
}
pub fn roll(c: &Connection, campaign: &str, id: &str, input: &[Selection]) -> AppResult<Roll> {
    roll_with(c, campaign, id, input, &mut || {
        let mut bytes = [0; 4];
        getrandom::fill(&mut bytes).map_err(|_| {
            "The system did not provide secure randomness. No roll recorded.".to_string()
        })?;
        Ok(u32::from_le_bytes(bytes))
    })
}
fn roll_with(
    c: &Connection,
    campaign: &str,
    id: &str,
    input: &[Selection],
    next: &mut impl FnMut() -> AppResult<u32>,
) -> AppResult<Roll> {
    journal::identifier(id)?;
    journal::require_campaign(c, campaign)?;
    let selections = composition(input)?;
    let transaction = c.unchecked_transaction().map_err(journal::storage)?;
    if let Some(existing) = find(&transaction, id)? {
        let previous: Vec<_> = existing
            .groups
            .iter()
            .map(|g| Selection {
                sides: g.sides,
                quantity: g.quantity,
            })
            .collect();
        if existing.campaign_id != campaign || previous != selections {
            return Err(
                "This identifier belongs to a different roll. Reopen the dice roller and try again."
                    .into(),
            );
        }
        return Ok(existing);
    }
    let mut groups = Vec::with_capacity(selections.len());
    for g in selections {
        let values = (0..g.quantity)
            .map(|_| sample(g.sides, next))
            .collect::<AppResult<Vec<_>>>()?;
        let subtotal = values.iter().sum();
        groups.push(Group {
            sides: g.sides,
            quantity: g.quantity,
            values,
            subtotal,
        });
    }
    let date: String = transaction
        .query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')", [], |r| {
            r.get(0)
        })
        .map_err(journal::storage)?;
    let result = Roll {
        id: id.into(),
        campaign_id: campaign.into(),
        created_at: date,
        total: groups.iter().map(|g| g.subtotal).sum(),
        groups,
    };
    let payload = serde_json::to_string(&result).map_err(|_| invalid())?;
    transaction
        .execute(
            "INSERT INTO dice_rolls(id,campaign_id,created_at,payload) VALUES(?1,?2,?3,?4)",
            params![result.id, campaign, result.created_at, payload],
        )
        .map_err(journal::storage)?;
    transaction.commit().map_err(journal::storage)?;
    Ok(result)
}
pub fn history(c: &Connection, campaign: &str, before: Option<&Cursor>) -> AppResult<History> {
    journal::require_campaign(c, campaign)?;
    if let Some(cursor) = before {
        journal::identifier(&cursor.id)?;
        chrono::DateTime::parse_from_rfc3339(&cursor.created_at).map_err(|_| invalid())?;
    }
    let mut stmt=c.prepare("SELECT id,campaign_id,created_at,payload FROM dice_rolls WHERE campaign_id=?1 AND (?2 IS NULL OR (created_at,id)<(?2,?3)) ORDER BY created_at DESC,id DESC LIMIT 31").map_err(journal::storage)?;
    let mut rows = stmt
        .query(params![
            campaign,
            before.map(|b| b.created_at.as_str()),
            before.map(|b| b.id.as_str())
        ])
        .map_err(journal::storage)?;
    let mut rolls = Vec::new();
    while let Some(row) = rows.next().map_err(journal::storage)? {
        rolls.push(decode(
            row.get(0).map_err(journal::storage)?,
            row.get(1).map_err(journal::storage)?,
            row.get(2).map_err(journal::storage)?,
            row.get(3).map_err(journal::storage)?,
        )?);
    }
    let more = rolls.len() > PAGE_SIZE;
    rolls.truncate(PAGE_SIZE);
    let next_cursor = if more {
        rolls.last().map(|r| Cursor {
            created_at: r.created_at.clone(),
            id: r.id.clone(),
        })
    } else {
        None
    };
    Ok(History { rolls, next_cursor })
}
pub fn all(c: &Connection, campaign: &str) -> AppResult<Vec<Roll>> {
    let mut rolls = Vec::new();
    let mut before = None;
    loop {
        let page = history(c, campaign, before.as_ref())?;
        rolls.extend(page.rolls);
        before = page.next_cursor;
        if before.is_none() {
            break;
        }
    }
    Ok(rolls)
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    let mut stmt = c
        .prepare("SELECT id,campaign_id,created_at,payload FROM dice_rolls")
        .map_err(journal::storage)?;
    let mut rows = stmt.query([]).map_err(journal::storage)?;
    while let Some(row) = rows.next().map_err(journal::storage)? {
        let roll = decode(
            row.get(0).map_err(journal::storage)?,
            row.get(1).map_err(journal::storage)?,
            row.get(2).map_err(journal::storage)?,
            row.get(3).map_err(journal::storage)?,
        )?;
        journal::require_campaign(c, &roll.campaign_id)?;
    }
    Ok(())
}
#[cfg(test)]
mod tests;
