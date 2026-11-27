---
id: REL-02
title: "Semver и changelog из Conventional Commits"
status: todo
area: release
kind: chore
severity: P1
milestone: next
blocked_by: []
spec: .scratch/release/spec.md
updated: 2026-11-27
---

## Проблема

Версия поднимается вручную через `make bump` после каждой задачи, которая меняет сборку. `CHANGELOG.md` нет, история изменений собирается только из `git log`. Для релиза нужен предсказуемый semver и changelog, а ручной бамп после каждой задачи конфликтует с автоматическим релизом.

## Что сделать

- Сравнить release-please и commit-and-tag-version на этом репозитории: release PR, обновление `package.json`, `package-lock.json` и `manifest.json`, тег, `CHANGELOG.md`.
- Выбрать инструмент и записать причину в итог задачи.
- Настроить разбор Conventional Commits с русским текстом и существующими типами `feat`, `fix`, `chore`, `docs`, `test`.
- Решить, остаётся ли `make bump` для локальных сборок. Если правило «патч растёт после каждой задачи» отменяется, обновить `AGENTS.md` и `docs/agents/issue-tracker.md`.
- Добавить проверку, что версии в `package.json`, `package-lock.json` и `manifest.json` совпадают.
- Проверить инструмент на тестовой ветке или форке, не ломая текущую версию.

## Приёмка

- Тестовый релизный цикл даёт версию, тег и `CHANGELOG.md` без ручной правки.
- `manifest.json` получает ту же версию, что `package.json` и тег.
- Русские сообщения коммитов попадают в changelog читаемо.
- `make check` падает при расхождении версий.
- Решение по `make bump` записано, документы обновлены.

## Вне рамок

- Создание GitHub-репозитория и workflow сборки: это `REL-01`.
- Подача в Community Plugins: это `REL-03`.
- Переписывание старых коммитов и старых релизов.
