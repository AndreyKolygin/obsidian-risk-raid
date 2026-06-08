# RAID Fields Reference
> Полное описание всех полей для заполнения RAID-записей в формате YAML.
> Используется как контекст для скилла автозаполнения.

---

## Структура файла проекта

Каждый проект — один `.md` файл в папке RAID (по умолчанию `RAID/`). Формат:

```markdown
---
project-name: "Название проекта"
---

# Название проекта — RAID Log

## R-001 Заголовок риска
```raid
status: open
owner: "Иван Иванов"
description: "Описание"
...
\```

## A-001 Заголовок допущения
```raid
...
\```
```

Тип определяется по первой букве идентификатора в заголовке `## {ID} {Заголовок}`:
- `R-NNN` — Risk (Риск)
- `A-NNN` — Assumption (Допущение)
- `I-NNN` — Issue (Проблема)
- `D-NNN` — Dependency (Зависимость)

Идентификаторы генерируются плагином автоматически. Не нужно прописывать `raid-type` или `raid-id` в frontmatter — тип читается из заголовка секции.

---

## Общие поля (все типы)

| YAML-ключ | Тип | Обязателен | Описание |
|---|---|---|---|
| `status` | enum | ✅ | Статус записи (значения зависят от типа) |
| `owner` | string | ✅ | Полное имя ответственного |
| `description` | string | ✅ | Краткое описание / суть |
| `deadline` | datetime | — | Срок в формате `YYYY-MM-DDTHH:MM`, например `2025-03-15T10:00` |
| `linked-items` | list | — | Список связанных ID: `[R-001, D-002]` |
| `tags` | list | — | Теги для фильтрации: `[security, finance]` |
| `created-at` | datetime | авто | ISO-дата создания (проставляется автоматически) |
| `updated-at` | datetime | авто | ISO-дата последнего обновления (проставляется автоматически) |
| `history` | list | авто | Журнал изменений (проставляется автоматически, не редактировать вручную) |

---

## RISK — Риск

### Статусы
| Значение | Смысл |
|---|---|
| `open` | Риск активен, меры не приняты |
| `watch` | Наблюдается, возможна эскалация |
| `mitigated` | Митигирован, меры приняты |
| `closed` | Закрыт, больше не актуален |

### Поля

| YAML-ключ | Тип | Когда | Описание |
|---|---|---|---|
| `probability` | enum | всегда | Вероятность: `high` / `medium` / `low` |
| `probability-note` | string | всегда | Пояснение: почему такая вероятность |
| `impact` | enum | всегда | Влияние: `high` / `medium` / `low` |
| `impact-note` | string | всегда | Пояснение: что именно и как затрагивается |
| `severity` | enum | авто | Высчитывается автоматически из probability + impact (см. матрицу) |
| `mitigation` | string | всегда | План митигации: что конкретно делается или будет сделано |

### Матрица серьёзности

```
Вероятность \ Влияние | low     | medium   | high
high                  | medium  | high     | critical
medium                | low     | medium   | high
low                   | low     | low      | medium
```

Значения severity: `critical` / `high` / `medium` / `low`

### Полный пример

```yaml
probability: high
probability-note: "Прецеденты согласования занимали 3–6 месяцев, у нас 2 месяца"
impact: high
impact-note: "Блокирует выход на рынок, потеря ~$500K выручки за квартал"
severity: critical
status: open
owner: "Андрей Колыгин"
description: "Регулятор может не согласовать продукт до дедлайна релиза"
mitigation: "Подать документы на 2 недели раньше, назначить куратора со стороны регулятора"
deadline: "2025-04-01T00:00"
tags: [compliance, launch]
linked-items: [D-001]
created-at: "2026-06-03T10:00:00.000Z"
updated-at: "2026-06-03T10:00:00.000Z"
history:
  - date: "2026-06-03T10:00:00.000Z"
    changes: [Item created]
```

---

## ASSUMPTION — Допущение

### Статусы
| Значение | Смысл |
|---|---|
| `unconfirmed` | Допущение не подтверждено, требует проверки |
| `confirmed` | Подтверждено источником или фактом |

### Поля при статусе `unconfirmed`

| YAML-ключ | Тип | Описание |
|---|---|---|
| `reasoning` | string | Обоснование: почему мы считаем это верным |
| `action` | string | Что нужно сделать для подтверждения |
| `if-wrong` | string | Последствия, если допущение окажется неверным |

### Поля при статусе `confirmed`

| YAML-ключ | Тип | Описание |
|---|---|---|
| `source` | string | Источник подтверждения (документ, человек, ссылка) |
| `recorded` | string | Где зафиксировано (Confluence, Jira, email, дата встречи) |
| `assumption-risk` | string | Риск, если допущение перестанет быть верным |

