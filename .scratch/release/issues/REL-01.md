---
id: REL-01
title: "Релизный workflow GitHub Actions и артефакты"
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

В репозитории нет `.github/`, удалённого репозитория и релизов. `dist/` в `.gitignore`, поэтому готовую сборку никто, кроме автора, не получит. Даже если файлы выложить вручную, нет проверки, что тег совпадает с `manifest.json` и что в релиз попали именно `main.js` и манифест.

## Что сделать

- Завести удалённый репозиторий на GitHub и решить, будет он публичным или отдельным релизным.
- Добавить workflow проверок на push и pull request: `npm ci`, `make check`.
- Добавить workflow релиза по тегу вида `0.1.4` или по опубликованному release PR.
- В релизном workflow собирать `dist/`, сравнивать версию `manifest.json` с тегом без префикса `v` и падать при расхождении.
- Прикреплять к релизу `dist/main.js` и `dist/manifest.json`. Если появится `styles.css`, добавлять и его.
- Использовать только `GITHUB_TOKEN` с правом `contents: write`, без личных токенов.
- Описать в README, какие настройки репозитория нужны для workflow.

## Приёмка

- Проверочный workflow зелёный на push и pull request.
- Тестовый тег собирает релиз и прикладывает `main.js` и `manifest.json`.
- Тег с версией, отличной от манифеста, роняет workflow.
- `dist/` по-прежнему не коммитится.
- Секретов в репозитории нет.

## Вне рамок

- Генерация changelog и semver: это `REL-02`.
- Инструкция установки и подача в Community Plugins: это `REL-03`.
- Подпись сборки и нотаризация.

## Решения

- Текущий репозиторий `skushnarev/naborschik` публичный, отдельный релизный не заводим.
- Релиз запускается по push тега без префикса `v`. Workflow сам создаёт GitHub Release.
- Первый релиз это текущая версия `0.1.5`, обычный, не prerelease.
- `bin/check-version.mjs` сверяет `package.json`, `package-lock.json` и `manifest.json`, с аргументом ещё и тег. Проверка входит в `make check`.
- Плохой тег проверяется настоящим тегом `0.1.99`, после проверки тег удаляется. Плюс тест на скрипт версии.
- Тело релиза на русском, название `Naborschik 0.1.5`, публикуется сразу.
- Релизный workflow гоняет `make check` и проверяет, что тег указывает на коммит из `main`.
- CI на Node 26 и `ubuntu-latest`, официальные actions по major-тегу, релиз через `gh`.
- `LICENSE` отложен до `REL-03`.
- `REL-01` проверяется в ветке и PR, затем merge в `main`.

## Итог

- `.github/workflows/ci.yml` гоняет `npm ci` и `make check` на push в `main` и на pull request. PR #1 и push в `main` зелёные.
- `.github/workflows/release.yml` запускается по тегу без префикса `v`, проверяет, что тег указывает на коммит из `main`, гоняет `make check`, сверяет версию с тегом и создаёт GitHub Release. `main.js` и `manifest.json` прикладываются всегда, `styles.css` только если появится в `dist/`.
- `bin/check-version.mjs` и `make version-check` сверяют `package.json`, `package-lock.json` и `manifest.json`, с аргументом ещё и тег. Проверка входит в `make check`, тест `test/version.test.ts` покрывает расхождение версий, чужой тег и префикс `v`.
- Тег `0.1.99` уронил релизный workflow на сверке версии и удалён. Релиз `0.1.5` опубликован: https://github.com/skushnarev/naborschik/releases/tag/0.1.5. `main.js` и `manifest.json` совпадают с локальной сборкой по sha256.
- `dist/` не коммитится, версия осталась `0.1.5`: сборка плагина не менялась.
- Используется только `GITHUB_TOKEN` с `contents: write` в релизном job. Права по умолчанию в репозитории остаются read-only, право записи для всего репозитория не нужно.
- README описывает процесс релиза и настройки, глоссарий получил термины «версия плагина», «тег релиза», «релиз» и «артефакт релиза».
