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
Vercel → проєкт → Settings → Environment Variables. Додайте (для Production):
- `ANTHROPIC_API_KEY` — ключ з console.anthropic.com
- `SUPABASE_URL` — `https://XXXX.supabase.co` (той самий, що в `config.js`)
- `SUPABASE_ANON_KEY` — anon public key (той самий, що в `config.js`)
- `ANTHROPIC_MODEL` — необов'язково; за замовчуванням `claude-haiku-4-5-20251001`

Після додавання змінних: Deployments → три крапки біля останнього → Redeploy.
Функції перевіряють, що користувач увійшов (токен Supabase), тож сторонні не зможуть витрачати ваш ключ.

## 7. Застосунок на телефоні (PWA)
Сайт має `manifest.webmanifest`, іконки та `sw.js`. На Android у Chrome з'явиться кнопка «Встановити» вгорі; на iPhone: Safari → «Поділитися» → «На екран Додому».

## 8. Сповіщення про терміни
Профіль → «Сповіщати, коли продукти скоро псуються». Працює, поки застосунок відкритий або встановлений; серверних push-розсилок немає.

## 9. Штрихкод
Камера читає штрихкод у Chrome (Android, десктоп). У решті браузерів є ручне введення цифр. Назва береться з Open Food Facts, ціни й терміни вводите ви самі.
