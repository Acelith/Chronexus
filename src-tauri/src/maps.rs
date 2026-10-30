use crate::journal::{identifier, require_campaign, storage, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapImage {
    pub id: String,
    pub caption: String,
    pub width: i64,
    pub height: i64,
    pub page_id: Option<String>,
}
pub fn images(c: &Connection, campaign: &str) -> AppResult<Vec<MapImage>> {
    require_campaign(c, campaign)?;
    let mut q=c.prepare("SELECT id,caption,width,height,page_id FROM image_attachments WHERE campaign_id=?1 AND role='map' ORDER BY created_at,id").map_err(storage)?;
    let rows = q
        .query_map([campaign], |r| {
            Ok(MapImage {
                id: r.get(0)?,
                caption: r.get(1)?,
                width: r.get(2)?,
                height: r.get(3)?,
                page_id: r.get(4)?,
            })
        })
        .map_err(storage)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage);
    rows
}
fn map(c: &Connection, campaign: &str, image: &str) -> AppResult<(i64, i64)> {
    identifier(image)?;
    c.query_row(
        "SELECT width,height FROM image_attachments WHERE campaign_id=?1 AND id=?2 AND role='map'",
        params![campaign, image],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .optional()
    .map_err(storage)?
    .ok_or("Map image not found in this campaign.".into())
}
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PinInput {
    pub source_kind: String,
    pub source_id: String,
    pub label: String,
    pub x: i64,
    pub y: i64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Pin {
    pub id: String,
    pub campaign_id: String,
    pub image_id: String,
    pub input: PinInput,
    pub revision: i64,
}
fn pin_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Pin> {
    let page: Option<String> = r.get(3)?;
    let session: Option<String> = r.get(4)?;
    let clue: Option<String> = r.get(5)?;
    let (source_kind, source_id) = if let Some(id) = page {
        ("page".to_string(), id)
    } else if let Some(id) = session {
        ("session".to_string(), id)
    } else {
        ("clue".to_string(), clue.unwrap_or_default())
    };
    Ok(Pin {
        id: r.get(0)?,
        campaign_id: r.get(1)?,
        image_id: r.get(2)?,
        input: PinInput {
            source_kind,
            source_id,
            label: r.get(6)?,
            x: r.get(7)?,
            y: r.get(8)?,
        },
        revision: r.get(9)?,
    })
}
pub fn pins(c: &Connection, campaign: &str, image: &str) -> AppResult<Vec<Pin>> {
    require_campaign(c, campaign)?;
    map(c, campaign, image)?;
    let mut q=c.prepare("SELECT id,campaign_id,image_id,page_id,session_id,clue_id,label,x,y,revision FROM map_pins WHERE campaign_id=?1 AND image_id=?2 ORDER BY label,id").map_err(storage)?;
    let rows = q
        .query_map(params![campaign, image], pin_row)
        .map_err(storage)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage);
    rows
}
fn source(kind: &str) -> AppResult<(&'static str, &'static str)> {
    match kind {
        "page" => Ok(("page_id", "pages")),
        "session" => Ok(("session_id", "sessions")),
        "clue" => Ok(("clue_id", "clues")),
        _ => Err("Invalid map pin target.".into()),
    }
}
pub fn save_pin(
    c: &Connection,
    campaign: &str,
    image: &str,
    id: Option<String>,
    revision: Option<i64>,
    input: PinInput,
) -> AppResult<Pin> {
    require_campaign(c, campaign)?;
    map(c, campaign, image)?;
    identifier(&input.source_id)?;
    let (field, table) = source(&input.source_kind)?;
    if input.label.trim().is_empty()
        || input.label.chars().count() > 200
        || input.label.contains('\0')
        || !(0..=1000000).contains(&input.x)
        || !(0..=1000000).contains(&input.y)
    {
        return Err("Invalid map pin.".into());
    }
    let found: bool = c
        .query_row(
            &format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE campaign_id=?1 AND id=?2)"),
            params![campaign, input.source_id],
            |r| r.get(0),
        )
        .map_err(storage)?;
    if !found {
        return Err("Pin target not found in this campaign.".into());
    }
    let id = if let Some(id) = id {
        identifier(&id)?;
        id
    } else {
        uuid::Uuid::new_v4().to_string()
    };
    let page = if field == "page_id" {
        Some(input.source_id.as_str())
    } else {
        None
    };
    let session = if field == "session_id" {
        Some(input.source_id.as_str())
    } else {
        None
    };
    let clue = if field == "clue_id" {
        Some(input.source_id.as_str())
    } else {
        None
    };
    let changed = if let Some(revision) = revision {
        c.execute("UPDATE map_pins SET page_id=?1,session_id=?2,clue_id=?3,label=?4,x=?5,y=?6,revision=revision+1 WHERE campaign_id=?7 AND image_id=?8 AND id=?9 AND revision=?10",params![page,session,clue,input.label,input.x,input.y,campaign,image,id,revision]).map_err(storage)?
    } else {
        c.execute("INSERT INTO map_pins(id,campaign_id,image_id,page_id,session_id,clue_id,label,x,y) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9)",params![id,campaign,image,page,session,clue,input.label,input.x,input.y]).map_err(storage)?
    };
    if changed != 1 {
        return Err("Pin changed elsewhere. Reload before saving.".into());
    }
    pins(c, campaign, image)?
        .into_iter()
        .find(|pin| pin.id == id)
        .ok_or("Pin missing after save.".into())
}
pub fn delete_pin(
    c: &Connection,
    campaign: &str,
    image: &str,
    id: &str,
    revision: i64,
) -> AppResult<()> {
    require_campaign(c, campaign)?;
    identifier(id)?;
    let count = c
        .execute(
            "DELETE FROM map_pins WHERE campaign_id=?1 AND image_id=?2 AND id=?3 AND revision=?4",
            params![campaign, image, id, revision],
        )
        .map_err(storage)?;
    if count != 1 {
        return Err("Pin changed elsewhere. Reload before deleting.".into());
    }
    Ok(())
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    pub id: String,
    pub campaign_id: String,
    pub image_id: String,
    pub from_pin_id: String,
    pub to_pin_id: String,
    pub label: String,
    pub revision: i64,
}
pub fn routes(c: &Connection, campaign: &str, image: &str) -> AppResult<Vec<Route>> {
    require_campaign(c, campaign)?;
    map(c, campaign, image)?;
    let mut q=c.prepare("SELECT id,campaign_id,image_id,from_pin_id,to_pin_id,label,revision FROM map_routes WHERE campaign_id=?1 AND image_id=?2 ORDER BY id").map_err(storage)?;
    let rows = q
        .query_map(params![campaign, image], |r| {
            Ok(Route {
                id: r.get(0)?,
                campaign_id: r.get(1)?,
                image_id: r.get(2)?,
                from_pin_id: r.get(3)?,
                to_pin_id: r.get(4)?,
                label: r.get(5)?,
                revision: r.get(6)?,
            })
        })
        .map_err(storage)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage);
    rows
}
pub fn add_route(
    c: &Connection,
    campaign: &str,
    image: &str,
    from: &str,
    to: &str,
    label: &str,
) -> AppResult<Route> {
    require_campaign(c, campaign)?;
    map(c, campaign, image)?;
    identifier(from)?;
    identifier(to)?;
    if from == to || label.chars().count() > 200 || label.contains('\0') {
        return Err("Invalid map route.".into());
    }
    let id = uuid::Uuid::new_v4().to_string();
    c.execute("INSERT INTO map_routes(id,campaign_id,image_id,from_pin_id,to_pin_id,label) VALUES(?1,?2,?3,?4,?5,?6)",params![id,campaign,image,from,to,label]).map_err(storage)?;
    routes(c, campaign, image)?
        .into_iter()
        .find(|route| route.id == id)
        .ok_or("Route missing after save.".into())
}
pub fn delete_route(
    c: &Connection,
    campaign: &str,
    image: &str,
    id: &str,
    revision: i64,
) -> AppResult<()> {
    require_campaign(c, campaign)?;
    identifier(id)?;
    let count = c
        .execute(
            "DELETE FROM map_routes WHERE campaign_id=?1 AND image_id=?2 AND id=?3 AND revision=?4",
            params![campaign, image, id, revision],
        )
        .map_err(storage)?;
    if count != 1 {
        return Err("Route changed elsewhere. Reload before deleting.".into());
    }
    Ok(())
}
pub fn relink(c: &Connection, campaign: &str, old: &str, new: &str) -> AppResult<()> {
    require_campaign(c, campaign)?;
    let old_size = map(c, campaign, old)?;
    let new_size = map(c, campaign, new)?;
    if old == new || old_size != new_size {
        return Err("Choose a different map image with the same dimensions.".into());
    }
    let tx = c.unchecked_transaction().map_err(storage)?;
    tx.execute(
        "UPDATE map_pins SET image_id=?1 WHERE campaign_id=?2 AND image_id=?3",
        params![new, campaign, old],
    )
    .map_err(storage)?;
    tx.execute(
        "UPDATE map_routes SET image_id=?1 WHERE campaign_id=?2 AND image_id=?3",
        params![new, campaign, old],
    )
    .map_err(storage)?;
    tx.commit().map_err(storage)
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    // The legacy image FK alone does not prove campaign ownership or map role.
    let invalid: bool = c.query_row(
        "SELECT EXISTS(SELECT 1 FROM map_pins p JOIN image_attachments i ON i.id=p.image_id WHERE p.campaign_id!=i.campaign_id OR i.role!='map') OR EXISTS(SELECT 1 FROM map_routes r JOIN map_pins p ON p.id=r.from_pin_id JOIN map_pins q ON q.id=r.to_pin_id WHERE r.campaign_id!=p.campaign_id OR r.campaign_id!=q.campaign_id)", [], |r| r.get(0)
    ).map_err(storage)?;
    if invalid {
        return Err("Invalid map pin.".into());
    }

    for campaign in crate::journal::list_campaigns(c)? {
        for image in images(c, &campaign.id)? {
            for pin in pins(c, &campaign.id, &image.id)? {
                identifier(&pin.id)?;
                source(&pin.input.source_kind)?;
            }
            for route in routes(c, &campaign.id, &image.id)? {
                identifier(&route.id)?;
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pins_routes_and_same_size_relink_survive_archive() {
        let directory = tempfile::tempdir().unwrap();
        let c = crate::db::open(&directory.path().join("map.sqlite3")).unwrap();
        let campaign = crate::journal::create_campaign(&c, "Map test").unwrap();
        let page = crate::knowledge::create_page(&c, &campaign.id, "Port", "place", "active", &[])
            .unwrap();
        let mut bytes = std::io::Cursor::new(Vec::new());
        image::DynamicImage::ImageRgb8(image::RgbImage::from_pixel(2, 2, image::Rgb([1, 2, 3])))
            .write_to(&mut bytes, image::ImageFormat::Png)
            .unwrap();
        let target = crate::images::ImageTarget {
            kind: "page".into(),
            id: page.id.clone(),
        };
        let first = crate::images::add(
            &c,
            directory.path(),
            &campaign.id,
            &target,
            "Map one",
            "map",
            bytes.get_ref().clone(),
        )
        .unwrap();
        let second = crate::images::add(
            &c,
            directory.path(),
            &campaign.id,
            &target,
            "Map two",
            "map",
            bytes.into_inner(),
        )
        .unwrap();
        assert!(save_pin(
            &c,
            &campaign.id,
            &first.id,
            None,
            None,
            PinInput {
                source_kind: "page".into(),
                source_id: page.id.clone(),
                label: "Out".into(),
                x: 1000001,
                y: 0
            }
        )
        .is_err());
        let a = save_pin(
            &c,
            &campaign.id,
            &first.id,
            None,
            None,
            PinInput {
                source_kind: "page".into(),
                source_id: page.id.clone(),
                label: "A".into(),
                x: 100000,
                y: 200000,
            },
        )
        .unwrap();
        let b = save_pin(
            &c,
            &campaign.id,
            &first.id,
            None,
            None,
            PinInput {
                source_kind: "page".into(),
                source_id: page.id,
                label: "B".into(),
                x: 800000,
                y: 900000,
            },
        )
        .unwrap();
        add_route(&c, &campaign.id, &first.id, &a.id, &b.id, "Path").unwrap();
        relink(&c, &campaign.id, &first.id, &second.id).unwrap();
        assert_eq!(pins(&c, &campaign.id, &second.id).unwrap().len(), 2);
        assert_eq!(routes(&c, &campaign.id, &second.id).unwrap().len(), 1);
        validate_archive(&c).unwrap();
        c.execute(
            "UPDATE image_attachments SET role='reference' WHERE id=?1",
            [&second.id],
        )
        .unwrap();
        assert!(
            validate_archive(&c).is_err(),
            "pins must belong to map images"
        );
        c.execute(
            "UPDATE image_attachments SET role='map' WHERE id=?1",
            [&second.id],
        )
        .unwrap();
        assert!(crate::images::detach(&c, &campaign.id, &second.id).is_err());
        crate::images::detach(&c, &campaign.id, &first.id).unwrap();
    }
}
