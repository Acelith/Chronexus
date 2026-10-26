// Synthetic fixtures only: they mimic the public page structure, not its text.
use super::*;
use crate::{backup, journal};

fn page(title: &str, content: &str) -> String {
    format!(
        r#"<html><head><title>x</title><script>window.evil=1</script></head><body>
<div class="page-title page-header"><span>{title}</span></div>
<div id="wad-dnd5e-above-content" class="wd-adunit">AD TEXT</div>
<div id="page-content">{content}</div>
<div class="page-tags"><a href="/system:page-tags/tag/x">tag</a></div>
<div class="license-area">Unless otherwise stated, the content of this page is licensed under <a rel="license" href="http://creativecommons.org/licenses/by-sa/3.0/">Creative Commons Attribution-ShareAlike 3.0 License</a></div>
</body></html>"#
    )
}
const SPELL: &str = r#"<div class="content-separator" style="display:none"></div>
<p>Source: Synthetic Handbook</p>
<p><em>1st-level evocation (ritual)</em></p>
<p><strong>Casting Time:</strong> 1 action<br />
<strong>Range:</strong> 30 feet<br />
<strong>Components:</strong> V, S, M (a glass bead)<br />
<strong>Duration:</strong> Concentration, up to 1 minute</p>
<p>A test light — ünïcödé 光 — fills the area.<script>alert(1)</script></p>
<iframe src="https://evil.test">frame text</iframe>
<form action="https://evil.test"><input value="secret"/>form text</form>
<table class="wiki-content-table"><tr><th>Level</th><th>Effect</th></tr><tr><td>1</td><td><a href="javascript:alert(1)" onclick="x()">glow</a></td></tr></table>
<p><strong><em>At Higher Levels.</em></strong> The light grows by 5 feet per slot level above 1st.</p>
<p><strong><em>Spell Lists.</em></strong> <a href="http://dnd5e.wikidot.com/spells:wizard">Wizard</a></p>"#;

