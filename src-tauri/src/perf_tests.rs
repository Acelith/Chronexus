//! M23 measurements on a large synthetic campaign. Ignored by default:
//! `cargo test --release --lib perf_ -- --ignored --nocapture`
use crate::{backup, db, graph, journal, knowledge, search};
use serde_json::{json, Value};
use std::time::Instant;

const SESSIONS: usize = 300;
const PAGES: usize = 2000;
const BLOCKS: usize = 40;

fn document(seed: usize, targets: &[String]) -> Value {
    let blocks: Vec<Value> = (0..BLOCKS)
        .map(|b| {
            let mut content = vec![json!({"type":"text","text":format!("Session {seed} block {b}: the party travels past the old mill and argues about the guild debt."),"styles":{}})];
            if b % 8 == 0 {
                let id = &targets[(seed * 7 + b) % targets.len()];
                content.push(json!({"type":"pageMention","props":{"pageId":id,"label":"Linked page"}}));
            }
            json!({"id":format!("b{seed}-{b}"),"type":"paragraph","props":{},"content":content,"children":[]})
        })
        .collect();
    json!({"version":1,"blocks":blocks})
}

fn time<T>(label: &str, runs: u32, mut work: impl FnMut() -> T) -> T {
    let start = Instant::now();
    let mut last = None;
    for _ in 0..runs {
        last = Some(work());
    }
    let mean = start.elapsed() / runs;
    eprintln!("PERF {label:<34} {:>9.2} ms", mean.as_secs_f64() * 1000.0);
    last.unwrap()
}

#[test]
#[ignore]
fn perf_large_synthetic_campaign() {
    let dir = tempfile::tempdir().unwrap();
    let store = backup::Store::open(dir.path()).unwrap();
    let c = &store.connection;
    let campaign = journal::create_campaign(c, "Synthetic large campaign").unwrap();
    let tx = c.unchecked_transaction().unwrap();
    let mut pages = vec![];
    for i in 0..PAGES {
        let aliases = vec![
            format!("Alias A{i}"),
            format!("Alias B{i}"),
            format!("Alias C{i}"),
        ];
        let page = knowledge::create_page_in_transaction(
            &tx,
            &campaign.id,
            &format!("Page {i}"),
            "npc",
            "active",
            &aliases,
        )
        .unwrap();
        pages.push(page.id);
    }
    tx.commit().unwrap();
    let mut sessions = vec![];
    for s in 0..SESSIONS {
        let session =
            journal::create_session(c, &campaign.id, s as i64 + 1, &format!("Session {s}"), None)
                .unwrap();
        journal::save_document(c, &campaign.id, &session.id, 0, document(s, &pages)).unwrap();
        sessions.push(session.id);
    }
    for r in 0..1000 {
        graph::save_relationship(
            c,
            &campaign.id,
            None,
            None,
            graph::RelationshipInput {
                from_page_id: pages[r % PAGES].clone(),
                to_page_id: pages[(r * 13 + 1) % PAGES].clone(),
                label: "knows".into(),
                certainty: "suspected".into(),
                source_kind: None,
                source_id: None,
                source_block_id: None,
                evidence: String::new(),
                notes: String::new(),
            },
        )
        .unwrap();
    }
    let size = std::fs::metadata(store.directory.join("nodex.sqlite3"))
        .unwrap()
        .len();
    eprintln!("PERF data: {SESSIONS} sessions x {BLOCKS} blocks, {PAGES} pages, 1000 relationships, {:.1} MiB", size as f64 / 1048576.0);
    let path = store.directory.join("nodex.sqlite3");
    drop(store);
    time("open archive (migrations checked)", 10, || {
        db::open(&path).unwrap()
    });
    let c = db::open(&path).unwrap();
    time("list_campaigns", 20, || {
        journal::list_campaigns(&c).unwrap()
    });
    time("list_sessions (full documents)", 10, || {
        journal::list_sessions(&c, &campaign.id).unwrap()
    });
    time("list_pages", 10, || {
        knowledge::list_pages(&c, &campaign.id).unwrap()
    });
    let mut revision = 1;
    time("save_document (index + search)", 10, || {
        let saved = journal::save_document(
            &c,
            &campaign.id,
            &sessions[0],
            revision,
            document(9999, &pages),
        )
        .unwrap();
        revision = saved.revision;
    });
    time("backlinks of a page", 20, || {
        knowledge::backlinks(&c, &campaign.id, &pages[7]).unwrap()
    });
    time("search 'guild debt' relevance", 20, || {
        search::find(&c, &campaign.id, "guild debt", None, "relevance").unwrap()
    });
    time("search 'mill' recent", 20, || {
        search::find(&c, &campaign.id, "mill", None, "recent").unwrap()
    });
    let query = graph::GraphQuery {
        kind: None,
        edge_kind: "all".into(),
        certainty: None,
        focus_id: None,
        depth: 1,
        session_id: None,
        search: String::new(),
    };
    time("graph (all edges, bounded view)", 5, || {
        graph::graph(&c, &campaign.id, query.clone()).unwrap()
    });
    time("rebuild search index", 1, || search::rebuild(&c).unwrap());
    let out = tempfile::tempdir().unwrap();
    let mut n = 0;
    time("write verified backup", 1, || {
        n += 1;
        backup::write_backup(
            &c,
            path.parent().unwrap(),
            &out.path().join(format!("b{n}.nodex")),
        )
        .unwrap()
    });
}
