# TG Bot Designer

Прототип визуального конструктора Telegram-ботов: проектируйте сценарии диалогов, кнопки и переходы на канвасе. React + Vite + Tailwind CSS.

## Возможности

- Визуальный редактор сценариев бота (узлы и переходы)
- Виртуализированный список компонентов (`react-window`) для производительности
- Горячая перезагрузка в разработке (Vite HMR)

## Запуск

```bash
npm install
npm run dev
```

Сборка production-версии:

```bash
npm run build
npm run preview
```

## Стек

- [React 18](https://react.dev/)
- [Vite 5](https://vitejs.dev/)
- [Tailwind CSS 3](https://tailwindcss.com/)
- [react-window](https://react-window.vercel.app/)

## Структура

- `src/App.jsx` — точка входа приложения
- `src/TgBotDesignerPrototype.jsx` — прототип редактора
- `src/TgBotDesignerPrototype_new.jsx` — переработанная версия прототипа
- `public/` — статические файлы

## Демо

Живая версия: https://artem891372.github.io/tg-bot-designer/

## Статус

Прототип / эксперимент — функциональность в разработке.

## Лицензия

MIT — см. [LICENSE](LICENSE).
