//! Tauri commands, grouped by domain. Commands that touch the archive are
//! `async` and use `Database::run`, so the main thread never waits on the Store.
pub mod ai;
pub mod archive;
pub mod campaign;
pub mod knowledge;
pub mod player;
pub mod settings;
pub mod sync;
pub mod wiki;
