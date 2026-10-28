NPM = /Users/marco.gallegos/.nvm/versions/node/v24.21.0/bin/npm
PLIST_NAME = com.marcogallegos.carelesswhisperui.plist
PLIST_SRC = $(CURDIR)/$(PLIST_NAME)
PLIST_DST = $(HOME)/Library/LaunchAgents/$(PLIST_NAME)
SERVICE_LABEL = com.marcogallegos.carelesswhisperui
URL = http://localhost:3000
LOG_DIR = $(CURDIR)/logs
STDOUT_LOG = $(LOG_DIR)/stdout.log
STDERR_LOG = $(LOG_DIR)/stderr.log

.PHONY: help build install uninstall load unload reload deploy status logs logs-clear

help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  %-12s %s\n", $$1, $$2}'

build: ## Build the app into dist/ (VITE_* env values are baked in here)
	@PATH=$(dir $(NPM)):$$PATH $(NPM) run build

install: ## Copy plist to ~/Library/LaunchAgents/
	@mkdir -p $(HOME)/Library/LaunchAgents
	@mkdir -p $(LOG_DIR)
	@cp $(PLIST_SRC) $(PLIST_DST)
	@echo "Installed $(PLIST_NAME) to ~/Library/LaunchAgents/"

uninstall: unload ## Unload and remove plist from LaunchAgents
	@rm -f $(PLIST_DST)
	@echo "Removed $(PLIST_NAME) from ~/Library/LaunchAgents/"

load: install ## Install and load the service
	@launchctl load $(PLIST_DST)
	@echo "Loaded $(PLIST_NAME)"

unload: ## Unload the service
	@launchctl unload $(PLIST_DST) 2>/dev/null || true
	@echo "Unloaded $(PLIST_NAME)"

reload: unload load ## Reload the service (unload + load)

deploy: build reload ## Build, then reload the service
	@sleep 2
	@$(MAKE) --no-print-directory status

status: ## Show service status
	@launchctl print gui/$$(id -u)/$(SERVICE_LABEL) 2>/dev/null | grep -E '^\s*(state|pid|last exit code) =' || echo "$(SERVICE_LABEL) is not loaded"
	@curl -s -o /dev/null -w "$(URL) -> HTTP %{http_code}\n" $(URL)/ || echo "$(URL) is not responding"

logs: ## Show recent stdout and stderr logs
	@echo "┌──────────────────────────────────────────────┐"
	@echo "│  stdout  (last 30 lines)                     │"
	@echo "└──────────────────────────────────────────────┘"
	@tail -30 $(STDOUT_LOG) 2>/dev/null || echo "  (no stdout log yet)"
	@echo ""
	@echo "┌──────────────────────────────────────────────┐"
	@echo "│  stderr  (last 30 lines)                     │"
	@echo "└──────────────────────────────────────────────┘"
	@tail -30 $(STDERR_LOG) 2>/dev/null || echo "  (no stderr log yet)"

logs-clear: ## Clear log files
	@> $(STDOUT_LOG) 2>/dev/null; > $(STDERR_LOG) 2>/dev/null || true
	@echo "Logs cleared"
