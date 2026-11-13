use std::env;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::process::Command;

fn response(status: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

fn handle(mut stream: TcpStream, simulator: &str) {
    let mut buffer = [0_u8; 4096];
    let Ok(size) = stream.read(&mut buffer) else { return };
    let request = String::from_utf8_lossy(&buffer[..size]);
    let Some(request_line) = request.lines().next() else { return };
    let path = request_line.split_whitespace().nth(1).unwrap_or("/");

    let result = if path == "/health" {
        response("200 OK", r#"{"status":"ok"}"#)
    } else if path.starts_with("/api/v1/simulate") {
        match Command::new(simulator).args(["60", "120", "0"]).output() {
            Ok(output) if output.status.success() => response(
                "200 OK",
                &String::from_utf8_lossy(&output.stdout),
            ),
            Ok(output) => response(
                "502 Bad Gateway",
                &format!(r#"{{"error":"simulator exited with {}"}}"#, output.status),
            ),
            Err(error) => response(
                "503 Service Unavailable",
                &format!(r#"{{"error":"unable to start simulator: {error}"}}"#),
            ),
        }
    } else {
        response("404 Not Found", r#"{"error":"not found"}"#)
    };
    let _ = stream.write_all(result.as_bytes());
}

fn main() -> std::io::Result<()> {
    let address = env::var("AIRSPACE_API_ADDR").unwrap_or_else(|_| "127.0.0.1:8080".into());
    let simulator = env::var("AIRSPACE_SIMULATOR").unwrap_or_else(|_| "simulator-cli".into());
    let listener = TcpListener::bind(&address)?;
    eprintln!("airspace-api listening on http://{address}");
    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            handle(stream, &simulator);
        }
    }
    Ok(())
}
