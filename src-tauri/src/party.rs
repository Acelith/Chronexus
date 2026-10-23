use crate::{
    journal::{self, require_campaign, storage, AppResult},
    knowledge,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MemberInput {
    pub page_id: Option<String>,
    pub name: String,
    pub player_name: String,
    pub role: String,
    pub status: String,
    pub revision: Option<i64>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    pub page: knowledge::Page,
    pub player_name: String,
    pub role: String,
    pub status: String,
    pub revision: i64,
}
fn validate(player: &str, role: &str, status: &str) -> AppResult<()> {
    if player.chars().count() > 200
        || role.chars().count() > 500
        || player.contains('\0')
        || role.contains('\0')
        || !["active", "former", "unknown"].contains(&status)
    {
        return Err("Giocatore, ruolo o stato del membro non valido.".into());
    }
    Ok(())
}
pub fn list(c: &Connection, campaign: &str) -> AppResult<Vec<Member>> {
    require_campaign(c, campaign)?;
    let mut q=c.prepare("SELECT page_id,player_name,role,status,revision FROM party_members WHERE campaign_id=?1 ORDER BY rowid").map_err(storage)?;
    let rows = q
        .query_map([campaign], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
            ))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    rows.into_iter()
        .map(|(id, player_name, role, status, revision)| {
            validate(&player_name, &role, &status)?;
            if revision < 0 {
                return Err("Revisione del membro non valida.".into());
            }
            Ok(Member {
                page: knowledge::get_page(c, campaign, &id)?,
                player_name,
                role,
                status,
                revision,
            })
        })
        .collect()
}
pub fn save(c: &Connection, campaign: &str, input: &MemberInput) -> AppResult<Member> {
    require_campaign(c, campaign)?;
    validate(&input.player_name, &input.role, &input.status)?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    let page = if let Some(id) = &input.page_id {
        journal::identifier(id)?;
        knowledge::get_page(&tx, campaign, id)?
    } else {
        if input.revision.is_some() {
            return Err("Un nuovo membro non ha revisione.".into());
        }
        knowledge::create_page_in_transaction(&tx, campaign, &input.name, "npc", "active", &[])?
    };
    if input.revision.is_none() && page.kind != "npc" {
        return Err("Scegli una pagina di tipo Personaggio.".into());
    }
    if let Some(revision) = input.revision {
        if revision<0 || tx.execute("UPDATE party_members SET player_name=?1,role=?2,status=?3,revision=revision+1 WHERE campaign_id=?4 AND page_id=?5 AND revision=?6",params![input.player_name,input.role,input.status,campaign,page.id,revision]).map_err(storage)?!=1 {return Err("Il membro è stato modificato: ricarica il party prima di salvare.".into())}
    } else {
        tx.execute("INSERT INTO party_members(campaign_id,page_id,player_name,role,status) VALUES(?1,?2,?3,?4,?5)",params![campaign,page.id,input.player_name,input.role,input.status]).map_err(|_|"Personaggio già presente nel party o salvataggio non riuscito.".to_string())?;
    }
    tx.commit().map_err(storage)?;
    list(c, campaign)?
        .into_iter()
        .find(|m| m.page.id == page.id)
        .ok_or("Membro salvato non disponibile.".into())
}
pub fn remove(c: &Connection, campaign: &str, id: &str, revision: i64) -> AppResult<()> {
    require_campaign(c, campaign)?;
    journal::identifier(id)?;
    if c.execute(
        "DELETE FROM party_members WHERE campaign_id=?1 AND page_id=?2 AND revision=?3",
        params![campaign, id, revision],
    )
    .map_err(storage)?
        != 1
    {
        return Err("Il membro è cambiato: ricarica il party.".into());
    }
    Ok(())
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    for campaign in journal::list_campaigns(c)? {
        list(c, &campaign.id)?;
    }
    Ok(())
}
