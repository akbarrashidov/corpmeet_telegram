import "@testing-library/jest-dom/vitest";

// App.tsx инициализирует localStorage="uz" для новых юзеров в Telegram.
// В тестах нужен RU (тесты ассертят русские строки).
try {
  localStorage.setItem("corpmeet_lang", "ru");
} catch {
  // localStorage unavailable in pure-JS tests
}
