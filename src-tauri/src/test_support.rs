//! Loopback fakes shared by network tests. Never used by the app itself.
use std::{
    io::{Read, Write},
    net::TcpListener,
    thread::JoinHandle,
    time::Duration,
};

/// Serves canned raw HTTP responses in order, one connection each, at
/// `http://127.0.0.1:<port>`. The handle yields every request as its header
/// block followed by the body (read up to Content-Length).
pub fn serve(responses: Vec<Vec<u8>>) -> (String, JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        let mut seen = vec![];
        for response in responses {
            let Ok((mut stream, _)) = listener.accept() else {
                break;
            };
            stream
                .set_read_timeout(Some(Duration::from_secs(15)))
                .unwrap();
            let mut head = vec![];
            let mut byte = [0];
            while !head.ends_with(b"\r\n\r\n") && stream.read_exact(&mut byte).is_ok() {
                head.push(byte[0]);
            }
            let head = String::from_utf8_lossy(&head).to_string();
            let length = head
                .lines()
                .find_map(|line| {
                    line.to_lowercase()
                        .strip_prefix("content-length:")
                        .map(|v| v.trim().parse::<usize>().unwrap_or(0))
                })
                .unwrap_or(0);
            let mut body = vec![0; length];
            let _ = stream.read_exact(&mut body);
            seen.push(format!("{head}{}", String::from_utf8_lossy(&body)));
            let _ = stream.write_all(&response);
        }
        seen
    });
    (base, worker)
}

/// Same as [`serve`] for text responses.
pub fn serve_text(responses: Vec<String>) -> (String, JoinHandle<Vec<String>>) {
    serve(responses.into_iter().map(String::into_bytes).collect())
}

/// A loopback address where nothing listens.
pub fn closed_port() -> String {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    drop(listener);
    base
}
