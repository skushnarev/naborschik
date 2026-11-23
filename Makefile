.PHONY: status docs-check test check agents prototype prototype-serve help

help: ## Показать цели
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'

status: ## Задачи: открытые (ARGS="VC-01..VC-05")
	node bin/status.mjs $(ARGS)

docs-check: ## Проверить задачи и запретить чеклисты в доках
	node bin/docs-check.mjs

test: ## Прогнать Node-тесты конвертера
	node --test prototype/tests/*.test.mjs

check: docs-check test ## Все проверки проекта

agents: ## Обновить симлинк команд OpenCode
	@mkdir -p .opencode
	@ln -sfn ../.agents/commands .opencode/commands
	@echo "Команды OpenCode: .opencode/commands -> .agents/commands"

prototype: ## Открыть прототип в браузере
	@open prototype/index.html

prototype-serve: ## Открыть прототип через локальный сервер
	@echo "http://localhost:4173/"
	@python3 -m http.server 4173 --directory prototype
