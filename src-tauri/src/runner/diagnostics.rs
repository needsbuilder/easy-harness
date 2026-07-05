use std::io::Write;
use std::path::Path;

use crate::error::EngineError;

pub fn build_zip(
    dest: &Path,
    env_json: &str,
    state_json: &str,
    logs: &[(String, Vec<String>)],
) -> Result<(), EngineError> {
    let file = std::fs::File::create(dest)?;
    let mut zip = zip::ZipWriter::new(file);
    let opts: zip::write::SimpleFileOptions = Default::default();
    zip.start_file("env.json", opts)
        .map_err(std::io::Error::other)?;
    zip.write_all(env_json.as_bytes())?;
    zip.start_file("installed.json", opts)
        .map_err(std::io::Error::other)?;
    zip.write_all(state_json.as_bytes())?;
    for (run_id, lines) in logs {
        zip.start_file(format!("logs/{run_id}.log"), opts)
            .map_err(std::io::Error::other)?;
        zip.write_all(lines.join("\n").as_bytes())?;
    }
    zip.finish().map_err(std::io::Error::other)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zip_contains_env_state_and_logs() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("diag.zip");
        build_zip(
            &dest,
            r#"{"os":"mac"}"#,
            r#"{"installations":[]}"#,
            &[("run-1".into(), vec!["첫 줄".into(), "둘째 줄".into()])],
        )
        .unwrap();
        let file = std::fs::File::open(&dest).unwrap();
        let mut zip = zip::ZipArchive::new(file).unwrap();
        let names: Vec<String> = (0..zip.len())
            .map(|i| zip.by_index(i).unwrap().name().to_string())
            .collect();
        assert!(names.contains(&"env.json".to_string()));
        assert!(names.contains(&"installed.json".to_string()));
        assert!(names.contains(&"logs/run-1.log".to_string()));
        let mut body = String::new();
        std::io::Read::read_to_string(&mut zip.by_name("logs/run-1.log").unwrap(), &mut body)
            .unwrap();
        assert!(body.contains("둘째 줄"));
    }
}
