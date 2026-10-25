use super::{tools, Policy};
use crate::{
    journal::{self, AppResult},
    knowledge, party, player,
};
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

fn value(data: impl Serialize) -> AppResult<Value> {
    serde_json::to_value(data).map_err(|_| "Answer not available.".into())
}
fn text<'a>(args: &'a Value, key: &str) -> AppResult<&'a str> {
    args.get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Invalid parameter {key}."))
}
fn number(args: &Value, key: &str) -> AppResult<i64> {
    args.get(key)
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("Invalid parameter {key}."))
}
fn optional_text<'a>(args: &'a Value, key: &str) -> AppResult<Option<&'a str>> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(v)) => Ok(Some(v)),
        _ => Err(format!("Invalid parameter {key}.")),
    }
}
fn optional_revision(args: &Value) -> AppResult<Option<i64>> {
    match args.get("revision") {
        None | Some(Value::Null) => Ok(None),
        _ => number(args, "revision").map(Some),
    }
}
fn validate_schema(schema: &Value, value: &Value) -> AppResult<()> {
    fn is_type(kind: &str, v: &Value) -> bool {
        match kind {
            "string" => v.is_string(),
            "object" => v.is_object(),
            "array" => v.is_array(),
            "integer" => v.as_i64().is_some(),
            "boolean" => v.is_boolean(),
            "null" => v.is_null(),
            _ => false,
        }
    }
    let typed = match &schema["type"] {
        Value::String(t) => is_type(t, value),
        Value::Array(types) => types
            .iter()
            .any(|t| t.as_str().is_some_and(|t| is_type(t, value))),
        _ => true,
    };
    if !typed
        || schema["enum"]
            .as_array()
            .is_some_and(|items| !items.contains(value))
    {
        return Err("Invalid type or value of a parameter.".into());
    }
    if let Some(object) = value.as_object() {
        if let Some(properties) = schema["properties"].as_object() {
            if schema["additionalProperties"] == false
                && object.keys().any(|key| !properties.contains_key(key))
            {
                return Err("Unknown parameter; operation refused.".into());
            }
            for (key, value) in object {
                if let Some(schema) = properties.get(key) {
                    validate_schema(schema, value)?;
                }
            }
        }
        if schema["required"].as_array().is_some_and(|keys| {
            keys.iter()
                .any(|key| key.as_str().is_none_or(|key| !object.contains_key(key)))
        }) {
            return Err("A required parameter is missing.".into());
        }
    }
    if let (Some(items), Some(item_schema)) = (value.as_array(), schema.get("items")) {
        for item in items {
            validate_schema(item_schema, item)?;
        }
    }
    Ok(())
}
fn validate_args(definition: &Value, args: &Value) -> AppResult<()> {
    validate_schema(&definition["inputSchema"], args)
}
fn page_value(page: knowledge::Page) -> AppResult<Value> {
    let record = value(page)?;
    let etag = format!("{:x}", Sha256::digest(record.to_string().as_bytes()));
    Ok(json!({"record":record,"etag":etag}))
}
fn merge(target: &mut Value, patch: &Value) {
    if let (Some(target), Some(patch)) = (target.as_object_mut(), patch.as_object()) {
        for (key, v) in patch {
            if let Some(previous) = target.get_mut(key) {
                merge(previous, v);
            } else {
                target.insert(key.clone(), v.clone());
            }
        }
    } else {
        *target = patch.clone();
    }
}
fn summaries(c: &Connection, campaign: &str, args: &Value, pages: bool) -> AppResult<Value> {
    let limit = args
        .get("limit")
        .map(|_| number(args, "limit"))
        .transpose()?
        .unwrap_or(50);
    let offset = args
        .get("offset")
        .map(|_| number(args, "offset"))
        .transpose()?
        .unwrap_or(0);
    if !(1..=100).contains(&limit) || !(0..=1_000_000).contains(&offset) {
        return Err("Invalid pagination.".into());
    }
    let sql = if pages {
        "SELECT id,title,kind,revision FROM pages WHERE campaign_id=?1 ORDER BY title,id LIMIT ?2 OFFSET ?3"
    } else {
        "SELECT id,title,CAST(sequence AS TEXT),revision FROM sessions WHERE campaign_id=?1 ORDER BY sequence,id LIMIT ?2 OFFSET ?3"
    };
    let mut q = c.prepare(sql).map_err(journal::storage)?;
    let rows=q.query_map(params![campaign,limit,offset],|r|Ok(json!({"id":r.get::<_,String>(0)?,"title":r.get::<_,String>(1)?,"category":r.get::<_,String>(2)?,"revision":r.get::<_,i64>(3)?}))).map_err(journal::storage)?.collect::<rusqlite::Result<Vec<_>>>().map_err(journal::storage)?;
    Ok(
        json!({"items":rows,"offset":offset,"nextOffset":if rows.len()==limit as usize {Some(offset+limit)}else{None}}),
    )
}

