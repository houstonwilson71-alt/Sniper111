use std::io;

fn main() -> io::Result<()> {
    tonic_build::configure()
        .build_client(false)
        .build_server(true)
        .compile_protos(&["../common/proto/engine.proto"], &["../common/proto"])?;
    Ok(())
}
