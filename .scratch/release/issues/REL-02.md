---
id: REL-02
title: "Перевести релиз на release-please"
status: done
resolution: fixed
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
- Настроить `release-type: node`, `include-v-in-tag: false`, `include-component-in-tag: false`, `include-v-in-release-name: false`.
- Подключить `manifest.json` через `extra-files` с jsonpath `$.version`.
- Поставить в манифест старт `{".": "0.1.5"}`, чтобы первый changelog начался с этой версии.
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
- Обычный semver: `feat` поднимает минор, `fix` патч, `chore`, `docs`, `test`, `build` и `ci` релиз не создают. `always-bump-patch` использовался только на первом релизе, чтобы получить `0.1.6`, и затем убран.
- Сборка и загрузка в том же workflow, без PAT для артефактов.
- Токен release-please: `secrets.RELEASE_PLEASE_TOKEN || secrets.GITHUB_TOKEN`. PAT нужен только чтобы release PR запускал CI.
- `CHANGELOG.md` с русскими заголовками.
- `make version-check` остаётся защитой, а не источником версии.

## Заметки

release-please публикует релиз до загрузки артефактов. Если окно без файлов мешает, включить `draft: true` и `force-tag-creation: true`, а публиковать после `gh release upload`.

## Итог

- `release-please-config.json` и `.release-please-manifest.json` добавлены. `release-type: node`, тег без `v` и без компонента, `manifest.json` обновляется через `extra-files`. Русские заголовки changelog заданы в `changelog-sections`.
- `.github/workflows/release.yml` запускается по push в `main`. Job `release-please` создаёт или обновляет release PR, job `artifacts` по `release_created` собирает `dist/`, гоняет `make check`, сверяет версию с тегом и прикладывает `main.js` и `manifest.json` через `gh release upload --clobber`.
- `make bump` и `bin/bump-version.mjs` удалены. `make version-check` остался защитой и входит в `make check`.
- Первый release PR #2 поднял версию до `0.1.6` в трёх файлах и создал `CHANGELOG.md`. PR смержен, workflow `46032426408` зелёный, релиз `0.1.6` опубликован: https://github.com/skushnarev/naborschik/releases/tag/0.1.6. Тег без префикса `v`, артефакты `main.js` и `manifest.json` на месте.
- `always-bump-patch` и `bootstrap-sha` убраны после первого релиза: дальше работает обычный semver. `feat` поднимает минор, `fix` патч, служебные типы релиз не создают.
- Release PR, созданный `GITHUB_TOKEN`, не запускает CI. В настройках репозитория включён пункт Allow GitHub Actions to create and approve pull requests, поэтому PR создаётся. Для проверок на release PR нужен `RELEASE_PLEASE_TOKEN`; без него версия проверяется локально через `make version-check`.
- `docs-check`, `make check` и CI на `main` зелёные. Повторный запуск workflow на уже существующем релизе не падает.
