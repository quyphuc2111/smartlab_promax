use axum::{
    extract::Path,
    http::{HeaderMap, StatusCode},
    Json,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::time::Duration;

use crate::auth::{create_token, extract_token_from_header, verify_token};
use crate::db;
use crate::models::*;

pub async fn health_check() -> Json<ApiResponse<String>> {
    Json(ApiResponse::ok("OK".to_string()))
}

pub async fn register(Json(payload): Json<RegisterRequest>) -> (StatusCode, Json<AuthResponse>) {
    // Validation
    if payload.username.len() < 3 {
        return (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                success: false,
                message: "Username must be at least 3 characters".to_string(),
                token: None,
                user: None,
            }),
        );
    }

    if payload.password.len() < 6 {
        return (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                success: false,
                message: "Password must be at least 6 characters".to_string(),
                token: None,
                user: None,
            }),
        );
    }

    // Validate role
    let valid_roles = ["Student", "Teacher", "Administrator"];
    if !valid_roles.contains(&payload.role.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(AuthResponse {
                success: false,
                message: "Invalid role. Must be Student, Teacher, or Administrator".to_string(),
                token: None,
                user: None,
            }),
        );
    }

    // Hash password
    let password_hash = match hash(&payload.password, DEFAULT_COST) {
        Ok(h) => h,
        Err(_) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AuthResponse {
                    success: false,
                    message: "Failed to hash password".to_string(),
                    token: None,
                    user: None,
                }),
            )
        }
    };

    // Create user
    match db::create_user(&payload.username, &password_hash, &payload.role) {
        Ok(user_id) => {
            let token = create_token(user_id, &payload.username, &payload.role).ok();
            (
                StatusCode::CREATED,
                Json(AuthResponse {
                    success: true,
                    message: "Registration successful".to_string(),
                    token,
                    user: Some(User {
                        user_id,
                        user_name: payload.username,
                        role: payload.role,
                        status: true,
                    }),
                }),
            )
        }
        Err(e) => {
            let message = if e.to_string().contains("UNIQUE") {
                "Username already exists"
            } else {
                "Database error"
            };
            (
                StatusCode::BAD_REQUEST,
                Json(AuthResponse {
                    success: false,
                    message: message.to_string(),
                    token: None,
                    user: None,
                }),
            )
        }
    }
}

pub async fn login(Json(payload): Json<LoginRequest>) -> (StatusCode, Json<AuthResponse>) {
    let user = match db::find_user_by_username(&payload.username) {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(AuthResponse {
                    success: false,
                    message: "User not found".to_string(),
                    token: None,
                    user: None,
                }),
            )
        }
    };

    let (user_id, user_name, password_hash, role, status) = user;

    if !status {
        return (
            StatusCode::UNAUTHORIZED,
            Json(AuthResponse {
                success: false,
                message: "Account is disabled".to_string(),
                token: None,
                user: None,
            }),
        );
    }

    match verify(&payload.password, &password_hash) {
        Ok(true) => {
            let token = create_token(user_id, &user_name, &role).ok();
            (
                StatusCode::OK,
                Json(AuthResponse {
                    success: true,
                    message: "Login successful".to_string(),
                    token,
                    user: Some(User { user_id, user_name, role, status }),
                }),
            )
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(AuthResponse {
                success: false,
                message: "Invalid password".to_string(),
                token: None,
                user: None,
            }),
        ),
    }
}

pub async fn get_current_user(headers: HeaderMap) -> (StatusCode, Json<ApiResponse<User>>) {
    let auth_header = headers.get("Authorization").and_then(|h| h.to_str().ok());
    let token = match extract_token_from_header(auth_header) {
        Some(t) => t,
        None => return (StatusCode::UNAUTHORIZED, Json(ApiResponse::err("No token provided"))),
    };

    let claims = match verify_token(&token) {
        Some(c) => c,
        None => return (StatusCode::UNAUTHORIZED, Json(ApiResponse::err("Invalid token"))),
    };

    match db::find_user_by_id(claims.sub) {
        Some((user_id, user_name, role, status)) => {
            (StatusCode::OK, Json(ApiResponse::ok(User { user_id, user_name, role, status })))
        }
        None => (StatusCode::NOT_FOUND, Json(ApiResponse::err("User not found"))),
    }
}

