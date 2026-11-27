---
id: REL-01
title: "Релизный workflow GitHub Actions и артефакты"
status: blocked
area: release
kind: chore
severity: P1
milestone: next
blocked_by: ["human"]
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
