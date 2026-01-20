package main

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
)

type GitHubRelease struct {
	TagName string `json:"tag_name"`
	Assets  []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

const (
	REPO_OWNER = "sakatimuna7" 
	REPO_NAME  = "printer-http-service"      
	BUN_VER    = "v1.1.38"
)

func main() {
	fmt.Println("==========================================")
	fmt.Println("   PRINTER SERVICE - BOOTSTRAPPER")
	fmt.Println("==========================================")

	baseDir, _ := os.Getwd()
	binDir := filepath.Join(baseDir, "bin")
	os.MkdirAll(binDir, 0755)

	bunExe := filepath.Join(binDir, "bun")
	if runtime.GOOS == "windows" {
		bunExe += ".exe"
	}

	appBundle := filepath.Join(binDir, "index.js")

	// 1. Ensure Bun is present
	if _, err := os.Stat(bunExe); os.IsNotExist(err) {
		fmt.Println("[1/2] Bun not found. Downloading runtime...")
		if err := downloadBun(binDir); err != nil {
			fmt.Printf("❌ Error downloading Bun: %v\n", err)
			pause()
			return
		}
	}

	// 2. Check for latest app-bundle from GitHub Releases
	if _, err := os.Stat(appBundle); os.IsNotExist(err) {
		fmt.Println("[2/2] App bundle not found. Fetching latest release...")
		
		if err := downloadLatestBundle(binDir); err != nil {
			fmt.Printf("❌ Error downloading bundle: %v\n", err)
			
			// Fallback to local bundle
			localZip := filepath.Join(baseDir, "dist", "app-bundle.zip")
			if _, err := os.Stat(localZip); err == nil {
				fmt.Println("📦 Using local dist/app-bundle.zip as fallback...")
				if err := unzip(localZip, binDir); err != nil {
					fmt.Printf("❌ Error extracting bundle: %v\n", err)
				} else {
					fmt.Println("✅ Bundle extracted from dist/app-bundle.zip")
				}
			} else {
				fmt.Println("❌ No bundle found!")
				fmt.Println("Please build the bundle using 'bun run bundle' first.")
				pause()
				return
			}
		}
	}

	for {
		// 3. Check for updates on every restart
		checkForUpdates(binDir)

		fmt.Println("🚀 Starting Service...")
		cmd := exec.Command(bunExe, "run", appBundle)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin

		// --- Watchdog Mechanism ---
		done := make(chan bool)
		go func() {
			ticker := time.NewTicker(30 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-done:
					return
				case <-ticker.C:
					// Ping health endpoint
					resp, err := http.Get("http://localhost:5001/health")
					if err != nil || resp.StatusCode != 200 {
						fmt.Printf("⚠️ Watchdog: Service unresponsive (err: %v). Killing process...\n", err)
						if cmd.Process != nil {
							cmd.Process.Kill()
						}
						return
					}
					resp.Body.Close()
				}
			}
		}()
		// --------------------------

		if err := cmd.Run(); err != nil {
			fmt.Printf("❌ Service exited: %v\n", err)
		} else {
			fmt.Println("ℹ️ Service stopped.")
		}
		close(done)

		fmt.Println("🔄 Restarting in 2 seconds...")
		time.Sleep(2 * time.Second)
	}
}

func getCurrentVersion(binDir string) string {
	data, err := os.ReadFile(filepath.Join(binDir, "version"))
	if err != nil {
		return ""
	}
	return string(data)
}

func setCurrentVersion(binDir string, version string) {
	os.WriteFile(filepath.Join(binDir, "version"), []byte(version), 0644)
}

func checkForUpdates(binDir string) {
	current := getCurrentVersion(binDir)
	fmt.Printf("🔍 Checking for updates... (Current: %s)\n", current)

	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", REPO_OWNER, REPO_NAME)
	resp, err := http.Get(apiURL)
	if err != nil {
		fmt.Printf("⚠️ Update check failed: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return
	}

	if release.TagName != current {
		fmt.Printf("✨ New version available: %s! Updating...\n", release.TagName)
		if err := downloadLatestBundle(binDir); err != nil {
			fmt.Printf("❌ Update failed: %v\n", err)
		} else {
			setCurrentVersion(binDir, release.TagName)
			fmt.Printf("✅ Updated to %s\n", release.TagName)
		}
	} else {
		fmt.Println("✅ Service is up to date.")
	}
}

func downloadLatestBundle(destDir string) error {
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", REPO_OWNER, REPO_NAME)
	
	resp, err := http.Get(apiURL)
	if err != nil {
		return fmt.Errorf("failed to fetch release info: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return fmt.Errorf("failed to parse release JSON: %w", err)
	}

	// Find app-bundle.zip in assets
	var bundleURL string
	for _, asset := range release.Assets {
		if asset.Name == "app-bundle.zip" {
			bundleURL = asset.BrowserDownloadURL
			break
		}
	}

	if bundleURL == "" {
		return fmt.Errorf("app-bundle.zip not found in release %s", release.TagName)
	}

	fmt.Printf("📥 Downloading %s...\n", release.TagName)
	zipPath := filepath.Join(destDir, "app-bundle.zip")
	if err := downloadFile(bundleURL, zipPath); err != nil {
		return fmt.Errorf("failed to download bundle: %w", err)
	}

	fmt.Println("📦 Extracting bundle...")
	if err := unzip(zipPath, destDir); err != nil {
		return fmt.Errorf("failed to extract bundle: %w", err)
	}

	os.Remove(zipPath)
	// No longer printing success here as checkForUpdates handles it
	return nil
}

func downloadBun(destDir string) error {
	var url string
	switch runtime.GOOS {
	case "windows":
		url = fmt.Sprintf("https://github.com/oven-sh/bun/releases/download/bun-%s/bun-windows-x64.zip", BUN_VER)
	case "linux":
		url = fmt.Sprintf("https://github.com/oven-sh/bun/releases/download/bun-%s/bun-linux-x64.zip", BUN_VER)
	case "darwin":
		url = fmt.Sprintf("https://github.com/oven-sh/bun/releases/download/bun-%s/bun-darwin-aarch64.zip", BUN_VER)
	default:
		return fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}

	zipPath := filepath.Join(destDir, "bun_download.zip")
	if err := downloadFile(url, zipPath); err != nil {
		return err
	}

	if err := unzip(zipPath, destDir); err != nil {
		return err
	}

	// Move bun.exe/bun up if it was in a subfolder
	subfolder := ""
	if runtime.GOOS == "windows" {
		subfolder = "bun-windows-x64"
	} else if runtime.GOOS == "linux" {
		subfolder = "bun-linux-x64"
	} else if runtime.GOOS == "darwin" {
		subfolder = "bun-darwin-aarch64"
	}

	if subfolder != "" {
		src := filepath.Join(destDir, subfolder, "bun")
		if runtime.GOOS == "windows" {
			src += ".exe"
		}
		
		dest := filepath.Join(destDir, filepath.Base(src))
		os.Rename(src, dest)
		os.RemoveAll(filepath.Join(destDir, subfolder))
	}

	os.Remove(zipPath)
	return nil
}

func downloadFile(url string, path string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	out, err := os.Create(path)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func unzip(src string, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		fpath := filepath.Join(dest, f.Name)
		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, os.ModePerm)
			continue
		}

		if err = os.MkdirAll(filepath.Dir(fpath), os.ModePerm); err != nil {
			return err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()

		if err != nil {
			return err
		}
	}
	return nil
}

func pause() {
	fmt.Println("\nPress Enter to exit...")
	var dummy string
	fmt.Scanln(&dummy)
}
