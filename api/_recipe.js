'use strict';
// Розбір рецепта зі сторінки БЕЗ ШІ: JSON-LD (schema.org/Recipe), microdata, а якщо їх немає, прості евристики за заголовками.
const ENT = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', deg: '°', frac12: '½', frac14: '¼', frac34: '¾' };
const decode = (s) => String(s || '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z0-9]+);/gi, (m, n) => (ENT[n.toLowerCase()] !== undefined ? ENT[n.toLowerCase()] : m));
const stripTags = (h) => decode(String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').trim();
const oneLine = (s) => stripTags(s).replace(/\s+/g, ' ').trim();

// Інгредієнт «Фарш свинячий або яловичий - 125 г (1-2 шт.)» → «фарш свинячий або яловичий»
function ingName(raw) {
  let t = oneLine(raw);
  t = t.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  t = t.split(/\s[-–—:]\s|:\s|\s{2,}/)[0];
  t = t.replace(/\s*[,;].*$/, m => (/\d/.test(m) ? '' : m));
  t = t.replace(/\s*(\d|[½¼¾⅓⅔]).*$/, '');
  t = t.replace(/(?<![а-яіїєґ])(по\s+вкусу|по\s+смаку|за\s+смаком|щіпка|щепотка|пучок|для\s+(подачі|подачи|смаження|жарки))(?![а-яіїєґ]).*$/i, '');
  t = t.replace(/[\s,;:.–—-]+$/g, '').replace(/^[•*·\s-]+/, '').trim();
  return t.slice(0, 60);
}
// ---- переклад з російської словником (без ШІ): продукти, одиниці й типові дієслова кухні; невідоме лишається як є ----
const RU_UA = {
  // продукти
  'колбаски копчёные': 'ковбаски копчені', 'колбаски': 'ковбаски', 'колбаса': 'ковбаса', 'копчёные': 'копчені', 'копчёный': 'копчений', 'копченая': 'копчена', 'копчёная': 'копчена',
  'сыр плавленый': 'сир плавлений', 'сырки': 'сирки', 'сырок': 'сирок', 'сыр': 'сир', 'плавленый': 'плавлений', 'плавленые': 'плавлені', 'плавленых': 'плавлених',
  'картофель': 'картопля', 'картошка': 'картопля', 'картофеля': 'картоплі', 'рис': 'рис', 'морковь': 'морква', 'моркови': 'моркви', 'лук репчатый': 'цибуля ріпчаста', 'лук': 'цибуля', 'лука': 'цибулі',
  'чеснок': 'часник', 'чеснока': 'часнику', 'масло растительное': 'олія рослинна', 'масло сливочное': 'масло вершкове', 'масле': 'олії', 'масло': 'олія', 'соль': 'сіль', 'сахар': 'цукор', 'перец чёрный горошком': 'перець чорний горошком',
  'перец чёрный молотый': 'перець чорний мелений', 'перец чёрный': 'перець чорний', 'перец': 'перець', 'лавровый лист': 'лавровий лист', 'вода': 'вода', 'воды': 'води', 'воду': 'воду', 'горячей воды': 'гарячої води', 'горячая вода': 'гаряча вода',
  'зелень петрушки': 'зелень петрушки', 'петрушка': 'петрушка', 'укроп': 'кріп', 'сухарики': 'сухарики', 'мука': 'борошно', 'яйцо': 'яйце', 'яйца': 'яйця', 'молоко': 'молоко', 'сливки': 'вершки', 'сметана': 'сметана', 'творог': 'сир кисломолочний',
  'мясо': "м'ясо", 'фарш': 'фарш', 'свинина': 'свинина', 'говядина': 'яловичина', 'курица': 'курка', 'куриное филе': 'куряче філе', 'филе': 'філе', 'помидор': 'помідор', 'помидоры': 'помідори', 'томатная паста': 'томатна паста', 'огурец': 'огірок', 'капуста': 'капуста',
  'свёкла': 'буряк', 'свекла': 'буряк', 'болгарский перец': 'болгарський перець', 'грибы': 'гриби', 'шампиньоны': 'печериці', 'макароны': 'макарони', 'гречка': 'гречка', 'фасоль': 'квасоля', 'лимон': 'лимон', 'мёд': 'мед', 'уксус': 'оцет', 'сода': 'сода',
  'бульон': 'бульйон', 'кабачок': 'кабачок', 'баклажан': 'баклажан', 'зелень': 'зелень', 'орехи': 'горіхи', 'изюм': 'родзинки', 'колбасы': 'ковбаси', 'колбасками': 'ковбасками', 'колбасок': 'ковбасок', 'картофелем': 'картоплею', 'картофель нарезают': 'картоплю нарізаємо', 'морковью': 'морквою', 'луком': 'цибулею', 'рисом': 'рисом', 'сыром': 'сиром', 'сливками': 'вершками', 'маслом': 'олією', 'хлеб': 'хліб', 'ветчина': 'шинка', 'сосиски': 'сосиски', 'бекон': 'бекон',
  // одиниці й слова кількості
  'ст. ложки': 'ст. ложки', 'ст. ложка': 'ст. ложка', 'ч. ложки': 'ч. ложки', 'зубчика': 'зубчики', 'зубчик': 'зубчик', 'пучок': 'пучок', 'по вкусу': 'за смаком', 'для подачи': 'для подачі', 'для жарки': 'для смаження', 'щепотка': 'дрібка', 'штуки': 'шт', 'штук': 'шт',
  'маленький': 'маленький', 'небольшой': 'невеликий', 'с хорошей горкой': 'з гарною гіркою', 'по желанию': 'за бажанням',
  // кроки
  'подготавливают все необходимые продукты': 'Готуємо всі потрібні продукти', 'подготавливают': 'готуємо', 'подготовьте': 'підготуйте', 'очищают': 'очищаємо', 'нарезают': 'нарізаємо', 'нарезают': 'нарізаємо', 'нарезаем': 'нарізаємо', 'нарезать': 'нарізати',
  'маленькими кусочками': 'маленькими шматочками', 'небольшими кружочками': 'невеликими кружальцями', 'кусочками среднего размера': 'шматочками середнього розміру', 'кусочками': 'шматочками', 'кружочками': 'кружальцями', 'кубиками': 'кубиками', 'четвертинками': 'чвертьколами',
  'обжаривают': 'обсмажуємо', 'обжаривайте': 'обсмажуйте', 'обжарить': 'обсмажити', 'обжаренные': 'обсмажені', 'обжаренным': 'обсмаженим', 'жарят': 'смажимо', 'жарить': 'смажити', 'добавляют': 'додаємо', 'добавьте': 'додайте', 'добавляем': 'додаємо',
  'заливают': 'заливаємо', 'залейте': 'залийте', 'дают закипеть': 'доводимо до кипіння', 'закипания': 'закипання', 'после закипания': 'після закипання', 'варят': 'варимо', 'варить': 'варити', 'варите': 'варіть', 'солят': 'солимо', 'суп солят по вкусу': 'солимо суп за смаком',
  'натирают': 'натираємо', 'на крупной тёрке': 'на великій тертці', 'на крупной терке': 'на великій тертці', 'вынимают': 'виймаємо', 'вместе с рисом': 'разом із рисом', 'кладут': 'кладемо', 'помешивая': 'помішуючи', 'перемешивают': 'перемішуємо', 'перемешайте': 'перемішайте',
  'раскладывают по тарелкам': 'розкладаємо по тарілках', 'готовый суп': 'готовий суп', 'убирают с огня': 'знімаємо з вогню', 'в каждую': 'у кожну', 'нарезанную зелень': 'нарізану зелень', 'до полупрозрачности лука': 'до напівпрозорості цибулі', 'до подрумянивания': 'до підрумʼянювання',
  'на растительном масле': 'на олії', 'на среднем огне': 'на середньому вогні', 'на сильном огне': 'на сильному вогні', 'на медленном огне': 'на повільному вогні', 'затем': 'потім', 'ещё': 'ще', 'около': 'близько', 'минут': 'хвилин', 'минуты': 'хвилини', 'минуту': 'хвилину', 'пока': 'доки', 'не растворятся': 'не розчиняться', 'до готовности': 'до готовності',
  'и': 'і', 'с': 'з', 'со': 'зі', 'на': 'на', 'или': 'або', 'для': 'для', 'в': 'у', 'к': 'до', 'до': 'до', 'из': 'із', 'по': 'за', 'чеснок очищают': 'часник очищаємо', 'лук очищают': 'цибулю очищаємо', 'сковороду': 'сковорідку', 'сковороде': 'сковорідці', 'кастрюлю': 'каструлю', 'морковь нарезают': 'моркву нарізаємо',
  'картофель нарезают': 'картоплю нарізаємо', 'картофель': 'картопля', 'овощи': 'овочі', 'овощами': 'овочами', 'лавровый': 'лавровий', 'горошком': 'горошком', 'лист': 'лист', 'зелень': 'зелень', 'суп': 'суп', 'рис': 'рис', 'колбаски': 'ковбаски', 'сковорода': 'сковорідка', 'все': 'усі', 'необходимые': 'потрібні', 'продукты': 'продукти', 'этапы приготовления': 'кроки приготування', 'ингредиенты': 'інгредієнти',
};
const RU_KEYS = Object.keys(RU_UA).sort((a, b) => b.length - a.length);
const RU_RX = new RegExp('(?<![а-яіїєґёъыэ])(' + RU_KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![а-яіїєґёъыэ])', 'gi');
const looksRussian = (t) => /[ыэёъ]|(?<![а-яіїєґ])(и|или|для|с|со|это|при|как)(?![а-яіїєґ])|ющ|ают|яют/i.test(String(t)) && !/[іїєґ]/i.test(String(t));
function ruToUa(t, force) {
  const src = String(t == null ? '' : t);
  if (!force && !looksRussian(src)) return src;
  let out = src.replace(RU_RX, (m) => { const v = RU_UA[m.toLowerCase().replace(/ё/g, 'ё')] || RU_UA[m.toLowerCase()]; if (v == null) return m; return m[0] !== m[0].toLowerCase() ? v[0].toUpperCase() + v.slice(1) : v; });
  return out.replace(/ё/g, 'е').replace(/ы/g, 'и').replace(/э/g, 'е').replace(/ъ/g, '');
}
// ---- перерахунок на потрібну кількість порцій ----
const FR = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };
const numOf = (t) => (FR[t] != null ? FR[t] : Number(String(t).replace(',', '.')));
function niceNum(v) {
  if (v >= 20) return String(Math.round(v / 5) * 5);
  if (v >= 1) return String(Math.round(v * 2) / 2).replace('.', ',');
  return String(Math.max(0.5, Math.round(v * 2) / 2)).replace('.', ',');
}
const NUM = '(\\d+(?:[.,]\\d+)?|[½¼¾⅓⅔])';
// units: якщо після числа стоїть одиниця з переліку, число множиться; onlyMetric — лише г/кг/мл/л (для кроків, щоб не чіпати хвилини)
function scaleText(text, f, onlyMetric) {
  if (!f || Math.abs(f - 1) < 0.01) return text;
  const unit = onlyMetric ? '(кг|гр|г|мл|л)' : '(кг|гр|г|мл|л|шт|штук|ст|ч|зуб|гілоч|пучк|скибк|дольк|головк|стебл|листоч|лист)';
  const re = new RegExp('(?<![\\d.,])' + NUM + '(?:\\s*[-–]\\s*' + NUM + ')?(\\s*)' + unit + '(?![а-яіїєґ]{4,})', 'gi');
  return String(text).replace(re, (m, a, b, sp, u) => {
    let x = numOf(a) * f; let un = u;
    let out;
    if (b) { let y = numOf(b) * f; out = niceNum(x) + '-' + niceNum(y); } else out = niceNum(x);
    if (/^л$/i.test(un) && x < 1 && !b) { out = niceNum(x * 1000); un = 'мл'; }
    return out + (sp || ' ') + un;
  });
}
function ingLine(raw, f) {
  const name = ingName(raw);
  let t = oneLine(raw).replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  const parts = t.split(/\s[-–—:]\s|:\s/);
  const q = parts.length > 1 ? parts.slice(1).join(' ') : (/\d|[½¼¾⅓⅔]/.test(t) ? t.slice(name.length) : '');
  const qty = String(q).replace(/\s+/g, ' ').replace(/^[\s,;:.–—-]+|[\s,;:.–—-]+$/g, '');
  if (!name) return '';
  if (!/\d|[½¼¾⅓⅔]/.test(qty)) return name;
  return name + ' ' + scaleText(qty, f, false).slice(0, 40);
}
function minutesFrom(v) {
  if (v == null) return null;
  const s = String(v);
  let m = /^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(s);
  if (m && (m[1] || m[2])) return (Number(m[1] || 0) * 60 + Number(m[2] || 0)) || null;
  const h = /(\d+)\s*(?:год|час|ч(?![а-яіїєґ])|h)/i.exec(s); const mi = /(\d+)\s*(?:хв|мин|м(?![а-яіїєґ])|min)/i.exec(s);
  if (h || mi) return (Number(h ? h[1] : 0) * 60 + Number(mi ? mi[1] : 0)) || null;
  return /^\d+$/.test(s.trim()) ? Number(s) || null : null;
}
const servingsFrom = (v) => { const a = Array.isArray(v) ? v.join(' ') : String(v == null ? '' : v); const m = /(\d+)/.exec(a); return m ? Math.min(Number(m[1]), 48) : null; };
function techFrom(text) {
  const t = String(text || '').toLowerCase();
  if (/мультиварк|мультиварк/.test(t)) return 'Мультиварка';
  if (/хлібопічк|хлебопечк/.test(t)) return 'Хлібопічка';
  if (/духовк|запікат|запекат|випікат|выпекат/.test(t)) return 'Духовка';
  if (/сковород|каструл|кастрюл|варит|варити|смажит|жарит|плит/.test(t)) return 'Плита';
  return '';
}
function stepsFrom(v) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (typeof x === 'string') { for (const l of stripTags(x).split(/\n+/)) { const t = l.replace(/^\s*(\d+[.)]|шаг\s*\d+[.:]?|крок\s*\d+[.:]?)\s*/i, '').trim(); if (t) out.push(t); } return; }
    if (Array.isArray(x)) return x.forEach(walk);
    if (typeof x === 'object') { if (x.itemListElement) return walk(x.itemListElement); walk(x.text || x.name); }
  };
  walk(v);
  return out;
}
function findRecipeNode(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipeNode(n); if (r) return r; } return null; }
  const t = node['@type'];
  if ((Array.isArray(t) ? t : [t]).some((x) => /Recipe$/i.test(String(x || '')))) return node;
  if (node['@graph']) return findRecipeNode(node['@graph']);
  return null;
}
function fromJsonLd(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) {
    let j; try { j = JSON.parse(m[1].trim()); } catch (e) { try { j = JSON.parse(decode(m[1]).trim()); } catch (e2) { continue; } }
    const r = findRecipeNode(j); if (!r) continue;
    const ings = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : String(r.recipeIngredient || r.ingredients || '').split(/\n+/));
    return { title: oneLine(r.name), ings, steps: stepsFrom(r.recipeInstructions), minutes: minutesFrom(r.totalTime) || minutesFrom(r.cookTime) || minutesFrom(r.prepTime), servings: servingsFrom(r.recipeYield), via: 'json-ld' };
  }
  return null;
}
function propAll(html, names) {
  const out = []; const re = new RegExp('<(\\w+)[^>]*\\bitemprop=["\'](?:' + names + ')["\'][^>]*>([\\s\\S]*?)<\\/\\1>', 'gi'); let m;
  while ((m = re.exec(html))) out.push(m[0].includes('content=') && !m[2].trim() ? (/content=["']([^"']*)["']/i.exec(m[0]) || [])[1] || '' : m[2]);
  return out;
}
function metaProp(html, name) {
  const m = new RegExp('<[^>]*\\bitemprop=["\']' + name + '["\'][^>]*>', 'i').exec(html);
  if (!m) return null; const c = /(?:content|datetime)=["']([^"']*)["']/i.exec(m[0]); return c ? c[1] : null;
}
function fromMicrodata(html) {
  if (!/itemtype=["'][^"']*Recipe/i.test(html) && !/itemprop=["']recipeIngredient/i.test(html)) return null;
  const ings = propAll(html, 'recipeIngredient|ingredients');
  if (ings.length < 2) return null;
  const stepRaw = propAll(html, 'recipeInstructions');
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return { title: oneLine((propAll(html, 'name')[0]) || (h1 && h1[1]) || ''), ings, steps: stepsFrom(stepRaw),
    minutes: minutesFrom(metaProp(html, 'totalTime') || metaProp(html, 'cookTime')), servings: servingsFrom(metaProp(html, 'recipeYield') || (propAll(html, 'recipeYield')[0] || '')), via: 'microdata' };
}
// Евристика: список <li> під заголовком «Інгредієнти» і кроки під «Приготування»
function fromHeadings(html) {
  const clean = html.replace(/<(script|style|noscript|nav|header|footer)[\s\S]*?<\/\1>/gi, ' ');
  const sect = (re) => {
    const m = new RegExp('<h[1-4][^>]*>[^<]*(?:' + re + ')[^<]*<\\/h[1-4]>([\\s\\S]{0,6000}?)(?=<h[1-4]\\b|$)', 'i').exec(clean);
    return m ? m[1] : '';
  };
  const li = (h) => [...h.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => oneLine(x[1])).filter(Boolean);
  const ingHtml = sect('інгредієнт|ингредиент|склад|продукти|продукты');
  const stHtml = sect('приготуван|спосіб|способ|кроки|шаги|покроков|інструкц|инструкц');
  let ings = li(ingHtml); if (ings.length < 2) ings = stripTags(ingHtml).split(/\n+/).map((x) => x.trim()).filter((x) => x && x.length < 90);
  let steps = li(stHtml); if (!steps.length) steps = stepsFrom(stHtml);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(clean);
  if (ings.length < 2 || !steps.length || !h1) return null;
  return { title: oneLine(h1[1]), ings, steps, minutes: null, servings: null, via: 'headings' };
}
function finish(r, allText, target, lang) {
  if (!r) return null;
  const ru = lang === 'uk' && looksRussian([r.title].concat(r.ings, r.steps).join(' '));
  const UA = ru ? (x) => ruToUa(x, true) : (x) => x;
  r = { ...r, title: UA(r.title), ings: r.ings.map(UA), steps: r.steps.map(UA) };
  const T = Number(target) || 0;
  const f = T && r.servings ? T / r.servings : 1;
  const seen = new Set(); const ings = [];
  for (const i of r.ings) { const n = ingName(i); const k = n.toLowerCase(); if (n.length >= 2 && !seen.has(k)) { seen.add(k); ings.push(ingLine(i, f) || n); } }
  const steps = r.steps.map((s) => scaleText(s.replace(/\s+/g, ' ').trim().slice(0, 400), f, true)).filter(Boolean).slice(0, 30);
  const title = String(r.title || '').replace(/[<>]/g, '').replace(/\s*[|—–-]\s*[^|—–-]*(рецепт|russianfood|food|cook)[^|—–-]*$/i, '').trim().slice(0, 80);
  if (!title || ings.length < 2) return null;
  return { title, tech: techFrom(steps.join(' ') + ' ' + allText), minutes: r.minutes && r.minutes <= 900 ? r.minutes : null, servings: (f !== 1 ? T : r.servings) || null, ings: ings.slice(0, 40), steps, via: r.via, scaledFrom: f !== 1 ? r.servings : null };
}
function parseRecipeHtml(html, target, lang) {
  const h = String(html || '');
  const text = h.slice(0, 200000);
  return finish(fromJsonLd(h) || fromMicrodata(h) || fromHeadings(h), stripTags(text).slice(0, 6000), target, lang);
}
// Вставлений текст: «Назва / Інгредієнти: ... / Приготування: ...»
function parseRecipeText(text, target, lang) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/^[\s•*·-]+/, '').trim()).filter(Boolean);
  const isIng = (l) => /^(інгредієнти|ингредиенты|склад|продукти|продукты)\s*:?$/i.test(l);
  const isStep = (l) => /^((покроков\S*\s+|поетапн\S*\s+|этапы\s+|етапи\s+|порядок\s+|спосіб\s+|способ\s+)?(приготування|приготовления|приготовление)|як приготувати|как приготовить|кроки|шаги|инструкция|інструкція)\s*:?$/i.test(l);
  const a = lines.findIndex(isIng); const b = lines.findIndex(isStep);
  if (a < 0 || b < 0 || b <= a + 2) return null;
  const title = a > 0 ? lines[0] : '';
  const all = lines.join(' ');
  return finish({ title, ings: lines.slice(a + 1, b), steps: stepsFrom(lines.slice(b + 1).join('\n')), minutes: minutesFrom((/(\d+\s*(?:год|час|хв|мин)[а-яі.]*)/i.exec(all) || [])[1]), servings: servingsFrom((/(\d+)\s*порц/i.exec(all) || [])[1]), via: 'text' }, all, target, lang);
}
module.exports = { parseRecipeHtml, parseRecipeText, ingName, minutesFrom, ruToUa };
