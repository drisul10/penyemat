// Invented sample pages on example.com domains (AGENTS.md hard rule 1).
// Shared by the Chromium (Playwright) and Firefox (web-ext + Selenium BiDi) suites.

const page = (title, body) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>` +
  `<body><article><h1>${title}</h1>${body}</article></body></html>`;

const paragraphs = (...lines) => lines.map((line) => `<p>${line}</p>`).join('');

export const FIXTURES = {
  'https://recipes.example.com/lemon-pasta': {
    title: 'Lemon ricotta pasta in 20 minutes',
    html: page(
      'Lemon ricotta pasta in 20 minutes',
      paragraphs(
        'Bring a large pot of salted water to the boil and cook the pasta until it still has some bite.',
        'Stir the ricotta with olive oil and black pepper while the pasta cooks.',
        'Finish with lemon zest and a spoon of pasta water so the sauce clings to every piece.',
        'Serve at once with more pepper on top. This weeknight dinner takes twenty minutes.',
      ),
    ),
  },
  'https://bread.example.com/sourdough-starter': {
    title: "Beginner's guide to sourdough starter",
    html: page(
      "Beginner's guide to sourdough starter",
      paragraphs(
        'Feed the starter every day with equal weights of flour and water.',
        'A loaf with poppy seeds works once the starter is bubbling reliably.',
        'Keep the jar somewhere warm and mark the level with a rubber band.',
      ),
    ),
  },
  'https://travel.example.com/lisbon-walk': {
    title: 'Lisbon on foot: a three-day walking plan',
    html: page(
      'Lisbon on foot: a three-day walking plan',
      paragraphs(
        'Start in Alfama early, before the trams fill up, and climb to the castle.',
        'Day two crosses the river by ferry for the view back over the hills.',
        'Pack comfortable shoes because the cobbles are steep and slippery.',
      ),
    ),
  },
  'https://homes.example.com/river-flat': {
    title: 'Apartment listings near the river',
    html: page(
      'Apartment listings near the river',
      paragraphs(
        'Two bedrooms with a balcony facing the water, close to the market.',
        'The landlord asks for a deposit of one month and references.',
      ),
    ),
  },
};

export function fixtureFor(url) {
  const clean = url.split('#')[0].split('?')[0];
  return FIXTURES[clean] ?? null;
}
