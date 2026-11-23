# Triage labels

Скиллы говорят в терминах пяти канонических ролей. В этом репозитории роль сводится к статусу задачи во front matter и, если нужно, к `blocked_by`.

| Роль в mattpocock/skills | Что ставим | Значение |
| --- | --- | --- |
| `needs-triage` | `status: todo`, `blocked_by: []` | Задачу нужно разобрать |
| `needs-info` | `status: blocked`, `blocked_by: [human]` | Ждём ответа человека |
| `ready-for-agent` | `status: todo`, `blocked_by: []`, есть `spec` и приёмка | Можно брать в работу |
| `ready-for-human` | `status: blocked`, `blocked_by: [human]` | Нужен человек: доступы, площадки, решения |
| `wontfix` | `status: done`, `resolution: wontfix` | Осознанно не делаем |

Отдельных ярлыков нет: статус и блокировки уже лежат в front matter. `triage` читает эту таблицу, чтобы не искать внешний трекер.
