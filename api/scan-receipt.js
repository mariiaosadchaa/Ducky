'use strict';
const { requireUser } = require('./_auth');
const { askClaude, parseJSON, str, num, isoDate, send } = require('./_claude');

const SYSTEM = 'Ти читаєш фото, скріншот або PDF касового чека з українського магазину. Поверни ЛИШЕ JSON без пояснень: '
  + '{"store":"назва магазину","date":"YYYY-MM-DD або null","items":[{"name":"назва товару","qty":"кількість/вага або порожньо","price":число}]}. '
  + 'Ціна — сума за позицію в гривнях. Нічого не вигадуй: якщо значення не видно, став null або порожній рядок. '
  + 'Не включай рядки «Разом», знижки, оплату, ПДВ.';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Лише POST.' });
  const a = await requireUser(req);
  if (a.error) return send(res, a.status, { error: a.error });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const image = String(body.image || '');
  const media = String(body.mediaType || 'image/jpeg');
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(media)) return send(res, 400, { error: 'Непідтримуваний формат. Підходить фото, скріншот або PDF.' });
  if (!image || image.length > 4_000_000 || !/^[A-Za-z0-9+/=]+$/.test(image)) return send(res, 400, { error: 'Фото відсутнє або завелике.' });
  try {
    const text = await askClaude({
      system: SYSTEM, maxTokens: 2500,
      content: [{ type: 'image', source: { type: 'base64', media_type: media, data: image } }, { type: 'text', text: 'Розпізнай чек.' }],
    });
    const j = parseJSON(text);
    if (!j || !Array.isArray(j.items)) return send(res, 422, { error: 'Не вдалося розпізнати чек. Спробуйте чіткіше фото.' });
    const items = j.items.slice(0, 80).map((i) => ({ name: str(i && i.name), qty: str(i && i.qty, 30), price: num(i && i.price) })).filter((i) => i.name);
    if (!items.length) return send(res, 422, { error: 'На фото не знайдено позицій.' });
    return send(res, 200, { store: str(j.store, 60), date: isoDate(j.date), items });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || 'Помилка сервера.' });
  }
};