> Поля `reasoning`, `action`, `if-wrong` сохраняются в записи даже после смены статуса на `confirmed`.

### Полные примеры

```yaml
# unconfirmed
status: unconfirmed
owner: "Мария Петрова"
description: "Банк-партнёр поддерживает API v2 к марту 2025"
reasoning: "Roadmap партнёра содержит v2 в Q1 2025, устная договорённость на последней встрече"
action: "Получить письменное подтверждение от технического директора партнёра до 10 февраля"
if-wrong: "Придётся поддерживать legacy API v1 ещё 6 месяцев, +2 спринта разработки"
deadline: "2025-02-10T00:00"
tags: [integration, partner]
created-at: "2026-06-03T10:00:00.000Z"
updated-at: "2026-06-03T10:00:00.000Z"
```

```yaml
# confirmed
status: confirmed
owner: "Мария Петрова"
description: "Банк-партнёр поддерживает API v2 к марту 2025"
source: "Письмо от CTO Банка Альфа от 14.01.2025"
recorded: "Confluence: Integration/Partner-API, Jira BANK-441"
assumption-risk: "Если партнёр перенесёт релиз, интеграция задержится на 2 месяца"
reasoning: "Roadmap партнёра содержит v2 в Q1 2025, устная договорённость"
action: "Получить письменное подтверждение от технического директора"
if-wrong: "+2 спринта разработки на поддержку v1"
tags: [integration, partner]
created-at: "2026-06-03T10:00:00.000Z"
updated-at: "2026-06-10T14:00:00.000Z"
```

---

## ISSUE — Проблема

### Статусы
| Значение | Смысл |
|---|---|
| `blocker` | Блокирует работу команды / релиз |
| `open` | Зафиксирована, не начата |
| `in-progress` | В работе |
| `resolved` | Решена |

### Поля при статусе `blocker` / `open` / `in-progress`

| YAML-ключ | Тип | Описание |
|---|---|---|
| `issue-impact` | string | Влияние на команду, процессы, бизнес |
| `action` | string | Следующий конкретный шаг для решения |

### Поля при статусе `resolved`

| YAML-ключ | Тип | Описание |
|---|---|---|
| `issue-impact` | string | Какое влияние было (оставляем для истории) |
| `solution` | string | Как именно была решена проблема |

### Полные примеры

```yaml
# blocker
status: blocker
owner: "Дмитрий Сидоров"
description: "Нет схемы БД для расчёта долга, разработка стоит"
issue-impact: "2 разработчика заблокированы уже 3 дня, под угрозой спринт"
action: "Схема должна быть согласована финансовым аналитиком до пятницы"
deadline: "2025-02-07T18:00"
tags: [database, sprint-2]
linked-items: [D-003]
created-at: "2026-06-01T09:00:00.000Z"
updated-at: "2026-06-01T09:00:00.000Z"
```

```yaml
# resolved
status: resolved
owner: "Дмитрий Сидоров"
description: "Нет схемы БД для расчёта долга"
issue-impact: "2 разработчика были заблокированы 3 дня"
solution: "Схема согласована аналитиком 07.02, добавлена в Confluence. Разработка возобновлена."
tags: [database]
created-at: "2026-06-01T09:00:00.000Z"
updated-at: "2026-06-07T16:00:00.000Z"
```

---

## DEPENDENCY — Зависимость

### Статусы
| Значение | Смысл |
|---|---|
| `pending` | Ожидаем, ничего не начато |
| `in-progress` | Контакт установлен, идёт работа |
| `blocked` | Зависимость заблокирована |
| `confirmed` | Получено / готово |

### Направления (dependency-direction)
| Значение | Смысл |
|---|---|
| `inbound` | Нам нужно что-то от другой команды / системы |
| `outbound` | Мы что-то даём другой команде / системе |
| `external` | Внешний поставщик, партнёр, регулятор |

### Поля при статусе `pending` / `in-progress` / `blocked`

| YAML-ключ | Тип | Описание |
|---|---|---|
| `dependency-direction` | enum | Направление зависимости |
| `dependency-contact` | string | Контактное лицо / команда |
| `delay-risk` | string | Что произойдёт при задержке |

### Поля при статусе `confirmed`

| YAML-ключ | Тип | Описание |
|---|---|---|
| `dependency-direction` | enum | Направление |
| `dependency-contact` | string | Контактное лицо |
| *(delay-risk не нужен — зависимость получена)* | — | — |

### Полные примеры

