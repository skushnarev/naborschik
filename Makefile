.PHONY: status docs-check core-check version-check typecheck test check build dev golden public bump hooks agents plugin-link help

help: ## Показать цели
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'

status: ## Задачи: открытые (ARGS="VC-01..VC-05")
	node bin/status.mjs $(ARGS)

docs-check: ## Проверить задачи и запретить чеклисты в доках
	node bin/docs-check.mjs

core-check: ## Проверить, что ядро, адаптеры и веб-конвертер не импортируют obsidian
	node bin/core-check.mjs

version-check: ## Сверить версию в package.json, package-lock.json и manifest.json (ARGS="0.1.5")
	node bin/check-version.mjs $(ARGS)

typecheck: ## Проверить типы TypeScript
	./node_modules/.bin/tsc --noEmit

test: ## Node-тесты плагина и веб-сборки
	node --test test/*.test.ts

build: ## Собрать плагин в dist
	node esbuild.config.mjs production

dev: ## Сборка плагина с watch
	node esbuild.config.mjs

check: docs-check core-check version-check typecheck test build ## Все проверки проекта

golden: ## Пересобрать golden-фикстуры из `src/`
	node bin/make-golden.mjs

public: ## Собрать веб-конвертер в public/index.html (ARGS="папка")
	node bin/build-public.mjs $(ARGS)

bump: ## Поднять патч-версию плагина
	node bin/bump-version.mjs

hooks: ## Поставить pre-commit с make check
	@if [ -f .git/hooks/pre-commit ] && ! grep -q "make check" .git/hooks/pre-commit; then \
		echo "В .git/hooks/pre-commit уже есть другой хук, уберите его вручную."; \
		exit 1; \
	fi
	@printf '#!/bin/sh\nexec make check\n' > .git/hooks/pre-commit
	@chmod +x .git/hooks/pre-commit
	@echo "Pre-commit: .git/hooks/pre-commit -> make check"

agents: ## Обновить симлинк команд OpenCode
	@mkdir -p .opencode
	@ln -sfn ../.agents/commands .opencode/commands
	@echo "Команды OpenCode: .opencode/commands -> .agents/commands"

plugin-link: ## Поставить плагин в хранилище симлинком (VAULT=/путь/к/хранилищу)
	@test -n "$(VAULT)" || { echo "Укажите хранилище: make plugin-link VAULT=/путь/к/хранилищу"; exit 1; }
	@test -d "$(VAULT)" || { echo "Нет такого хранилища: $(VAULT)"; exit 1; }
	@test -d "$(VAULT)/.obsidian" || { echo "Похоже, это не хранилище Obsidian: $(VAULT)"; exit 1; }
	@$(MAKE) --no-print-directory build
	@mkdir -p "$(VAULT)/.obsidian/plugins"
	@ln -sfn "$(CURDIR)/dist" "$(VAULT)/.obsidian/plugins/naborschik"
	@echo "Плагин: $(VAULT)/.obsidian/plugins/naborschik -> dist"
