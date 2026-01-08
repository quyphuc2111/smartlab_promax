use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream, UdpSocket};
use std::sync::Arc;
use std::time::Duration;
use surge_ping::{Client, Config, PingIdentifier, PingSequence};
use tokio::sync::Mutex;
use rusqlite::{Connection, Result as SqliteResult};
use once_cell::sync::Lazy;
use std::sync::Mutex as StdMutex;
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::Deserialize;
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use tauri::Manager;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;
use futures_util::{StreamExt, SinkExt};

// Constants for UDP Discovery
const DISCOVERY_PORT: u16 = 5959;
const DISCOVERY_MAGIC: &[u8] = b"SMARTLAB_SERVER";
const BROADCAST_INTERVAL_MS: u64 = 2000;
const REMOTE_CONTROL_PORT: u16 = 5960;

// App mode
static APP_MODE: Lazy<StdMutex<AppMode>> = Lazy::new(|| StdMutex::new(AppMode::Client));
static UDP_BROADCASTER: AtomicBool = AtomicBool::new(false);
static REMOTE_SERVER_RUNNING: AtomicBool = AtomicBool::new(false);
static REMOTE_SERVER_PORT: AtomicU16 = AtomicU16::new(REMOTE_CONTROL_PORT);

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AppMode {
    Teacher,  // Server mode - runs backend, broadcasts presence
    Client,   // Student mode - discovers server
}

// Backend process management
static BACKEND_PROCESS: Lazy<StdMutex<Option<Child>>> = Lazy::new(|| StdMutex::new(None));
static BACKEND_RUNNING: AtomicBool = AtomicBool::new(false);

// Database connection
static DB: Lazy<StdMutex<Connection>> = Lazy::new(|| {
    let conn = Connection::open("app_data.db").expect("Failed to open database");
    init_db(&conn).expect("Failed to initialize database");
    StdMutex::new(conn)
});

fn init_db(conn: &Connection) -> SqliteResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    Ok(())
}