```yaml
# pending
status: pending
owner: "Елена Кузнецова"
description: "Согласование compliance-требований от юридического департамента"
dependency-direction: inbound
dependency-contact: "Алексей Воронов, юр. отдел, a.voronov@company.ru"
delay-risk: "Без согласования нельзя запустить продукт в production, задержка релиза на 4+ недели"
deadline: "2025-03-01T00:00"
tags: [compliance, legal]
linked-items: [R-002]
created-at: "2026-06-03T10:00:00.000Z"
updated-at: "2026-06-03T10:00:00.000Z"
```

```yaml
# confirmed
status: confirmed
owner: "Елена Кузнецова"
description: "Согласование compliance-требований"
dependency-direction: inbound
dependency-contact: "Алексей Воронов, юр. отдел"
deadline: "2025-03-01T00:00"
tags: [compliance]
created-at: "2026-06-03T10:00:00.000Z"
updated-at: "2026-06-12T11:00:00.000Z"
```

---

## Сводная таблица всех YAML-ключей

| YAML-ключ | TS-поле | Тип | Применимость |
|---|---|---|---|
| `status` | status | enum | все типы |
| `owner` | owner | string | все типы |
| `description` | description | string | все типы |
| `deadline` | deadline | `YYYY-MM-DDTHH:MM` | все типы |
| `linked-items` | linkedItems | list of IDs | все типы |
| `tags` | tags | list of strings | все типы |
| `created-at` | createdAt | ISO datetime | все (авто) |
| `updated-at` | updatedAt | ISO datetime | все (авто) |
| `history` | history | list of entries | все (авто) |
| `probability` | probability | `high\|medium\|low` | Risk |
| `probability-note` | probabilityNote | string | Risk |
| `impact` | impact | `high\|medium\|low` | Risk |
| `impact-note` | impactNote | string | Risk |
| `severity` | severity | `critical\|high\|medium\|low` | Risk (авто) |
| `mitigation` | mitigation | string | Risk |
| `reasoning` | reasoning | string | Assumption |
| `action` | action | string | Assumption (unconfirmed), Issue |
| `if-wrong` | ifWrong | string | Assumption |
| `source` | source | string | Assumption (confirmed) |
| `recorded` | recorded | string | Assumption (confirmed) |
| `assumption-risk` | assumptionRisk | string | Assumption (confirmed) |
| `issue-impact` | issueImpact | string | Issue |
| `solution` | solution | string | Issue (resolved) |
| `dependency-direction` | dependencyDirection | `inbound\|outbound\|external` | Dependency |
| `dependency-contact` | dependencyContact | string | Dependency |
| `delay-risk` | delayRisk | string | Dependency (не confirmed) |

---

## Формат поля `history` (только для чтения)

Плагин добавляет запись в `history` при каждом создании и редактировании.

```yaml
history:
  - date: "2026-06-03T10:00:00.000Z"
    changes:
      - Item created
  - date: "2026-06-05T14:30:00.000Z"
    changes:
      - Status: open → watch
      - Mitigation updated
```

Не редактировать вручную — это аудит-лог плагина.

---

## Правила заполнения для скилла

### 1. Определить тип
По контексту описания задачи:
- **Risk** — что-то может пойти не так, есть вероятность негативного события
- **Assumption** — что-то считаем верным, но не проверили
- **Issue** — проблема уже существует, блокирует или замедляет
- **Dependency** — нам нужно что-то получить от кого-то

### 2. Выбрать статус
Исходя из текущего состояния, не желаемого.

### 3. Заполнить обязательные поля
- `status`, `owner`, `description` — обязательны всегда
- Для Risk: минимум `probability` + `impact` (severity посчитается сам)
- Для остальных: description обычно достаточно для минимальной записи

### 4. Заполнить контекстные поля
Согласно таблице полей для данного типа и статуса.

### 5. Формат заголовка секции
```
## {ID} {Краткое название}
```
ID присваивается плагином автоматически. Название — 3–7 слов, суть проблемы без воды.

### 6. Не заполнять автоматические поля
`created-at`, `updated-at`, `severity`, `history` — проставляются плагином автоматически.

---

## Минимально допустимые записи

### Risk (минимум)
```yaml
probability: high
impact: medium
status: open
owner: "Имя Фамилия"
description: "Краткое описание риска"
```

### Assumption (минимум)
```yaml
status: unconfirmed
owner: "Имя Фамилия"
description: "Что считаем верным"
```

### Issue (минимум)
```yaml
status: open
owner: "Имя Фамилия"
description: "Суть проблемы"
```

### Dependency (минимум)
```yaml
status: pending
owner: "Имя Фамилия"
description: "Что нам нужно от кого"
dependency-direction: inbound
```
