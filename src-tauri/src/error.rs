use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("레시피 파일을 읽을 수 없어요 ({file}): {message}")]
    RecipeParse { file: String, message: String },
    #[error("레시피를 찾을 수 없어요: {0}")]
    UnknownRecipe(String),
    #[error("레시피끼리 서로를 기다리고 있어요: {0:?}")]
    DependencyCycle(Vec<String>),
    #[error("{recipe} 레시피는 {platform}을 지원하지 않아요")]
    PlatformUnsupported { recipe: String, platform: String },
    #[error("레시피 서명이 올바르지 않아요: {0}")]
    SignatureInvalid(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}
