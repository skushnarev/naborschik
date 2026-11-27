# Скиллы: установка и раскладка

Источник: <https://github.com/mattpocock/skills>, коммит `abeeaf95660ba9e8b7c753eb38f441ca707a8823` от 2026-11-19, лицензия MIT. Копия лицензии лежит в `.agents/skills/LICENSE`.

## Что установлено

- 27 скиллов из наборов `skills/engineering/` и `skills/productivity/`.
- Каталоги `misc/`, `in-progress/`, `deprecated/` и bucket-README не копировались.
- 16 слэш-команд, по одной на каждый скилл с `disable-model-invocation: true`.
- 11 скиллов доступны агенту автоматически по описанию.

Скиллы лежат в `.agents/skills/` без изменений. Команды лежат в `.agents/commands/` и генерируются из скиллов.

## Почему `.agents/`, а не `.opencode/`

- `.agents/skills/` это проектный путь, который использует официальный установщик `npx skills add ... -a opencode`. Тот же каталог читают Codex, Cursor, GitHub Copilot и другие агенты.
- OpenCode V2 поддерживает `.agents/skills` как project compatibility source. При совпадении ID приоритет у `.opencode/skills`, но второго каталога здесь нет.
- OpenCode ищет команды только в `.opencode/commands/`. Поэтому там симлинк на `.agents/commands`, а не второй набор файлов.
- Источник один. Копии по харнесам не заводить.

## Команды

`.agents/commands/` это 16 статических обёрток, по одной на каждый скилл с `disable-model-invocation: true`:

```markdown
---
description: "..."
---

Call the `skill` tool with id `...` and follow that skill exactly. User input, if any:

$ARGUMENTS
```

Обёртки лежат в git, меню `/` работает без сборки. При обновлении скиллов сверить `description` в обёртке с `SKILL.md`. Если это станет рутиной, вернуть генератор.

`make agents` создаёт симлинк `.opencode/commands -> ../.agents/commands`. Сам каталог `.opencode/` в `.gitignore`, поэтому после клонирования достаточно одной команды.

## Два режима

| Режим | Сколько | Как попадает к агенту | Как вызывать |
| --- | --- | --- | --- |
| Model-invoked | 11 | Описание всегда в списке скиллов | автоматически или по имени |
| User-invoked | 16 | В списке агента нет, но скилл зарегистрирован | только `/имя` из `.agents/commands/` |

`disable-model-invocation` поддерживается OpenCode нативно, фронтматтер upstream не правился. «Невидимый» скилл всё равно загружается по ID, именно это делает команда-обёртка.

## Реестр

| Вызов | Когда | Что появляется |
| --- | --- | --- |
| `/grill-me` | Проверить спеку или план на дыры | Вопросы и решения |
| `/grill-with-docs` | Уточнить домен и термины | `GLOSSARY.md`, ADR в `docs/adr/` |
| `/to-spec` | Собрать спеку из обсуждения | `.scratch/<feature>/spec.md` |
| `/to-tickets` | Разбить спеку на задачи | `.scratch/<feature>/issues/*.md` |
| `/implement` | Реализовать задачу | Код, данные, проверки |
| `/retro`, `/handoff` | Граница среза или длинной сессии | Правки `AGENTS.md`, хендофф |
| `tdd`, `code-review` | Когда появится код | Тесты и ревью на швах |

## Обновление

1. Склонировать `mattpocock/skills` в временный каталог.
2. Скопировать только каталоги скиллов из `skills/engineering/` и `skills/productivity/` в `.agents/skills/`.
3. Скопировать `LICENSE`, если он изменился.
4. Сверить `description` в `.agents/commands/*.md` с обновлёнными `SKILL.md`.
5. Запустить `make agents` и открыть новую сессию, чтобы меню увидело правки.
6. Проверить `make status ARGS="--check"` и `make docs-check`.
7. Записать новый коммит источника в этот файл.

## Ограничения

- Скиллы написаны вокруг TypeScript-стека. В репозитории есть ядро, плагин и веб-конвертер, `tdd`, `prototype` и `code-review` подключаются по делу, а не по ритуалу.
- `improve-codebase-architecture` это обзор, а не спасение. На небольшом проекте он может предложить лишний рефакторинг, следовать слепо не нужно.
- Скиллы не отменяют `AGENTS.md`, `PLAN.md` и приёмку из спеки.
- Файлы `.scratch/` коммитятся: это история решений.
