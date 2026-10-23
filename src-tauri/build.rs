fn main() {
    // Deterministic application icon; generated output is never committed.
    let size = 32u32;
    let pixels = size * size * 4;
    let mask = size * 4;
    let mut icon = vec![0, 0, 1, 0, 1, 0, 32, 32, 0, 0, 1, 0, 32, 0];
    icon.extend_from_slice(&(40 + pixels + mask).to_le_bytes());
    icon.extend_from_slice(&22u32.to_le_bytes());
    for value in [40u32, size, size * 2] {
        icon.extend_from_slice(&value.to_le_bytes());
    }
    icon.extend_from_slice(&[1, 0, 32, 0]);
    for value in [0u32, pixels, 0, 0, 0, 0] {
        icon.extend_from_slice(&value.to_le_bytes());
    }
    for y in 0..size {
        for x in 0..size {
            let mark = (8..24).contains(&y) && (x == 8 || x == 23 || x == 31 - y);
            icon.extend_from_slice(if mark {
                &[120, 185, 215, 255]
            } else {
                &[35, 22, 16, 255]
            });
        }
    }
    icon.resize(icon.len() + mask as usize, 0);
    std::fs::create_dir_all("icons").expect("Creazione cartella icona");
    std::fs::write("icons/icon.ico", icon).expect("Generazione icona");
    tauri_build::build()
}
