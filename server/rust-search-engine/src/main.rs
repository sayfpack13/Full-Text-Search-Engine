use clap::{Parser, Subcommand};
use search_engine::SearchEngine;
use log::info;

#[derive(Parser)]
#[command(name = "search-engine")]
#[command(about = "A full-text search engine")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Search for documents
    Search {
        /// Search query
        query: String,
        /// Maximum number of results
        #[arg(short, long, default_value = "10")]
        limit: usize,
        /// Number of results to skip
        #[arg(short, long, default_value = "0")]
        offset: usize,
    },
    /// Get search statistics
    Stats,
    /// Get system status
    Status,
    /// Run maintenance tasks
    Maintenance {
        /// Maintenance task to run
        task: String,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    env_logger::init();
    
    let cli = Cli::parse();
    let search_dir = std::env::var("SEARCH_DIRECTORY").unwrap_or_else(|_| "index".to_string());
    let mut engine = SearchEngine::new(&search_dir).await?;

    match cli.command {
        Commands::Search { query, limit, offset } => {
            info!("Searching for: {}", query);
            let results = engine.search(&query, limit, offset).await?;
            println!("{}", serde_json::to_string_pretty(&results)?);
        }
        Commands::Stats => {
            let stats = engine.get_stats().await?;
            println!("{}", serde_json::to_string_pretty(&stats)?);
        }
        Commands::Status => {
            let status = engine.get_status().await?;
            println!("{}", serde_json::to_string_pretty(&status)?);
        }
        Commands::Maintenance { task } => {
            info!("Running maintenance task: {}", task);
            let result = engine.run_maintenance(&task).await?;
            println!("{}", serde_json::to_string_pretty(&result)?);
        }
    }

    Ok(())
}
