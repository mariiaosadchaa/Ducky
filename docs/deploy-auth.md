# Вхід через Google та обліковий запис Rivna app (Supabase)

Ducky використовує **той самий проєкт Supabase, що й Rivna app**. Тому один обліковий запис працює в обох застосунках, а дані Ducky лежать в окремій таблиці `ducky_data`.

## 1. База даних
Supabase → SQL Editor → New query → вставити `docs/supabase.sql` → Run.
У файлі дві частини: особиста таблиця `ducky_data` і спільна комора сім'ї `ducky_household_data`. Другу частину запустіть, щоб працював перемикач «Сім'я: …» вгорі сторінки. Якщо буде помилка `operator does not exist: uuid = ...`, значить `household_id` у Rivna app не uuid, тоді змініть тип у першому рядку таблиці.

## 2. Ключі
Supabase → Project Settings → API. Скопіюйте **Project URL** та **anon public key** у `web/config.js`:

```js
window.DUCKY_CONFIG = {
  supabaseUrl: 'https://XXXX.supabase.co',
  supabaseAnonKey: 'eyJ...',
};
```
anon key публічний за задумом, безпеку забезпечують політики RLS з `supabase.sql`. **service_role key сюди вставляти не можна.**

## 3. Адреси повернення
Supabase → Authentication → URL Configuration:
- Site URL: `https://ducky-navy.vercel.app`
- Redirect URLs: додати `https://ducky-navy.vercel.app/**` та (для локальної перевірки) `http://localhost:3000/**`

## 4. Google
1. Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.
2. Authorized redirect URI: `https://XXXX.supabase.co/auth/v1/callback`
3. Скопіюйте Client ID та Client secret.
4. Supabase → Authentication → Providers → Google → увімкнути, вставити Client ID та secret. Якщо в Rivna app Google вже налаштований, цей крок уже зроблено.

## 5. Vercel
У корені репозиторію є `vercel.json` (`outputDirectory: web`). Закомітьте й запушіть зміни, і Vercel сам перезбере сайт. Якщо не використовуєте `vercel.json`, у налаштуваннях проєкту Vercel вкажіть Root Directory = `web`.

## Перевірка
- Відкрийте сайт: перший екран, реєстрація та кнопка «Увійти через Google».
- Увійдіть на комп'ютері, додайте продукт, відкрийте сайт на телефоні з тим самим акаунтом: продукт має з'явитися.


## 6. ШІ: розпізнавання чека з фото та рецепти
Працює через серверні функції Vercel у папці `api/`. Ключ ніколи не потрапляє в браузер.

**Безкоштовний варіант (Google Gemini).**
1. Відкрийте aistudio.google.com, увійдіть акаунтом Google, натисніть «Get API key» → «Create API key». Картка не потрібна.
2. Vercel → проєкт → Settings → Environment Variables → додайте для Production:
   - `GEMINI_API_KEY` — ключ із кроку 1
   - `SUPABASE_URL` — `https://XXXX.supabase.co` (як у `config.js`)
   - `SUPABASE_ANON_KEY` — anon public key (як у `config.js`)
   - `GEMINI_MODEL` — необов'язково, за замовчуванням `gemini-2.5-flash`
3. Deployments → три крапки біля останнього → Redeploy.

Безкоштовний ліміт має обмеження на кількість запитів на хвилину й на день; актуальні умови дивіться на ai.google.dev. Коли ліміт вичерпано, сайт покаже підказку спробувати пізніше. Google може використовувати дані з безкоштовного рівня для покращення продуктів, тому не фотографуйте чеки з особистими даними.

**Платний варіант (Anthropic).** Замість `GEMINI_API_KEY` додайте `ANTHROPIC_API_KEY` (і за бажанням `ANTHROPIC_MODEL`). Якщо задані обидва ключі, використовується Gemini.

Функції перевіряють, що користувач увійшов (токен Supabase), тож сторонні не зможуть витрачати ваш ліміт.

## 7. Застосунок на телефоні (PWA)
Сайт має `manifest.webmanifest`, іконки та `sw.js`. На Android у Chrome з'явиться кнопка «Встановити» вгорі; на iPhone: Safari → «Поділитися» → «На екран Додому».

## 8. Сповіщення про терміни
Профіль → «Сповіщати, коли продукти скоро псуються». Працює, поки застосунок відкритий або встановлений; серверних push-розсилок немає.

## 9. Штрихкод
Камера читає штрихкод у Chrome (Android, десктоп). У решті браузерів є ручне введення цифр. Назва береться з Open Food Facts, ціни й терміни вводите ви самі.

## Локальний запуск
Двічі клацніть `start-local.bat` у корені проєкту (потрібен Python або Node.js). Сайт відкриється на `http://localhost:3000`. Зміни у файлах видно після оновлення сторінки (Ctrl+F5).
Щоб працював вхід через Google, додайте `http://localhost:3000/**` у Supabase → Authentication → URL Configuration → Redirect URLs (Site URL не змінюйте). Вхід поштою та паролем працює без цього. ШІ-функції (`api/`) локально не працюють, лише на Vercel.

## iPhone
1. Відкрийте сайт у **Safari** (не в Chrome). Камера для скану чека й штрихкодів працює лише на https, тобто на Vercel, не на локальній адресі з IP.
2. Натисніть «Поділитися» → «На екран Додому». Так Ducky стає застосунком, а Safari не стирає дані через 7 днів без відвідин.
3. Увійдіть у **застосунку з екрана Додому**. Вхід у Safari та в застосунку окремі. Найнадійніше входити поштою й паролем; вхід через Google в застосунку з екрана Додому інколи повертає в Safari.
4. Сповіщення на iPhone працюють лише в застосунку з екрана Додому (iOS 16.4+) і лише поки він відкритий.
5. Штрихкод: у Safari використовується запасний сканер `web/vendor/zxing.js` (MIT), він вантажиться тільки при потребі.

## ШІ на власному комп'ютері (npm run dev)

`npm run dev` тепер сам обслуговує і `/api/...`, тож розпізнавання чека, рецепти від ШІ, імпорт рецепта і розбір списку працюють на localhost:3000.

1. У корені проєкту (де лежить `package.json`) скопіюйте файл `.env.local.example` і назвіть копію `.env.local`.
2. Відкрийте `.env.local` і після `GEMINI_API_KEY=` впишіть свій ключ з https://aistudio.google.com/apikey (без пробілів і лапок).
3. Зупиніть сервер (Ctrl+C) і запустіть знову: `npm run dev`. У вікні має бути рядок «ШІ: ключ Gemini знайдено».

Файл `.env.local` не потрапляє в git, ключ нікуди не передається. Supabase-налаштування беруться з `web/config.js`.
`start-local.bat` це не вміє, для ШІ запускайте саме `npm run dev`.
