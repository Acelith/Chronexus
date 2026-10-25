use crate::journal::{identifier, require_campaign, storage, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashSet};

const CERTAINTIES: [&str; 4] = ["confirmed", "suspected", "disproven", "unknown"];
const NODE_LIMIT: usize = 150;
const EDGE_LIMIT: usize = 400;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RelationshipInput {
    pub from_page_id: String,
    pub to_page_id: String,
    pub label: String,
    pub certainty: String,
    pub source_kind: Option<String>,
    pub source_id: Option<String>,
    pub source_block_id: Option<String>,
    pub evidence: String,
    pub notes: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Relationship {
    pub id: String,
    pub campaign_id: String,
    #[serde(flatten)]
    pub input: RelationshipInput,
    pub revision: i64,
    pub source_available: bool,
}
pub(crate) fn block_exists(document: &Value, id: &str) -> bool {
    document
        .get("blocks")
        .and_then(Value::as_array)
        .is_some_and(|blocks| {
            fn visit(blocks: &[Value], id: &str) -> bool {
                blocks.iter().any(|block| {
                    block["id"].as_str() == Some(id)
                        || block["children"]
                            .as_array()
                            .is_some_and(|children| visit(children, id))
                })
            }
            visit(blocks, id)
        })
}
fn source_document(
    connection: &Connection,
    campaign_id: &str,
    kind: &str,
    id: &str,
) -> AppResult<Value> {
    identifier(id)?;
    let sql = match kind {
        "session" => "SELECT document FROM sessions WHERE campaign_id=?1 AND id=?2",
        "page" => "SELECT document FROM pages WHERE campaign_id=?1 AND id=?2",
        _ => return Err("Invalid source type.".into()),
    };
    let raw: Option<String> = connection
        .query_row(sql, params![campaign_id, id], |r| r.get(0))
        .optional()
        .map_err(storage)?;
    serde_json::from_str(&raw.ok_or("Source not found in this campaign.")?)
        .map_err(|_| "Source document unreadable.".into())
}
fn validate(
    connection: &Connection,
    campaign_id: &str,
    input: &RelationshipInput,
) -> AppResult<()> {
    require_campaign(connection, campaign_id)?;
    crate::knowledge::get_page(connection, campaign_id, &input.from_page_id)?;
    crate::knowledge::get_page(connection, campaign_id, &input.to_page_id)?;
    if input.label.trim().is_empty()
        || input.label.chars().count() > 100
        || input.label.contains('\0')
    {
        return Err("Describe the relationship with a label of 1 to 100 characters.".into());
    }
    if !CERTAINTIES.contains(&input.certainty.as_str()) {
        return Err("Choose a valid certainty for the relationship.".into());
    }
    if input.evidence.chars().count() > 4000 || input.notes.chars().count() > 4000 {
        return Err("Evidence and notes can hold up to 4000 characters each.".into());
    }
    match (&input.source_kind, &input.source_id) {
        (Some(kind), Some(id)) => {
            let document = source_document(connection, campaign_id, kind, id)?;
            if let Some(block) = &input.source_block_id {
                if !block_exists(&document, block) {
                    return Err("Source block not found. Select a current block or remove the block reference.".into());
                }
            }
        }
        (None, None) if input.source_block_id.is_none() => {}
        _ => return Err("Select a complete source or remove the reference.".into()),
    }
    Ok(())
}
fn row_relationship(row: &rusqlite::Row<'_>) -> rusqlite::Result<Relationship> {
    let session: Option<String> = row.get(6)?;
    let page: Option<String> = row.get(7)?;
    Ok(Relationship {
        id: row.get(0)?,
        campaign_id: row.get(1)?,
        input: RelationshipInput {
            from_page_id: row.get(2)?,
            to_page_id: row.get(3)?,
            label: row.get(4)?,
            certainty: row.get(5)?,
            source_kind: if session.is_some() {
                Some("session".into())
            } else {
                page.as_ref().map(|_| "page".into())
            },
            source_id: session.or(page),
            source_block_id: row.get(8)?,
            evidence: row.get(9)?,
            notes: row.get(10)?,
        },
        revision: row.get(11)?,
        source_available: true,
    })
}
pub fn get_relationship(
    connection: &Connection,
    campaign_id: &str,
    id: &str,
) -> AppResult<Relationship> {
    identifier(campaign_id)?;
    identifier(id)?;
    let mut relationship=connection.query_row("SELECT id,campaign_id,from_page_id,to_page_id,label,certainty,source_session_id,source_page_id,source_block_id,evidence,notes,revision FROM relationships WHERE campaign_id=?1 AND id=?2",params![campaign_id,id],row_relationship).optional().map_err(storage)?.ok_or("Relationship not found in this campaign.")?;
    if let (Some(kind), Some(id)) = (
        &relationship.input.source_kind,
        &relationship.input.source_id,
    ) {
        relationship.source_available = source_document(connection, campaign_id, kind, id)
            .is_ok_and(|doc| {
                relationship
                    .input
                    .source_block_id
                    .as_ref()
                    .is_none_or(|block| block_exists(&doc, block))
            });
    }
    Ok(relationship)
}
pub fn save_relationship(
    connection: &Connection,
    campaign_id: &str,
    id: Option<&str>,
    revision: Option<i64>,
    input: RelationshipInput,
) -> AppResult<Relationship> {
    let transaction = connection.unchecked_transaction().map_err(storage)?;
    validate(&transaction, campaign_id, &input)?;
    let generated = uuid::Uuid::new_v4().to_string();
    let chosen = id.unwrap_or(&generated);
    identifier(chosen)?;
    let source_session = input
        .source_id
        .as_deref()
        .filter(|_| input.source_kind.as_deref() == Some("session"));
    let source_page = input
        .source_id
        .as_deref()
        .filter(|_| input.source_kind.as_deref() == Some("page"));
    if id.is_some() {
        let revision = revision.ok_or("Missing revision. Reopen the relationship.")?;
        let affected=transaction.execute("UPDATE relationships SET from_page_id=?1,to_page_id=?2,label=?3,certainty=?4,source_session_id=?5,source_page_id=?6,source_block_id=?7,evidence=?8,notes=?9,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE campaign_id=?10 AND id=?11 AND revision=?12",params![input.from_page_id,input.to_page_id,input.label.trim(),input.certainty,source_session,source_page,input.source_block_id,input.evidence,input.notes,campaign_id,chosen,revision]).map_err(storage)?;
        if affected != 1 {
            return Err(
                "Relationship changed elsewhere or not found. Reopen it before saving.".into(),
            );
        }
    } else {
        transaction.execute("INSERT INTO relationships(id,campaign_id,from_page_id,to_page_id,label,certainty,source_session_id,source_page_id,source_block_id,evidence,notes) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",params![chosen,campaign_id,input.from_page_id,input.to_page_id,input.label.trim(),input.certainty,source_session,source_page,input.source_block_id,input.evidence,input.notes]).map_err(storage)?;
    }
    transaction.commit().map_err(storage)?;
    get_relationship(connection, campaign_id, chosen)
}
pub fn delete_relationship(
    connection: &Connection,
    campaign_id: &str,
    id: &str,
    revision: i64,
) -> AppResult<()> {
    identifier(campaign_id)?;
    identifier(id)?;
    let count = connection
        .execute(
            "DELETE FROM relationships WHERE campaign_id=?1 AND id=?2 AND revision=?3",
            params![campaign_id, id, revision],
        )
        .map_err(storage)?;
    if count != 1 {
        return Err(
            "Relationship changed elsewhere or not found. Reopen it before deleting it.".into(),
        );
    }
    Ok(())
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphNode {
    pub id: String,
    pub entity_id: String,
    pub title: String,
    pub kind: String,
    pub missing: bool,
    #[serde(skip)]
    search: String,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceRef {
    pub kind: String,
    pub id: String,
    pub title: String,
    pub block_id: Option<String>,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    pub kind: String,
    pub label: String,
    pub certainty: Option<String>,
    pub relationship_id: Option<String>,
    pub provenance: Option<SourceRef>,
    pub preview: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GraphQuery {
    pub kind: Option<String>,
    pub edge_kind: String,
    pub certainty: Option<String>,
    pub focus_id: Option<String>,
    pub depth: u8,
    pub session_id: Option<String>,
    pub search: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
    pub truncated: bool,
    pub total_nodes: usize,
    pub total_edges: usize,
}

pub fn graph(
    connection: &Connection,
    campaign_id: &str,
    query: GraphQuery,
) -> AppResult<GraphData> {
    require_campaign(connection, campaign_id)?;
    if let Some(focus) = &query.focus_id {
        let (kind, id) = focus.split_once(':').ok_or("Invalid central node.")?;
        if !["page", "session"].contains(&kind) {
            return Err("Invalid central node.".into());
        }
        identifier(id)?;
    }
    if !["all", "mentions", "assertions"].contains(&query.edge_kind.as_str())
        || ![1, 2].contains(&query.depth)
        || query.search.chars().count() > 200
        || query
            .certainty
            .as_ref()
            .is_some_and(|c| !CERTAINTIES.contains(&c.as_str()))
    {
        return Err("Invalid graph filters.".into());
    }
    if query.kind.as_ref().is_some_and(|k| {
        ![
            "npc", "place", "faction", "quest", "item", "event", "lore", "note", "session",
            "missing",
        ]
        .contains(&k.as_str())
    }) {
        return Err("Invalid node type.".into());
    }
    let transaction = connection.unchecked_transaction().map_err(storage)?;
    let mut nodes = BTreeMap::new();
    {
        let mut statement=transaction.prepare("SELECT p.id,p.title,p.kind,COALESCE(group_concat(a.alias,' '),'') FROM pages p LEFT JOIN page_aliases a ON a.page_id=p.id WHERE p.campaign_id=?1 GROUP BY p.id ORDER BY p.title_key,p.id").map_err(storage)?;
        for row in statement
            .query_map([campaign_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            })
            .map_err(storage)?
        {
            let (id, title, kind, aliases) = row.map_err(storage)?;
            let key = format!("page:{id}");
            nodes.insert(
                key.clone(),
                GraphNode {
                    id: key,
                    entity_id: id,
                    search: format!("{title} {aliases}").to_lowercase(),
                    title,
                    kind,
                    missing: false,
                },
            );
        }
        let mut statement = transaction
            .prepare(
                "SELECT id,title,sequence FROM sessions WHERE campaign_id=?1 ORDER BY sequence,id",
            )
            .map_err(storage)?;
        for row in statement
            .query_map([campaign_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                ))
            })
            .map_err(storage)?
        {
            let (id, title, sequence) = row.map_err(storage)?;
            let title = format!("Session {sequence}: {title}");
            let key = format!("session:{id}");
            nodes.insert(
                key.clone(),
                GraphNode {
                    id: key,
                    entity_id: id,
                    search: title.to_lowercase(),
                    title,
                    kind: "session".into(),
                    missing: false,
                },
            );
        }
    }
    if let Some(session) = &query.session_id {
        identifier(session)?;
        if !nodes.contains_key(&format!("session:{session}")) {
            return Err("Filter session not found in this campaign.".into());
        }
    }
    let provenance = |kind: &str, id: &str, block_id: Option<String>| SourceRef {
        kind: kind.into(),
        id: id.into(),
        title: nodes
            .get(&format!("{kind}:{id}"))
            .map(|n| n.title.clone())
            .unwrap_or_else(|| "Source not available".into()),
        block_id,
    };
    let mut edges = vec![];
    if query.edge_kind != "mentions" {
        let mut statement=transaction.prepare("SELECT id,campaign_id,from_page_id,to_page_id,label,certainty,source_session_id,source_page_id,source_block_id,evidence,notes,revision FROM relationships WHERE campaign_id=?1 ORDER BY id").map_err(storage)?;
        for row in statement
            .query_map([campaign_id], row_relationship)
            .map_err(storage)?
        {
            let r = row.map_err(storage)?;
            if query
                .certainty
                .as_ref()
                .is_some_and(|c| c != &r.input.certainty)
                || query.session_id.as_ref().is_some_and(|s| {
                    r.input.source_kind.as_deref() != Some("session")
                        || r.input.source_id.as_ref() != Some(s)
                })
            {
                continue;
            }
            let source = r
                .input
                .source_kind
                .as_ref()
                .zip(r.input.source_id.as_ref())
                .map(|(k, id)| provenance(k, id, r.input.source_block_id));
            edges.push(GraphEdge {
                id: format!("relationship:{}", r.id),
                source: format!("page:{}", r.input.from_page_id),
                target: format!("page:{}", r.input.to_page_id),
                kind: "assertion".into(),
                label: r.input.label,
                certainty: Some(r.input.certainty),
                relationship_id: Some(r.id),
                provenance: source,
                preview: r.input.evidence,
            });
        }
    }
    if query.edge_kind != "assertions" {
        let mut statement=transaction.prepare("SELECT source_session_id,source_page_id,source_block_id,target_page_id,preview FROM mentions WHERE campaign_id=?1 ORDER BY source_session_id,source_page_id,source_block_id,target_page_id").map_err(storage)?;
        let rows = statement
            .query_map([campaign_id], |r| {
                Ok((
                    r.get::<_, Option<String>>(0)?,
                    r.get::<_, Option<String>>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                ))
            })
            .map_err(storage)?;
        for row in rows {
            let (session, page, block, target, preview) = row.map_err(storage)?;
            if query
                .session_id
                .as_ref()
                .is_some_and(|s| session.as_ref() != Some(s))
            {
                continue;
            }
            let (kind, id) = match (session, page) {
                (Some(id), _) => ("session", id),
                (_, Some(id)) => ("page", id),
                _ => continue,
            };
            edges.push(GraphEdge {
                id: format!("mention:{kind}:{id}:{block}:{target}"),
                source: format!("{kind}:{id}"),
                target: format!("page:{target}"),
                kind: "mention".into(),
                label: "mentions".into(),
                certainty: None,
                relationship_id: None,
                provenance: Some(provenance(kind, &id, Some(block))),
                preview,
            });
        }
    }
    for edge in &edges {
        if !nodes.contains_key(&edge.target) {
            let id = edge.target.trim_start_matches("page:").to_string();
            nodes.insert(
                edge.target.clone(),
                GraphNode {
                    id: edge.target.clone(),
                    entity_id: id,
                    title: "Missing page".into(),
                    kind: "missing".into(),
                    missing: true,
                    search: "missing page".into(),
                },
            );
        }
    }
    // Filtered metadata stays in Rust; only a bounded view is sent to the canvas.
    let eligible: HashSet<String> = nodes
        .values()
        .filter(|n| query.kind.as_ref().is_none_or(|k| k == &n.kind))
        .map(|n| n.id.clone())
        .collect();
    edges.retain(|e| eligible.contains(&e.source) && eligible.contains(&e.target));
    let mut visible: HashSet<String> = eligible;
    if let Some(focus) = &query.focus_id {
        if !nodes.contains_key(focus) {
            return Err("Central node not found in this campaign.".into());
        }
        visible = HashSet::from([focus.clone()]);
        let mut frontier = visible.clone();
        for _ in 0..query.depth {
            let mut next = HashSet::new();
            for edge in &edges {
                if frontier.contains(&edge.source) {
                    next.insert(edge.target.clone());
                }
                if frontier.contains(&edge.target) {
                    next.insert(edge.source.clone());
                }
            }
            next.retain(|id| !visible.contains(id));
            visible.extend(next.iter().cloned());
            frontier = next;
        }
        visible.retain(|id| query.kind.as_ref().is_none_or(|k| nodes[id].kind == *k));
    }
    if query.session_id.is_some() {
        let incident: HashSet<_> = edges
            .iter()
            .flat_map(|e| [e.source.clone(), e.target.clone()])
            .collect();
        visible.retain(|id| incident.contains(id));
    }
    let search = query.search.trim().to_lowercase();
    visible.retain(|id| nodes[id].search.contains(&search));
    let total_nodes = visible.len();
    let total_edges = edges
        .iter()
        .filter(|e| visible.contains(&e.source) && visible.contains(&e.target))
        .count();
    let mut ordered: Vec<_> = nodes
        .into_values()
        .filter(|n| visible.contains(&n.id))
        .collect();
    ordered.sort_by(|a, b| {
        (query.focus_id.as_ref() != Some(&a.id), &a.title, &a.id).cmp(&(
            query.focus_id.as_ref() != Some(&b.id),
            &b.title,
            &b.id,
        ))
    });
    ordered.truncate(NODE_LIMIT);
    let ids: HashSet<_> = ordered.iter().map(|n| n.id.clone()).collect();
    edges.retain(|e| ids.contains(&e.source) && ids.contains(&e.target));
    edges.truncate(EDGE_LIMIT);
    let truncated = total_nodes > ordered.len() || total_edges > edges.len();
    transaction.commit().map_err(storage)?;
    Ok(GraphData {
        nodes: ordered,
        edges,
        truncated,
        total_nodes,
        total_edges,
    })
}