pub(super) fn call(
    c: &Connection,
    policy: &Policy,
    name: &str,
    args: &Value,
) -> AppResult<(Value, bool)> {
    let catalog = tools(&Policy {
        campaign: policy.campaign.clone(),
        write: true,
    })?;
    let definition = catalog["tools"]
        .as_array()
        .and_then(|items| items.iter().find(|t| t["name"] == name))
        .ok_or("Tool not available.")?;
    validate_args(definition, args)?;
    let writing = definition["annotations"]["readOnlyHint"] != true;
    if name == "chronexus_reference" {
        let mut reference: Value = serde_json::from_str(include_str!("reference.json"))
            .map_err(|_| "Reference not available.")?;
        reference["sheetFields"] = json!(player::SHEET_FIELDS);
        return Ok((reference, false));
    }
    if name == "chronexus_campaigns" {
        let campaigns = journal::list_campaigns(c)?
            .into_iter()
            .filter(|item| policy.campaign.as_ref().is_none_or(|id| id == &item.id))
            .collect::<Vec<_>>();
        return Ok((value(campaigns)?, false));
    }
    let campaign = text(args, "campaignId")?;
    policy.authorize(campaign, writing)?;
    journal::require_campaign(c, campaign)?;
    let result = match name {
        "chronexus_sessions" => summaries(c, campaign, args, false)?,
        "chronexus_pages" => summaries(c, campaign, args, true)?,
        "chronexus_session" => value(journal::get_session(c, campaign, text(args, "id")?)?)?,
        "chronexus_page" => page_value(knowledge::get_page(c, campaign, text(args, "id")?)?)?,
        "chronexus_create_session" => value(journal::create_session(
            c,
            campaign,
            number(args, "sequence")?,
            text(args, "title")?,
            optional_text(args, "playedOn")?.map(str::to_owned),
        )?)?,
        "chronexus_create_page" => page_value(knowledge::create_page(
            c,
            campaign,
            text(args, "title")?,
            text(args, "kind")?,
            optional_text(args, "status")?.unwrap_or("active"),
            &serde_json::from_value::<Vec<String>>(
                args.get("aliases").cloned().unwrap_or(json!([])),
            )
            .map_err(|_| "Invalid aliases.")?,
        )?)?,
        "chronexus_update_page" => {
            let old = knowledge::get_page(c, campaign, text(args, "id")?)?;
            if page_value(knowledge::get_page(c, campaign, &old.id)?)?["etag"]
                != text(args, "etag")?
            {
                return Err(
                    "Page changed elsewhere: reload it before updating the metadata.".into(),
                );
            }
            let patch = args["patch"].as_object().ok_or("Invalid patch.")?;
            if patch.is_empty()
                || patch
                    .keys()
                    .any(|k| !["title", "kind", "status", "aliases"].contains(&k.as_str()))
            {
                return Err("Invalid metadata patch.".into());
            }
            let aliases = if let Some(v) = patch.get("aliases") {
                serde_json::from_value(v.clone()).map_err(|_| "Invalid aliases.")?
            } else {
                old.aliases
            };
            page_value(knowledge::update_page(
                c,
                campaign,
                &old.id,
                optional_text(&args["patch"], "title")?.unwrap_or(&old.title),
                optional_text(&args["patch"], "kind")?.unwrap_or(&old.kind),
                optional_text(&args["patch"], "status")?.unwrap_or(&old.status),
                &aliases,
            )?)?
        }
        "chronexus_append_note" | "chronexus_save_document" => {
            let id = text(args, "id")?;
            let revision = number(args, "revision")?;
            let target = text(args, "target")?;
            let mut document = match target {
                "session" => journal::get_session(c, campaign, id)?.document,
                "page" => knowledge::get_page(c, campaign, id)?.document,
                _ => return Err("Invalid notes destination.".into()),
            };
            if name == "chronexus_append_note" {
                let note = text(args, "text")?;
                if note.trim().is_empty() || note.len() > 200_000 || note.contains('\0') {
                    return Err("Empty or too large note (up to 200 KB).".into());
                }
                document["blocks"].as_array_mut().ok_or("Invalid document.")?.push(json!({"id":uuid::Uuid::new_v4().to_string(),"type":"paragraph","props":{},"content":[{"type":"text","text":note,"styles":{}}],"children":[]}));
            } else {
                document = args["document"].clone();
            }
            if target == "session" {
                value(journal::save_document(c, campaign, id, revision, document)?)?
            } else {
                page_value(knowledge::save_page_document(
                    c, campaign, id, revision, document,
                )?)?
            }
        }
        "chronexus_character" => value(player::get_character(c, campaign)?)?,
        "chronexus_create_character" => {
            if player::get_character(c, campaign)?.is_some() {
                return Err(
                    "Sheet already exists: use update_character with the current revision.".into(),
                );
            }
            let input=serde_json::from_value(json!({"name":text(args,"name")?,"systemId":optional_text(args,"systemId")?.unwrap_or("generic"),"ancestry":"","vocation":"","level":null,"experience":null,"hpCurrent":0,"hpMaximum":0,"hpTemporary":0,"stats":[],"resources":[],"conditions":"","notes":""})).map_err(|_|"Invalid sheet.")?;
            value(player::save_character(c, campaign, None, None, input)?)?
        }
        "chronexus_update_character" => {
            let old = player::get_character(c, campaign)?.ok_or("Sheet not found.")?;
            if old.id != text(args, "id")? {
                return Err("Sheet does not belong to this campaign.".into());
            }
            let patch = args["patch"]
                .as_object()
                .filter(|p| !p.is_empty())
                .ok_or("Empty or invalid patch.")?;
            let mut input = value(old.data)?;
            if patch.keys().any(|key| input.get(key).is_none()) {
                return Err("Unknown sheet field.".into());
            }
            merge(&mut input, &args["patch"]);
            value(player::save_character(
                c,
                campaign,
                Some(&old.id),
                Some(number(args, "revision")?),
                serde_json::from_value(input).map_err(|_| "Invalid sheet values.")?,
            )?)?
        }
        "chronexus_party" => value(party::list(c, campaign)?)?,
        "chronexus_save_party_member" => value(party::save(
            c,
            campaign,
            &serde_json::from_value(args["input"].clone()).map_err(|_| "Invalid member.")?,
        )?)?,
        "chronexus_assets" => value(player::list_assets(
            c,
            campaign,
            text(args, "characterId")?,
        )?)?,
        "chronexus_save_asset" => {
            let id = optional_text(args, "id")?;
            let revision = optional_revision(args)?;
            if id.is_some() != revision.is_some() {
                return Err("Updating needs both ID and revision.".into());
            }
            value(player::save_asset(
                c,
                campaign,
                text(args, "characterId")?,
                id,
                revision,
                serde_json::from_value(args["input"].clone())
                    .map_err(|_| "Invalid item or spell.")?,
            )?)?
        }
        _ => return Err("Tool not available.".into()),
    };
    Ok((result, writing))
}
