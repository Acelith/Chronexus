//! Turns untrusted Wikidot HTML into inert text. Scripts, frames, forms and
//! media are dropped; links become plain labels; nothing from the page is run.
use super::{category_of, Block, Entry, IndexRow, SpellFields, EDITION};
use crate::journal::AppResult;
use scraper::{ElementRef, Html, Node, Selector};

const SKIP: &[&str] = &[
    "script", "style", "iframe", "frame", "frameset", "form", "noscript", "object", "embed",
    "button", "input", "select", "textarea", "svg", "math", "img", "picture", "video", "audio",
    "canvas", "template", "link", "meta", "head", "title",
];
const MAX_DEPTH: usize = 48;
const MAX_BLOCKS: usize = 2000;
const MAX_TEXT: usize = 20_000;
const MAX_ROWS: usize = 3000;
pub const LICENSE_FALLBACK: &str = "License not stated on the page.";

fn selector(s: &str) -> Selector {
    Selector::parse(s).expect("static selector")
}
fn skipped(e: &scraper::node::Element) -> bool {
    SKIP.contains(&e.name())
        || e.id()
            .is_some_and(|id| id == "toc" || id.starts_with("wad-"))
        || e.classes().any(|c| {
            c == "yui-nav" || c == "wd-adunit" || c == "content-separator" || c == "page-tags"
        })
}
/// Whitespace is collapsed per line; non-breaking spaces count as spaces.
pub fn clean(s: &str) -> String {
    s.lines()
        .map(|l| l.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|l| !l.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}
fn bounded(mut s: String, truncated: &mut bool) -> String {
    if s.chars().count() > MAX_TEXT {
        s = s.chars().take(MAX_TEXT).collect();
        *truncated = true;
    }
    s
}
fn inline(el: ElementRef, out: &mut String, depth: usize) {
    if depth > MAX_DEPTH {
        return;
    }
    for child in el.children() {
        match child.value() {
            Node::Text(t) => out.push_str(t),
            Node::Element(e) if !skipped(e) => {
                let name = e.name();
                if name == "br" {
                    out.push('\n');
                    continue;
                }
                let block = matches!(
                    name,
                    "p" | "div" | "li" | "tr" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "table"
                );
                if block {
                    out.push('\n');
                }
                if let Some(c) = ElementRef::wrap(child) {
                    inline(c, out, depth + 1);
                }
                if block {
                    out.push('\n');
                }
            }
            _ => {}
        }
    }
}
fn text_of(el: ElementRef) -> String {
    let mut s = String::new();
    inline(el, &mut s, 0);
    clean(&s)
}
struct Walker {
    blocks: Vec<Block>,
    pending: String,
    truncated: bool,
}
impl Walker {
    fn push(&mut self, block: Block) {
        if self.blocks.len() >= MAX_BLOCKS {
            self.truncated = true;
        } else {
            self.blocks.push(block);
        }
    }
    fn flush(&mut self) {
        let text = clean(&std::mem::take(&mut self.pending));
        if !text.is_empty() {
            let text = bounded(text, &mut self.truncated);
            self.push(Block::Paragraph { text });
        }
    }
    fn walk(&mut self, el: ElementRef, depth: usize) {
        if depth > MAX_DEPTH {
            self.truncated = true;
            return;
        }
        for child in el.children() {
            match child.value() {
                Node::Text(t) => self.pending.push_str(t),
                Node::Element(e) if !skipped(e) => {
                    let Some(c) = ElementRef::wrap(child) else {
                        continue;
                    };
                    match e.name() {
                        "br" => self.pending.push('\n'),
                        "p" | "pre" | "dd" | "dt" => {
                            self.flush();
                            let text = bounded(text_of(c), &mut self.truncated);
                            if !text.is_empty() {
                                self.push(Block::Paragraph { text });
                            }
                        }
                        h @ ("h1" | "h2" | "h3" | "h4" | "h5" | "h6") => {
                            self.flush();
                            let text = bounded(text_of(c), &mut self.truncated);
                            if !text.is_empty() {
                                let level = h[1..].parse().unwrap_or(6);
                                self.push(Block::Heading { level, text });
                            }
                        }
                        "ul" | "ol" => {
                            self.flush();
                            let items: Vec<String> = c
                                .children()
                                .filter_map(ElementRef::wrap)
                                .filter(|li| li.value().name() == "li")
                                .map(|li| bounded(text_of(li), &mut self.truncated))
                                .filter(|t| !t.is_empty())
                                .take(500)
                                .collect();
                            if !items.is_empty() {
                                self.push(Block::List { items });
                            }
                        }
                        "table" => {
                            self.flush();
                            let rows = table_rows(c, &mut self.truncated);
                            if !rows.is_empty() {
                                self.push(Block::Table { rows });
                            }
                        }
                        "hr" => self.flush(),
                        "div" | "section" | "article" | "blockquote" | "center" | "dl" | "main"
                        | "aside" | "header" | "footer" | "details" | "summary" | "figure"
                        | "figcaption" => {
                            self.flush();
                            self.walk(c, depth + 1);
                            self.flush();
                        }
                        _ => inline(c, &mut self.pending, depth + 1),
                    }
                }
                _ => {}
            }
        }
    }
}
fn table_rows(table: ElementRef, truncated: &mut bool) -> Vec<Vec<String>> {
    let rows = selector("tr");
    let cells = selector("th, td");
    let mut out = vec![];
    for row in table.select(&rows) {
        if out.len() >= 300 {
            *truncated = true;
            break;
        }
        let r: Vec<String> = row
            .select(&cells)
            .take(16)
            .map(|c| {
                let mut t = text_of(c).replace('\n', " ");
                if t.chars().count() > 2000 {
                    t = t.chars().take(2000).collect();
                    *truncated = true;
                }
                t
            })
            .collect();
        if r.iter().any(|c| !c.is_empty()) {
            out.push(r);
        }
    }
    out
}
fn content(doc: &Html) -> AppResult<ElementRef<'_>> {
    doc.select(&selector("#page-content"))
        .next()
        .ok_or_else(|| "Unrecognized Wikidot page structure: content missing.".into())
}
fn license(doc: &Html) -> String {
    doc.select(&selector(".license-area"))
        .next()
        .map(|e| text_of(e).replace('\n', " "))
        .filter(|t| !t.is_empty() && t.chars().count() <= 400)
        .unwrap_or_else(|| LICENSE_FALLBACK.into())
}
/// Accepts site-relative or absolute links to the same wiki; returns a page name.
pub fn page_from_href(href: &str) -> Option<String> {
    let rest = ["https://dnd5e.wikidot.com", "http://dnd5e.wikidot.com"]
        .iter()
        .find_map(|p| href.strip_prefix(p))
        .unwrap_or(href);
    let rest = rest.strip_prefix('/')?;
    let rest = rest.split(['#', '?']).next()?;
    category_of(rest).map(|_| rest.to_string())
}
pub fn origin(source: Option<&str>, title: &str, page: &str, group: &str) -> &'static str {
    let haystack = format!("{} {} {}", source.unwrap_or(""), title, group).to_lowercase();
    if haystack.contains("unearthed arcana") || title.contains("(UA)") || page.ends_with("-ua") {
        "ua"
    } else if haystack.contains("homebrew") || title.contains("(HB)") {
        "homebrew"
    } else if source.is_some() || group.contains("Published") {
        "published"
    } else {
        "unspecified"
    }
}
pub fn index(html: &str, category: &str) -> AppResult<Vec<IndexRow>> {
    let doc = Html::parse_document(html);
    let root = content(&doc)?;
    let navsets: Vec<(ElementRef, Vec<String>)> = root
        .select(&selector("div.yui-navset"))
        .map(|n| {
            let labels = n
                .select(&selector("ul.yui-nav li"))
                .map(text_of)
                .collect::<Vec<_>>();
            (n, labels)
        })
        .collect();
    let mut headings: [String; 6] = Default::default();
    let mut rows: Vec<IndexRow> = vec![];
    for node in root.descendants() {
        let Some(el) = ElementRef::wrap(node) else {
            continue;
        };
        let name = el.value().name();
        if el
            .ancestors()
            .filter_map(ElementRef::wrap)
            .any(|a| skipped(a.value()))
        {
            continue;
        }
        if let Some(level) = name
            .strip_prefix('h')
            .and_then(|n| n.parse::<usize>().ok())
            .filter(|n| (1..=6).contains(n))
        {
            headings[level - 1] = text_of(el).replace('\n', " ");
            for h in headings.iter_mut().skip(level) {
                h.clear();
            }
            continue;
        }
        if name != "a" {
            continue;
        }
        let Some(page) = el.value().attr("href").and_then(page_from_href) else {
            continue;
        };
        if category_of(&page) != Some(category) || rows.iter().any(|r| r.page == page) {
            continue;
        }
        let title = text_of(el).replace('\n', " ");
        if title.is_empty() || title.chars().count() > 200 {
            continue;
        }
        let tab = el.ancestors().filter_map(ElementRef::wrap).find_map(|a| {
            let index: usize = a
                .value()
                .id()?
                .strip_prefix("wiki-tab-")?
                .rsplit('-')
                .next()?
                .parse()
                .ok()?;
            let (_, labels) = navsets
                .iter()
                .find(|(n, _)| a.ancestors().any(|x| x.id() == n.id()))?;
            labels.get(index).cloned()
        });
        let mut group: Vec<String> = headings.iter().filter(|h| !h.is_empty()).cloned().collect();
        group.extend(tab);
        let mut group = group.join(" › ");
        if group.chars().count() > 200 {
            group = group.chars().take(200).collect();
        }
        let details = el
            .ancestors()
            .filter_map(ElementRef::wrap)
            .find(|a| a.value().name() == "tr")
            .map(|tr| {
                // Cells naming other entries of the same list are neighbours, not details.
                tr.select(&selector("td"))
                    .filter(|td| {
                        !td.select(&selector("a[href]")).any(|a| {
                            a.value()
                                .attr("href")
                                .and_then(page_from_href)
                                .is_some_and(|p| category_of(&p) == Some(category))
                        })
                    })
                    .map(|td| text_of(td).replace('\n', " "))
                    .filter(|t| !t.is_empty())
                    .map(|t| t.chars().take(200).collect())
                    .take(8)
                    .collect()
            })
            .unwrap_or_default();
        let origin = origin(None, &title, &page, &group).into();
        rows.push(IndexRow {
            page,
            name: title,
            group,
            details,
            origin,
        });
        if rows.len() >= MAX_ROWS {
            break;
        }
    }
    if rows.is_empty() {
        return Err("The Wikidot index contains no recognizable entries for this category.".into());
    }
    Ok(rows)
}
pub fn entry(html: &str, page: &str) -> AppResult<Entry> {
    let category = category_of(page).ok_or("Wikidot page not allowed.")?;
    let doc = Html::parse_document(html);
    let title = doc
        .select(&selector(".page-title"))
        .next()
        .map(|t| text_of(t).replace('\n', " "))
        .filter(|t| !t.is_empty() && t.chars().count() <= 200)
        .ok_or("Unrecognized Wikidot page structure: title missing.")?;
    let root = content(&doc)?;
    let mut walker = Walker {
        blocks: vec![],
        pending: String::new(),
        truncated: false,
    };
    walker.walk(root, 0);
    walker.flush();
    if walker.blocks.is_empty() {
        return Err("The Wikidot page contains no text that can be interpreted.".into());
    }
    let source = walker.blocks.iter().find_map(|b| match b {
        Block::Paragraph { text } => text
            .strip_prefix("Source:")
            .map(|s| s.trim().chars().take(200).collect::<String>())
            .filter(|s| !s.is_empty()),
        _ => None,
    });
    let spell = (category == "spells").then(|| spell(&walker.blocks));
    let missing = spell.as_ref().map(missing).unwrap_or_default();
    let origin = origin(source.as_deref(), &title, page, "").into();
    Ok(Entry {
        page: page.into(),
        url: format!("https://dnd5e.wikidot.com/{page}"),
        category: category.into(),
        title,
        source,
        origin,
        edition: EDITION.into(),
        license: license(&doc),
        blocks: walker.blocks,
        spell,
        missing,
        truncated: walker.truncated,
    })
}
fn ordinal_level(word: &str) -> Option<u8> {
    let digits: String = word.chars().take_while(char::is_ascii_digit).collect();
    let rest = &word[digits.len()..];
    let n: u8 = digits.parse().ok()?;
    (["st-level", "nd-level", "rd-level", "th-level"].contains(&rest) && (1..=9).contains(&n))
        .then_some(n)
}
fn block_text(b: &Block) -> String {
    match b {
        Block::Paragraph { text } | Block::Heading { text, .. } => text.clone(),
        Block::List { items } => items
            .iter()
            .map(|i| format!("• {i}"))
            .collect::<Vec<_>>()
            .join("\n"),
        Block::Table { rows } => rows
            .iter()
            .map(|r| r.join(" | "))
            .collect::<Vec<_>>()
            .join("\n"),
    }
}
pub fn spell(blocks: &[Block]) -> SpellFields {
    let mut s = SpellFields::default();
    let mut description = vec![];
    for b in blocks {
        let text = block_text(b);
        let lower = text.to_lowercase();
        if let Block::Paragraph { .. } = b {
            if text.starts_with("Source:") {
                continue;
            }
            if s.level.is_none() && text.lines().count() == 1 && text.chars().count() <= 120 {
                let words: Vec<&str> = lower.split_whitespace().collect();
                if words.get(1).is_some_and(|w| w.starts_with("cantrip")) {
                    s.level = Some("0".into());
                    s.school = Some(capitalize(words[0]));
                } else if let (Some(level), Some(school)) =
                    (words.first().and_then(|w| ordinal_level(w)), words.get(1))
                {
                    s.level = Some(level.to_string());
                    s.school = Some(capitalize(
                        school.trim_matches(|c: char| !c.is_alphabetic()),
                    ));
                }
                if s.level.is_some() {
                    s.level_line = Some(text.clone());
                    s.ritual = lower.contains("(ritual");
                    continue;
                }
            }
            if lower.contains("casting time:") {
                for line in text.lines() {
                    if let Some((label, value)) = line.split_once(':') {
                        let value = Some(value.trim().chars().take(200).collect::<String>())
                            .filter(|v| !v.is_empty());
                        match label.trim().to_lowercase().as_str() {
                            "casting time" => s.casting_time = value,
                            "range" => s.range = value,
                            "components" => s.components = value,
                            "duration" => s.duration = value,
                            _ => description.push(line.to_string()),
                        }
                    }
                }
                continue;
            }
            if let Some(rest) = text.strip_prefix("At Higher Levels.") {
                s.higher_levels = Some(rest.trim().into());
                continue;
            }
            if let Some(rest) = text.strip_prefix("Spell Lists.") {
                s.classes = Some(rest.trim().chars().take(400).collect());
                continue;
            }
        }
        description.push(text);
    }
    s.concentration = s
        .duration
        .as_deref()
        .is_some_and(|d| d.to_lowercase().starts_with("concentration"));
    s.ritual = s.ritual
        || s.casting_time
            .as_deref()
            .is_some_and(|c| c.to_lowercase().contains("ritual"));
    let description = description.join("\n\n");
    s.description = Some(description).filter(|d| !d.trim().is_empty());
    s
}
fn capitalize(s: &str) -> String {
    let mut c = s.chars();
    c.next()
        .map(|f| f.to_uppercase().collect::<String>() + c.as_str())
        .unwrap_or_default()
}
fn missing(s: &SpellFields) -> Vec<String> {
    [
        ("level", s.level.is_none()),
        ("school", s.school.is_none()),
        ("castingTime", s.casting_time.is_none()),
        ("range", s.range.is_none()),
        ("components", s.components.is_none()),
        ("duration", s.duration.is_none()),
        ("description", s.description.is_none()),
    ]
    .into_iter()
    .filter(|(_, m)| *m)
    .map(|(k, _)| k.to_string())
    .collect()
}
