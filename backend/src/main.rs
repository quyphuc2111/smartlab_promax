mod db;
mod auth;
mod handlers;
mod models;

use axum::{
    routing::{get, post, put, delete},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // Initialize database
    db::init_db().expect("Failed to initialize database");

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        // Auth routes
        .route("/api/health", get(handlers::health_check))
        .route("/api/register", post(handlers::register))
        .route("/api/login", post(handlers::login))
        .route("/api/me", get(handlers::get_current_user))
        // Network routes
        .route("/api/scan", get(handlers::scan_network))
        .route("/api/ping/:ip", get(handlers::ping_host))
        // Room Computer routes
        .route("/api/room-computers", get(handlers::get_room_computers))
        .route("/api/room-computers", post(handlers::create_room_computer))
        .route("/api/room-computers/:id", put(handlers::update_room_computer))
        .route("/api/room-computers/:id", delete(handlers::delete_room_computer))
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("🚀 Server running at http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
