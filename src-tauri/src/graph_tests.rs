use crate::{db, graph::*, journal, knowledge};
use serde_json::json;
fn query() -> GraphQuery {
    GraphQuery {
        kind: None,
        edge_kind: "all".into(),
        certainty: None,
        focus_id: None,
        depth: 1,
        session_id: None,
        search: String::new(),
    }
}
fn input(from: &str, to: &str) -> RelationshipInput {
    RelationshipInput {
        from_page_id: from.into(),
        to_page_id: to.into(),
        label: "accusa".into(),
        certainty: "suspected".into(),
        source_kind: None,
        source_id: None,
        source_block_id: None,
        evidence: "Una dichiarazione, non una prova.".into(),
        notes: String::new(),
    }
}
fn doc(ids: &[&str]) -> serde_json::Value {
    json!({"version":1,"blocks":[{"id":"evidence-block","type":"paragraph","props":{},"children":[],"content":ids.iter().map(|id|json!({"type":"pageMention","props":{"pageId":id,"label":"Name"}})).collect::<Vec<_>>()}]})
}
fn page(c: &rusqlite::Connection, campaign: &str, title: &str) -> knowledge::Page {
    knowledge::create_page(c, campaign, title, "npc", "active", &[]).unwrap()
}
#[test]
fn co_mentions_are_only_session_edges_until_an_assertion_is_created() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let v = page(&c, &a.id, "Varek");
    let g = page(&c, &a.id, "Gilda");
    let s = journal::create_session(&c, &a.id, 12, "L'accusa", None).unwrap();
    journal::save_document(&c, &a.id, &s.id, 0, doc(&[&v.id, &g.id])).unwrap();
    let data = graph(&c, &a.id, query()).unwrap();
    assert_eq!(data.edges.len(), 2);
    assert!(data.edges.iter().all(|e| e.kind == "mention"
        && e.source == format!("session:{}", s.id)
        && e.certainty.is_none()));
    let mut request = input(&v.id, &g.id);
    request.source_kind = Some("session".into());
    request.source_id = Some(s.id.clone());
    request.source_block_id = Some("evidence-block".into());
    let r = save_relationship(&c, &a.id, None, None, request).unwrap();
    let data = graph(&c, &a.id, query()).unwrap();
    let assertion = data.edges.iter().find(|e| e.kind == "assertion").unwrap();
    assert_eq!(assertion.source, format!("page:{}", v.id));
    assert_eq!(assertion.target, format!("page:{}", g.id));
    assert_eq!(assertion.certainty.as_deref(), Some("suspected"));
    assert_eq!(assertion.relationship_id.as_deref(), Some(r.id.as_str()));
    assert_eq!(
        assertion.provenance.as_ref().unwrap().block_id.as_deref(),
        Some("evidence-block")
    );
}
#[test]
fn relationships_persist_update_with_revision_and_delete_without_touching_mentions() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("graph.sqlite3");
    let (campaign, id) = {
        let c = db::open(&path).unwrap();
        let a = journal::create_campaign(&c, "A").unwrap();
        let v = page(&c, &a.id, "Varek");
        let g = page(&c, &a.id, "Gilda");
        let r = save_relationship(&c, &a.id, None, None, input(&v.id, &g.id)).unwrap();
        (a.id, r.id)
    };
    let c = db::open(&path).unwrap();
    let r = get_relationship(&c, &campaign, &id).unwrap();
    assert_eq!(r.input.certainty, "suspected");
    let mut changed = r.input.clone();
    changed.certainty = "disproven".into();
    let saved = save_relationship(&c, &campaign, Some(&id), Some(0), changed.clone()).unwrap();
    assert_eq!(saved.revision, 1);
    assert!(save_relationship(&c, &campaign, Some(&id), Some(0), changed).is_err());
    assert!(delete_relationship(&c, &campaign, &id, 0).is_err());
    delete_relationship(&c, &campaign, &id, 1).unwrap();
    assert!(get_relationship(&c, &campaign, &id).is_err());
    assert!(graph(&c, &campaign, query()).unwrap().edges.is_empty());
}
#[test]
fn campaign_boundaries_and_source_validation_are_enforced() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let b = journal::create_campaign(&c, "B").unwrap();
    let v = page(&c, &a.id, "Varek");
    let g = page(&c, &a.id, "Gilda");
    let foreign = page(&c, &b.id, "Other");
    assert!(save_relationship(&c, &a.id, None, None, input(&v.id, &foreign.id)).is_err());
    let mut invalid = input(&v.id, &g.id);
    invalid.certainty = "maybe".into();
    assert!(save_relationship(&c, &a.id, None, None, invalid).is_err());
    let s = journal::create_session(&c, &a.id, 1, "Prima", None).unwrap();
    let mut source = input(&v.id, &g.id);
    source.source_kind = Some("session".into());
    source.source_id = Some(s.id.clone());
    source.source_block_id = Some("missing".into());
    assert!(save_relationship(&c, &a.id, None, None, source.clone()).is_err());
    source.source_block_id = None;
    let r = save_relationship(&c, &a.id, None, None, source).unwrap();
    assert!(get_relationship(&c, &b.id, &r.id).is_err());
    assert!(delete_relationship(&c, &b.id, &r.id, 0).is_err());
    let mut q = query();
    q.session_id = Some(s.id);
    assert!(graph(&c, &b.id, q).is_err());
}
#[test]
fn removed_source_block_is_reported_without_erasing_relationship_or_evidence() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let v = page(&c, &a.id, "Varek");
    let g = page(&c, &a.id, "Gilda");
    let s = journal::create_session(&c, &a.id, 1, "Prima", None).unwrap();
    journal::save_document(&c, &a.id, &s.id, 0, doc(&[&v.id])).unwrap();
    let mut source = input(&v.id, &g.id);
    source.source_kind = Some("session".into());
    source.source_id = Some(s.id.clone());
    source.source_block_id = Some("evidence-block".into());
    let r = save_relationship(&c, &a.id, None, None, source).unwrap();
    journal::save_document(&c, &a.id, &s.id, 1, journal::empty_document()).unwrap();
    let saved = get_relationship(&c, &a.id, &r.id).unwrap();
    assert!(!saved.source_available);
    assert_eq!(saved.input.evidence, "Una dichiarazione, non una prova.");
}
#[test]
fn filters_depth_and_session_provenance_have_defined_semantics() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let v = page(&c, &a.id, "Varek");
    let g = page(&c, &a.id, "Gilda");
    let n = page(&c, &a.id, "Nara");
    save_relationship(&c, &a.id, None, None, input(&v.id, &g.id)).unwrap();
    let mut other = input(&g.id, &n.id);
    other.certainty = "confirmed".into();
    save_relationship(&c, &a.id, None, None, other).unwrap();
    let mut q = query();
    q.focus_id = Some(format!("page:{}", v.id));
    assert_eq!(graph(&c, &a.id, q.clone()).unwrap().nodes.len(), 2);
    q.depth = 2;
    assert_eq!(graph(&c, &a.id, q).unwrap().nodes.len(), 3);
    let mut q = query();
    q.certainty = Some("confirmed".into());
    assert_eq!(graph(&c, &a.id, q).unwrap().edges.len(), 1);
    let mut q = query();
    q.edge_kind = "mentions".into();
    assert!(graph(&c, &a.id, q).unwrap().edges.is_empty());
    let mut q = query();
    q.search = "VAREK".into();
    assert_eq!(graph(&c, &a.id, q).unwrap().nodes.len(), 1);
    let mut q = query();
    q.kind = Some("place".into());
    assert!(graph(&c, &a.id, q).unwrap().nodes.is_empty());
}
#[test]
fn graph_view_is_bounded_and_never_contains_dangling_canvas_edges() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let pages: Vec<_> = (0..155)
        .map(|i| page(&c, &a.id, &format!("Pagina {i:03}")))
        .collect();
    for _ in 0..405 {
        save_relationship(&c, &a.id, None, None, input(&pages[0].id, &pages[1].id)).unwrap();
    }
    save_relationship(&c, &a.id, None, None, input(&pages[0].id, &pages[154].id)).unwrap();
    let data = graph(&c, &a.id, query()).unwrap();
    assert!(data.truncated);
    assert_eq!(data.total_nodes, 155);
    assert_eq!(data.nodes.len(), 150);
    assert_eq!(data.total_edges, 406);
    assert_eq!(data.edges.len(), 400);
    assert!(data
        .edges
        .iter()
        .all(|edge| data.nodes.iter().any(|n| n.id == edge.source)
            && data.nodes.iter().any(|n| n.id == edge.target)));
}
#[test]
fn migration_from_m2_preserves_documents_and_applies_once() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("m2.sqlite3");
    let old = rusqlite::Connection::open(&path).unwrap();
    old.execute_batch(include_str!("../migrations/001_foundation.sql"))
        .unwrap();
    old.execute_batch(include_str!("../migrations/002_journal.sql"))
        .unwrap();
    old.execute_batch(include_str!("../migrations/003_knowledge.sql"))
        .unwrap();
    let a = journal::create_campaign(&old, "A").unwrap();
    let p = page(&old, &a.id, "Varek");
    drop(old);
    for _ in 0..2 {
        let c = db::open(&path).unwrap();
        assert_eq!(
            knowledge::get_page(&c, &a.id, &p.id).unwrap().document,
            p.document
        );
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            db::LATEST_SCHEMA
        );
    }
}
