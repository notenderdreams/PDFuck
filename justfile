default: run

install:
    bun install
    cargo fetch --manifest-path src-tauri/Cargo.toml

run:
    bun run dev

run-web:
    bun run dev:web

build:
    bun run build

build-web:
    bun run build:web

check:
    bun x tsc --noEmit
    cargo check --manifest-path src-tauri/Cargo.toml

clean:
    cargo clean --manifest-path src-tauri/Cargo.toml
    rm -rf dist node_modules
