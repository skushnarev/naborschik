.PHONY: status docs-check typecheck test test-proto check build dev hooks agents prototype prototype-serve plugin-link help

help: ## Показать цели
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'

status: ## Задачи: открытые (ARGS="VC-01..VC-05")
	node bin/status.mjs $(ARGS)

docs-check: ## Проверить задачи и запретить чеклисты в доках
	node bin/docs-check.mjs

typecheck: ## Проверить типы TypeScript
	./node_modules/.bin/tsc --noEmit

test: ## Node-тесты плагина
	node --test test/*.test.ts

test-proto: ## Node-тесты прототипа
	node --test prototype/tests/*.test.mjs

build: ## Собрать плагин в dist
	node esbuild.config.mjs production

dev: ## Сборка плагина с watch
	node esbuild.config.mjs

check: docs-check typecheck test test-proto build ## Все проверки проекта

hooks: ## Поставить pre-commit с make check
	@printf '#!/bin/sh\nexec make check\n' > .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "Pre-commit: .git/hooks/pre-commit -> make check"

agents: ## Обновить симлинк команд OpenCode
	@mkdir -p .opencode
	@ln -sfn ../.agents/commands .opencode/commands
	@echo "Команды OpenCode: .opencode/commands -> .agents/commands"

prototype: ## Открыть прототип в браузере
	@open prototype/index.html

prototype-serve: ## Открыть прототип через локальный сервер
	@echo "http://localhost:4173/"
	@python3 -m http.server 4173 --directory prototype

plugin-link: ## Поставить плагин в хранилище симлинком (VAULT=/путь/к/хранилищу)
	@test -n "$(VAULT)" || { echo "Укажите хранилище: make plugin-link VAULT=/путь/к/хранилищу"; exit 1; }
	@test -d "$(VAULT)" || { echo "Нет такого хранилища: $(VAULT)"; exit 1; }
	@test -d "$(VAULT)/.obsidian" || { echo "Похоже, это не хранилище Obsidian: $(VAULT)"; exit 1; }
	@$(MAKE) --no-print-directory build
	@mkdir -p "$(VAULT)/.obsidian/plugins"
	@ln -sfn "$(CURDIR)/dist" "$(VAULT)/.obsidian/plugins/naborschik"
	@echo "Плагин: $(VAULT)/.obsidian/plugins/naborschik -> dist"
