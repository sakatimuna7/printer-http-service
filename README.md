# HTTP Printer Service

A lightweight, cross-platform printer service built with Bun for thermal receipt printers.

## 📁 Project Structure

```
eklinik-printer-service/
├── src/                    # Application source code
│   ├── index.ts           # Main entry point
│   ├── types.ts           # Type definitions
│   ├── usb-adapter.ts     # USB adapter implementation
│   └── portable-init.ts   # Portable initialization logic
│
├── scripts/               # Build and utility scripts
│   ├── bundler.ts        # Creates app-bundle.zip
│   ├── packager.ts       # Creates usb-data.ts
│   └── usb-data.ts       # Generated USB module data
│
├── launchers/            # Thin client bootstrapper
│   └── go/              # Go bootstrapper source
│       └── main.go
│
├── dist/                # Build outputs
│   ├── app-bundle.zip              # 3.2MB - Application bundle
│   ├── launcher.exe                # 8.4MB - Windows bootstrapper
│   └── printer-service-portable.exe # 106MB - Standalone executable
│
└── docs/                # Documentation
    ├── README.md        # Full documentation
    └── SETUP_GUIDE.md   # Setup guide
```

## 🚀 Quick Start

### Development

```bash
bun install
bun start
```

### Build Options

**Thin Client (Recommended - 11MB total)**

```bash
bun run bundle                  # Creates dist/app-bundle.zip (3.2MB)
bun run build:launcher:win      # Creates dist/launcher.exe (8.4MB)
```

**Standalone Executable (106MB)**

```bash
bun run build:portable          # Windows
bun run build:portable:linux    # Linux
```

## 📖 Documentation

See [docs/README.md](./docs/README.md) for full documentation and [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) for deployment instructions.

## 🔧 Available Scripts

- `bun start` - Start development server
- `bun run bundle` - Create thin client bundle
- `bun run build:launcher:win` - Build Windows launcher
- `bun run build:launcher:linux` - Build Linux launcher
- `bun run build:portable` - Build standalone Windows executable
- `bun run build:portable:linux` - Build standalone Linux executable

## 📦 Distribution

**Thin Client**: Distribute `launcher.exe` + `app-bundle.zip` (~11MB)
**Standalone**: Distribute `printer-service-portable.exe` (~106MB)
