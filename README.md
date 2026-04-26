# IdleForge

Mobile-first idle/action prototype. Mine ore, fight mobs, craft equipment, descend deeper.

**Live demo:** _добавить ссылку GitHub Pages после деплоя_

## Стек

Чистая статика — HTML5 + ES modules + Canvas 2D. Без сборки, без зависимостей.
Целевой viewport: 390×844 (iPhone-размер), управление тач-первое, работает и в десктоп-браузере.

## Управление

- **Свайп / удержание пальца на экране** — джойстик. Появляется в точке касания.
- **Тап на кнопку «◆ TAP TO CRAFT ◆» / «◆ TAP TO SHOP ◆»** — войти в кузню или магазин (когда персонаж рядом со зданием).
- **Тап на портал** — переход на следующий этаж (если есть требуемая кирка).
- **Боковые кнопки** (Inventory, Forge, Shop) — открыть соответствующий попап в любой момент.
- **WASD** на десктопе — движение.

## Структура

```
index.html        # entry, HUD markup, all CSS
game.js           # state + simulation tick + action functions
ui.js             # canvas rendering, popup rendering, event handlers
balance/          # pure data tables (player, ores, pickaxes, mobs, …)
```

## Прогрессия

4 этажа: Surface Quarry → Copper Mine → Iron Depths → Silver Depths.
Каждый этаж требует кирку соответствующего тира для портала вниз. Боссы перед порталами:
**King of Snakes** (Mine 1) → **Iron Warlord** (Mine 2) → **Alpha Werewolf** (Mine 3).

## Атрибуция

Иконки мобов и интерфейса — [game-icons.net](https://game-icons.net), лицензия [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/):

- Rock Golem — **Delapouite**
- Snake, Battle Gear, Werewolf — **Lorc**

## Запуск локально

ES-модули требуют HTTP-сервера (не работает через `file://`). Любой статик-сервер подойдёт:

```sh
# Python
python3 -m http.server 8000

# Node
npx serve

# VSCode
расширение Live Server → правый клик на index.html → Open with Live Server
```

Открыть `http://localhost:8000/`.
