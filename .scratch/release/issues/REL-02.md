---
id: REL-02
title: "Перевести релиз на release-please"
status: doing
area: release
kind: chore
severity: P1
milestone: next
blocked_by: []
spec: .scratch/release/spec.md
updated: 2026-11-27
---

## Проблема

Версия поднимается вручную через `make bump` после каждой задачи, которая меняет сборку. `CHANGELOG.md` нет, история изменений собирается только из `git log`. Текущий `release.yml` создаёт релиз по тегу. release-please умеет сам вести версию, changelog, тег и GitHub Release, поэтому ручной бамп и отдельный создатель релиза становятся лишними.

## Что сделать

- Добавить `release-please-config.json` и `.release-please-manifest.json`.
- Настроить `release-type: node`, `versioning: always-bump-patch`, `include-v-in-tag: false`, `include-component-in-tag: false`, `include-v-in-release-name: false`. Без `always-bump-patch` коммиты `chore` не дают релиза.
- Подключить `manifest.json` через `extra-files` с jsonpath `$.version`.
- Поставить в манифест старт `{".": "0.1.5"}` и `bootstrap-sha` на коммит тега `0.1.5`, чтобы первый changelog не захватил всю историю.
- Переписать `.github/workflows/release.yml` на `push: main`: шаг `googleapis/release-please-action@v4`, затем по `release_created == 'true'` checkout, `npm ci`, `make check` и `gh release upload ... --clobber`. `make check` уже собирает `dist/`.
- Выдать job права `contents: write`, `pull-requests: write` и `issues: write`.
- Удалить запуск по тегу. События от `GITHUB_TOKEN` не запускают другие workflow, поэтому сборка и загрузка идут в том же workflow, без PAT.
- Решить токен для release-please: с `GITHUB_TOKEN` release PR не запускает CI. Добавить `RELEASE_PLEASE_TOKEN` с точечными правами или принять ручную проверку перед merge.
- Удалить `bin/bump-version.mjs`, цель `make bump` и правило в `AGENTS.md` о росте патча после каждой задачи. Версия меняется только в release PR.
- Оставить `make version-check` как защиту: она ловит расхождение `package.json`, `package-lock.json`, `manifest.json` и тега.
- Настроить русские заголовки changelog через `changelog-sections`, скрыть `chore` и `test`, если они не нужны читателю.
- Проверить цикл на тестовой ветке или форке.

## Приёмка

- Release PR сам поднимает версию в `package.json`, `package-lock.json` и `manifest.json` и обновляет `CHANGELOG.md`.
- После merge release-please создаёт тег без `v` и GitHub Release, а job прикладывает `main.js` и `manifest.json`.
- `make check` падает, если версия и тег расходятся.
- `make bump` и `bump-version.mjs` удалены, `AGENTS.md` обновлён.
- Release PR запускает CI, если добавлен `RELEASE_PLEASE_TOKEN`; без него проверка перед merge ручная.
- Повторный запуск не падает на уже существующем релизе.
- Русские сообщения коммитов читаемы в changelog.

## Вне рамок

- Создание репозитория, CI и первый релиз: это `REL-01`.
- Подача в Community Plugins: это `REL-03`.
- Переписывание старых коммитов и релизов.
- Идемпотентность tag-push workflow: он удаляется.

## Решения

- Максимум release-please: версия, changelog, тег и релиз у него. Свои скрипты бампа убираем.
- Тег без `v`: `include-v-in-tag: false` и `include-component-in-tag: false`.
- `versioning: always-bump-patch`, потому что задачи идут как `chore`, а правило репозитория требует патч.
- Сборка и загрузка в том же workflow, без PAT для артефактов.
- Токен release-please: `secrets.RELEASE_PLEASE_TOKEN || secrets.GITHUB_TOKEN`. PAT нужен только чтобы release PR запускал CI.
- `CHANGELOG.md` с русскими заголовками.
- `make version-check` остаётся защитой, а не источником версии.

## Заметки

release-please публикует релиз до загрузки артефактов. Если окно без файлов мешает, включить `draft: true` и `force-tag-creation: true`, а публиковать после `gh release upload`.
