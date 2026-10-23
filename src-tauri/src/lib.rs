mod db;
use std::sync::Mutex;
use tauri::Manager;

struct Database(Mutex<rusqlite::Connection>);

#[tauri::command]
fn database_status(db: tauri::State<Database>) -> Result<String, String> {
    let connection =
        db.0.lock()
            .map_err(|_| "Archivio occupato. Riavvia Nodex.")?;
    connection
        .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|_| "Impossibile leggere l'archivio locale.".to_string())?;
    Ok("Archivio locale pronto".into())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let connection = db::open(&directory.join("nodex.sqlite3"))?;
            app.manage(Database(Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![database_status])
        .run(tauri::generate_context!())
        .expect("Impossibile avviare Nodex: verifica i permessi della cartella dati.");
}
