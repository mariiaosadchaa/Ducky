'use strict';
// Розумний збіг продуктів «за змістом»: «курка» = «куряче філе» = «Куриное филе»; «м'ясо» знаходить свинину й курку.
// Працює без інтернету: словник понять (українська й російська) + категорії. Нічого не вигадує про ціни чи запаси.
(function () {
  const L = '(?<![а-яіїєґ])';   // початок слова (\b не працює з кирилицею)
  // [ключ, регулярний вираз за початком слова, категорія, виключення (ключі, які скасовують це поняття)]
  const C = [
    ['chicken', 'кур(а|и|у|ц|ин|яч|ят|к)|курк|кури|курча|бройлер|гомілк|голінк|крил|крыл|окороч', 'meat'],
    ['turkey', 'індик|індич|индейк|индюш', 'meat'],
    ['pork', 'свин|шийк|ошеек|шия$|карбонад|рулька|реберц', 'meat'],
    ['beef', 'яловичин|говяд|говядин|телятин|телятин|вирізк|антрекот', 'meat'],
    ['mince', 'фарш', 'meat'],
    ['sausage', 'ковбас|сосиск|сардельк|шинк|бекон|салямі|салями|сервелат|сало', 'meat'],
    ['meat', "м['’ʼ]?яс|мяс|птиц", 'meat'],
    ['fish', 'риб|рыб|лосос|сьомг|семг|форел|скумбр|оселед|сельд|тунец|тунц|минта|хек|короп|карп|тілапі|судак|окун|тріск|треск|дорадо|сибас', 'fish'],
    ['seafood', 'креветк|кальмар|мідії|мидии|краб|морепродукт', 'fish'],
    ['milk', 'молок|молоч(?![нк])', 'dairy', ['plantmilk']],
    ['plantmilk', '(банан|мигдал|миндал|соєв|соев|вівсян|овсян|кокос)\\S*\\s+молок', 'drink'],
    ['cream', 'вершк(и|ів|ам|ах|ами|у|ок)?(?![а-яіїєґ])|сливк|сливок', 'dairy'],
    ['sourcream', 'сметан', 'dairy'],
    ['kefir', 'кефір|кефир|ряжанк|простокваш|айран', 'dairy'],
    ['yogurt', 'йогурт|иогурт', 'dairy'],
    ['cottage', 'творог|твор(іг|ог)|кисломолоч', 'dairy'],
    ['butter', 'масл(о|а|у)(?![а-яіїєґ])|вершков', 'dairy', ['oil']],
    ['oil', 'олі|олив|соняшн|подсолн|рослинн|растительн|кукурудзян', ''],
    ['cheese', 'сир(?![а-яіїєґ])|сира(?![а-яіїєґ])|сиру|сири(?![а-яіїєґ])|сыр|пармез|моцар|гауд|чедд|бринз|фета|маскарп|рікот|рикот|едам|маасд|сулугун|плавлен', 'dairy', ['cottage']],
    ['egg', 'яйц|яєц|яйк', 'dairy'],
    ['bread', 'хліб|хлеб|батон|булк|багет|лаваш|тост', 'grain'],
    ['flour', 'борошн|мука|мук(?![а-яіїєґ])', 'grain'],
    ['buckwheat', 'греч', 'grain'],
    ['rice', 'рис(?![а-яіїєґ])|рису|рисов', 'grain'],
    ['oats', 'вівс|овс|геркулес', 'grain'],
    ['millet', 'пшон|пшен', 'grain'],
    ['semolina', 'манк', 'grain'],
    ['pasta', 'макарон|спагет|локшин|вермішел|вермишел|пенне|фузіл|лапш|паста(?![а-яіїєґ])', 'grain', ['tomatopaste']],
    ['gnocchi', 'ньок', 'grain'],
    ['potato', 'картопл|картошк|картофел', 'veg', ['fries']],
    ['fries', 'фрі(?![а-яіїєґ])|фри(?![а-яіїєґ])', ''],
    ['carrot', 'морк', 'veg'],
    ['onion', 'цибул|лук(?![а-яіїєґ])|лука|репчат', 'veg'],
    ['garlic', 'часник|чеснок', 'veg'],
    ['tomatopaste', 'томатн\\S*\\s+паст|кетчуп|томат\\S*\\s+соус', ''],
    ['tomato', 'помідор|помидор|томат', 'veg', ['tomatopaste']],
    ['cucumber', 'огірк|огурц', 'veg'],
    ['cabbage', 'капуст', 'veg'],
    ['beet', 'буряк|свекл|бурак', 'veg'],
    ['bellpepper', 'перець\\s+(солод|болгар)|перец\\s+(слад|болгар)|паприк', 'veg'],
    ['pepper', 'перець|перец', 'spice', ['bellpepper']],
    ['mushroom', 'гриб|шампіньйон|шампиньон|печериц|лисичк', 'veg'],
    ['zucchini', 'кабачк|цукіні|цуккини', 'veg'],
    ['eggplant', 'баклажан', 'veg'],
    ['greens', 'зелень|кріп|петрушк|укроп|базилік|базилик|кінз|кинз', 'veg'],
    ['lettuce', 'салат(?![а-яіїєґ]*\\s+олів)', 'veg'],
    ['apple', 'яблук|яблок', 'fruit'],
    ['banana', 'банан', 'fruit', ['plantmilk']],
    ['citrus', 'апельсин|мандарин|лимон|грейпфрут', 'fruit'],
    ['pear', 'груш', 'fruit'],
    ['berry', 'полуниц|клубник|малин|чорниц|черник|ягод|смородин|вишн|черешн', 'fruit'],
    ['grape', 'виноград', 'fruit'],
    ['salt', 'сіль|соль', 'spice'],
    ['sugar', 'цукор|сахар', 'sweet'],
    ['honey', 'мед(?![а-яіїєґ])|меду|мед\\s|варення|джем', 'sweet'],
    ['chocolate', 'шоколад|цукерк|конфет', 'sweet'],
    ['cookies', 'печиво|печенье|вафл|тістечк|торт', 'sweet'],
    ['coffee', 'кава|кофе|кави', 'drink'],
    ['tea', 'чай', 'drink'],
    ['juice', 'сік(?![а-яіїєґ])|соку|сок(?![а-яіїєґ])|лимонад', 'drink'],
    ['water', 'вода|воду|воды', 'drink'],
    ['nuts', 'горіх|орех|мигдал|миндал|фундук|арахіс|арахис|ізюм|изюм', ''],
    ['beans', 'квасол|фасол|сочевиц|чечевиц|нут(?![а-яіїєґ])|горошок|горох', 'grain'],
  ];
  const CATS = [
    ['meat', "м['’ʼ]?яс|мяс|птиц|м'ясн"], ['dairy', 'молочн|молочк'], ['veg', 'овоч|овощ'], ['fruit', 'фрукт|ягод'],
    ['grain', 'круп|бакалі|каш'], ['fish', 'риб|рыб|морепродукт'], ['drink', 'напо|напит'], ['sweet', 'солодощ|сладк|десерт'], ['spice', 'спеці|специ|приправ'],
  ].map(([k, re]) => [k, new RegExp(L + '(' + re + ')', 'i')]);
  const RX = C.map(([id, re, cat, not]) => ({ id, cat, not: not || [], re: new RegExp(L + '(' + re + ')', 'i') }));

  const clean = (s) => String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/ы/g, 'и').replace(/э/g, 'е').replace(/ъ/g, '')
    .replace(/[^a-zа-яіїєґ'’ʼ\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const memo = new Map();
  function concepts(name) {
    const s = clean(name); if (!s) return { ids: new Set(), cats: new Set() };
    if (memo.has(s)) return memo.get(s);
    const ids = new Set();
    for (const r of RX) if (r.re.test(s)) ids.add(r.id);
    for (const r of RX) if (ids.has(r.id)) for (const n of r.not) { if (ids.has(n)) ids.delete(r.id); }
    const cats = new Set();
    for (const r of RX) if (ids.has(r.id) && r.cat) cats.add(r.cat);
    for (const [k, re] of CATS) if (re.test(s)) cats.add(k);
    // «Плавлений сир» — це сир, а не «кисломолочне»; «сир кисломолочний» — це творог: cottage перемагає cheese
    if (ids.has('cottage')) ids.delete('cheese');
    const out = { ids, cats };
    if (memo.size > 3000) memo.clear();
    memo.set(s, out);
    return out;
  }
  const STOP = new Set(['для', 'без', 'або', 'зі', 'із', 'по', 'на', 'та', 'і', 'з', 'в', 'у']);
  const stems = (s) => clean(s).split(/[\s-]+/).filter((t) => t.length >= 3 && !STOP.has(t)).map((t) => t.slice(0, 5));
  // збіг: «що шукаємо» (інгредієнт, запит) проти назви продукту
  function foodMatch(query, name) {
    const q = concepts(query); const p = concepts(name);
    const cq = clean(query); const cn = clean(name);
    if (!cq || !cn) return false;
    if (cq === cn) return true;
    if (q.ids.size) {
      // усі названі поняття мають бути в продукті; «м'ясо» також збігається з будь-яким конкретним м'ясом
      return [...q.ids].every((id) => p.ids.has(id) || (id === 'meat' && p.cats.has('meat')));
    }
    if (q.cats.size) return [...q.cats].some((c) => p.cats.has(c));
    // невідоме слово: збіг за основами слів або підрядок (від 4 літер)
    const a = stems(query); const b = stems(name);
    if (a.length && a.every((x) => b.includes(x))) return true;
    return cq.length >= 4 && (cn.includes(cq) || (cn.length >= 4 && cq.includes(cn)));
  }
  window.foodMatch = foodMatch;
  window.foodConcepts = concepts;
  // пошук у списку продуктів: спершу за змістом, а також простий підрядок
  window.foodSearch = (query, list, get) => {
    const q = clean(query); if (!q) return list;
    return list.filter((x) => { const n = get ? get(x) : x; return foodMatch(query, n) || clean(n).includes(q); });
  };
})();
