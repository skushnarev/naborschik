# Спека: релизы, версии и установка из интернета

> **Дата:** 2026-11-27
> **Основа:** `AGENTS.md`, `PLAN.md`, `manifest.json`, `esbuild.config.mjs`.
> **Связанное:** `.scratch/plugin-mvp/`, `README.md`.

## Проблема

Плагин собирается только локально. `dist/` в `.gitignore`, GitHub Actions нет, удалённого репозитория тоже нет. Поставить плагин может только автор: `make plugin-link` ставит симлинк на локальную сборку. Другой человек не может скачать готовый `main.js` и `manifest.json` из интернета.

Версия живёт в трёх файлах: `package.json`, `package-lock.json` и `manifest.json`. Раньше `make bump` поднимал патч вручную после каждой задачи. Для релиза этого мало: Obsidian читает версию из `manifest.json`, тег релиза должен с ней совпадать, а история изменений нигде не собирается. Коммиты уже идут по Conventional Commits, значит changelog можно строить автоматически.

## Решение

Сделать GitHub единственным местом, откуда плагин ставят другие люди. На каждый релиз GitHub Actions собирает `dist/`, проверяет, что версия в манифесте совпадает с тегом, и прикрепляет к релизу `main.js` и `manifest.json`. Установка описывается двумя путями: скачать файлы из релиза вручную или поставить через BRAT. Подача в каталог Community Plugins идёт отдельным шагом, когда релиз стабилен.

Текущий репозиторий `skushnarev/naborschik` публичный, отдельный релизный не заводим. В `REL-01` релиз запускается по push тега без префикса `v`: workflow сам создаёт GitHub Release и прикладывает `main.js` и `manifest.json`. `REL-02` заменяет этот запуск на release-please: тег и релиз создаёт он, а workflow только собирает и прикладывает артефакты. `LICENSE` отложен до REL-03: до этого репозиторий публичный, но не open source.

Версию и changelog ведёт release-please: он делает release PR, обновляет версию и `CHANGELOG.md` и ставит тег. commit-and-tag-version не выбран: release-please даёт release PR и changelog на GitHub. `REL-02` переводит на него весь релизный путь и убирает `make bump`.

release-please сам создаёт GitHub Release и тег, поэтому отдельный workflow на `release: published` не сработает: события, созданные `GITHUB_TOKEN`, не запускают другие workflow. Сборка и загрузка `main.js` и `manifest.json` идут в том же workflow, по условию `release_created`. Тег без префикса `v`.

## Что входит

- Workflow проверок на push и pull request.
- Workflow релиза через release-please: release PR, тег, GitHub Release, сборка и артефакты.
- Версия обновляется release-please в `package.json`, `package-lock.json` и `manifest.json`; `make version-check` проверяет согласованность и тег.
- `CHANGELOG.md` из Conventional Commits.
- Инструкция установки из релиза и через BRAT.
- Чеклист подачи в Community Plugins.

## Что не входит

- Публикация через API площадок.
- Автоматическая публикация в каталог Obsidian без ручной подачи.
- Подпись сборки, нотаризация и магазины приложений.
- Изменение кода плагина, разбора и адаптеров.
- Секреты и токены в репозитории.

## Задачи

- `REL-01` - релизный workflow GitHub Actions и артефакты.
- `REL-02` - release-please, версия и changelog.
- `REL-03` - установка из релиза, BRAT и чеклист Community Plugins.

`REL-01` даёт CI и релиз по тегу. `REL-02` заменяет ручной бамп и тег на release-please. `REL-03` идёт после обоих, потому что описывает уже работающий релиз.

## Критерий готовности

- Push в main прогоняет `make check`.
- Релиз собирается на GitHub и отдаёт `main.js` и `manifest.json`.
- Версия в `manifest.json` совпадает с тегом и `package.json`.
- `CHANGELOG.md` собирается из коммитов без ручного переписывания.
- README объясняет установку из релиза и через BRAT.
- Чеклист Community Plugins пройден или явно отложен.
