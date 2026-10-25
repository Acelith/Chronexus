//! Explicitly enabled access for external assistants, separate from campaign AI.
mod domain;
#[cfg(test)]
mod tests;
mod transport;
use crate::journal::AppResult;
use serde_json::{json, Value};
pub use transport::{Config, Server};

#[derive(Clone, Debug)]
pub struct Policy {
    pub campaign: Option<String>,
    pub write: bool,
}
impl Policy {
    fn authorize(&self, campaign: &str, writing: bool) -> AppResult<()> {
        crate::journal::identifier(campaign)?;
        if self.campaign.as_ref().is_some_and(|id| id != campaign) {
            return Err("Campaign not authorized for this bridge.".into());
        }
        if writing && (!self.write || self.campaign.as_deref() != Some(campaign)) {
            return Err("Read-only bridge: write not authorized.".into());
        }
        Ok(())
    }
}
pub fn tools(policy: &Policy) -> AppResult<Value> {
    let values: Vec<Value> = serde_json::from_str(include_str!("tools.json"))
        .map_err(|_| "Tool catalog not available.".to_string())?;
    Ok(
        json!({"tools":values.into_iter().filter(|tool| policy.write || tool["annotations"]["readOnlyHint"]==true).collect::<Vec<_>>()}),
    )
}
