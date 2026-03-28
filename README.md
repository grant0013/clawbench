# ClawBench

<div align="center">

![ClawBench](https://img.shields.io/badge/ClawBench-v2.0.2-4f46e5?style=for-the-badge)
![Hark-Tech](https://img.shields.io/badge/by-Hark--Tech-0f172a?style=for-the-badge)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-334155?style=for-the-badge)
![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)

**AI Model Benchmarking — powered by llama.cpp**

*Benchmark any GGUF model on your hardware in minutes. No command line required.*

</div>

---

## Overview

**ClawBench** is a desktop application built by **Hark-Tech** that makes benchmarking large language models (LLMs) effortless. It automatically installs llama.cpp, detects your hardware, downloads models from HuggingFace, and runs professional-grade benchmarks — all from a clean, beginner-friendly interface.

Whether you're a developer comparing quantisation formats, a researcher profiling GPU performance, or simply someone who wants to know how fast a model runs on their machine, ClawBench gives you accurate, structured results with zero setup.

---

## Features

### Free Tier
| Feature | Description |
|---------|-------------|
| **Token Speed Benchmark** | Measures prompt processing (PP) and text generation (TG) tokens per second |
| **Memory Usage Benchmark** | Tracks RAM and VRAM consumption during inference |
| **Results Panel** | Visual display of benchmark results with charts |
| **History** | Browse and export past benchmark runs |
| **Manual Configuration** | Set llama.cpp path, GPU layers, threads manually |
| **Auto-Detect llama.cpp** | Scans common install locations for existing llama.cpp builds |
| **Claw Chat Launcher** | Generates a one-click `.bat` script to run your model with optimal settings |

### Premium Tier
| Feature | Description |
|---------|-------------|
| **Auto-Install llama.cpp** | Downloads and installs the correct prebuilt llama.cpp binary for your GPU automatically (CUDA / Vulkan / CPU) |
| **Hardware Detection** | Detects your GPU(s), VRAM, CPU cores/threads, and total RAM |
| **Auto-Optimise Settings** | Calculates the ideal GPU layers, thread count, batch size, and context size for your hardware and model |
| **HuggingFace Model Browser** | Search, browse, and download any GGUF model directly from HuggingFace inside the app |
| **Context Scaling Benchmark** | Charts how token speed changes across different context window sizes |
| **Batch Size Benchmark** | Profiles optimal batch size for your hardware |
| **Quantisation Comparison** | Compares all quant variants of a model side-by-side (Q4, Q6, Q8, etc.) |
| **Perplexity Benchmark** | Measures model quality with perplexity scoring |
| **Build llama.cpp from Source** | Compiles llama.cpp from source with the optimal backend for your GPU generation |

---

## Installation

### Requirements
- Windows 10/11 (64-bit) — macOS and Linux builds available
- NVIDIA GPU recommended (RTX series) for best performance
- 8 GB RAM minimum, 16 GB recommended

### Download
Download the latest installer from the [Releases](https://github.com/grant0013/clawbench/releases) page:

| File | Description |
|------|-------------|
| `ClawBench-2.0.0-Setup.exe` | Windows installer (recommended) |

Run the installer, choose your install location, and follow the on-screen steps. On first launch, ClawBench will automatically download and install llama.cpp for your hardware.

---

## Quick Start

1. **Launch ClawBench** — the Setup Wizard will automatically detect your GPU and download the correct llama.cpp build
2. **Select a model** — browse for a local `.gguf` file, or use the HuggingFace Browser (Premium) to download one
3. **Configure settings** — use Auto-Optimise (Premium) or set GPU layers and threads manually
4. **Run benchmark** — click **Run Benchmark** and watch results appear in real time
5. **Generate launcher** — click **Generate Launcher Script** to create a one-click **Claw Chat** script for your Desktop

---

## Benchmarks Explained

### Token Speed
The primary benchmark. Runs `llama-bench` and measures:
- **Prompt Processing (PP)** — how fast the model processes your input (tokens/sec)
- **Text Generation (TG)** — how fast the model generates responses (tokens/sec)

Higher is better. A generation speed above 15 t/s is comfortable for real-time chat.

### Memory Usage
Runs a short inference and captures:
- **Peak RAM** — system memory used during inference
- **Peak VRAM** — GPU memory used (NVIDIA only)
- **Model Size** — size of the `.gguf` file on disk

### Perplexity *(Premium)*
A quality metric — lower perplexity means the model has better language understanding. Useful for comparing quantisation levels (Q4 vs Q8) to see quality loss.

### Context Scaling *(Premium)*
Charts token speed at multiple context sizes (512 → 8192 tokens). Useful for finding the sweet spot between context length and speed on your hardware.

### Batch Size *(Premium)*
Tests prompt processing speed across different batch sizes. Useful for server/API deployments to maximise throughput.

### Quantisation Comparison *(Premium)*
Automatically benchmarks all quant variants (Q4_K_M, Q5_K_M, Q6_K, Q8_0, etc.) in the same folder and ranks them by speed and file size.

---

## Claw Chat Launcher

After running a Token Speed benchmark, click **Generate Launcher Script**. This creates a `Run ModelName.bat` file on your Desktop that:

- Displays your model name, GPU config, and measured speeds
- Launches `llama-cli` with your optimised settings
- Opens an interactive **Claw Chat** session — just type and press Enter
- Handles errors and waits before closing

Double-click the `.bat` file at any time to start chatting with your model — no terminal knowledge required.

---

## Settings

| Setting | Description |
|---------|-------------|
| **llama.cpp Path** | Path to the folder containing `llama-bench.exe`, `llama-cli.exe`, etc. Set automatically by the Setup Wizard |
| **Default GPU Layers** | Number of model layers to offload to GPU. `99` = all layers (recommended for VRAM > model size) |
| **Default Threads** | CPU threads for inference. Typically set to half your physical core count |
| **Default Models Directory** | Default folder that opens when browsing for model files |

---

## Obtaining a Premium Licence

Premium features are unlocked with a **ClawBench licence key** (format: `LLMB-XXXX-XXXX-XXXX-XXXX`).

### Purchase Instantly Online

> **[purchase.openclawarcade.org](https://purchase.openclawarcade.org)**

Two licence tiers are available — both are one-time payments with no subscription:

| | **Standard — £10** | **Lifetime — £25** |
|---|---|---|
| All Premium features | ✓ | ✓ |
| All v2.x updates | ✓ | ✓ |
| Future major versions | ✗ | ✓ |
| Key format | `LLMB-XXXX-XXXX-XXXX-XXXX` | `LLML-XXXX-XXXX-XXXX-XXXX` |

1. Visit **[purchase.openclawarcade.org](https://purchase.openclawarcade.org)**
2. Choose Standard or Lifetime and complete the secure Stripe checkout
3. Your licence key is displayed immediately on screen
4. A copy is also **emailed to you automatically** — check your inbox

The whole process takes under a minute. No account required.

### Activating Your Licence
1. Open ClawBench
2. Go to **Settings**
3. In the **Licence** section, enter your key
4. Click **Activate** — Premium unlocks immediately, no restart required

### Licence Terms
- One-time payment — no subscription, no renewal fees
- **Standard**: covers all v2.x releases. A discounted upgrade will be offered when v3 launches
- **Lifetime**: covers all current and future major versions, forever
- Licences are stored locally — they persist across app updates automatically
- Business/multi-seat licences available — contact [hello@openclawarcade.org](mailto:hello@openclawarcade.org)

### Lost Your Key?
Your key is tied to your Stripe payment. If you've lost it, email [hello@openclawarcade.org](mailto:hello@openclawarcade.org) with your payment confirmation and we'll resend it.

---

## Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [Git](https://git-scm.com/)

### Steps

```bash
# Clone the repository
git clone https://github.com/grant0013/clawbench.git
cd clawbench

# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build distributable
npm run electron:build
```

The packaged output will appear in the `release/` folder.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop Framework | [Electron](https://electronjs.org/) 41 |
| Frontend | [React](https://react.dev/) 19 + TypeScript |
| Build Tool | [Vite](https://vitejs.dev/) 8 |
| Charts | [Recharts](https://recharts.org/) |
| Database | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Benchmark Engine | [llama.cpp](https://github.com/ggerganov/llama.cpp) |
| Packaging | [electron-builder](https://www.electron.build/) |

---

## Legal

### Copyright
© 2026 **Hark-Tech**. All rights reserved.

ClawBench is a proprietary software product created and owned by Hark-Tech. Unauthorised copying, redistribution, modification, or reverse engineering of this software is strictly prohibited.

### Licence
This software is **not open source**. The source code is published on GitHub for transparency and issue tracking purposes only. You may not use, copy, modify, or distribute this software or its source code without explicit written permission from Hark-Tech.

**You are permitted to:**
- Download and use ClawBench on your own devices
- Report bugs and submit feature requests via GitHub Issues

**You are not permitted to:**
- Redistribute or resell ClawBench
- Modify or create derivative works
- Reverse engineer the licence system
- Use any portion of the source code in other projects

### Third-Party Software
ClawBench uses the following open-source components, each under their respective licences:

| Software | Licence |
|----------|---------|
| [llama.cpp](https://github.com/ggerganov/llama.cpp) | MIT |
| [Electron](https://electronjs.org/) | MIT |
| [React](https://react.dev/) | MIT |
| [Recharts](https://recharts.org/) | MIT |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | MIT |

### Disclaimer
ClawBench is provided "as is" without warranty of any kind. Hark-Tech is not liable for any damage to hardware, data loss, or any other issues arising from the use of this software. Benchmark results are indicative and may vary based on system configuration, background processes, and thermal conditions.

### Privacy
ClawBench does not collect, transmit, or store any personal data. All benchmark results and settings are stored locally on your machine. Licence key validation communicates with Hark-Tech servers only to verify key authenticity — no personal information is sent.

---

## Support

For support, bug reports, or feature requests:

- **GitHub Issues:** [github.com/grant0013/clawbench/issues](https://github.com/grant0013/clawbench/issues)
- **Email:** [hello@openclawarcade.org](mailto:hello@openclawarcade.org)

---

<div align="center">

Made with ❤️ by **Hark-Tech**

</div>