#[derive(Debug, Clone, Serialize)]
pub struct User {
    pub id: i64,
    pub username: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AuthResult {
    pub success: bool,
    pub message: String,
    pub user: Option<User>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[tauri::command]
fn register(username: String, password: String) -> Result<AuthResult, String> {
    if username.len() < 3 {
        return Ok(AuthResult {
            success: false,
            message: "Username must be at least 3 characters".to_string(),
            user: None,
        });
    }
    
    if password.len() < 6 {
        return Ok(AuthResult {
            success: false,
            message: "Password must be at least 6 characters".to_string(),
            user: None,
        });
    }

    let password_hash = hash(&password, DEFAULT_COST)
        .map_err(|e| format!("Failed to hash password: {}", e))?;

    let conn = DB.lock().map_err(|e| e.to_string())?;
    
    match conn.execute(
        "INSERT INTO users (username, password_hash) VALUES (?1, ?2)",
        [&username, &password_hash],
    ) {
        Ok(_) => {
            let user_id = conn.last_insert_rowid();
            Ok(AuthResult {
                success: true,
                message: "Registration successful".to_string(),
                user: Some(User { id: user_id, username }),
            })
        }
        Err(e) => {
            if e.to_string().contains("UNIQUE constraint failed") {
                Ok(AuthResult {
                    success: false,
                    message: "Username already exists".to_string(),
                    user: None,
                })
            } else {
                Err(format!("Database error: {}", e))
            }
        }
    }
}

#[tauri::command]
fn login(username: String, password: String) -> Result<AuthResult, String> {
    let conn = DB.lock().map_err(|e| e.to_string())?;
    
    let result: Result<(i64, String), _> = conn.query_row(
        "SELECT id, password_hash FROM users WHERE username = ?1",
        [&username],
        |row| Ok((row.get(0)?, row.get(1)?)),
    );

    match result {
        Ok((id, password_hash)) => {
            match verify(&password, &password_hash) {
                Ok(true) => Ok(AuthResult {
                    success: true,
                    message: "Login successful".to_string(),
                    user: Some(User { id, username }),
                }),
                Ok(false) => Ok(AuthResult {
                    success: false,
                    message: "Invalid password".to_string(),
                    user: None,
                }),
                Err(e) => Err(format!("Password verification error: {}", e)),
            }
        }
        Err(_) => Ok(AuthResult {
            success: false,
            message: "User not found".to_string(),
            user: None,
        }),
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct HostInfo {
    pub ip: String,
    pub is_alive: bool,
    pub hostname: Option<String>,
}

fn get_local_ip() -> Option<Ipv4Addr> {
    if let Ok(ip) = local_ip_address::local_ip() {
        if let IpAddr::V4(ipv4) = ip {
            return Some(ipv4);
        }
    }
    None
}

fn get_network_range(local_ip: Ipv4Addr) -> Vec<Ipv4Addr> {
    let octets = local_ip.octets();
    let mut ips = Vec::new();
    
    // Scan /24 subnet (common for home/office networks)
    for i in 1..255 {
        ips.push(Ipv4Addr::new(octets[0], octets[1], octets[2], i));
    }
    ips
}

fn check_host_alive(ip: Ipv4Addr) -> bool {
    // Try common ports to check if host is alive
    let ports = [80, 443, 22, 445, 139, 3389, 8080];
    
    for port in ports {
        let socket = SocketAddr::new(IpAddr::V4(ip), port);
        if TcpStream::connect_timeout(&socket, Duration::from_millis(100)).is_ok() {
            return true;
        }
    }
    false
}

#[tauri::command]
fn get_local_ip_address() -> Result<String, String> {
    get_local_ip()
        .map(|ip| ip.to_string())
        .ok_or_else(|| "Could not determine local IP".to_string())
}

#[tauri::command]
async fn scan_network() -> Result<Vec<HostInfo>, String> {
    let local_ip = get_local_ip().ok_or("Could not determine local IP")?;
    let ips = get_network_range(local_ip);
    
    let results: Arc<Mutex<Vec<HostInfo>>> = Arc::new(Mutex::new(Vec::new()));
    let mut handles = Vec::new();
    
    // Process IPs in chunks to avoid too many concurrent connections
    for chunk in ips.chunks(50) {
        let chunk_ips: Vec<Ipv4Addr> = chunk.to_vec();
        let results_clone = Arc::clone(&results);
        
        let handle = tokio::spawn(async move {
            let mut chunk_results = Vec::new();
            for ip in chunk_ips {
                let is_alive = check_host_alive(ip);
                if is_alive {
                    chunk_results.push(HostInfo {
                        ip: ip.to_string(),
                        is_alive,
                        hostname: None,
                    });
                }
            }
            let mut results = results_clone.lock().await;
            results.extend(chunk_results);
        });
        handles.push(handle);
    }
    
    for handle in handles {
        let _ = handle.await;
    }
    
    let final_results = results.lock().await;
    Ok(final_results.clone())
}

#[derive(Debug, Clone, Serialize)]
pub struct PingResult {
    pub ip: String,
    pub success: bool,
    pub latency_ms: Option<f64>,
    pub error: Option<String>,
}

#[tauri::command]
async fn ping_host(ip: String) -> Result<PingResult, String> {
    let addr: Ipv4Addr = ip.parse().map_err(|_| "Invalid IP address")?;
    
    // Try ICMP ping first
    let icmp_result = icmp_ping(addr).await;
    if icmp_result.success {
        return Ok(icmp_result);
    }
    
    // Fallback to TCP ping if ICMP fails (no root permission)
    Ok(tcp_ping(addr))
}

async fn icmp_ping(addr: Ipv4Addr) -> PingResult {
    let ip = addr.to_string();
    
    let client = match Client::new(&Config::default()) {
        Ok(c) => c,
        Err(e) => return PingResult {
            ip,
            success: false,
            latency_ms: None,
            error: Some(format!("ICMP not available: {}", e)),
        },
    };
    
    let mut pinger = client
        .pinger(IpAddr::V4(addr), PingIdentifier(rand::random()))
        .await;
    
    pinger.timeout(Duration::from_secs(2));
    
    match pinger.ping(PingSequence(0), &[0; 32]).await {
        Ok((_, duration)) => PingResult {
            ip,
            success: true,
            latency_ms: Some(duration.as_secs_f64() * 1000.0),
            error: None,
        },
        Err(e) => PingResult {
            ip,
            success: false,
            latency_ms: None,
            error: Some(e.to_string()),
        },
    }
}

fn tcp_ping(addr: Ipv4Addr) -> PingResult {
    let ip = addr.to_string();
    let ports = [80, 443, 22, 445, 139, 3389, 8080, 53];
    
    for port in ports {
        let socket = SocketAddr::new(IpAddr::V4(addr), port);
        let start = std::time::Instant::now();
        
        if TcpStream::connect_timeout(&socket, Duration::from_millis(500)).is_ok() {
            let latency = start.elapsed().as_secs_f64() * 1000.0;
            return PingResult {
                ip,
                success: true,
                latency_ms: Some(latency),
                error: None,
            };
        }
    }
    
    PingResult {
        ip,
        success: false,
        latency_ms: None,
        error: Some("No open ports found".to_string()),
    }
}

// ==================== REMOTE CONTROL COMMANDS ====================

#[derive(Debug, Clone, Serialize)]
pub struct RemoteCommandResult {
    pub success: bool,
    pub message: String,
    pub ip: String,
}

/// Wake-on-LAN - Bật máy từ xa bằng MAC address
#[tauri::command]
async fn wake_on_lan(mac_address: String, broadcast_ip: Option<String>) -> Result<RemoteCommandResult, String> {
    use std::net::UdpSocket;
    
    // Parse MAC address
    let mac_bytes: Vec<u8> = mac_address
        .split(|c| c == ':' || c == '-')
        .filter_map(|s| u8::from_str_radix(s, 16).ok())
        .collect();
    
    if mac_bytes.len() != 6 {
        return Ok(RemoteCommandResult {
            success: false,
            message: "Invalid MAC address format".to_string(),
            ip: String::new(),
        });
    }
    
    // Build magic packet: 6 bytes of 0xFF followed by MAC address repeated 16 times
    let mut magic_packet = vec![0xFFu8; 6];
    for _ in 0..16 {
        magic_packet.extend_from_slice(&mac_bytes);
    }
    
    let broadcast = broadcast_ip.unwrap_or_else(|| "255.255.255.255".to_string());
    
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.set_broadcast(true).map_err(|e| e.to_string())?;
    
    match socket.send_to(&magic_packet, format!("{}:9", broadcast)) {
        Ok(_) => Ok(RemoteCommandResult {
            success: true,
            message: "Wake-on-LAN packet sent".to_string(),
            ip: broadcast,
        }),
        Err(e) => Ok(RemoteCommandResult {
            success: false,
            message: format!("Failed to send WoL packet: {}", e),
            ip: broadcast,
        }),
    }
}

/// Shutdown máy từ xa qua SSH (Linux/macOS) hoặc command
#[tauri::command]
async fn remote_shutdown(ip: String, username: Option<String>, _password: Option<String>) -> Result<RemoteCommandResult, String> {
    // Thử shutdown qua Windows RPC nếu không có SSH credentials
    if username.is_none() {
        // Sử dụng net rpc shutdown cho Windows trong cùng domain
        let output = tokio::process::Command::new("net")
            .args(["rpc", "shutdown", "-I", &ip, "-f", "-t", "0"])
            .output()
            .await;
        
        match output {
            Ok(out) if out.status.success() => {
                return Ok(RemoteCommandResult {
                    success: true,
                    message: "Shutdown command sent via RPC".to_string(),
                    ip,
                });
            }
            _ => {}
        }
        
        // Fallback: Thử shutdown command trực tiếp (Windows)
        let output = tokio::process::Command::new("shutdown")
            .args(["/s", "/m", &format!("\\\\{}", ip), "/t", "0", "/f"])
            .output()
            .await;
        
        match output {
            Ok(out) if out.status.success() => {
                return Ok(RemoteCommandResult {
                    success: true,
                    message: "Shutdown command sent".to_string(),
                    ip,
                });
            }
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                return Ok(RemoteCommandResult {
                    success: false,
                    message: format!("Shutdown failed: {}", stderr),
                    ip,
                });
            }
            Err(e) => {
                return Ok(RemoteCommandResult {
                    success: false,
                    message: format!("Command error: {}", e),
                    ip,
                });
            }
        }
    }
    
    // SSH shutdown cho Linux/macOS
    Ok(RemoteCommandResult {
        success: false,
        message: "SSH shutdown not implemented yet".to_string(),
        ip,
    })
}

/// Restart máy từ xa
#[tauri::command]
async fn remote_restart(ip: String) -> Result<RemoteCommandResult, String> {
    // Windows restart command
    let output = tokio::process::Command::new("shutdown")
        .args(["/r", "/m", &format!("\\\\{}", ip), "/t", "0", "/f"])
        .output()
        .await;
    
    match output {
        Ok(out) if out.status.success() => {
            Ok(RemoteCommandResult {
                success: true,
                message: "Restart command sent".to_string(),
                ip,
            })
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            Ok(RemoteCommandResult {
                success: false,
                message: format!("Restart failed: {}", stderr),
                ip,
            })
        }
        Err(e) => Ok(RemoteCommandResult {
            success: false,
            message: format!("Command error: {}", e),
            ip,
        }),
    }
}

/// Kiểm tra trạng thái máy (online/offline)
#[tauri::command]
async fn check_computer_status(ip: String) -> Result<RemoteCommandResult, String> {
    let addr: Ipv4Addr = ip.parse().map_err(|_| "Invalid IP")?;
    let is_alive = check_host_alive(addr);
    
    Ok(RemoteCommandResult {
        success: is_alive,
        message: if is_alive { "Online".to_string() } else { "Offline".to_string() },
        ip,
    })
}

/// Mở VNC viewer để xem màn hình từ xa
#[tauri::command]
async fn open_vnc_viewer(ip: String, port: Option<u16>) -> Result<RemoteCommandResult, String> {
    let vnc_port = port.unwrap_or(5900);
    let vnc_url = format!("{}:{}", ip, vnc_port);
    
    // Thử mở VNC viewer có sẵn trên hệ thống
    #[cfg(target_os = "macos")]
    {
        let output = tokio::process::Command::new("open")
            .args([&format!("vnc://{}", vnc_url)])
            .output()
            .await;
        
        if let Ok(out) = output {
            if out.status.success() {
                return Ok(RemoteCommandResult {
                    success: true,
                    message: format!("Opening VNC viewer to {}", vnc_url),
                    ip,
                });
            }
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Thử mở với các VNC client phổ biến
        let viewers = ["vncviewer", "tvnviewer", "C:\\Program Files\\RealVNC\\VNC Viewer\\vncviewer.exe"];
        for viewer in viewers {
            let output = tokio::process::Command::new(viewer)
                .arg(&vnc_url)
                .spawn();
            
            if output.is_ok() {
                return Ok(RemoteCommandResult {
                    success: true,
                    message: format!("Opening VNC viewer to {}", vnc_url),
                    ip,
                });
            }
        }
    }
    
    Ok(RemoteCommandResult {
        success: false,
        message: "No VNC viewer found. Please install a VNC client.".to_string(),
        ip,
    })
}

// ==================== SCREEN CAPTURE & CONTROL ====================

#[derive(Debug, Clone, Serialize)]
pub struct ScreenCaptureResult {
    pub success: bool,
    pub image_base64: Option<String>,
    pub width: u32,
    pub height: u32,
    pub message: String,
}

/// Capture màn hình local và trả về base64 image
#[tauri::command]
fn capture_screen() -> Result<ScreenCaptureResult, String> {
    use scrap::{Capturer, Display};
    use std::io::ErrorKind::WouldBlock;
    
    let display = Display::primary().map_err(|e| format!("No display found: {}", e))?;
    let mut capturer = Capturer::new(display).map_err(|e| format!("Capturer error: {}", e))?;
    
    let width = capturer.width() as u32;
    let height = capturer.height() as u32;
    
    // Try to capture frame (may need multiple attempts)
    let mut attempts = 0;
    let frame = loop {
        match capturer.frame() {
            Ok(frame) => break frame,
            Err(e) if e.kind() == WouldBlock => {
                attempts += 1;
                if attempts > 50 {
                    return Ok(ScreenCaptureResult {
                        success: false,
                        image_base64: None,
                        width: 0,
                        height: 0,
                        message: "Timeout waiting for frame".to_string(),
                    });
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => return Err(format!("Capture error: {}", e)),
        }
    };
    
    // Convert BGRA to RGBA
    let mut rgba = Vec::with_capacity((width * height * 4) as usize);
    for pixel in frame.chunks(4) {
        rgba.push(pixel[2]); // R
        rgba.push(pixel[1]); // G
        rgba.push(pixel[0]); // B
        rgba.push(pixel[3]); // A
    }
    
    // Encode to PNG
    let img = image::RgbaImage::from_raw(width, height, rgba)
        .ok_or("Failed to create image")?;
    
    let mut png_data = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
    encoder.encode(&img, width, height, image::ColorType::Rgba8)
        .map_err(|e| format!("PNG encode error: {}", e))?;
    
    // Convert to base64
    use base64::Engine;
    let base64_str = base64::engine::general_purpose::STANDARD.encode(&png_data);
    
    Ok(ScreenCaptureResult {
        success: true,
        image_base64: Some(base64_str),
        width,
        height,
        message: "Screen captured".to_string(),
    })
}

/// Capture màn hình với quality thấp hơn (JPEG) để stream nhanh hơn
#[tauri::command]
fn capture_screen_jpeg(quality: Option<u8>) -> Result<ScreenCaptureResult, String> {
    use scrap::{Capturer, Display};
    use std::io::ErrorKind::WouldBlock;
    
    let display = Display::primary().map_err(|e| format!("No display found: {}", e))?;
    let mut capturer = Capturer::new(display).map_err(|e| format!("Capturer error: {}", e))?;
    
    let width = capturer.width() as u32;
    let height = capturer.height() as u32;
    
    let mut attempts = 0;
    let frame = loop {
        match capturer.frame() {
            Ok(frame) => break frame,
            Err(e) if e.kind() == WouldBlock => {
                attempts += 1;
                if attempts > 50 {
                    return Ok(ScreenCaptureResult {
                        success: false,
                        image_base64: None,
                        width: 0,
                        height: 0,
                        message: "Timeout".to_string(),
                    });
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(e) => return Err(format!("Capture error: {}", e)),
        }
    };
    
    // Convert BGRA to RGB
    let mut rgb = Vec::with_capacity((width * height * 3) as usize);
    for pixel in frame.chunks(4) {
        rgb.push(pixel[2]); // R
        rgb.push(pixel[1]); // G
        rgb.push(pixel[0]); // B
    }
    
    let img = image::RgbImage::from_raw(width, height, rgb)
        .ok_or("Failed to create image")?;
    
    // Encode to JPEG
    let mut jpeg_data = Vec::new();
    let q = quality.unwrap_or(50);
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_data, q);
    encoder.encode(&img, width, height, image::ColorType::Rgb8)
        .map_err(|e| format!("JPEG encode error: {}", e))?;
    
    use base64::Engine;
    let base64_str = base64::engine::general_purpose::STANDARD.encode(&jpeg_data);
    
    Ok(ScreenCaptureResult {
        success: true,
        image_base64: Some(base64_str),
        width,
        height,
        message: "Screen captured".to_string(),
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct InputResult {
    pub success: bool,
    pub message: String,
}

/// Simulate mouse click tại vị trí x, y
#[tauri::command]
fn simulate_mouse_click(x: i32, y: i32, button: Option<String>) -> Result<InputResult, String> {
    use enigo::{Enigo, Mouse, Settings, Coordinate, Button};
    
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    
    // Move mouse to position
    enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| e.to_string())?;
    
    // Click
    let btn = match button.as_deref() {
        Some("right") => Button::Right,
        Some("middle") => Button::Middle,
        _ => Button::Left,
    };
    
    enigo.button(btn, enigo::Direction::Click).map_err(|e| e.to_string())?;
    
    Ok(InputResult {
        success: true,
        message: format!("Clicked at ({}, {})", x, y),
    })
}

/// Simulate mouse move
#[tauri::command]
fn simulate_mouse_move(x: i32, y: i32) -> Result<InputResult, String> {
    use enigo::{Enigo, Mouse, Settings, Coordinate};
    
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| e.to_string())?;
    
    Ok(InputResult {
        success: true,
        message: format!("Mouse moved to ({}, {})", x, y),
    })
}

/// Simulate keyboard input
#[tauri::command]
fn simulate_key_press(key: String) -> Result<InputResult, String> {
    use enigo::{Enigo, Keyboard, Settings, Key};
    
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    
    // Handle special keys
    let result = match key.to_lowercase().as_str() {
        "enter" | "return" => enigo.key(Key::Return, enigo::Direction::Click),
        "tab" => enigo.key(Key::Tab, enigo::Direction::Click),
        "escape" | "esc" => enigo.key(Key::Escape, enigo::Direction::Click),
        "backspace" => enigo.key(Key::Backspace, enigo::Direction::Click),
        "delete" => enigo.key(Key::Delete, enigo::Direction::Click),
        "space" => enigo.key(Key::Space, enigo::Direction::Click),
        "up" => enigo.key(Key::UpArrow, enigo::Direction::Click),
        "down" => enigo.key(Key::DownArrow, enigo::Direction::Click),
        "left" => enigo.key(Key::LeftArrow, enigo::Direction::Click),
        "right" => enigo.key(Key::RightArrow, enigo::Direction::Click),
        _ => enigo.text(&key),
    };
    
    result.map_err(|e| e.to_string())?;
    
    Ok(InputResult {
        success: true,
        message: format!("Key pressed: {}", key),
    })
}

/// Type text
#[tauri::command]
fn simulate_type_text(text: String) -> Result<InputResult, String> {
    use enigo::{Enigo, Keyboard, Settings};
    
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.text(&text).map_err(|e| e.to_string())?;
    
    Ok(InputResult {
        success: true,
        message: format!("Typed: {}", text),
    })
}

/// Mở Remote Desktop (RDP) cho Windows
#[tauri::command]
async fn open_remote_desktop(ip: String) -> Result<RemoteCommandResult, String> {
    #[cfg(target_os = "windows")]
    {
        let output = tokio::process::Command::new("mstsc")
            .args(["/v:", &ip])
            .spawn();
        
        match output {
            Ok(_) => Ok(RemoteCommandResult {
                success: true,
                message: format!("Opening Remote Desktop to {}", ip),
                ip,
            }),
            Err(e) => Ok(RemoteCommandResult {
                success: false,
                message: format!("Failed to open RDP: {}", e),
                ip,
            }),
        }
    }
    
    #[cfg(target_os = "macos")]
    {
        // macOS có thể dùng Microsoft Remote Desktop
        let output = tokio::process::Command::new("open")
            .args(["-a", "Microsoft Remote Desktop", &format!("rdp://{}", ip)])
            .output()
            .await;
        
        match output {
            Ok(out) if out.status.success() => Ok(RemoteCommandResult {
                success: true,
                message: format!("Opening Remote Desktop to {}", ip),
                ip,
            }),
            _ => Ok(RemoteCommandResult {
                success: false,
                message: "Microsoft Remote Desktop not installed".to_string(),
                ip,
            }),
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let output = tokio::process::Command::new("rdesktop")
            .arg(&ip)
            .spawn();
        
        match output {
            Ok(_) => Ok(RemoteCommandResult {
                success: true,
                message: format!("Opening Remote Desktop to {}", ip),
                ip,
            }),
            Err(_) => Ok(RemoteCommandResult {
                success: false,
                message: "rdesktop not installed".to_string(),
                ip,
            }),
        }
    }
}

// ==================== BACKEND MANAGEMENT ====================

#[derive(Debug, Clone, Serialize)]
pub struct BackendStatus {
    pub running: bool,
    pub message: String,
}

// ==================== UDP DISCOVERY ====================

#[derive(Debug, Clone, Serialize)]
pub struct DiscoveryResult {
    pub found: bool,
    pub server_ip: Option<String>,
    pub message: String,
}

/// Get current app mode
#[tauri::command]
fn get_app_mode() -> AppMode {
    *APP_MODE.lock().unwrap()
}

/// Set app mode (Teacher/Client)
#[tauri::command]
fn set_app_mode(mode: String) -> Result<String, String> {
    let app_mode = match mode.as_str() {
        "Teacher" => AppMode::Teacher,
        _ => AppMode::Client,
    };
    
    let mut current_mode = APP_MODE.lock().map_err(|e| e.to_string())?;
    *current_mode = app_mode;
    
    // Save to config file
    let config_path = get_config_path();
    let config = serde_json::json!({ "mode": mode });
    std::fs::write(&config_path, config.to_string()).ok();
    
    Ok(format!("Mode set to {}", mode))
}

/// Load saved app mode from config
#[tauri::command]
fn load_app_mode() -> AppMode {
    let config_path = get_config_path();
    if let Ok(content) = std::fs::read_to_string(&config_path) {
        if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(mode_str) = config.get("mode").and_then(|v| v.as_str()) {
                return match mode_str {
                    "Teacher" => AppMode::Teacher,
                    _ => AppMode::Client,
                };
            }
        }
    }
    AppMode::Client
}

fn get_config_path() -> std::path::PathBuf {
    // First check if config exists next to exe (for portable install)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let portable_config = exe_dir.join("config.json");
            if portable_config.exists() {
                return portable_config;
            }
        }
    }
    
    // Otherwise use user config dir
    let mut path = dirs::config_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("smartlab");
    std::fs::create_dir_all(&path).ok();
    path.push("config.json");
    path
}

/// Start UDP broadcast (Teacher mode) - broadcasts server presence
#[tauri::command]
async fn start_server_broadcast() -> Result<String, String> {
    if UDP_BROADCASTER.load(Ordering::SeqCst) {
        return Ok("Broadcast already running".to_string());
    }
    
    UDP_BROADCASTER.store(true, Ordering::SeqCst);
    
    tokio::spawn(async {
        let socket = match UdpSocket::bind("0.0.0.0:0") {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to bind UDP socket: {}", e);
                UDP_BROADCASTER.store(false, Ordering::SeqCst);
                return;
            }
        };
        
        socket.set_broadcast(true).ok();
        
        let local_ip = get_local_ip().map(|ip| ip.to_string()).unwrap_or_default();
        let message = format!("{}|{}", String::from_utf8_lossy(DISCOVERY_MAGIC), local_ip);
        
        while UDP_BROADCASTER.load(Ordering::SeqCst) {
            // Broadcast to 255.255.255.255
            let _ = socket.send_to(message.as_bytes(), format!("255.255.255.255:{}", DISCOVERY_PORT));
            
            // Also broadcast to subnet broadcast
            if let Some(ip) = get_local_ip() {
                let octets = ip.octets();
                let subnet_broadcast = format!("{}.{}.{}.255:{}", octets[0], octets[1], octets[2], DISCOVERY_PORT);
                let _ = socket.send_to(message.as_bytes(), subnet_broadcast);
            }
            
            std::thread::sleep(Duration::from_millis(BROADCAST_INTERVAL_MS));
        }
    });
    
    Ok("Server broadcast started".to_string())
}

/// Stop UDP broadcast
#[tauri::command]
fn stop_server_broadcast() -> String {
    UDP_BROADCASTER.store(false, Ordering::SeqCst);
    "Broadcast stopped".to_string()
}

/// Discover server via UDP (Client mode)
#[tauri::command]
async fn discover_server_udp() -> Result<DiscoveryResult, String> {
    let socket = UdpSocket::bind(format!("0.0.0.0:{}", DISCOVERY_PORT))
        .or_else(|_| UdpSocket::bind("0.0.0.0:0"))
        .map_err(|e| e.to_string())?;
    
    socket.set_read_timeout(Some(Duration::from_secs(5))).ok();
    socket.set_broadcast(true).ok();
    
    // Send discovery request
    let request = b"SMARTLAB_DISCOVER";
    let _ = socket.send_to(request, format!("255.255.255.255:{}", DISCOVERY_PORT));
    
    // Also send to subnet
    if let Some(ip) = get_local_ip() {
        let octets = ip.octets();
        let subnet_broadcast = format!("{}.{}.{}.255:{}", octets[0], octets[1], octets[2], DISCOVERY_PORT);
        let _ = socket.send_to(request, subnet_broadcast);
    }
    
    // Listen for response
    let mut buf = [0u8; 256];
    let start = std::time::Instant::now();
    
    while start.elapsed() < Duration::from_secs(5) {
        match socket.recv_from(&mut buf) {
            Ok((len, addr)) => {
                let message = String::from_utf8_lossy(&buf[..len]);
                let magic = String::from_utf8_lossy(DISCOVERY_MAGIC);
                if message.starts_with(magic.as_ref()) {
                    let parts: Vec<&str> = message.split('|').collect();
                    if parts.len() >= 2 {
                        let server_ip = parts[1].to_string();
                        return Ok(DiscoveryResult {
                            found: true,
                            server_ip: Some(server_ip),
                            message: format!("Found server at {}", addr.ip()),
                        });
                    }
                }
            }
            Err(_) => continue,
        }
    }
    
    Ok(DiscoveryResult {
        found: false,
        server_ip: None,
        message: "No server found".to_string(),
    })
}

/// Start backend server
#[tauri::command]
fn start_backend(app_handle: tauri::AppHandle) -> Result<BackendStatus, String> {
    if BACKEND_RUNNING.load(Ordering::SeqCst) {
        return Ok(BackendStatus {
            running: true,
            message: "Backend already running".to_string(),
        });
    }

    // Tìm đường dẫn backend executable
    let backend_path = find_backend_path(&app_handle)?;
    
    println!("Starting backend from: {:?}", backend_path);
    
    let child = Command::new(&backend_path)
        .spawn()
        .map_err(|e| format!("Failed to start backend: {}", e))?;
    
    let mut process = BACKEND_PROCESS.lock().map_err(|e| e.to_string())?;
    *process = Some(child);
    BACKEND_RUNNING.store(true, Ordering::SeqCst);
    
    // Đợi backend khởi động
    std::thread::sleep(Duration::from_millis(1000));
    
    Ok(BackendStatus {
        running: true,
        message: "Backend started successfully".to_string(),
    })
}

/// Stop backend server
#[tauri::command]
fn stop_backend() -> Result<BackendStatus, String> {
    let mut process = BACKEND_PROCESS.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref mut child) = *process {
        let _ = child.kill();
        let _ = child.wait();
    }
    
    *process = None;
    BACKEND_RUNNING.store(false, Ordering::SeqCst);
    
    Ok(BackendStatus {
        running: false,
        message: "Backend stopped".to_string(),
    })
}

/// Check backend status
#[tauri::command]
fn check_backend_status() -> BackendStatus {
    // Kiểm tra bằng cách ping API
    let is_running = std::net::TcpStream::connect_timeout(
        &"127.0.0.1:3000".parse().unwrap(),
        Duration::from_millis(500)
    ).is_ok();
    
    BACKEND_RUNNING.store(is_running, Ordering::SeqCst);
    
    BackendStatus {
        running: is_running,
        message: if is_running { "Backend is running".to_string() } else { "Backend is not running".to_string() },
    }
}

// ==================== REMOTE CONTROL SERVER (Student/Controlled PC) ====================

#[derive(Debug, Clone, Serialize)]
pub struct RemoteServerStatus {
    pub running: bool,
    pub port: u16,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum RemoteInputEvent {
    #[serde(rename = "mouse_move")]
    MouseMove { x: i32, y: i32 },
    #[serde(rename = "mouse_click")]
    MouseClick { x: i32, y: i32, button: String },
    #[serde(rename = "mouse_down")]
    MouseDown { x: i32, y: i32, button: String },
    #[serde(rename = "mouse_up")]
    MouseUp { x: i32, y: i32, button: String },
    #[serde(rename = "mouse_scroll")]
    MouseScroll { delta_x: i32, delta_y: i32 },
    #[serde(rename = "key_press")]
    KeyPress { key: String },
    #[serde(rename = "key_down")]
    KeyDown { key: String },
    #[serde(rename = "key_up")]
    KeyUp { key: String },
    #[serde(rename = "type_text")]
    TypeText { text: String },
}

fn handle_remote_input(event: RemoteInputEvent) -> Result<(), String> {
    use enigo::{Enigo, Mouse, Keyboard, Settings, Coordinate, Button, Key, Direction};
    
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    
    match event {
        RemoteInputEvent::MouseMove { x, y } => {
            enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| e.to_string())?;
        }
        RemoteInputEvent::MouseClick { x, y, button } => {
            enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| e.to_string())?;
            let btn = match button.as_str() {
                "right" => Button::Right,
                "middle" => Button::Middle,
                _ => Button::Left,
            };
            enigo.button(btn, Direction::Click).map_err(|e| e.to_string())?;
        }
        RemoteInputEvent::MouseDown { x, y, button } => {
            enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| e.to_string())?;
            let btn = match button.as_str() {
                "right" => Button::Right,
                "middle" => Button::Middle,
                _ => Button::Left,
            };
            enigo.button(btn, Direction::Press).map_err(|e| e.to_string())?;
        }
        RemoteInputEvent::MouseUp { x, y, button } => {
            enigo.move_mouse(x, y, Coordinate::Abs).map_err(|e| e.to_string())?;
            let btn = match button.as_str() {
                "right" => Button::Right,
                "middle" => Button::Middle,
                _ => Button::Left,
            };
            enigo.button(btn, Direction::Release).map_err(|e| e.to_string())?;
        }
        RemoteInputEvent::MouseScroll { delta_x, delta_y } => {
            if delta_y != 0 {
                enigo.scroll(delta_y, enigo::Axis::Vertical).map_err(|e| e.to_string())?;
            }
            if delta_x != 0 {
                enigo.scroll(delta_x, enigo::Axis::Horizontal).map_err(|e| e.to_string())?;
            }
        }
        RemoteInputEvent::KeyPress { key } => {
            handle_key_event(&mut enigo, &key, Direction::Click)?;
        }
        RemoteInputEvent::KeyDown { key } => {
            handle_key_event(&mut enigo, &key, Direction::Press)?;
        }
        RemoteInputEvent::KeyUp { key } => {
            handle_key_event(&mut enigo, &key, Direction::Release)?;
        }
        RemoteInputEvent::TypeText { text } => {
            enigo.text(&text).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

fn handle_key_event(enigo: &mut enigo::Enigo, key: &str, direction: enigo::Direction) -> Result<(), String> {
    use enigo::{Keyboard, Key};
    
    let result = match key.to_lowercase().as_str() {
        "enter" | "return" => enigo.key(Key::Return, direction),
        "tab" => enigo.key(Key::Tab, direction),
        "escape" | "esc" => enigo.key(Key::Escape, direction),
        "backspace" => enigo.key(Key::Backspace, direction),
        "delete" => enigo.key(Key::Delete, direction),
        "space" => enigo.key(Key::Space, direction),
        "up" | "arrowup" => enigo.key(Key::UpArrow, direction),
        "down" | "arrowdown" => enigo.key(Key::DownArrow, direction),
        "left" | "arrowleft" => enigo.key(Key::LeftArrow, direction),
        "right" | "arrowright" => enigo.key(Key::RightArrow, direction),
        "home" => enigo.key(Key::Home, direction),
        "end" => enigo.key(Key::End, direction),
        "pageup" => enigo.key(Key::PageUp, direction),
        "pagedown" => enigo.key(Key::PageDown, direction),
        "shift" => enigo.key(Key::Shift, direction),
        "control" | "ctrl" => enigo.key(Key::Control, direction),
        "alt" => enigo.key(Key::Alt, direction),
        "meta" | "win" | "cmd" => enigo.key(Key::Meta, direction),
        "f1" => enigo.key(Key::F1, direction),
        "f2" => enigo.key(Key::F2, direction),
        "f3" => enigo.key(Key::F3, direction),
        "f4" => enigo.key(Key::F4, direction),
        "f5" => enigo.key(Key::F5, direction),
        "f6" => enigo.key(Key::F6, direction),
        "f7" => enigo.key(Key::F7, direction),
        "f8" => enigo.key(Key::F8, direction),
        "f9" => enigo.key(Key::F9, direction),
        "f10" => enigo.key(Key::F10, direction),
        "f11" => enigo.key(Key::F11, direction),
        "f12" => enigo.key(Key::F12, direction),
        _ => {
            if key.len() == 1 {
                if let Some(c) = key.chars().next() {
                    enigo.key(Key::Unicode(c), direction)
                } else {
                    return Ok(());
                }
            } else {
                return Ok(());
            }
        }
    };
    
    result.map_err(|e| e.to_string())
}

fn capture_screen_for_stream(quality: u8) -> Option<Vec<u8>> {
    use scrap::{Capturer, Display};
    use std::io::ErrorKind::WouldBlock;
    
    let display = Display::primary().ok()?;
    let mut capturer = Capturer::new(display).ok()?;
    
    let width = capturer.width() as u32;
    let height = capturer.height() as u32;
    
    let mut attempts = 0;
    let frame = loop {
        match capturer.frame() {
            Ok(frame) => break frame,
            Err(e) if e.kind() == WouldBlock => {
                attempts += 1;
                if attempts > 30 {
                    return None;
                }
                std::thread::sleep(Duration::from_millis(10));
            }
            Err(_) => return None,
        }
    };
    
    // Convert BGRA to RGB
    let mut rgb = Vec::with_capacity((width * height * 3) as usize);
    for pixel in frame.chunks(4) {
        rgb.push(pixel[2]); // R
        rgb.push(pixel[1]); // G
        rgb.push(pixel[0]); // B
    }
    
    let img = image::RgbImage::from_raw(width, height, rgb)?;
    
    let mut jpeg_data = Vec::new();
    let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_data, quality);
    encoder.encode(&img, width, height, image::ColorType::Rgb8).ok()?;
    
    Some(jpeg_data)
}

/// Start remote control server (chạy trên Student PC để cho phép Teacher điều khiển)
#[tauri::command]
async fn start_remote_server(port: Option<u16>) -> Result<RemoteServerStatus, String> {
    if REMOTE_SERVER_RUNNING.load(Ordering::SeqCst) {
        let current_port = REMOTE_SERVER_PORT.load(Ordering::SeqCst);
        return Ok(RemoteServerStatus {
            running: true,
            port: current_port,
            message: "Server already running".to_string(),
        });
    }
    
    let server_port = port.unwrap_or(REMOTE_CONTROL_PORT);
    REMOTE_SERVER_PORT.store(server_port, Ordering::SeqCst);
    
    let addr = format!("0.0.0.0:{}", server_port);
    let listener = TcpListener::bind(&addr).await
        .map_err(|e| format!("Failed to bind: {}", e))?;
    
    REMOTE_SERVER_RUNNING.store(true, Ordering::SeqCst);
    
    tokio::spawn(async move {
        println!("Remote control server started on port {}", server_port);
        
        while REMOTE_SERVER_RUNNING.load(Ordering::SeqCst) {
            match listener.accept().await {
                Ok((stream, addr)) => {
                    println!("New connection from: {}", addr);
                    
                    tokio::spawn(async move {
                        if let Ok(ws_stream) = accept_async(stream).await {
                            let (mut write, mut read) = ws_stream.split();
                            
                            // Spawn screen streaming task
                            let streaming = Arc::new(AtomicBool::new(true));
                            let streaming_clone = streaming.clone();
                            
                            let stream_task = tokio::spawn(async move {
                                while streaming_clone.load(Ordering::SeqCst) {
                                    if let Some(frame_data) = capture_screen_for_stream(40) {
                                        use base64::Engine;
                                        let base64_frame = base64::engine::general_purpose::STANDARD.encode(&frame_data);
                                        let msg = serde_json::json!({
                                            "type": "frame",
                                            "data": base64_frame
                                        });
                                        
                                        if write.send(tokio_tungstenite::tungstenite::Message::Text(msg.to_string())).await.is_err() {
                                            break;
                                        }
                                    }
                                    tokio::time::sleep(Duration::from_millis(50)).await; // ~20 FPS
                                }
                            });
                            
                            // Handle incoming input events
                            while let Some(msg) = read.next().await {
                                match msg {
                                    Ok(tokio_tungstenite::tungstenite::Message::Text(text)) => {
                                        if let Ok(event) = serde_json::from_str::<RemoteInputEvent>(&text) {
                                            let _ = handle_remote_input(event);
                                        }
                                    }
                                    Ok(tokio_tungstenite::tungstenite::Message::Close(_)) => break,
                                    Err(_) => break,
                                    _ => {}
                                }
                            }
                            
                            streaming.store(false, Ordering::SeqCst);
                            let _ = stream_task.await;
                        }
                    });
                }
                Err(e) => {
                    eprintln!("Accept error: {}", e);
                }
            }
        }
    });
    
    Ok(RemoteServerStatus {
        running: true,
        port: server_port,
        message: format!("Server started on port {}", server_port),
    })
}

/// Stop remote control server
#[tauri::command]
fn stop_remote_server() -> RemoteServerStatus {
    REMOTE_SERVER_RUNNING.store(false, Ordering::SeqCst);
    RemoteServerStatus {
        running: false,
        port: REMOTE_SERVER_PORT.load(Ordering::SeqCst),
        message: "Server stopped".to_string(),
    }
}

/// Get remote server status
#[tauri::command]
fn get_remote_server_status() -> RemoteServerStatus {
    let running = REMOTE_SERVER_RUNNING.load(Ordering::SeqCst);
    let port = REMOTE_SERVER_PORT.load(Ordering::SeqCst);
    RemoteServerStatus {
        running,
        port,
        message: if running { "Running".to_string() } else { "Stopped".to_string() },
    }
}

// ==================== REMOTE CONTROL CLIENT (Teacher/Controller PC) ====================

#[derive(Debug, Clone, Serialize)]
pub struct RemoteConnectionResult {
    pub success: bool,
    pub message: String,
}

/// Connect to remote PC for control (trả về WebSocket URL để frontend connect)
#[tauri::command]
fn get_remote_control_url(ip: String, port: Option<u16>) -> String {
    let p = port.unwrap_or(REMOTE_CONTROL_PORT);
    format!("ws://{}:{}", ip, p)
}

/// Check if remote control server is available on target IP
#[tauri::command]
async fn check_remote_control_available(ip: String, port: Option<u16>) -> Result<RemoteConnectionResult, String> {
    let p = port.unwrap_or(REMOTE_CONTROL_PORT);
    let addr: SocketAddr = format!("{}:{}", ip, p).parse()
        .map_err(|_| "Invalid address")?;
    
    match TcpStream::connect_timeout(&addr, Duration::from_secs(2)) {
        Ok(_) => Ok(RemoteConnectionResult {
            success: true,
            message: format!("Remote control available at {}:{}", ip, p),
        }),
        Err(e) => Ok(RemoteConnectionResult {
            success: false,
            message: format!("Cannot connect: {}", e),
        }),
    }
}

// ==================== UDP DISCOVERY WITH REMOTE CONTROL ====================

/// Start UDP broadcast with remote control port info
#[tauri::command]
async fn start_remote_broadcast() -> Result<String, String> {
    if UDP_BROADCASTER.load(Ordering::SeqCst) {
        return Ok("Broadcast already running".to_string());
    }
    
    UDP_BROADCASTER.store(true, Ordering::SeqCst);
    
    tokio::spawn(async {
        let socket = match UdpSocket::bind("0.0.0.0:0") {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to bind UDP socket: {}", e);
                UDP_BROADCASTER.store(false, Ordering::SeqCst);
                return;
            }
        };
        
        socket.set_broadcast(true).ok();
        
        let local_ip = get_local_ip().map(|ip| ip.to_string()).unwrap_or_default();
        let remote_port = REMOTE_SERVER_PORT.load(Ordering::SeqCst);
        // Format: MAGIC|IP|REMOTE_PORT
        let message = format!("{}|{}|{}", String::from_utf8_lossy(DISCOVERY_MAGIC), local_ip, remote_port);
        
        while UDP_BROADCASTER.load(Ordering::SeqCst) {
            let _ = socket.send_to(message.as_bytes(), format!("255.255.255.255:{}", DISCOVERY_PORT));
            
            if let Some(ip) = get_local_ip() {
                let octets = ip.octets();
                let subnet_broadcast = format!("{}.{}.{}.255:{}", octets[0], octets[1], octets[2], DISCOVERY_PORT);
                let _ = socket.send_to(message.as_bytes(), subnet_broadcast);
            }
            
            std::thread::sleep(Duration::from_millis(BROADCAST_INTERVAL_MS));
        }
    });
    
    Ok("Remote broadcast started".to_string())
}

#[derive(Debug, Clone, Serialize)]
pub struct DiscoveredPeer {
    pub ip: String,
    pub remote_port: u16,
    pub available: bool,
}

/// Discover peers with remote control capability
#[tauri::command]
async fn discover_remote_peers() -> Result<Vec<DiscoveredPeer>, String> {
    let socket = UdpSocket::bind(format!("0.0.0.0:{}", DISCOVERY_PORT))
        .or_else(|_| UdpSocket::bind("0.0.0.0:0"))
        .map_err(|e| e.to_string())?;
    
    socket.set_read_timeout(Some(Duration::from_secs(3))).ok();
    socket.set_broadcast(true).ok();
    
    // Send discovery request
    let request = b"SMARTLAB_DISCOVER";
    let _ = socket.send_to(request, format!("255.255.255.255:{}", DISCOVERY_PORT));
    
    if let Some(ip) = get_local_ip() {
        let octets = ip.octets();
        let subnet_broadcast = format!("{}.{}.{}.255:{}", octets[0], octets[1], octets[2], DISCOVERY_PORT);
        let _ = socket.send_to(request, subnet_broadcast);
    }
    
    let mut peers = Vec::new();
    let mut buf = [0u8; 256];
    let start = std::time::Instant::now();
    let local_ip = get_local_ip().map(|ip| ip.to_string()).unwrap_or_default();
    
    while start.elapsed() < Duration::from_secs(3) {
        match socket.recv_from(&mut buf) {
            Ok((len, _addr)) => {
                let message = String::from_utf8_lossy(&buf[..len]);
                let magic = String::from_utf8_lossy(DISCOVERY_MAGIC);
                if message.starts_with(magic.as_ref()) {
                    let parts: Vec<&str> = message.split('|').collect();
                    if parts.len() >= 2 {
                        let peer_ip = parts[1].to_string();
                        // Skip self
                        if peer_ip == local_ip {
                            continue;
                        }
                        let remote_port = parts.get(2)
                            .and_then(|p| p.parse().ok())
                            .unwrap_or(REMOTE_CONTROL_PORT);
                        
                        // Check if not already in list
                        if !peers.iter().any(|p: &DiscoveredPeer| p.ip == peer_ip) {
                            peers.push(DiscoveredPeer {
                                ip: peer_ip,
                                remote_port,
                                available: true,
                            });
                        }
                    }
                }
            }
            Err(_) => continue,
        }
    }
    
    Ok(peers)
}

fn find_backend_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    // Production mode - check resource directory first
    if let Ok(resource_path) = app_handle.path().resource_dir() {
        let bundled_paths = vec![
            resource_path.join("ip_scanner_api.exe"),
            resource_path.join("ip_scanner_api"),
        ];
        
        for path in bundled_paths {
            if path.exists() {
                return Ok(path);
            }
        }
    }
    
    // Check exe directory (for portable/extracted installs)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let extra_paths = vec![
                exe_dir.join("ip_scanner_api.exe"),
                exe_dir.join("ip_scanner_api"),
            ];
            
            for path in extra_paths {
                if path.exists() {
                    return Ok(path);
                }
            }
        }
    }
    
    // Development mode - relative paths
    let possible_paths: Vec<std::path::PathBuf> = vec![
        std::path::PathBuf::from("../backend/target/release/ip_scanner_api.exe"),
        std::path::PathBuf::from("../backend/target/release/ip_scanner_api"),
        std::path::PathBuf::from("backend/target/release/ip_scanner_api.exe"),
        std::path::PathBuf::from("backend/target/release/ip_scanner_api"),
        std::path::PathBuf::from("../backend/target/debug/ip_scanner_api.exe"),
        std::path::PathBuf::from("../backend/target/debug/ip_scanner_api"),
    ];
    
    for path in &possible_paths {
        if path.exists() {
            return Ok(path.clone());
        }
    }
    
    // Add current directory based paths
    if let Ok(current_dir) = std::env::current_dir() {
        let extra_paths = vec![
            current_dir.join("../backend/target/release/ip_scanner_api.exe"),
            current_dir.join("../backend/target/release/ip_scanner_api"),
            current_dir.join("backend/target/release/ip_scanner_api.exe"),
            current_dir.join("backend/target/release/ip_scanner_api"),
        ];
        
        for path in extra_paths {
            if path.exists() {
                return Ok(path);
            }
        }
    }
    
    Err("Backend executable not found. Please build backend first with: cd backend && cargo build --release".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_local_ip_address,
            scan_network,
            ping_host,
            register,
            login,
            wake_on_lan,
            remote_shutdown,
            remote_restart,
            check_computer_status,
            open_vnc_viewer,
            open_remote_desktop,
            start_backend,
            stop_backend,
            check_backend_status,
            // UDP Discovery
            get_app_mode,
            set_app_mode,
            load_app_mode,
            start_server_broadcast,
            stop_server_broadcast,
            discover_server_udp,
            // Screen capture & control
            capture_screen,
            capture_screen_jpeg,
            simulate_mouse_click,
            simulate_mouse_move,
            simulate_key_press,
            simulate_type_text,
            // Remote control LAN
            start_remote_server,
            stop_remote_server,
            get_remote_server_status,
            get_remote_control_url,
            check_remote_control_available,
            start_remote_broadcast,
            discover_remote_peers
        ])
        .on_window_event(|_window, event| {
            // Stop backend when app closes
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let _ = stop_backend();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