pub async fn scan_network() -> Json<ApiResponse<Vec<HostInfo>>> {
    let local_ip = match get_local_ip() {
        Some(ip) => ip,
        None => return Json(ApiResponse::err("Could not determine local IP")),
    };

    let ips = get_network_range(local_ip);
    let mut handles = Vec::new();

    // Scan concurrently using tokio tasks
    for ip in ips {
        let handle = tokio::spawn(async move {
            if check_host_alive(ip) {
                Some(HostInfo {
                    ip: ip.to_string(),
                    is_alive: true,
                })
            } else {
                None
            }
        });
        handles.push(handle);
    }

    let mut hosts = Vec::new();
    for handle in handles {
        if let Ok(Some(host)) = handle.await {
            hosts.push(host);
        }
    }

    // Sort by IP
    hosts.sort_by(|a, b| {
        let a_parts: Vec<u8> = a.ip.split('.').filter_map(|s| s.parse().ok()).collect();
        let b_parts: Vec<u8> = b.ip.split('.').filter_map(|s| s.parse().ok()).collect();
        a_parts.cmp(&b_parts)
    });

    Json(ApiResponse::ok(hosts))
}

pub async fn ping_host(Path(ip): Path<String>) -> Json<ApiResponse<PingResult>> {
    let addr: Ipv4Addr = match ip.parse() {
        Ok(a) => a,
        Err(_) => return Json(ApiResponse::err("Invalid IP address")),
    };

    let result = tcp_ping(addr);
    Json(ApiResponse::ok(result))
}

// Helper functions
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
    (1..255)
        .map(|i| Ipv4Addr::new(octets[0], octets[1], octets[2], i))
        .collect()
}

fn check_host_alive(ip: Ipv4Addr) -> bool {
    let ports = [80, 443, 22, 445, 139, 3389, 8080];
    for port in ports {
        let socket = SocketAddr::new(IpAddr::V4(ip), port);
        if TcpStream::connect_timeout(&socket, Duration::from_millis(100)).is_ok() {
            return true;
        }
    }
    false
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


// ==================== ROOM COMPUTER HANDLERS ====================

pub async fn get_room_computers() -> Json<ApiResponse<Vec<RoomComputer>>> {
    match db::get_all_room_computers() {
        Ok(computers) => {
            let list: Vec<RoomComputer> = computers
                .into_iter()
                .map(|(id, name, ip, status)| RoomComputer {
                    room_computer_id: Some(id),
                    computer_name: name,
                    ip_address: ip,
                    status: Some(status),
                })
                .collect();
            Json(ApiResponse::ok(list))
        }
        Err(e) => Json(ApiResponse::err(&format!("Database error: {}", e))),
    }
}

pub async fn create_room_computer(
    Json(payload): Json<RoomComputer>,
) -> (StatusCode, Json<ApiResponse<RoomComputer>>) {
    let status = payload.status.as_deref().unwrap_or("Active");
    
    // Check if IP already exists
    if let Some(ip) = &payload.ip_address {
        if db::find_room_computer_by_ip(ip).is_some() {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiResponse::err("IP address already exists")),
            );
        }
    }

    match db::create_room_computer(&payload.computer_name, payload.ip_address.as_deref(), status) {
        Ok(id) => (
            StatusCode::CREATED,
            Json(ApiResponse::ok(RoomComputer {
                room_computer_id: Some(id),
                computer_name: payload.computer_name,
                ip_address: payload.ip_address,
                status: Some(status.to_string()),
            })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&format!("Failed to create: {}", e))),
        ),
    }
}

pub async fn update_room_computer(
    Path(id): Path<i64>,
    Json(payload): Json<RoomComputer>,
) -> (StatusCode, Json<ApiResponse<RoomComputer>>) {
    let status = payload.status.as_deref().unwrap_or("Active");

    match db::update_room_computer(id, &payload.computer_name, payload.ip_address.as_deref(), status) {
        Ok(rows) if rows > 0 => (
            StatusCode::OK,
            Json(ApiResponse::ok(RoomComputer {
                room_computer_id: Some(id),
                computer_name: payload.computer_name,
                ip_address: payload.ip_address,
                status: Some(status.to_string()),
            })),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::err("Computer not found")),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&format!("Failed to update: {}", e))),
        ),
    }
}

pub async fn delete_room_computer(Path(id): Path<i64>) -> (StatusCode, Json<ApiResponse<String>>) {
    match db::delete_room_computer(id) {
        Ok(rows) if rows > 0 => (
            StatusCode::OK,
            Json(ApiResponse::ok("Deleted successfully".to_string())),
        ),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(ApiResponse::err("Computer not found")),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiResponse::err(&format!("Failed to delete: {}", e))),
        ),
    }
}
