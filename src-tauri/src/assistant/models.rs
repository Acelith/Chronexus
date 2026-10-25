//! Compiled, qualified model policy shared with the frontend and developer tools.
//! Historical settings/answers are data; only live execution uses this allowlist.
use crate::journal::AppResult;
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSpec {
    pub name: String,
    pub weight_digest: String,
    pub gpu_layers: u32,
    pub batch: u32,
}
#[derive(Debug, Deserialize)]
pub struct Policy {
    pub primary: ModelSpec,
    pub secondary: ModelSpec,
}
pub fn policy() -> AppResult<&'static Policy> {
    static POLICY: OnceLock<AppResult<Policy>> = OnceLock::new();
    POLICY
        .get_or_init(|| {
            serde_json::from_str(include_str!("../../../src/ai-models.json"))
                .map_err(|_| "Catalogo dei modelli locali non valido.".into())
        })
        .as_ref()
        .map_err(Clone::clone)
}
pub fn base(name: &str) -> AppResult<&'static ModelSpec> {
    let p = policy()?;
    [&p.primary, &p.secondary]
        .into_iter()
        .find(|m| m.name == name)
        .ok_or_else(|| {
            "Modello non qualificato o ritirato. Scegli Qwen3.8-27B oppure Gemma 4 12B.".into()
        })
}
pub fn derived(name: &str) -> bool {
    name.starts_with("chronexus-12b-")
}
pub fn allowed(name: &str, weight: Option<&str>) -> bool {
    if derived(name) {
        return weight.is_some();
    }
    base(name).is_ok_and(|s| Some(s.weight_digest.as_str()) == weight)
}
pub fn verify(name: &str, weight: Option<&str>) -> AppResult<()> {
    if !allowed(name, weight) {
        return Err("Modello non qualificato o pesi cambiati. Controlla Qwen3.8-27B o scegli esplicitamente Gemma 4 12B.".into());
    }
    Ok(())
}
pub fn options(name: &str) -> AppResult<(u32, u32)> {
    if derived(name) {
        return Ok((99, 256));
    }
    let s = base(name)?;
    Ok((s.gpu_layers, s.batch))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_qualified_base_weights_are_usable_and_secondary_stays_explicit() {
        let p = policy().unwrap();
        assert_eq!(options(&p.primary.name).unwrap(), (48, 256));
        assert!(allowed(&p.primary.name, Some(&p.primary.weight_digest)));
        assert!(allowed(&p.secondary.name, Some(&p.secondary.weight_digest)));
        assert!(!allowed(&p.primary.name, Some(&p.secondary.weight_digest)));
        for name in [
            "qwen3:4b-instruct",
            "qwen3:4b",
            "qwen3.8:cloud",
            "some-local-model",
        ] {
            assert!(base(name).is_err());
            assert!(!allowed(name, Some(&p.primary.weight_digest)));
        }
    }

    #[test]
    fn migration_disables_retired_choices_preserving_history_and_gemma_through_backup() {
        use crate::{
            assistant::{campaign, store},
            backup, db, journal,
        };
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("profile");
        std::fs::create_dir(&root).unwrap();
        let c = rusqlite::Connection::open(root.join("nodex.sqlite3")).unwrap();
        for migration in db::MIGRATIONS.iter().take(17) {
            c.execute_batch(migration).unwrap();
        }
        let old = journal::create_campaign(&c, "Vecchio Qwen").unwrap();
        let gemma = journal::create_campaign(&c, "Gemma conservata").unwrap();
        let settings = store::Settings {
            enabled: true,
            model: "qwen3:4b-instruct".into(),
            digest: "a".repeat(64),
            specialization: "multilingual-rag".into(),
        };
        store::set_settings(&c, &settings).unwrap();
        let mut p = campaign::Profile {
            settings: settings.clone(),
            ..Default::default()
        };
        campaign::write(&c, &old.id, &p).unwrap();
        p.settings.model = policy().unwrap().secondary.name.clone();
        campaign::write(&c, &gemma.id, &p).unwrap();
        let turn = uuid::Uuid::new_v4().to_string();
        store::begin(
            &c,
            &old.id,
            &turn,
            "Domanda sintetica",
            "campaign",
            None,
            &settings,
            &[],
        )
        .unwrap();
        store::finish(
            &c,
            &old.id,
            &turn,
            "complete",
            "Risposta storica sintetica.",
            &serde_json::json!({}),
            "",
        )
        .unwrap();
        drop(c);
        let mut archive = backup::Store::open(&root).unwrap();
        assert!(!store::settings(&archive.connection).unwrap().enabled);
        let retired = campaign::get(&archive.connection, &old.id).unwrap();
        assert!(!retired.settings.enabled);
        assert_eq!(retired.settings.model, settings.model);
        assert_eq!(retired.settings.digest, settings.digest);
        assert!(
            campaign::get(&archive.connection, &gemma.id)
                .unwrap()
                .settings
                .enabled
        );
        let file = dir.path().join("m18.nodex");
        backup::write_backup(&archive.connection, &archive.directory, &file).unwrap();
        let preview = archive.prepare(&file).unwrap();
        archive.restore(&preview.token).unwrap();
        let history = store::history(&archive.connection, &old.id, 0).unwrap();
        assert_eq!(history[0].model, settings.model);
        assert_eq!(history[0].answer, "Risposta storica sintetica.");
        assert!(
            !campaign::get(&archive.connection, &old.id)
                .unwrap()
                .settings
                .enabled
        );
    }
}