#[test]
fn spell_page_becomes_inert_structured_text_with_provenance() {
    let e = parse::entry(&page("Test Light", SPELL), "spell:test-light").unwrap();
    assert_eq!(e.title, "Test Light");
    assert_eq!(e.url, "https://dnd5e.wikidot.com/spell:test-light");
    assert_eq!(e.source.as_deref(), Some("Synthetic Handbook"));
    assert_eq!(e.origin, "published");
    assert_eq!(e.edition, "5e-2014");
    assert!(e
        .license
        .contains("Creative Commons Attribution-ShareAlike 3.0"));
    let s = e.spell.as_ref().unwrap();
    assert_eq!(s.level.as_deref(), Some("1"));
    assert_eq!(s.school.as_deref(), Some("Evocation"));
    assert_eq!(s.casting_time.as_deref(), Some("1 action"));
    assert_eq!(s.range.as_deref(), Some("30 feet"));
    assert_eq!(s.components.as_deref(), Some("V, S, M (a glass bead)"));
    assert!(s.ritual && s.concentration);
    assert_eq!(s.classes.as_deref(), Some("Wizard"));
    assert!(s
        .higher_levels
        .as_deref()
        .unwrap()
        .starts_with("The light grows"));
    let d = s.description.as_deref().unwrap();
    assert!(d.contains("ünïcödé 光") && d.contains("1 | glow"));
    assert!(e.missing.is_empty());
    let all = serde_json::to_string(&e).unwrap();
    for bad in [
        "alert",
        "evil",
        "secret",
        "frame text",
        "form text",
        "AD TEXT",
        "tag",
    ] {
        assert!(!all.contains(bad), "{bad} leaked into {all}");
    }
}
#[test]
fn changed_markup_is_reported_instead_of_invented() {
    let html = page(
        "Odd",
        "<p>Source: Unearthed Arcana 99</p><p>Just prose.</p>",
    );
    let e = parse::entry(&html, "spell:odd").unwrap();
    assert_eq!(e.origin, "ua");
    assert!(e.missing.contains(&"castingTime".to_string()));
    assert!(e.missing.contains(&"level".to_string()));
    assert!(e.spell.as_ref().unwrap().casting_time.is_none());
    assert!(parse::entry("<html><body><p>moved</p></body></html>", "spell:odd").is_err());
    assert!(parse::entry(&page("Empty", "<script>x</script>"), "spell:odd").is_err());
    assert!(parse::entry(&page("X", SPELL), "../etc").is_err());
    // Hostile nesting is bounded: either truncated text or a clear error, never a crash.
    let deep = format!("{}text{}", "<div>".repeat(5000), "</div>".repeat(5000));
    if let Ok(e) = parse::entry(&page("Deep", &deep), "feat:deep") {
        assert!(e.truncated);
    }
}
#[test]
fn indices_keep_tabs_rows_groups_and_reject_foreign_links() {
    let spells = page(
        "Spells",
        r#"<div class="yui-navset"><ul class="yui-nav"><li><a href="javascript:;"><em>Cantrip</em></a></li><li><a href="javascript:;"><em>1st Level</em></a></li></ul>
<div class="yui-content"><div id="wiki-tab-0-0"><table><tr><th>Name</th><th>School</th></tr><tr><td><a href="/spell:alpha">Alpha</a></td><td><em>Abjuration</em></td></tr></table></div>
<div id="wiki-tab-0-1"><table><tr><td><a href="/spell:beta-ua">Beta (UA)</a></td><td>Evocation</td></tr>
<tr><td><a href="https://evil.test/spell:gamma">Gamma</a></td></tr><tr><td><a href="/spell:alpha">Alpha again</a></td></tr></table></div></div></div>"#,
    );
    let rows = parse::index(&spells, "spells").unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[0].page, "spell:alpha");
    assert_eq!(rows[0].group, "Cantrip");
    assert_eq!(rows[0].details, vec!["Abjuration"]);
    assert_eq!(rows[1].origin, "ua");
    assert_eq!(rows[1].group, "1st Level");
    let home = page(
        "Home",
        r#"<h1><span>Feats</span></h1><h6><span>Published</span></h6><p>• <a href="/feat:alert">Alert</a><br/>• <a href="http://dnd5e.wikidot.com/feat:actor">Actor</a></p>
<h6><span>Homebrew</span></h6><p><a href="/feat:brewed">Brewed</a></p>
<h1><span><a href="/wizard">Wizard</a></span></h1><h6><span>Published</span></h6><p><a href="/wizard:evocation">Evocation</a> <a href="/spells:wizard">List</a></p>"#,
    );
    let feats = parse::index(&home, "feats").unwrap();
    assert_eq!(
        feats.iter().map(|r| r.page.as_str()).collect::<Vec<_>>(),
        ["feat:alert", "feat:actor", "feat:brewed"]
    );
    assert_eq!(feats[0].origin, "published");
    assert_eq!(feats[2].origin, "homebrew");
    let classes = parse::index(&home, "classes").unwrap();
    assert_eq!(
        classes.iter().map(|r| r.page.as_str()).collect::<Vec<_>>(),
        ["wizard", "wizard:evocation"]
    );
    assert!(parse::index(&home, "items").is_err());
}
#[test]
fn only_allowlisted_pages_and_categories_are_accepted() {
    for ok in [
        "spell:fire-bolt",
        "feat:alert",
        "lineage:elf",
        "background:sage",
        "wondrous-items:bag",
        "wizard",
        "wizard:evocation",
    ] {
        assert!(category_of(ok).is_some(), "{ok}");
    }
    for bad in [
        "spells",
        "spells:wizard",
        "system:join",
        "spell:",
        "spell:A",
        "../x",
        "spell:a/b",
        "admin:x",
        "forum:start",
        "spell:a?b",
        "wizard:x:y",
    ] {
        assert!(category_of(bad).is_none(), "{bad}");
    }
    assert_eq!(parse::page_from_href("https://evil.test/spell:a"), None);
    assert_eq!(parse::page_from_href("//evil.test/spell:a"), None);
    assert_eq!(
        parse::page_from_href("/spell:a#top").as_deref(),
        Some("spell:a")
    );
    assert!(index_path("rules").is_err());
}
fn sample_entry(page: &str) -> Value {
    serde_json::to_value(parse::entry(&page_html(page), page).unwrap()).unwrap()
}
fn page_html(p: &str) -> String {
    page(
        &format!("Title {p}"),
        "<p>Source: Synthetic</p><p>Body text.</p>",
    )
}
#[test]
fn cache_is_bounded_separate_clearable_and_survives_backup_restore() {
    let d = tempfile::tempdir().unwrap();
    let s = backup::Store::open(&d.path().join("profile")).unwrap();
    let c = &s.connection;
    let campaign = journal::create_campaign(c, "A").unwrap();
    assert!(store(c, "entry/spell:x", &sample_entry("spell:y")).is_err());
    assert!(store(c, "http://bad", &json_obj()).is_err());
    for n in 0..205 {
        let p = format!("feat:f{n}");
        store(c, &format!("entry/{p}"), &sample_entry(&p)).unwrap();
    }
    let count: i64 = c
        .query_row("SELECT COUNT(*) FROM wikidot_cache", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 200);
    let index = Index {
        category: "feats".into(),
        url: "https://dnd5e.wikidot.com/".into(),
        rows: vec![IndexRow {
            page: "feat:alert".into(),
            name: "Alert".into(),
            group: "Feats".into(),
            details: vec![],
            origin: "unspecified".into(),
        }],
    };
    store(c, "index/feats", &serde_json::to_value(&index).unwrap()).unwrap();
    assert_eq!(filter(&index, "ALE").0, 1);
    assert_eq!(filter(&index, "zzz").0, 0);
    c.execute(
        "INSERT INTO wiki_cache(key,payload) VALUES('entry/spells/x','{}')",
        [],
    )
    .unwrap();
    // An approved AI source in this cache is reported before clearing.
    c.execute(
        "INSERT INTO campaign_ai_settings(campaign_id,payload) VALUES(?1,?2)",
        params![
            campaign.id,
            r#"{"ruleKeys":["wikidot/feat:f204","entry/spells/x"]}"#
        ],
    )
    .unwrap();
    let before = summary(c).unwrap();
    assert_eq!(
        (before.wikidot.entries, before.wikidot.ai_sources),
        (201, 1)
    );
    assert_eq!((before.open5e.entries, before.open5e.ai_sources), (1, 1));
    c.execute("DELETE FROM wiki_cache", []).unwrap();
    c.execute("DELETE FROM campaign_ai_settings", []).unwrap();
    let file = d.path().join("wikidot.nodex");
    backup::write_backup(c, &s.directory, &file).unwrap();
    let mut r = backup::Store::open(&d.path().join("restore")).unwrap();
    // The global wiki choice lives outside restore generations.
    crate::wiki_provider::save(&r.root, "open5e").unwrap();
    let p = r.prepare(&file).unwrap();
    r.restore(&p.token).unwrap();
    assert_eq!(
        crate::wiki_provider::read(&r.root).unwrap().provider,
        "open5e"
    );
    assert!(read_entry(&r.connection, "feat:f204").unwrap().is_some());
    let after = clear(&r.connection, "wikidot").unwrap();
    assert_eq!(after.wikidot.entries, 0);
    assert!(read_index(&r.connection, "feats").unwrap().is_none());
    assert_eq!(journal::list_campaigns(&r.connection).unwrap().len(), 1);
    assert!(clear(&r.connection, "elsewhere").is_err());
}
fn json_obj() -> Value {
    serde_json::json!({})
}
fn server(responses: Vec<String>) -> (Url, std::thread::JoinHandle<Vec<String>>) {
    let (base, worker) = crate::test_support::serve_text(responses);
    (format!("{base}/").parse().unwrap(), worker)
}
fn test_client() -> Client {
    Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .pool_max_idle_per_host(0)
        .timeout(Duration::from_secs(3))
        .build()
        .unwrap()
}
fn html_response(body: &str) -> String {
    format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{body}", body.len())
}
#[tokio::test]
async fn network_errors_redirects_and_types_are_explicit() {
    let state = State::with_interval(Duration::ZERO);
    let client = test_client();
    let token = CancellationToken::new();
    let body = page_html("feat:alert");
    let cases: Vec<(String, Option<&str>)> = vec![
        (html_response(&body), None),
        ("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n".into(), Some("HTTP 404")),
        ("HTTP/1.1 429 Too Many Requests\r\nContent-Length: 0\r\n\r\n".into(), Some("HTTP 429")),
        ("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\n\r\n".into(), Some("HTTP 403")),
        ("HTTP/1.1 503 Unavailable\r\nContent-Length: 0\r\n\r\n".into(), Some("HTTP 503")),
        ("HTTP/1.1 302 Found\r\nLocation: https://evil.test/feat:alert\r\nContent-Length: 0\r\n\r\n".into(), Some("Redirect")),
        ("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}".into(), Some("HTML")),
        ("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 9999999\r\n\r\n".into(), Some("2 MiB")),
    ];
    for (response, error) in cases {
        let (base, worker) = server(vec![response]);
        let result = fetch_entry(&client, &state, &base, "feat:alert", &token).await;
        match error {
            None => assert_eq!(result.unwrap().title, "Title feat:alert"),
            Some(text) => assert!(result.unwrap_err().contains(text)),
        }
        let seen = worker.join().unwrap();
        assert!(seen[0].starts_with("GET /feat:alert HTTP/1.1"));
        assert!(
            !seen[0].to_lowercase().contains("cookie:")
                && !seen[0].to_lowercase().contains("authorization:")
        );
    }
    let (base, worker) = server(vec![
        "HTTP/1.1 301 Moved\r\nLocation: /feat:alert-2\r\nContent-Length: 0\r\n\r\n".into(),
        html_response(&page_html("feat:alert-2")),
    ]);
    let e = fetch(&client, &state, &base, "feat:alert", &token)
        .await
        .unwrap();
    assert!(e.contains("Title feat:alert-2"));
    worker.join().unwrap();
    assert!(fetch(&client, &state, &base, "system:admin", &token)
        .await
        .is_err());
}
/// Manual QA on locally saved public pages (never committed):
/// CHRONEXUS_QA_WIKIDOT_DIR=<dir> cargo test real_saved_pages -- --ignored --nocapture
#[test]
#[ignore]
fn real_saved_pages_parse_without_invented_fields() {
    let dir = std::path::PathBuf::from(std::env::var("CHRONEXUS_QA_WIKIDOT_DIR").unwrap());
    let read = |name: &str| std::fs::read_to_string(dir.join(name)).unwrap();
    for (file, category, min) in [
        ("p_spells.html", "spells", 400),
        ("p_.html", "feats", 80),
        ("p_.html", "classes", 13),
        ("p_.html", "backgrounds", 40),
        ("p_lineage.html", "species", 40),
        ("p_wondrous-items.html", "items", 100),
    ] {
        let rows = parse::index(&read(file), category).unwrap();
        let ua = rows.iter().filter(|r| r.origin == "ua").count();
        println!(
            "{category}: {} rows, {ua} UA, first {:?}",
            rows.len(),
            rows[0]
        );
        assert!(rows.len() >= min, "{category}");
    }
    let spell = parse::entry(&read("p_spell_acid-splash.html"), "spell:acid-splash").unwrap();
    println!("{}", serde_json::to_string_pretty(&spell).unwrap());
    assert!(spell.missing.is_empty(), "{:?}", spell.missing);
    for (file, page) in [
        ("p_feat_alert.html", "feat:alert"),
        ("p_lineage_elf.html", "lineage:elf"),
        ("p_wizard.html", "wizard"),
    ] {
        let e = parse::entry(&read(file), page).unwrap();
        println!(
            "{page}: {} blocks, source {:?}, origin {}, truncated {}",
            e.blocks.len(),
            e.source,
            e.origin,
            e.truncated
        );
        assert!(serde_json::to_string(&e).unwrap().len() < LIMIT);
    }
}
#[tokio::test]
async fn requests_are_spaced_and_cancellable() {
    let state = State::with_interval(Duration::from_millis(300));
    let client = test_client();
    let token = state.token();
    let (base, worker) = server(vec![
        html_response(&page_html("feat:a")),
        html_response(&page_html("feat:b")),
    ]);
    let start = Instant::now();
    fetch_entry(&client, &state, &base, "feat:a", &token)
        .await
        .unwrap();
    fetch_entry(&client, &state, &base, "feat:b", &token)
        .await
        .unwrap();
    assert!(start.elapsed() >= Duration::from_millis(300));
    worker.join().unwrap();
    let epoch = state.epoch();
    state.invalidate();
    assert_ne!(state.epoch(), epoch);
    let result = fetch_entry(&client, &state, &base, "feat:c", &token).await;
    assert!(result.unwrap_err().contains("cancelled"));
    assert!(!state.token().is_cancelled());
}
