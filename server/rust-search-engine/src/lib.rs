use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use tokio::fs as async_fs;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub content: String,
    pub score: f32,
    pub path: String,
    pub line_number: i64,
    pub indexed_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub query: String,
    pub results: Vec<SearchResult>,
    pub total: usize,
    pub limit: usize,
    pub offset: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexResult {
    pub success: bool,
    pub document_id: String,
    pub path: String,
    pub indexed_at: DateTime<Utc>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Stats {
    pub total_documents: usize,
    pub index_size_bytes: u64,
    pub last_updated: DateTime<Utc>,
    pub index_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Status {
    pub index_exists: bool,
    pub index_healthy: bool,
    pub total_documents: usize,
    pub index_size_bytes: u64,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaintenanceResult {
    pub task: String,
    pub success: bool,
    pub message: String,
    pub executed_at: DateTime<Utc>,
}

pub struct SearchEngine {
    search_path: PathBuf,
    cached_files: Vec<PathBuf>,
    last_scanned: DateTime<Utc>,
}

impl SearchEngine {
    pub async fn new(search_path: &str) -> Result<Self> {
        let search_path = PathBuf::from(search_path);
        
        // Create search directory if it doesn't exist
        if !search_path.exists() {
            async_fs::create_dir_all(&search_path).await
                .context("Failed to create search directory")?;
        }

        let mut engine = SearchEngine {
            cached_files: Vec::new(),
            search_path,
            last_scanned: Utc::now(),
        };

        engine.refresh_file_cache().await?;
        Ok(engine)
    }

    async fn refresh_file_cache(&mut self) -> Result<()> {
        self.cached_files.clear();
        
        if self.search_path.exists() && self.search_path.is_dir() {
            for entry in WalkDir::new(&self.search_path) 
                .into_iter() 
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().is_file())
                .filter(|e| {
                    e.path().extension()
                        .map(|ext| ext == "txt")
                        .unwrap_or(false)
                }) {
                self.cached_files.push(entry.path().to_path_buf());
            }
        }
        
        self.last_scanned = Utc::now();
        Ok(())
    }

    pub async fn index_document(&mut self, file_path: &str) -> Result<IndexResult> {
        let path = Path::new(file_path);
        
        if !path.exists() {
            return Ok(IndexResult {
                success: false,
                document_id: String::new(),
                path: file_path.to_string(),
                indexed_at: Utc::now(),
                message: "File does not exist".to_string(),
            });
        }

        // Copy file if it's not already in our search directory
        let dest_path = self.search_path.join(path.file_name().unwrap_or_default());
        
        if path != dest_path {
            async_fs::copy(path, &dest_path).await
                .context("Failed to copy file")?;
        }

        self.refresh_file_cache().await?;

        Ok(IndexResult {
            success: true,
            document_id: Uuid::new_v4().to_string(),
            path: file_path.to_string(),
            indexed_at: Utc::now(),
            message: "File added to search directory".to_string(),
        })
    }

    pub async fn search(&self, query: &str, limit: usize, offset: usize) -> Result<SearchResponse> {
        let mut results = Vec::new();
        let query_lower = query.to_lowercase();
        
        for (file_idx, file_path) in self.cached_files.iter().enumerate() {
            match self.search_in_file(file_path, &query_lower).await {
                Ok(file_results) => {
                    results.extend(file_results.into_iter().map(|mut result| {
                        result.id = format!("{}-{}", file_idx, result.line_number);
                        result
                    }));
                }
                Err(e) => {
                    eprintln!("Failed to search file {:?}: {}", file_path, e);
                }
            }
        }

        // Sort by score (higher is better)
        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        
        let total = results.len();
        let paginated_results = results
            .into_iter()
            .skip(offset)
            .take(limit)
            .collect();

        Ok(SearchResponse {
            query: query.to_string(),
            results: paginated_results,
            total,
            limit,
            offset,
        })
    }

    async fn search_in_file(&self, file_path: &Path, query: &str) -> Result<Vec<SearchResult>> {
        let mut results = Vec::new();
        let file_path_str = file_path.to_string_lossy().to_string();
        
        let content = async_fs::read_to_string(file_path).await
            .context("Failed to read file")?;
        
        for (line_number, line) in content.lines().enumerate() {
            let line_lower = line.to_lowercase();
            
            // Direct substring match
            if line_lower.contains(query) {
                let score = self.calculate_score(&line_lower, query);
                
                let filename = file_path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("Unknown")
                    .to_string();
                
                results.push(SearchResult {
                    id: String::new(), // Will be set later
                    title: format!("{} (line {})", filename, line_number + 1),
                    content: line.to_string(),
                    score,
                    path: file_path_str.clone(),
                    line_number: line_number as i64,
                    indexed_at: Utc::now(),
                });
            }
        }
        
        Ok(results)
    }

    fn calculate_score(&self, text: &str, query: &str) -> f32 {
        // Simple scoring: exact matches get higher score
        let mut score = 0.0;
        
        // Count occurrences
        let occurrences = text.matches(query).count();
        score += occurrences as f32 * 10.0;
        
        // Boost for word boundary matches if we can parse as word
        if query.len() >= 2 { // Only for words with 2+ characters
            let word_boundary_pattern = format!("\\b{}\\b", regex::escape(query));
            if let Ok(regex) = regex::Regex::new(&word_boundary_pattern) {
                if regex.is_match(text) {
                    score += 5.0;
                }
            }
        }
        
        // Lower penalty for very short queries to help substring matching
        if query.len() <= 4 {
            score += 2.0; // Boost short word searches
        }
        
        score
    }

    pub async fn get_stats(&self) -> Result<Stats> {
        let mut total_size = 0u64;
        
        for file_path in &self.cached_files {
            if let Ok(metadata) = async_fs::metadata(file_path).await {
                total_size += metadata.len();
            }
        }
        
        Ok(Stats {
            total_documents: self.cached_files.len(),
            index_size_bytes: total_size,
            last_updated: self.last_scanned,
            index_path: self.search_path.to_string_lossy().to_string(),
        })
    }

    pub async fn get_status(&self) -> Result<Status> {
        let healthy = self.search_path.exists() && self.search_path.is_dir();
        
        let mut total_size = 0u64;
        for file_path in &self.cached_files {
            if let Ok(metadata) = async_fs::metadata(file_path).await {
                total_size += metadata.len();
            }
        }
        
        Ok(Status {
            index_exists: healthy,
            index_healthy: healthy,
            total_documents: self.cached_files.len(),
            index_size_bytes: total_size,
            last_updated: self.last_scanned,
        })
    }


    pub async fn run_maintenance(&mut self, task: &str) -> Result<MaintenanceResult> {
        match task {
            "cleanup" => {
                self.refresh_file_cache().await?;
                Ok(MaintenanceResult {
                    task: task.to_string(),
                    success: true,
                    message: "File cache refreshed successfully".to_string(),
                    executed_at: Utc::now(),
                })
            }
            "clear-all" => {
                // Remove all .txt files from search directory
                let mut files_removed = 0;
                let files_to_remove: Vec<_> = self.cached_files.iter().collect();
                
                for file_path in files_to_remove {
                    if let Err(e) = async_fs::remove_file(file_path).await {
                        eprintln!("Failed to remove file {:?}: {}", file_path, e);
                    } else {
                        files_removed += 1;
                    }
                }
                
                self.refresh_file_cache().await?;
                
                Ok(MaintenanceResult {
                    task: task.to_string(),
                    success: true,
                    message: format!("Removed {} files from search directory", files_removed),
                    executed_at: Utc::now(),
                })
            }
            "update-stats" => {
                self.refresh_file_cache().await?;
                Ok(MaintenanceResult {
                    task: task.to_string(),
                    success: true,
                    message: "File cache refreshed successfully".to_string(),
                    executed_at: Utc::now(),
                })
            }
            _ => {
                Ok(MaintenanceResult {
                    task: task.to_string(),
                    success: false,
                    message: format!("Unknown maintenance task: {}", task),
                    executed_at: Utc::now(),
                })
            }
        }
    }
}
