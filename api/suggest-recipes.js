'use strict';
const { requireUser } = require('./_auth');
const { askClaude, parseJSON, str, send } = require('./_claude');

const SYSTEM = 'Ти шеф-кухар для українського домогосподарства. Пропонуй прості рецепти переважно з наявних продуктів. '
  + 'Поверни ЛИШЕ JSON: {"recipes":[{"title":"назва","tech":"Мультиварка|Духовка|Хлібопічка|Плита|","minutes":число,"servings":число,"ings":["інгредієнт"],"steps":["крок"]}]}. '
  + 'Українською. Інгредієнти — короткі назви продуктів в однині чи як у магазині, без кількостей. '
  + 'Суворо дотримуйся алергій та заборонених продуктів. Використовуй лише техніку зі списку користувача (або плиту).';

const list = (v, n = 60, m = 40) => (Array.isArray(v) ? v.slice(0, m).map((x) => str(x, n)).filter(Boolean) : []);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Лише POST.' });
  const a = await requireUser(req);
  if (a.error) return send(res, a.status, { error: a.error });
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const pantry = list(b.pantry, 60, 80);
  if (!pantry.length) return send(res, 400, { error: 'Комора порожня: додайте продукти.' });
  const ctx = {
    pantry, expiring: list(b.expiring), appliances: list(b.appliances, 40, 10), allergies: list(b.allergies),
    avoid: list(b.avoid), likes: list(b.likes), diet: str(b.diet, 60), servings: Math.min(Math.max(Number(b.servings) || 2, 1), 12),
    count: Math.min(Math.max(Number(b.count) || 3, 1), 5),
  };
  try {
    const text = await askClaude({
      system: SYSTEM, maxTokens: 3000,
      content: 'Дані користувача: ' + JSON.stringify(ctx) + '\nЗапропонуй ' + ctx.count + ' різних рецептів. Спершу використай продукти, що скоро псуються.',
    });
    const j = parseJSON(text);
    if (!j || !Array.isArray(j.recipes)) return send(res, 422, { error: 'ШІ не зміг скласти рецепти. Спробуйте ще раз.' });
    const recipes = j.recipes.slice(0, ctx.count).map((r) => ({
      title: str(r && r.title, 80), tech: ['Мультиварка', 'Духовка', 'Хлібопічка', 'Плита'].includes(r && r.tech) ? r.tech : '',
      minutes: Math.min(Math.max(Math.round(Number(r && r.minutes)) || 0, 0), 600) || null,
      servings: Math.min(Math.max(Math.round(Number(r && r.servings)) || 0, 0), 24) || null,
      ings: list(r && r.ings, 60, 30), steps: list(r && r.steps, 300, 15),
    })).filter((r) => r.title && r.ings.length);
    if (!recipes.length) return send(res, 422, { error: 'ШІ не зміг скласти рецепти. Спробуйте ще раз.' });
    return send(res, 200, { recipes });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || 'Помилка сервера.' });
  }
};
